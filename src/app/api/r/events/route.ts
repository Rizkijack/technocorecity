import { NextResponse } from 'next/server'

// Edge runtime: no 10s function timeout (Hobby limit on Node), so the
// upstream long-poll `wait=10` can complete. Also cheaper to start.
export const runtime = 'edge'

const DEFAULT_BASE = 'https://technocore.chat'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE

function apiBase(): string {
  return API_BASE.replace(/\/$/, '')
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '600',
  }
}

/** Max upstream body size before we bail (1 MB). */
const MAX_BODY_BYTES = 1_000_000

/** Max `wait` parameter we'll forward upstream (seconds). */
const MAX_WAIT = 60

/** Clamp a Retry-After header to a sane range. */
function clampRetryAfter(raw: string | null): string | undefined {
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return undefined
  return String(Math.min(3600, n))
}

/**
 * CORS proxy for `GET /r/events?since=<n>&wait=<s>` — append-only log of new
 * public room creation.
 *
 * Validates `since` (non-negative integer) and `wait` (clamped to 0..60)
 * before forwarding upstream. Uses `AbortSignal.timeout` so the Edge worker
 * doesn't spin indefinitely on a stuck upstream, and derives a per-request
 * `AbortController` from `req.signal` so client disconnects cancel promptly.
 */
export async function GET(req: Request) {
  const upstream = new URL(`${apiBase()}/r/events`)
  const rawSince = new URL(req.url).searchParams.get('since')
  const rawWait = new URL(req.url).searchParams.get('wait')

  // Validate & clamp since to non-negative integer
  if (rawSince !== null) {
    const since = Number.parseInt(rawSince, 10)
    if (Number.isFinite(since) && since >= 0) {
      upstream.searchParams.set('since', String(since))
    }
  }

  // Validate & clamp wait to [0, 60]
  if (rawWait !== null) {
    const wait = Math.min(MAX_WAIT, Math.max(0, Number.parseInt(rawWait, 10) || 0))
    upstream.searchParams.set('wait', String(wait))
  }

  // Wire client disconnect → abort upstream fetch
  const controller = new AbortController()
  req.signal.addEventListener('abort', () => controller.abort())

  const timeout = AbortSignal.timeout(65_000) // slightly above MAX_WAIT + margin

  let res: Response
  try {
    res = await fetch(upstream.toString(), {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.any([controller.signal, timeout]),
    })
  } catch {
    if (controller.signal.aborted) {
      return new NextResponse(null, { status: 499, headers: corsHeaders() })
    }
    return new NextResponse('upstream fetch failed', {
      status: 502,
      headers: corsHeaders(),
    })
  }

  // Size guard — check Content-Length before buffering
  const cl = res.headers.get('content-length')
  if (cl && Number.parseInt(cl, 10) > MAX_BODY_BYTES) {
    return new NextResponse('upstream response too large', {
      status: 502,
      headers: corsHeaders(),
    })
  }

  const body = await res.text()
  if (body.length > MAX_BODY_BYTES) {
    return new NextResponse('upstream response too large', {
      status: 502,
      headers: corsHeaders(),
    })
  }

  // Hardcode Content-Type — don't trust upstream HTML (XSS vector).
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    ...corsHeaders(),
  }

  const retryAfter = clampRetryAfter(res.headers.get('retry-after'))
  if (retryAfter) headers['retry-after'] = retryAfter

  return new NextResponse(body, { status: res.status, headers })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
