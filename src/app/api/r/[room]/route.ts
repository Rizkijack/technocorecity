import { NextResponse } from 'next/server'

// Edge runtime: long-poll `wait=10` would hit the 10s Node-serverless
// timeout on Vercel Hobby. Edge has no such limit.
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

/** Max `wait` parameter we will forward upstream (seconds). */
const MAX_WAIT = 60

/** Valid room names: alphanumeric + underscore + hyphen, 1-64 chars. */
const VALID_ROOM_RE = /^[a-zA-Z0-9_-]{1,64}$/

/** Clamp a Retry-After header to a sane range. */
function clampRetryAfter(raw: string | null): string | undefined {
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return undefined
  return String(Math.min(3600, n))
}

/**
 * CORS proxy for `GET /r/<room>` and `GET /r/<room>?since=<n>&wait=<s>`.
 * Used as a fallback if technocore.chat tightens its CORS policy in the
 * future — see docs/06-api-integration.md section CORS.
 *
 * Validates room name against a strict regex, clamps `since` (non-negative)
 * and `wait` (0..60), wires client disconnect to abort upstream fetch, and
 * hardcodes Content-Type to prevent upstream HTML XSS.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const { room } = await params

  // Validate room name - reject whitespace, slashes, unicode, oversized names
  if (!room || !VALID_ROOM_RE.test(room)) {
    return new NextResponse('invalid room name', {
      status: 400,
      headers: corsHeaders(),
    })
  }

  const upstream = new URL(`${apiBase()}/r/${encodeURIComponent(room)}`)

  const rawSince = new URL(req.url).searchParams.get('since')
  const rawWait = new URL(req.url).searchParams.get('wait')

  // Validate and clamp since to non-negative integer
  if (rawSince !== null) {
    const since = Number.parseInt(rawSince, 10)
    if (Number.isFinite(since) && since >= 0) {
      upstream.searchParams.set('since', String(since))
    }
  }

  // Validate and clamp wait to [0, 60]
  if (rawWait !== null) {
    const wait = Math.min(MAX_WAIT, Math.max(0, Number.parseInt(rawWait, 10) || 0))
    upstream.searchParams.set('wait', String(wait))
  }

  // Wire client disconnect -> abort upstream fetch
  const controller = new AbortController()
  req.signal.addEventListener('abort', () => controller.abort())

  const timeout = AbortSignal.timeout(65_000)

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

  // Size guard - check Content-Length before buffering
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

  // Hardcode Content-Type - do not trust upstream HTML (XSS vector).
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
