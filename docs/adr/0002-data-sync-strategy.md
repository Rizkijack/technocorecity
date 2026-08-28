# ADR 0002: Data Sync Strategy — Client-Side Fetch + Long-Poll

**Status:** Accepted
**Date:** 2026-08-28
**Deciders:** Project maintainer

## Context

TechnocoreCity menampilkan data dari `https://technocore.chat/`. Server ini:
- **GET-only** untuk reads (POST juga ada untuk writes, tapi kita read-only).
- **HTTP-native** — semua operasi adalah plain GET, sengaja untuk fetchability dari agent.
- **Punya long-poll primitive** via `?wait=<seconds>`.
- **Tidak punya WebSocket, SSE, atau push notification**.
- **CORS-friendly** (desain eksplisit untuk "agent dengan fetch tool = full peer").

Kita butuh:
- Initial load: daftar semua room.
- Per-room: 50 pesan terakhir.
- Real-time: pesan baru muncul tanpa refresh.

## Decision

**Client-side fetch langsung dari browser ke technocore.chat, dengan long-poll `wait=10` untuk realtime updates.**

## Rationale

### Why client-side (bukan server-side proxy)

- **Zero backend** — tidak ada server function Next.js, tidak ada infra tambahan.
- **CORS harusnya OK** — server didesain untuk ini.
- **Latency minimal** — tidak ada hop tambahan.
- **No rate limit amplification** — request dari user IP, share budget dengan user manual browsing.

### Why long-poll (bukan polling cepat atau WebSocket)

- **Server primitive yang tersedia** — long-poll via `wait=10` adalah API resmi.
- **Hemat request** — 1 request = 10s wait, vs 10 request/detik untuk polling.
- **Latency perceived rendah** — saat event terjadi, response langsung kembali (≤ 1s biasanya).
- **Server-designed** — endpoint didesain untuk long-poll dengan bounded waiter slots.

### Why not Next.js API route as proxy

- Tambah latensi hop.
- Serverless function cold start.
- Rate limit budget kita sendiri (Vercel) jadi faktor tambahan.
- Tapi **disiapkan sebagai fallback** (`src/app/api/rooms/route.ts`) jika ternyata CORS ketat.

## Implementation

### Initial fetch

```typescript
const rooms = await fetch('https://technocore.chat/rooms').then(r => r.text())
const parsed = parseRooms(rooms)
```

### Per-room initial

```typescript
const msgs = await fetch(`https://technocore.chat/r/${room}`).then(r => r.text())
const parsed = parseRoomMessages(msgs)
```

### Long-poll loop

```typescript
while (panelOpen && !aborted) {
  const text = await fetch(
    `https://technocore.chat/r/${room}?since=${lastSeq}&wait=10`,
    { signal }
  ).then(r => r.text())
  
  if (text.trim()) {
    const newMsgs = parseRoomMessages(text)
    if (newMsgs.length) {
      lastSeq = newMsgs.at(-1)!.seq
      appendToCache(newMsgs)
    }
  }
  // empty after full wait = normal, loop
}
```

### Visibility-aware

- Pause saat `document.visibilityState !== 'visible'`.
- Lanjut saat visible.

### Error handling

- `429` → parse `Retry-After` dari body, sleep, retry.
- Network error → exponential backoff 1s, 2s, 4s.
- Abort → clean exit.

## Alternatives Considered

### Server-Sent Events (SSE) di atas Next.js API route

- **Pros:** Standard, browser native.
- **Cons:** technocore.chat tidak support SSE, harus proxy + translate.
- **Rejected because:** Butuh maintain proxy stateful, kompleks.

### WebSocket (custom)

- **Pros:** Real-time bidirectional.
- **Cons:** technocore.chat tidak punya WebSocket. Kita harus polling dan forward ke WS — pointless.
- **Rejected because:** Server tidak menyediakan primitive.

### Fast polling (setiap 1 detik)

- **Pros:** Simpler implementation.
- **Cons:** 10× lebih banyak request, hammer server, mudah kena rate limit.
- **Rejected because:** Server punya long-poll primitive yang lebih efisien.

### SWR auto-refresh

- **Pros:** Pakai tool yang sudah ada.
- **Cons:** Default `refreshInterval` minimum efektif 1s, tetap lebih boros dari long-poll.
- **Rejected for messages (keep for `/rooms`):** Untuk room list, refresh 5s acceptable. Untuk messages, long-poll lebih efisien.

### TanStack Query

- **Pros:** Lebih feature-rich dari SWR.
- **Cons:** Bundle lebih besar, overkill untuk use case ini.
- **Rejected because:** SWR cukup.

## Consequences

### Positive

- No backend, no infra cost beyond Vercel hosting.
- Real-time updates dengan latency perceived ~1-10s.
- Cache strategy simple (SWR + memory).
- Easy to debug (DevTools Network shows all requests).

### Negative

- Tergantung CORS technocore.chat tetap longgar. Jika mereka tighten CORS, kita perlu proxy.
- Long-poll bisa menggantung saat tab hidden (mitigasi: visibility gate).
- Rate limit budget share dengan user (acceptable, server designed for this).

### Neutral

- Tidak ada offline mode (sesuai non-goal).
- Tidak ada push notification (out of scope).

## Fallback: Next.js API Route

Jika CORS bermasalah, `src/app/api/rooms/route.ts`:

```typescript
export async function GET() {
  const res = await fetch('https://technocore.chat/rooms', {
    next: { revalidate: 30 }
  })
  return new Response(res.body, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
```

Lalu ganti `fetch('https://technocore.chat/...')` ke `fetch('/api/...')`. Implementasi abstracted di `src/lib/technocore/client.ts`, jadi perubahan 1 file.

## References

- [technocore.chat documentation](https://technocore.chat/) — long-poll pattern documented
- [MDN: Long polling](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#long_polling)
- [SWR docs](https://swr.vercel.app/)
