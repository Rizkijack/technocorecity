import { NextResponse } from 'next/server'

const DEFAULT_BASE = 'https://technocore.chat'

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(/\/$/, '')
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '600',
  }
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
    next: { revalidate: 30 },
    headers: { Accept: 'text/plain' },
  })
  const body = await res.text()
  // Hardcode safe headers — don't trust upstream cache poisoning.
  if (body.length > 1_000_000) {
    return new NextResponse('upstream response too large', {
      status: 502,
      headers: corsHeaders(),
    })
  }
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
    ...corsHeaders(),
  }
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) headers['retry-after'] = retryAfter
  return new NextResponse(body, { status: res.status, headers })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
