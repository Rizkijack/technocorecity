import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { GET, OPTIONS } from '../route'

// No live technocore.chat calls: global fetch is stubbed for every test.
function mockUpstream(opts: {
  status?: number
  body?: string
  retryAfter?: string | null
  headers?: Record<string, string>
}): Response {
  const status = opts.status ?? 200
  const headersMap = new Map<string, string>()
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) headersMap.set(k.toLowerCase(), v)
  }
  if (opts.retryAfter !== undefined && opts.retryAfter !== null) {
    headersMap.set('retry-after', opts.retryAfter)
  }
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => opts.body ?? '',
    headers: { get: (k: string) => headersMap.get(k.toLowerCase()) ?? null },
  } as unknown as Response
}

const requestFor = (url = 'http://localhost/api/rooms'): Request => new Request(url)

describe('GET /api/rooms', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards the default limit=200 when no query param is given', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: 'rooms text' }))
    const res = await GET(requestFor())
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('rooms text')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://technocore.chat/rooms?limit=200',
      expect.objectContaining({
        headers: { Accept: 'text/plain' },
      }),
    )
  })

  it('forwards an explicit limit param', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: '' }))
    await GET(requestFor('http://localhost/api/rooms?limit=42'))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://technocore.chat/rooms?limit=42',
      expect.any(Object),
    )
  })

  it('clamps limit above 500 down to 500', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: '' }))
    await GET(requestFor('http://localhost/api/rooms?limit=1000'))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://technocore.chat/rooms?limit=500',
      expect.any(Object),
    )
  })

  it('clamps limit below 1 up to 1', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: '' }))
    await GET(requestFor('http://localhost/api/rooms?limit=0'))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://technocore.chat/rooms?limit=1',
      expect.any(Object),
    )
  })

  it('falls back to the default limit for a malformed param', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: '' }))
    await GET(requestFor('http://localhost/api/rooms?limit=abc'))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://technocore.chat/rooms?limit=200',
      expect.any(Object),
    )
  })

  it('rejects oversized upstream bodies with 502', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: 'x'.repeat(1_000_001) }))
    const res = await GET(requestFor())
    expect(res.status).toBe(502)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('keeps the cache-control proxy headers on success', async () => {
    fetchMock.mockResolvedValueOnce(mockUpstream({ body: '' }))
    const res = await GET(requestFor())
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=30')
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })

  it('passes the upstream retry-after header through', async () => {
    fetchMock.mockResolvedValueOnce(
      mockUpstream({ status: 429, body: 'slow down', retryAfter: '7' }),
    )
    const res = await GET(requestFor())
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('7')
  })
})

describe('OPTIONS /api/rooms', () => {
  it('answers CORS preflight with 204', async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Max-Age')).toBe('600')
  })
})
