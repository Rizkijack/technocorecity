# ADR 0004: Agent Identifier Derivation — 16-Hex SHA-256 of DID Key

**Status:** Accepted
**Date:** 2026-08-28
**Deciders:** Project maintainer

## Context

technocore.chat agents teridentifikasi oleh `from` field di message line:
- **Signed writer**: `from = did:key:z6Mk...` (verified via Ed25519 signature).
- **Unsigned writer**: `from = ~nick` (self-asserted, anyone can claim any nick).

Untuk visualization di 3D scene, kita butuh:
- **Unique identifier** per agent (untuk deduplication, keying React, store mapping).
- **Display label** pendek (untuk 3D label, popover header, dll).
- **Stable** across re-fetch (tidak boleh random).
- **Privacy-aware** — boleh share, tapi tidak perlu leak info lebih dari yang sudah di server.

## Decision

**Untuk signed writer:**
- **Canonical key** = `fingerprint(didKey)` = 16 hex char pertama dari SHA-256(did:key string)
- **Display label** = sama: 16 hex fingerprint
- **Full DID** = disimpan di agent.didKey untuk popover "copy full"

**Untuk unsigned writer:**
- **Canonical key** = `"unsigned:" + nick`
- **Display label** = nick itu sendiri
- **Full DID** = `undefined`

## Rationale

### Why SHA-256 of did:key (sesuai spec server)

Dokumentasi resmi technocore.chat **eksplisit** menyebutkan:

> "Fingerprint = the first 16 lowercase hex characters of SHA-256(did:key string); new notes use `/kv/did-<first 2>/<remaining 14>`."

Server **sudah pakai** konvensi ini. Pakai hal yang sama = konsistensi dengan ekosistem. Bonus: notes disimpan di shard `did-<2>/<14>` di server, format yang sama membantu debugging.

### Why 16 hex (bukan 8 atau 32)

- **8 hex = 32 bit** = birthday collision di ~65k agents. Cukup untuk 1 view, tapi risky global.
- **16 hex = 64 bit** = birthday collision di ~4 billion. Aman untuk semua practical use case.
- **32 hex (full SHA-256)** = 128 bit, overkill, dan panjang untuk label visual.
- **16 char** = cukup pendek untuk label mono 10-11px, cukup panjang untuk uniqueness.

### Why not full DID as label

`did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK` = 56 char. Terlalu panjang untuk 3D label, akan wrap atau overflow. Plus visually noisy.

### Why not nick only (untuk unsigned)

- **Nick is not unique** — multiple agents bisa pakai nick sama.
- **Nick is forgeable** — siapa pun bisa tulis sebagai `~alice`.
- Untuk signed writer, kita PUNYA identifier unik (DID) — pakai itu.
- Untuk unsigned, nick adalah satu-satunya info yang kita punya — pakai itu, plus prefix `"unsigned:"` untuk canonical key agar tidak collision dengan signed agent yang somehow punya hash sama.

### Why not hash dari nick+room

- **Arbitrary** — tidak ada standar.
- **Breaks across rooms** — agent yang sama di room berbeda akan punya key berbeda (bad untuk tracking).
- **Server tidak pakai** — tidak align dengan protokol.

## Implementation

### Fingerprint Function

```typescript
// src/lib/technocore/fingerprint.ts

export async function fingerprint(didKey: string): Promise<string> {
  // Browser-native SubtleCrypto
  const data = new TextEncoder().encode(didKey)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  // First 8 bytes = 16 hex chars
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

**Note:** `subtle.digest` is async. Untuk batch processing saat initial load, paralel via `Promise.all`.

### Detection Signed vs Unsigned

```typescript
function isSignedWriter(from: string): boolean {
  // Server format: <did:key:...> for signed, ~nick for unsigned
  return from.startsWith('<') && from.endsWith('>')
}

function extractDidKey(from: string): string {
  // strip < >
  return from.slice(1, -1)
}

function extractNick(from: string): string {
  // strip ~
  return from.startsWith('~') ? from.slice(1) : from
}
```

### Agent Construction

```typescript
interface Agent {
  key: string          // canonical, untuk dedup
  displayName: string  // untuk label
  isSigned: boolean
  didKey?: string      // full DID untuk copy
  rooms: Set<string>
  messageCount: number
}

async function buildAgent(from: string, room: string): Promise<Agent> {
  if (isSignedWriter(from)) {
    const didKey = extractDidKey(from)
    const fp = await fingerprint(didKey)
    return {
      key: fp,
      displayName: fp,
      isSigned: true,
      didKey,
      rooms: new Set([room]),
      messageCount: 1,
    }
  } else {
    const nick = extractNick(from)
    return {
      key: `unsigned:${nick}`,
      displayName: nick,
      isSigned: false,
      rooms: new Set([room]),
      messageCount: 1,
    }
  }
}
```

### Aggregation Across Rooms

```typescript
async function aggregateAgents(
  messagesByRoom: Map<string, Message[]>
): Promise<Map<string, Agent>> {
  const agents = new Map<string, Agent>()
  
  for (const [room, messages] of messagesByRoom) {
    for (const msg of messages) {
      const agent = await buildAgent(msg.from, room)
      const existing = agents.get(agent.key)
      if (existing) {
        existing.rooms.add(room)
        existing.messageCount++
      } else {
        agents.set(agent.key, agent)
      }
    }
  }
  
  return agents
}
```

### Hook

```typescript
// useAgentDirectory.ts
export function useAgentDirectory() {
  const { data: roomMessages } = useRoomMessagesForAll()
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map())
  
  useEffect(() => {
    if (!roomMessages) return
    let cancelled = false
    aggregateAgents(roomMessages).then(result => {
      if (!cancelled) setAgents(result)
    })
    return () => { cancelled = true }
  }, [roomMessages])
  
  return agents
}
```

## Label Rendering

### 3D Scene

```tsx
<Html
  position={[x, y, z]}
  center
  distanceFactor={10}
  className="text-[10px] font-mono text-text-primary whitespace-nowrap"
>
  {agent.displayName}
</Html>
```

Untuk signed: 16 hex. Mono font.
Untuk unsigned: nick. Mono font (biar visually consistent).

### Popover

```tsx
<div>
  {agent.isSigned ? (
    <>
      <h3 className="font-mono">{agent.displayName}</h3>
      <p className="font-mono text-xs break-all">{agent.didKey}</p>
      <button onClick={() => copy(agent.didKey!)}>Copy DID</button>
    </>
  ) : (
    <>
      <h3 className="font-mono">{agent.displayName}</h3>
      <p className="text-xs text-text-muted">(self-asserted, not verified)</p>
    </>
  )}
</div>
```

## Alternatives Considered

### Use seq+room as identifier

- **Pros:** Unik per message.
- **Cons:** Bukan identifier per agent, tidak useful.
- **Rejected because:** Bukan representation agent.

### Use random UUID per fetch

- **Pros:** Pasti unique.
- **Cons:** Agents "berubah" tiap refresh — tidak stable, tidak bisa di-track, tidak bisa di-key.
- **Rejected because:** Breaks continuity.

### Use nick as key (regardless of signed)

- **Pros:** Simple.
- **Cons:** Collision, forgeable, no way to distinguish two "alice".
- **Rejected because:** Defeats purpose of having verified identity.

### Use full DID key as key (no hash)

- **Pros:** Lossless, no extra computation.
- **Cons:** Key panjang (56 char), perlu SHA anyway untuk short label.
- **Rejected because:** Pakai hash untuk key = efficient lookup & comparison.

### 8 hex (32 bit) instead of 16

- **Pros:** Lebih pendek.
- **Cons:** Birthday collision di ~65k.
- **Rejected because:** Tidak worth risk.

### Strip "did:key:" prefix before hash

- **Pros:** Marginal shorter input.
- **Cons:** Server specifies full did:key string,偏离 standar.
- **Rejected because:** Consistency with server documentation.

## Consequences

### Positive

- Aligns dengan server protocol (sesuai spec).
- Stable identifier across sessions.
- Privacy-preserving (no PII leak beyond what's in DID).
- Short enough for visual label.
- Unique enough untuk practical agent count.

### Negative

- SHA-256 adalah async (pakai `crypto.subtle`) — perlu paralel processing untuk batch.
- User awam tidak paham "apa itu fingerprint" — perlu UI hint (tooltips, legend).
- Hash collision theoretically possible (1 in 2^64) — tapi untuk visualization purposes, false positive tidak catastrophic.

### Neutral

- Browser support: `crypto.subtle` available di semua modern browser + Node 19+.
- Bundle size impact: zero (native API).

## Privacy Note

- DID key itu sendiri **sudah publik** (signed message di technocore.chat world-readable).
- Hash dari public key **tidak mengurangi** privacy (hash one-way, tapi input sudah public).
- Tidak ada PII bocor lebih dari yang server sudah expose.

## References

- [technocore.chat documentation](https://technocore.chat/) — fingerprint spec
- [W3C DID Key spec](https://w3c-ccg.github.io/did-method-key/)
- [MDN: SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
