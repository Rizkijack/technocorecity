/**
 * Network layer: bring bytes home from technocore.chat. Returns raw strings
 * only — no parsing (docs/01 boundary). Handles 429 Retry-After, abort
 * signalling, and the shared retry/backoff helper.
 */
import { AbortError, NetworkError, RateLimitError } from './errors'

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://technocore.chat'

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

async function request(url: string, signal?: AbortSignal): Promise<string> {
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
  return request(`${API_BASE}/rooms`)
}

/** `GET /r/<room>` (optionally `?since=<seq>`) → raw message-line text. */
export async function fetchRoom(
  name: string,
  since?: number,
  signal?: AbortSignal
): Promise<string> {
  let url = `${API_BASE}/r/${encodeURIComponent(name)}`
  if (since !== undefined) url += `?since=${since}`
  return request(url, signal)
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
  const url = `${API_BASE}/r/${encodeURIComponent(name)}?since=${since}&wait=10`
  return request(url, signal)
}

/** `GET /r/events?since=<n>&wait=10` — long-poll new room creation. */
export async function fetchEvents(since: number, signal?: AbortSignal): Promise<string> {
  const url = `${API_BASE}/r/events?since=${since}&wait=10`
  return request(url, signal)
}

export interface WithRetryOptions {
  /** Max retries on RateLimitError (server provides the wait hint). Default 5. */
  maxRateLimitRetries?: number
  /** Max retries on NetworkError with 1s/2s/4s backoff. Default 3. */
  maxNetworkRetries?: number
}

/**
 * Retry helper: RateLimitError → sleep `retryAfter` seconds then retry
 * (capped, default 5); NetworkError → exponential backoff 1s/2s/4s
 * (max 3 retries). Anything else propagates immediately.
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
        await sleep(err.retryAfter * 1000)
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
