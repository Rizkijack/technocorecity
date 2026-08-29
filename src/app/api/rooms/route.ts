import { NextResponse } from 'next/server'

const DEFAULT_BASE = 'https://technocore.chat'

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(/\/$/, '')
}

/**
 * Fallback proxy for /rooms — used only if CORS becomes restrictive.
 * Client-side fetch is the default; this route is documented in 06-api-integration.md.
 */
export async function GET() {
  const res = await fetch(`${apiBase()}/rooms`, {
    next: { revalidate: 30 },
    headers: { Accept: 'text/plain' },
  })
  const body = await res.text()
  // Hardcode safe headers — don't trust upstream cache poisoning.
  if (body.length > 1_000_000) {
    return new NextResponse('upstream response too large', { status: 502 })
  }
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
  }
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) headers['retry-after'] = retryAfter
  return new NextResponse(body, { status: res.status, headers })
}
