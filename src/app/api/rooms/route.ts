import { NextResponse } from 'next/server'

// Edge runtime: no 10s function timeout (Hobby limit on Node). The /rooms
// route benefits from Edge cold-start too.
export const runtime = 'edge'

const DEFAULT_BASE = 'https://technocore.chat'

// Misleading — NEXT_PUBLIC_ is for client-bundled env; this is server-only.
// Kept for backward compat with existing .env files.
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

/** Clamp a Retry-After header to a sane range. */
function clampRetryAfter(raw: string | null): string | undefined {
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return undefined
  return String(Math.min(3600, n))
}

/**
 * CORS proxy for `GET /rooms` — primary entry for the building list.
 * See docs/06-api-integration.md §CORS — direct cross-origin fetch is the
 * default, but if technocore.chat tightens its CORS policy, the same-origin
 * /api/rooms route transparently takes over via the auto-fallback in
 * `lib/technocore/client.ts`.
 *
 * Accepts `?limit=N` (clamped to 1..500, default 200) and forwards it to the
 * upstream so the city can intake up to the server's hard cap (200 rows)
 * instead of the default 50.
 */
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

export async function GET(request: Request) {
  const rawLimit = new URL(request.url).searchParams.get('limit')
  const parsedLimit = rawLimit === null ? Number.NaN : Number.parseInt(rawLimit, 10)
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
    : DEFAULT_LIMIT

  const res = await fetch(`${apiBase()}/rooms?limit=${limit}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(15_000),
  })

  // Size guard — buffer is needed for text proxy, so check Content-Length
  // first when available to avoid buffering a huge response.
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

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    ...corsHeaders(),
  }

  // Only cache on success — don't cache 5xx from upstream (amplifies outage).
  if (res.ok) {
    headers['Cache-Control'] = 'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
  } else {
    headers['Cache-Control'] = 'no-store'
  }

  const retryAfter = clampRetryAfter(res.headers.get('retry-after'))
  if (retryAfter) headers['retry-after'] = retryAfter

  return new NextResponse(body, { status: res.status, headers })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
