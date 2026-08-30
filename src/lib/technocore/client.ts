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

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://technocore.chat'

const sleep = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

/** Per-attempt cap for RateLimitError backoff: a bad Retry-After hint must not block us. */
const MAX_RATE_LIMIT_WAIT_MS = 60_000

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
    throw new RateLimitError(
      res.status,
      res.statusText || 'Too Many Requests',
      Number.isFinite(retryAfter) ? retryAfter : 0,
      'read'
    )
  }

  if (!res.ok) {
    throw new NetworkError(res.status, res.statusText || 'Request failed')
  }
  return res.text()
}

/** `GET /rooms` → raw markdown table text. */
export async function fetchRooms(): Promise<string> {
  return request(`${API_BASE}/rooms`, undefined, '/api/rooms')
}

/** `GET /r/<room>` (optionally `?since=<seq>`) → raw message-line text. */
export async function fetchRoom(
  name: string,
  since?: number,
  signal?: AbortSignal
): Promise<string> {
  if (since !== undefined && !Number.isFinite(since)) {
    throw new TypeError(`since must be finite number, got ${String(since)}`)
  }
  let url = `${API_BASE}/r/${encodeURIComponent(name)}`
  if (since !== undefined) url += `?since=${encodeURIComponent(String(since))}`
  return request(url, signal, `/api/r/${encodeURIComponent(name)}`)
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
  const url = `${API_BASE}/r/${encodeURIComponent(name)}?since=${encodeURIComponent(String(since))}&wait=10`
  return request(
    url,
    signal,
    `/api/r/${encodeURIComponent(name)}?since=${encodeURIComponent(String(since))}&wait=10`
  )
}

/** `GET /r/events?since=0&wait=10` — long-poll new room creation. */
export async function fetchEvents(since: number, signal?: AbortSignal): Promise<string> {
  if (!Number.isFinite(since)) throw new TypeError(`since must be finite`)
  const url = `${API_BASE}/r/events?since=${encodeURIComponent(String(since))}&wait=10`
  return request(
    url,
    signal,
    `/api/r/events?since=${encodeURIComponent(String(since))}&wait=10`
  )
}

export interface WithRetryOptions {
  /** Max retries on RateLimitError (server provides the wait hint). Default 5. */
  maxRateLimitRetries?: number
  /** Max retries on NetworkError with 1s/2s/4s backoff. Default 3. */
  maxNetworkRetries?: number
}

/**
 * Retry helper: RateLimitError → sleep `retryAfter` seconds (capped at 60s
 * per attempt; malformed/negative hints fall back to 1s) then retry
 * (default 5); NetworkError → exponential backoff 1s/2s/4s (max 3 retries).
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
        if (networkAttempts >= maxNetwork) throw err
        networkAttempts += 1
        await sleep(1000 * 2 ** (networkAttempts - 1)) // 1s, 2s, 4s
        continue
      }
      throw err
    }
  }
}
