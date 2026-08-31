import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  fetchRooms,
  fetchRoom,
  longPollRoom,
  fetchEvents,
  withRetry,
  API_BASE,
} from '../client'
import { NetworkError, RateLimitError, AbortError } from '../errors'

// helper to build a mock Response-like object
function mockResponse(opts: {
  ok?: boolean
  status?: number
  statusText?: string
  body?: string
  headers?: Record<string, string>
}): Response {
  const status = opts.status ?? 200
  const ok = opts.ok ?? (status >= 200 && status < 300)
  const body = opts.body ?? ''
  const headersMap = new Map<string, string>()
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      headersMap.set(k.toLowerCase(), v)
    }
  }
  return {
    ok,
    status,
    statusText: opts.statusText ?? (status === 200 ? 'OK' : 'Error'),
    headers: {
      get: (k: string) => headersMap.get(k.toLowerCase()) ?? null,
    } as unknown as Headers,
    text: async () => body,
  } as unknown as Response
}

describe('technocore client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('fetchRooms', () => {
    test('happy: returns text on 200 and defaults to limit=200', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'rooms text' }))
      const text = await fetchRooms()
      expect(text).toBe('rooms text')
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/rooms?limit=200`, {
        signal: undefined,
        cache: 'no-store',
        headers: { accept: 'text/plain' },
      })
    })

    test('forwards an explicit limit to the direct URL and the proxy fallback', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'direct' }))
      await fetchRooms(42)
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/rooms?limit=42`,
        expect.objectContaining({ cache: 'no-store' })
      )

      // browser-blocked direct fetch → proxy must carry the same limit
      const blocked = new TypeError('Failed to fetch')
      fetchMock.mockRejectedValueOnce(blocked)
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'proxied' }))
      const text = await fetchRooms(42)
      expect(text).toBe('proxied')
      expect(fetchMock).toHaveBeenLastCalledWith('/api/rooms?limit=42', expect.any(Object))
    })

    test('error: non-2xx throws NetworkError', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ status: 500, statusText: 'Server Error', ok: false })
      )
      await expect(fetchRooms()).rejects.toBeInstanceOf(NetworkError)
      await expect(fetchRooms()).rejects.toThrow() // second call? need mock again
    })

    // need fresh mock for second expectation? we already consumed once, so above double call fails.
    // Instead single assertion:
    test('error: 500 NetworkError properties', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ status: 500, statusText: 'Internal', ok: false, body: '' })
      )
      try {
        await fetchRooms()
        throw new Error('should not reach')
      } catch (e) {
        expect(e).toBeInstanceOf(NetworkError)
        expect((e as NetworkError).status).toBe(500)
        expect((e as NetworkError).statusText).toBe('Internal')
      }
    })

    test('429 header takes priority over body', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          status: 429,
          statusText: 'Too Many Requests',
          ok: false,
          body: 'retry in 99 seconds',
          headers: { 'retry-after': '5' },
        })
      )
      try {
        await fetchRooms()
        throw new Error('unreachable')
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError)
        expect((e as RateLimitError).retryAfter).toBe(5)
        expect((e as RateLimitError).bucket).toBe('read')
        expect((e as RateLimitError).status).toBe(429)
      }
    })

    test('429 body fallback when header missing', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          status: 429,
          ok: false,
          body: 'rate limited, retry after 12 seconds',
          headers: {},
        })
      )
      try {
        await fetchRooms()
        throw new Error('unreachable')
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError)
        expect((e as RateLimitError).retryAfter).toBe(12)
      }
    })

    test('429 body fallback picks first number', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          status: 429,
          ok: false,
          body: 'budget 2 of 10 reads left, wait 7s',
          headers: {},
        })
      )
      try {
        await fetchRooms()
        throw new Error('unreachable')
      } catch (e) {
        expect((e as RateLimitError).retryAfter).toBe(2) // first number in body
      }
    })

    test('429 invalid header and no number → retryAfter 0', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          status: 429,
          ok: false,
          body: 'no numbers here',
          headers: { 'retry-after': 'invalid' },
        })
      )
      try {
        await fetchRooms()
        throw new Error('unreachable')
      } catch (e) {
        expect((e as RateLimitError).retryAfter).toBe(0)
      }
    })

    test('429 with header NaN fallback to body', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          status: 429,
          ok: false,
          body: 'wait 8',
          headers: { 'retry-after': 'NaN' },
        })
      )
      try {
        await fetchRooms()
        throw new Error('unreachable')
      } catch (e) {
        expect((e as RateLimitError).retryAfter).toBe(8)
      }
    })

    test('NetworkError fallback statusText', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ status: 404, statusText: '', ok: false })
      )
      try {
        await fetchRooms()
        throw new Error('unreachable')
      } catch (e) {
        expect((e as NetworkError).statusText).toBe('Request failed')
      }
    })

    test('AbortError via signal.aborted even if fetch throws generic', async () => {
      const controller = new AbortController()
      controller.abort()
      // without signal, generic propagates
      const generic = new Error('network down')
      fetchMock.mockRejectedValueOnce(generic)
      await expect(fetchRooms()).rejects.toBe(generic)
      // now with aborted signal → AbortError
      fetchMock.mockRejectedValueOnce(new Error('network down'))
      await expect(fetchRoom('lobby', undefined, controller.signal)).rejects.toBeInstanceOf(
        AbortError
      )
    })

    test('AbortError via fetch throwing AbortError name', async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(err)
      await expect(fetchRoom('lobby')).rejects.toBeInstanceOf(AbortError)
    })

    test('AbortError via signal aborted flag', async () => {
      const controller = new AbortController()
      controller.abort()
      const err = new Error('anything')
      fetchMock.mockRejectedValueOnce(err)
      await expect(fetchRoom('test', undefined, controller.signal)).rejects.toBeInstanceOf(AbortError)
    })

    test('generic fetch throw propagates as is (not AbortError)', async () => {
      const err = new Error('ECONNREFUSED')
      fetchMock.mockRejectedValueOnce(err)
      await expect(fetchRooms()).rejects.toBe(err)
    })
  })

  describe('fetchRoom', () => {
    test('happy without since → no query', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'msg' }))
      const _t = await fetchRoom('my room')
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/r/${encodeURIComponent('my room')}`,
        expect.objectContaining({ cache: 'no-store' })
      )
    })

    test('with since appends query', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'x' }))
      await fetchRoom('lobby', 42)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/r/${encodeURIComponent('lobby')}?since=42`,
        expect.any(Object)
      )
    })

    test('since 0 is included', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: '' }))
      await fetchRoom('lobby', 0)
      expect(fetchMock.mock.calls[0]?.[0]).toContain('?since=0')
    })

    test('encodes special chars in name', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: '' }))
      await fetchRoom('a/b c?d')
      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toContain(encodeURIComponent('a/b c?d'))
    })

    test('passes signal through', async () => {
      const c = new AbortController()
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'ok' }))
      await fetchRoom('lobby', 5, c.signal)
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: c.signal }))
    })
  })

  describe('longPollRoom', () => {
    test('uses wait=10 and since', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'polled' }))
      const c = new AbortController()
      const t = await longPollRoom('lobby', 99, c.signal)
      expect(t).toBe('polled')
      const url = fetchMock.mock.calls[0]?.[0] as string
      expect(url).toBe(`/api/r/${encodeURIComponent('lobby')}?since=99&wait=10`)
    })
    test('longPoll abort propagates AbortError', async () => {
      const c = new AbortController()
      const err = new Error('abort')
      err.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(err)
      await expect(longPollRoom('lobby', 1, c.signal)).rejects.toBeInstanceOf(AbortError)
    })
  })

  describe('fetchEvents', () => {
    test('happy with since and wait=10', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: 'created lobby' }))
      const c = new AbortController()
      const t = await fetchEvents(5, c.signal)
      expect(t).toBe('created lobby')
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/r/events?since=5&wait=10`,
        expect.objectContaining({ signal: c.signal })
      )
    })

    test('without signal still works', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: '' }))
      const _t = await fetchEvents(0)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/r/events?since=0&wait=10`,
        expect.objectContaining({ signal: undefined })
      )
    })

    test('429 on fetchEvents → RateLimitError', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ status: 429, ok: false, body: 'wait 3', headers: {} })
      )
      await expect(fetchEvents(0)).rejects.toBeInstanceOf(RateLimitError)
    })
  })

  describe('withRetry', () => {
    test('happy: returns on first success', async () => {
      const fn = vi.fn().mockResolvedValueOnce('ok')
      const res = await withRetry(fn)
      expect(res).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('retries RateLimitError and succeeds', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError(429, 'Too Many', 1, 'read'))
        .mockResolvedValueOnce('after')
      const promise = withRetry(fn, { maxRateLimitRetries: 5 })
      // sleep 1000ms for retryAfter 1
      const run = promise
      // advance timers
      await vi.advanceTimersByTimeAsync(1000)
      const result = await run
      expect(result).toBe('after')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    test('retries RateLimitError with 0 delay still retries', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError(429, 'Too Many', 0, 'read'))
        .mockResolvedValueOnce('done')
      const promise = withRetry(fn)
      await vi.advanceTimersByTimeAsync(0)
      const result = await promise
      expect(result).toBe('done')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    test('exceeds maxRateLimitRetries throws', async () => {
      const fn = vi.fn().mockRejectedValue(new RateLimitError(429, 'Too Many', 1, 'read'))
      const promise = withRetry(fn, { maxRateLimitRetries: 2 })
      const chain = promise.catch(e => e)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(1000)
      const err = await chain
      expect(err).toBeInstanceOf(RateLimitError)
      expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries = 3 attempts, then throw on 3rd exceed
    })

    test('retries NetworkError with exponential backoff 1s then 2s', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError(500, 'fail'))
        .mockRejectedValueOnce(new NetworkError(500, 'fail'))
        .mockResolvedValueOnce('ok')
      const promise = withRetry(fn, { maxNetworkRetries: 3 })
      // first backoff 1000
      await vi.advanceTimersByTimeAsync(1000)
      // second backoff 2000
      await vi.advanceTimersByTimeAsync(2000)
      const result = await promise
      expect(result).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    test('NetworkError backoff 1s,2s,4s then success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError(500, 'a'))
        .mockRejectedValueOnce(new NetworkError(500, 'a'))
        .mockRejectedValueOnce(new NetworkError(500, 'a'))
        .mockResolvedValueOnce('final')
      const promise = withRetry(fn, { maxNetworkRetries: 5 })
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      const res = await promise
      expect(res).toBe('final')
      expect(fn).toHaveBeenCalledTimes(4)
    })

    test('exceeds maxNetworkRetries throws', async () => {
      const fn = vi.fn().mockRejectedValue(new NetworkError(503, 'down'))
      const promise = withRetry(fn, { maxNetworkRetries: 2 })
      const caught = promise.catch(e => e)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000) // extra not needed
      const err = await caught
      expect(err).toBeInstanceOf(NetworkError)
      expect(fn).toHaveBeenCalledTimes(3) // initial +2 retries =3
    })

    test('does not retry generic error', async () => {
      const generic = new Error('generic')
      const fn = vi.fn().mockRejectedValue(generic)
      await expect(withRetry(fn)).rejects.toBe(generic)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('does not retry ParseError', async () => {
      const { ParseError } = await import('../errors')
      const err = new ParseError('rooms', 'bad')
      const fn = vi.fn().mockRejectedValue(err)
      await expect(withRetry(fn)).rejects.toBe(err)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('AbortError is not retried (not NetworkError)', async () => {
      const err = new AbortError()
      const fn = vi.fn().mockRejectedValue(err)
      await expect(withRetry(fn)).rejects.toBe(err)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('RateLimitError uses retryAfter seconds *1000', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new RateLimitError(429, 'r', 2, 'read'))
        .mockResolvedValueOnce('ok')
      const promise = withRetry(fn)
      // should wait 2000
      expect(fn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1999)
      // still pending
      expect(fn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      const res = await promise
      expect(res).toBe('ok')
    })

    test('custom maxNetworkRetries 0 -> no retry', async () => {
      const fn = vi.fn().mockRejectedValue(new NetworkError(500, 'x'))
      await expect(withRetry(fn, { maxNetworkRetries: 0 })).rejects.toBeInstanceOf(NetworkError)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('custom maxRateLimitRetries 0 -> no retry', async () => {
      const fn = vi.fn().mockRejectedValue(new RateLimitError(429, 'r', 0, 'read'))
      await expect(withRetry(fn, { maxRateLimitRetries: 0 })).rejects.toBeInstanceOf(RateLimitError)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('RateLimitError retryAfter 86400 is clamped to 60s per attempt', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new RateLimitError(429, 'r', 86400, 'read'))
        .mockRejectedValueOnce(new RateLimitError(429, 'r', 86400, 'read'))
        .mockResolvedValueOnce('ok')
      const promise = withRetry(fn)
      expect(fn).toHaveBeenCalledTimes(1)
      // still pending after 59_999ms — would already have fired if the
      // unbounded 86400s hint were used
      await vi.advanceTimersByTimeAsync(59_999)
      expect(fn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fn).toHaveBeenCalledTimes(2)
      // second attempt is clamped the same way
      await vi.advanceTimersByTimeAsync(60_000)
      const res = await promise
      expect(res).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    test('RateLimitError retryAfter 2 sleeps 2000ms per attempt (unchanged)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new RateLimitError(429, 'r', 2, 'read'))
        .mockRejectedValueOnce(new RateLimitError(429, 'r', 2, 'read'))
        .mockResolvedValueOnce('ok')
      const promise = withRetry(fn)
      expect(fn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(2000)
      expect(fn).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(2000)
      const res = await promise
      expect(res).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    test('malformed retryAfter (NaN/negative) falls back to 1000ms', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new RateLimitError(429, 'r', Number.NaN, 'read'))
        .mockRejectedValueOnce(new RateLimitError(429, 'r', -5, 'read'))
        .mockResolvedValueOnce('ok')
      const promise = withRetry(fn)
      expect(fn).toHaveBeenCalledTimes(1)
      // NaN → 1000ms default (NaN in setTimeout would fire ~immediately)
      await vi.advanceTimersByTimeAsync(999)
      expect(fn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fn).toHaveBeenCalledTimes(2)
      // negative → 1000ms default
      await vi.advanceTimersByTimeAsync(999)
      expect(fn).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      const res = await promise
      expect(res).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })
})
