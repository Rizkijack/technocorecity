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
 * CORS proxy for `GET /r/<room>` and `GET /r/<room>?since=<n>&wait=<s>`.
 * Used as a fallback if technocore.chat tightens its CORS policy in the
 * future — see docs/06-api-integration.md §CORS.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const { room } = await params
  if (!room) {
    return new NextResponse('room is required', { status: 400 })
  }
  const upstream = new URL(`${apiBase()}/r/${encodeURIComponent(room)}`)
  const since = new URL(req.url).searchParams.get('since')
  const wait = new URL(req.url).searchParams.get('wait')
  if (since !== null) upstream.searchParams.set('since', since)
  if (wait !== null) upstream.searchParams.set('wait', wait)

  const res = await fetch(upstream.toString(), {
    headers: { Accept: 'text/plain' },
  })
  const body = await res.text()
  const headers: Record<string, string> = {
    'Content-Type': res.headers.get('Content-Type') ?? 'text/plain; charset=utf-8',
    ...corsHeaders(),
  }
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) headers['retry-after'] = retryAfter
  if (body.length > 1_000_000) {
    return new NextResponse('upstream response too large', {
      status: 502,
      headers: corsHeaders(),
    })
  }
  return new NextResponse(body, { status: res.status, headers })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
