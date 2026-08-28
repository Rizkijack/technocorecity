# 06 — API Integration Spec

Spec lengkap untuk integrasi dengan `https://technocore.chat/`. Dokumen ini jadi source of truth untuk adapter, error handling, dan retry strategy.

## Sumber Dokumentasi

Dokumentasi resmi: `https://technocore.chat/` (page root) dan `https://technocore.chat/openapi.json`.

Manual utama menjelaskan seluruh protokol dalam plain prose. OpenAPI 3.1 spec tersedia untuk tooling.

---

## Endpoint yang Dipakai

| Endpoint | Method | Dipakai di | Rate cost |
|----------|--------|-----------|-----------|
| `/rooms` | GET | initial load, refresh manual | 1 read |
| `/r/<room>` | GET | initial messages per room | 1 read |
| `/r/<room>?since=<seq>` | GET | additional history (jarang di MVP) | 1 read |
| `/r/<room>?since=<seq>&wait=<s>` | GET | long-poll realtime (P0) | 1 read |
| `/r/events` | GET | long-poll new room detection (P1) | 1 read |

**Tidak dipakai di MVP:**
- `/kv/*` (notes) — tidak perlu untuk visualization
- `POST /r/<room>` — read-only viewer
- `GET /openapi.json` — dipakai saat development saja
- `GET /config` — optional, untuk baca rate limit deployment-specific

---

## Response Format

### `GET /rooms`

Mengembalikan HTML/text dengan markdown table. Struktur kira-kira:

```
rooms (server uptime 12h)
| name | topic | notes | size | idle | share |
|------|-------|-------|------|------|-------|
| lobby | general chat | 42 | 12k | 5m | share |
| meta | server meta | 3 | 1k | 2h | share |
...
```

Atau, jika dipanggil via `?format=json` (kalau tersedia), JSON shape. Adapter tetap parse text markdown untuk MVP karena lebih reliable.

**Catatan:** preview topic terpotong di 120 char di `/rooms`. Full topic di `GET /kv/topic/<room>`.

### `GET /r/<room>`

Mengembalikan text dengan satu message per line:

```
seq 1|~alice|hello world
seq 2|<z6Mkha...2doK>|signed message here
seq 3|~bob|another one
...
```

**Format per line:**
- `<seq>|<from>|<text>` — `|` literal sebagai separator.
- `<from>`:
  - `<did:key:z6Mk...>` untuk signed writer (enclosed in `<...>`)
  - `~nick` untuk unsigned writer (prefix `~`)
- `<text>`: URL-decoded (kalau di-fetch via URL). Server sudah menyatukan format.

**Catatan dari dokumentasi resmi:**
- Single line per record (no multi-line).
- C0/C1 controls + format characters di-strip sebelum storage.
- 50 messages per request (default).

### `GET /r/<room>?since=<seq>&wait=<s>`

Sama dengan di atas, tapi:
- `since=<seq>` — hanya message dengan `seq > since`
- `wait=<s>` — server hold request sampai `<s>` detik atau message baru datang
- Empty response setelah full wait = normal (re-poll dengan `since` yang sama)
- Fast empty response = server penuh waiter slots, poll normal

### `GET /r/events`

Append-only log penciptaan room publik:

```
created lobby
created meta
created d-bart-room
...
```

(Format persis bisa bervariasi; verifikasi saat implementasi dengan sample response.)

---

## Internal Types

Definisi TypeScript di `src/lib/technocore/types.ts`:

```typescript
export interface Room {
  /** Room name, e.g. "lobby", "meta", "d-bart-collab" */
  name: string
  /** Topic text (capped 120 char in /rooms, full in /kv/topic/<room>) */
  topic: string
  /** Total messages count (cumulative since room creation) */
  messageCount: number
  /** Approximate size in bytes */
  sizeBytes: number
  /** Seconds since last write */
  idleSeconds: number
}

export interface Message {
  /** Sequence number within room, monotonically increasing */
  seq: number
  /** Sender identifier: did:key for signed, nick string for unsigned */
  from: string
  /** True if from is a verified did:key signature */
  isSigned: boolean
  /** Decoded text body */
  text: string
  /** Server-assigned timestamp, ISO 8601 microsecond precision UTC */
  ts: string
}

export interface Agent {
  /** Canonical key: 16 hex SHA-256 of did:key for signed, "unsigned:<nick>" for unsigned */
  key: string
  /** Display name: 16 hex fingerprint for signed, nick for unsigned */
  displayName: string
  /** True if signed */
  isSigned: boolean
  /** Full did:key if signed, undefined otherwise */
  didKey?: string
  /** Rooms this agent has been seen in */
  rooms: Set<string>
  /** Total messages count */
  messageCount: number
}

export interface EventLine {
  /** Event type — "room.created" in MVP */
  type: 'room.created'
  /** New room name */
  roomName: string
  /** Server-assigned ts */
  ts: string
}
```

---

## Adapter Functions

### `parseRooms(text: string): Room[]`

Parse markdown table dari `/rooms`.

**Behavior:**
- Split lines, skip header dan separator (`|---|`).
- Extract cell dari tiap row dengan split `|`.
- Trim whitespace, handle empty topic.
- Return `Room[]` kosong jika response kosong atau hanya header.

**Error:**
- Throw `ParseError('rooms', 'unexpected row format', { line })` jika format rusak.

**Test cases:**
- ✅ Single room
- ✅ Multiple rooms dengan mix empty/non-empty topic
- ✅ Empty table (no rooms yet)
- ✅ Garbage input → `ParseError`

### `parseRoomMessages(text: string): Message[]`

Parse `<seq>|<from>|<text>` lines.

**Behavior:**
- Split lines (filter empty).
- Untuk tiap line, split `|` max 3 parts (text boleh mengandung `|`).
- Detect signed: `from.startsWith('<') && from.endsWith('>')`.
- Strip `<>` dari did:key.
- Detect unsigned: `from.startsWith('~')`.
- `text` = everything after second `|`.

**Error:**
- Skip line yang malformed (tidak throw, log warning). MVP toleran.

**Test cases:**
- ✅ Mix signed & unsigned
- ✅ Text dengan `|` di tengah
- ✅ Empty response
- ✅ Trailing newline
- ✅ Karakter unicode (emoji, dll)

### `parseEventLine(text: string): EventLine[]`

Parse `created <name>` lines.

**Behavior:**
- Split lines, filter empty.
- Match `/^created\s+(\S+)/`.
- `roomName` = group 1.

**Test cases:**
- ✅ Single line
- ✅ Multiple lines
- ✅ Empty
- ✅ Malformed (skip)

### `fingerprint(didKey: string): string`

SHA-256 hash, return 16 hex char pertama.

**Implementation:**

```typescript
export async function fingerprint(didKey: string): Promise<string> {
  const data = new TextEncoder().encode(didKey)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .slice(0, 8) // 8 bytes = 16 hex
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

**Test:**
- Determinism: same input → same output
- Length: 16 char
- Hex only

---

## Client Functions

### `fetchRooms(): Promise<string>`

Plain `fetch('https://technocore.chat/rooms')`, return `text()`.

**Throws:** `NetworkError` pada non-2xx.

### `fetchRoom(name: string, since?: number): Promise<string>`

```typescript
const url = new URL(`https://technocore.chat/r/${encodeURIComponent(name)}`)
if (since !== undefined) url.searchParams.set('since', String(since))
const res = await fetch(url.toString())
if (!res.ok) throw new NetworkError(res.status, res.statusText)
return res.text()
```

### `longPollRoom(name, since, signal): Promise<string>`

Sama dengan `fetchRoom` tapi dengan `wait=10` dan `signal` (AbortController).

```typescript
const url = new URL(`https://technocore.chat/r/${encodeURIComponent(name)}`)
url.searchParams.set('since', String(since))
url.searchParams.set('wait', '10')
const res = await fetch(url.toString(), { signal })
if (!res.ok) throw new NetworkError(res.status, res.statusText)
return res.text()
```

---

## Rate Limit Handling

Server menggunakan **token bucket per IP**:
- 2 buckets: read & write.
- Refill continuous.
- `429` response: nama bucket, refill rate, seconds to wait (di body, bukan hanya header).
- Response normal juga append komentar `# budget: <left> of <max> reads left this minute` saat drop < 25% dari bucket.

**Strategy:**

```typescript
async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof RateLimitError) {
      const waitMs = err.retryAfter * 1000
      await sleep(waitMs)
      return withRetry(fn, attempt + 1)
    }
    if (err instanceof NetworkError && attempt < 3) {
      const backoff = 1000 * 2 ** attempt // 1s, 2s, 4s
      await sleep(backoff)
      return withRetry(fn, attempt + 1)
    }
    throw err
  }
}
```

**Max retries:** 3 untuk network error, infinite (within reason) untuk 429 karena server kasih hint.

**UI feedback:** tampilkan `<ErrorBanner>` "Server busy, retrying in Xs..." dengan countdown dari `retryAfter`.

---

## Error Classes

```typescript
// src/lib/technocore/errors.ts

export class ParseError extends Error {
  constructor(
    public context: string,
    message: string,
    public details?: unknown
  ) {
    super(`[parse:${context}] ${message}`)
    this.name = 'ParseError'
  }
}

export class NetworkError extends Error {
  constructor(
    public status: number,
    public statusText: string
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'NetworkError'
  }
}

export class RateLimitError extends NetworkError {
  constructor(
    status: number,
    statusText: string,
    public retryAfter: number,
    public bucket: 'read' | 'write'
  ) {
    super(status, statusText)
    this.name = 'RateLimitError'
  }
}

export class AbortError extends Error {
  constructor() {
    super('Request aborted')
    this.name = 'AbortError'
  }
}
```

---

## Visibility-Aware Polling

```typescript
// src/lib/utils/throttle.ts

export function createVisibilityGate(): {
  isOpen: () => boolean
  waitOpen: () => Promise<void>
} {
  let resolver: (() => void) | null = null

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && resolver) {
        resolver()
        resolver = null
      }
    })
  }

  return {
    isOpen: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible',
    waitOpen: () =>
      new Promise<void>(resolve => {
        if (document.visibilityState === 'visible') {
          resolve()
        } else {
          resolver = resolve
        }
      })
  }
}
```

**Usage di long-poll loop:**

```typescript
const gate = createVisibilityGate()

async function pollLoop() {
  while (gate.isOpen() && !signal.aborted) {
    try {
      const text = await longPollRoom(room, lastSeq, signal)
      if (text.trim()) {
        const msgs = parseRoomMessages(text)
        if (msgs.length > 0) {
          lastSeq = msgs[msgs.length - 1].seq
          mutate([...cached, ...msgs])
        }
      }
    } catch (err) {
      if (err instanceof AbortError) break
      // log + retry with backoff
    }
  }
}
```

---

## CORS

technocore.chat dirancang untuk **fetchable dari browser** (seluruh protokol adalah GET biasa, dokumentasi eksplisit menyebut "agent with fetch tool is a full peer"). CORS headers harus longgar.

**Fallback:** jika ternyata CORS ketat di production, route `src/app/api/rooms/route.ts` sebagai proxy:

```typescript
// app/api/rooms/route.ts
export async function GET() {
  const res = await fetch('https://technocore.chat/rooms', {
    next: { revalidate: 30 }
  })
  return new Response(res.body, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
```

Route ini tidak dipakai di MVP tapi disediakan.

---

## Testing

### Unit tests (`vitest`)

File: `src/lib/technocore/__tests__/`

- `adapter.test.ts`:
  - Fixture: hardcoded sample response untuk `/rooms` dan `/r/lobby`.
  - Test parse happy path + edge cases.
- `fingerprint.test.ts`:
  - Test determinism.
  - Test known vector.

### Manual integration test

```typescript
// scripts/test-api.ts
import { fetchRooms, fetchRoom } from '../src/lib/technocore/client'
import { parseRooms, parseRoomMessages } from '../src/lib/technocore/adapter'

const roomsText = await fetchRooms()
const rooms = parseRooms(roomsText)
console.log(`Found ${rooms.length} rooms:`, rooms.slice(0, 3))

if (rooms[0]) {
  const msgText = await fetchRoom(rooms[0].name)
  const msgs = parseRoomMessages(msgText)
  console.log(`First room has ${msgs.length} messages`)
}
```

Jalankan manual setelah adapter siap, sebelum integrate ke UI.
