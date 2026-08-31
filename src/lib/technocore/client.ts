/**
 * Network layer: bring bytes home from technocore.chat. Returns raw strings
 * only — no parsing (docs/01 boundary). Handles 429 Retry-After, abort
 * signalling, and the shared retry/backoff helper.
 *
 * When running on a deploy that ships the /api/* CORS proxy (Sevalla, Vercel,
 * any Node-runtime host), direct cross-origin fetches to technocore.chat
 * are tried first; if the browser blocks them with a CORS / network error
 * (TypeError: Failed to fetch), the call transparently falls back to the
 * same-origin /api/* proxy which forwards to technocore.chat and re-emits
 * permissive CORS headers.
 */
import { AbortError, NetworkError, RateLimitError } from './errors'
import { ROOMS_LIMIT } from './intake'

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://technocore.chat'

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Per-attempt cap for RateLimitError backoff: a bad Retry-After hint must not block us. */
const MAX_RATE_LIMIT_WAIT_MS = 60_000

/** Max sane Retry-After value we'll accept (seconds). */
const MAX_RETRY_AFTER_S = 3600

/**
 * Detect fetch errors that suggest the browser refused the request before it
 * left (CORS preflight rejected, network dropped, mixed-content block, etc.)
 * versus errors that come back from the upstream server (HTTP 4xx/5xx, which
 * produce a `Response` object — never a thrown TypeError here).
 */
function isNetworkBlocked(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return false
  // Chrome / Edge / Firefox all surface CORS-blocked cross-origin fetches as
  // a generic TypeError with this message; Safari uses a slightly different
  // phrasing. Anything that lands here means we never even reached the wire.
  if (err.name === 'TypeError' && /fetch/i.test(err.message)) return true
  return false
}

async function request(
  url: string,
  signal?: AbortSignal,
  proxyUrl?: string
): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: { accept: 'text/plain' },
    })
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      throw new AbortError()
    }
    if (proxyUrl && isNetworkBlocked(err)) {
      // Direct cross-origin fetch was refused by the browser. Retry through
      // the same-origin CORS proxy on this deploy.
      // eslint-disable-next-line no-console
      console.warn(
        '[technocore] direct fetch blocked, falling back to proxy',
        { from: url, to: proxyUrl, err: (err as Error).message },
      )
      return request(proxyUrl, signal, undefined)
    }
    // eslint-disable-next-line no-console
    console.error('[technocore] fetch failed', { url, err })
    throw err
  }

  if (res.status === 429) {
    const body = await res.text().catch(() => '')
    // Prefer the standard Retry-After header; fall back to a number in the body.
    let retryAfter = Number.NaN
    const header = res.headers.get('retry-after')
    if (header !== null) retryAfter = Number.parseInt(header, 10)
    if (!Number.isFinite(retryAfter)) {
      const m = /\d+/.exec(body)
      if (m) retryAfter = Number.parseInt(m[0], 10)
    }
    // Clamp to sane range — reject negative and absurdly large values
    const clamped = Number.isFinite(retryAfter) && retryAfter >= 0
      ? Math.min(MAX_RETRY_AFTER_S, retryAfter)
      : 0
    throw new RateLimitError(res.status, res.statusText || 'Too Many Requests', clamped, 'read')
  }

  if (!res.ok) {
    throw new NetworkError(res.status, res.statusText || 'Request failed')
  }
  return res.text()
}

/**
 * `GET /rooms?limit=N` → raw markdown table text. Defaults to `ROOMS_LIMIT`
 * (200, the upstream's single-request cap). The same limit is forwarded to
 * the same-origin CORS proxy fallback so both paths ingest the same amount.
 */
export async function fetchRooms(limit: number = ROOMS_LIMIT): Promise<string> {
  const query = `?limit=${limit}`
  return request(`${API_BASE}/rooms${query}`, undefined, `/api/rooms${query}`)
}

/**
 * `GET /r/<room>` (optionally `?since=<seq>`) → raw message-line text.
 * Routes through the same-origin proxy by default because technocore.chat
 * omits `Access-Control-Allow-Origin` on /r/* paths when degraded.
 * Also passes `proxyUrl` so the CORS-fallback logic in `request()` applies
 * when the upstream returns a network error on direct fetch.
 */
export async function fetchRoom(
  name: string,
  since?: number,
  signal?: AbortSignal
): Promise<string> {
  if (since !== undefined && !Number.isFinite(since)) {
    throw new TypeError(`since must be finite number, got ${String(since)}`)
  }
  const directPath = `/r/${encodeURIComponent(name)}`
  const proxyPath = `/api/r/${encodeURIComponent(name)}`
  let path = directPath
  if (since !== undefined) path += `?since=${encodeURIComponent(String(since))}`
  return request(`${API_BASE}${path}`, signal, proxyPath)
}

/**
 * `GET /r/<room>?since=<seq>&wait=10` — long-poll realtime updates.
 * Cancel via `signal` (AbortController); throws `AbortError` on cancel.
 */
export async function longPollRoom(
  name: string,
  since: number,
  signal: AbortSignal
): Promise<string> {
  if (!Number.isFinite(since)) throw new TypeError(`since must be finite`)
  const path = `/api/r/${encodeURIComponent(name)}?since=${encodeURIComponent(String(since))}&wait=10`
  return request(path, signal, undefined)
}

/** `GET /r/events?since=0&wait=10` — long-poll new room creation. */
export async function fetchEvents(since: number, signal?: AbortSignal): Promise<string> {
  if (!Number.isFinite(since)) throw new TypeError(`since must be finite`)
  const path = `/api/r/events?since=${encodeURIComponent(String(since))}&wait=10`
  return request(path, signal, undefined)
}

export interface WithRetryOptions {
  /** Max retries on RateLimitError (server provides the wait hint). Default 5. */
  maxRateLimitRetries?: number
  /** Max retries on 5xx/408/429 NetworkError with 1s/2s/4s backoff. Default 3. */
  maxNetworkRetries?: number
}

/** HTTP status codes that are safe to retry (transient server errors). */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])

/**
 * Retry helper: RateLimitError → sleep `retryAfter` seconds (capped at 60s
 * per attempt; malformed/negative hints fall back to 1s) then retry
 * (default 5); NetworkError → only retry on 5xx/408/429 with exponential
 * backoff 1s/2s/4s (max 3 retries). 4xx (except 408/429) propagate immediately.
 * Anything else propagates immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: WithRetryOptions = {}
): Promise<T> {
  const maxRateLimit = opts.maxRateLimitRetries ?? 5
  const maxNetwork = opts.maxNetworkRetries ?? 3
  let rateLimitAttempts = 0
  let networkAttempts = 0

  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof RateLimitError) {
        if (rateLimitAttempts >= maxRateLimit) throw err
        rateLimitAttempts += 1
        // Malformed/negative hints (NaN would poison setTimeout, negatives fire
        // immediately) fall back to 1s; the hint is clamped to 60s per attempt
        // so a buggy Retry-After can't block the request for hours.
        const retryAfterMs =
          Number.isFinite(err.retryAfter) && err.retryAfter >= 0
            ? err.retryAfter * 1000
            : 1000
        await sleep(Math.min(MAX_RATE_LIMIT_WAIT_MS, retryAfterMs))
        continue
      }
      if (err instanceof NetworkError) {
        // Only retry transient server errors — 4xx (except 408/429) are
        // permanent and retrying wastes time.
        if (!RETRYABLE_STATUSES.has(err.status)) throw err
        if (networkAttempts >= maxNetwork) throw err
        networkAttempts += 1
        await sleep(1000 * 2 ** (networkAttempts - 1)) // 1s, 2s, 4s
        continue
      }
      throw err
    }
  }
}
