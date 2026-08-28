# 08 — Performance & Caching

Target performa TechnocoreCity, strategi caching, dan teknik optimasi 3D.

## Performance Budget

### Frame Rate

| Scenario | Target FPS | Min FPS | Catatan |
|----------|-----------|---------|---------|
| Initial load (50 rooms, 0 agents) | 60 | 50 | Loading state, transisi smooth |
| Idle (50 rooms, 250 agents) | 60 | 45 | Ambient motion only |
| Active panel + 5 messages/sec streaming | 60 | 40 | New message animation |
| Heavy (200 rooms, 1000 agents) | 45 | 30 | Stress test scenario |

### Loading

| Metric | Target | Catatan |
|--------|--------|---------|
| First Contentful Paint | < 1.5s | Sky background + ground |
| Time to Interactive | < 3s | Canvas ready, click works |
| First Building Rendered | < 3s | Minimal 1 gedung visible |
| All Buildings Rendered | < 5s | 50 gedung semua visible |
| Bundle size (initial JS) | < 300KB gzipped | Three.js + R3F + Next.js shell |

### Memory

| Metric | Target |
|--------|--------|
| Heap (idle) | < 150MB |
| Heap (active panel) | < 200MB |
| GPU memory | < 250MB |

---

## Caching Strategy

### SWR Configuration

```typescript
// useRooms
useSWR(['rooms'], fetchRooms, {
  dedupingInterval: 5_000,        // 5s dedup
  revalidateOnFocus: true,        // refresh saat tab aktif
  revalidateOnReconnect: true,    // refresh saat online kembali
  refreshInterval: 0,             // no auto-refresh, manual via button
})

// useRoomMessages
useSWR(['room', room, since], fetchRoomMessages, {
  dedupingInterval: 0,            // no dedup, fresh tiap kali
  revalidateOnFocus: false,       // long-poll handles sendiri
  keepPreviousData: true,         // smooth transition saat ganti room
})
```

### Cache Keys

| Key | TTL | Refresh trigger |
|-----|-----|-----------------|
| `['rooms']` | indefinite until refresh | focus, manual button |
| `['room', name]` | 60s | long-poll on open |
| `['events']` | session | long-poll always |

### Long-Poll Lifecycle

```
[Panel Open]
  ├─ Initial fetch: GET /r/<room> (returns last 50)
  ├─ SWR cache populated
  ├─ Start long-poll loop:
  │    ├─ GET /r/<room>?since=<lastSeq>&wait=10
  │    ├─ On response (may be empty):
  │    │    ├─ Parse → if new messages → append to cache
  │    │    └─ Loop
  │    └─ On abort/error: pause/backoff
  └─ [Panel Close or unmount] → AbortController.abort()
```

### Tab Visibility

```typescript
// In useRoomMessages effect
useEffect(() => {
  if (!room) return
  const controller = new AbortController()
  const gate = createVisibilityGate()
  let lastSeq = 0
  let active = true

  const loop = async () => {
    while (active) {
      if (!gate.isOpen()) {
        await gate.waitOpen()
      }
      try {
        const text = await longPollRoom(room, lastSeq, controller.signal)
        if (text.trim()) {
          const msgs = parseRoomMessages(text)
          if (msgs.length > 0) {
            lastSeq = msgs[msgs.length - 1].seq
            mutate(prev => [...(prev ?? []), ...msgs])
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') break
        await sleep(2000)  // backoff
      }
    }
  }

  loop()

  return () => {
    active = false
    controller.abort()
  }
}, [room])
```

---

## 3D Optimizations

### Geometry Sharing

Satu `BoxGeometry` untuk semua agent point:

```typescript
// In geometry.ts
export const sharedAgentGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3)
export const sharedBuildingGeometry = (w, h, d) => new THREE.BoxGeometry(w, h, d)
```

Jangan instansiasi per-agent. Pakai shared reference.

### Material Sharing

Signed & unsigned punya 2 material shared:

```typescript
export const signedMaterial = new THREE.MeshBasicMaterial({
  color: 0x00d4ff,
  toneMapped: false,
})
export const unsignedMaterial = new THREE.MeshBasicMaterial({
  color: 0xe8eaf6,
  toneMapped: false,
})
```

### InstancedMesh (>100 agents)

Jika agent count > 100, pakai `<InstancedMesh>` dari R3F:

```typescript
function AgentCloud({ agents }: { agents: Agent[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!meshRef.current) return
    agents.forEach((agent, i) => {
      matrix.setPosition(agent.position.x, agent.position.y, agent.position.z)
      meshRef.current!.setMatrixAt(i, matrix)
      meshRef.current!.setColorAt(i, agent.isSigned ? signedColor : unsignedColor)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [agents])

  return (
    <instancedMesh ref={meshRef} args={[null, null, agents.length]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
```

Trade-off: kehilangan `<Html>` label per-agent di InstancedMesh. Solusi: pisahkan label ke layer terpisah (HTML overlay 2D yang diposisikan via project 3D coords).

### Text Labels

`<Text3D>` dari drei pakai font loader — berat. Untuk MVP, pakai `<Html>` dengan `transform` + `distanceFactor`:

```typescript
import { Html } from '@react-three/drei'

<Html
  position={[x, y, z]}
  center
  distanceFactor={10}
  occlude={false}
  className="text-[10px] font-mono text-text-primary whitespace-nowrap"
>
  {agent.displayName}
</Html>
```

`<Html>` lebih ringan, dan kita bisa pakai Tailwind untuk styling. Trade-off: tidak di-render oleh WebGL (jadi tidak bisa kena post-processing).

### Frustum Culling

R3F + three.js default-nya enable frustum culling. Jangan disable kecuali ada alasan.

### Pixel Ratio

```typescript
<Canvas dpr={[1, 2]} />
```

Cap di 2 untuk retina. Di 3+ tidak worth it.

### Shadow

MVP: **disable shadows** (hemat GPU). Jika diaktifkan, gunakan:

```typescript
<directionalLight
  castShadow
  shadow-mapSize-width={1024}
  shadow-mapSize-height={1024}
  shadow-camera-near={0.5}
  shadow-camera-far={50}
  shadow-camera-left={-30}
  shadow-camera-right={30}
  shadow-camera-top={30}
  shadow-camera-bottom={-30}
/>
```

Batasi shadow bounds ke area pusat saja (tidak cover seluruh world 200×200).

### Post-Processing

Bloom itu mahal. Jika FPS turun:

1. Disable bloom dulu.
2. Kurangi `dpr` ke max 1.5.
3. Disable tone mapping advanced.

---

## Network Optimizations

### Request Batching

Untuk `/r/<room>` per agent, kita perlu messages dari SEMUA room. Jika 50 room, itu 50 request. Solusi:

1. **Fetch rooms dulu**, lalu iteratif fetch messages dengan prioritas:
   - Top 10 room by `messageCount` → fetch duluan.
   - Sisanya → background fetch dengan delay 100ms antar request.
2. **Cancel-on-unmount** untuk semua request.

### Compression

Server side: `Content-Encoding: gzip` atau `br` (kalau server support). Browser auto-decode.

### Conditional GET

Server belum specify ETag support secara eksplisit. Skip untuk MVP.

---

## Memory Management

### Cleanup

Tiap `useEffect` yang mount subscription/timer **wajib** return cleanup function:

```typescript
useEffect(() => {
  const controller = new AbortController()
  // ... do stuff
  return () => controller.abort()
}, [deps])
```

### Avoid Memory Leaks Common

- ❌ Event listener tanpa `removeEventListener`
- ❌ `setInterval` tanpa `clearInterval`
- ❌ Material/geometry yang dibuat di render (buat di module scope atau `useMemo`)
- ❌ Cache yang tidak di-bound

### Monitoring

Di production, gunakan `performance.memory` (Chrome only) untuk monitoring heap:

```typescript
if ('memory' in performance) {
  setInterval(() => {
    const { usedJSHeapSize, totalJSHeapSize } = (performance as any).memory
    if (usedJSHeapSize > 200 * 1024 * 1024) {
      console.warn('Heap high:', usedJSHeapSize)
    }
  }, 10_000)
}
```

---

## Profiling

### DevTools

1. **Performance tab** — record 5 detik, identifikasi long task.
2. **Memory tab** — heap snapshot sebelum & sesudah interaction.
3. **React DevTools Profiler** — identify re-render yang tidak perlu.

### Tools

- `clinic.js` untuk Node-side (kalau ada server component).
- `why-did-you-render` untuk detect wasted re-render di dev.
- Chrome DevTools "Layers" tab untuk inspect GPU compositing.

### Optimization Workflow

1. **Measure first**: profile dalam kondisi representative.
2. **Identify bottleneck**: GPU? CPU? Memory? Network?
3. **Apply one fix**: ubah satu hal, ukur lagi.
4. **Compare**: before vs after, pastikan worth it.

---

## Stress Test Scenarios

### 1000 agents

- Switch ke InstancedMesh.
- HTML label di layer terpisah, cull kalau > 50 unit dari camera.
- Test: 30+ FPS, heap < 250MB.

### 200 rooms

- Layout algorithm harus handle 200 gedung tanpa overlap.
- Initial load: staggered, 10 gedung per 200ms (animated entry).
- Test: load selesai dalam 10s, no freeze.

### Heavy long-poll

- 3 panel terbuka simultan = 3 long-poll = 3 request aktif.
- Pasti handle dengan abort saat panel ditutup.
- Rate limit aware: jika 429, pause semua.

---

## Red Flags yang Harus Di-watch

- 🛑 FPS drop ke < 30 saat panel open → cek: list re-render? animation loop leak?
- 🛑 Heap naik terus tiap kali panel open → cek: messages di-append tanpa cleanup?
- 🛑 Network 429 muncul sering → cek: terlalu banyak long-poll concurrent? visibility gate aktif?
- 🛑 Initial load > 5s → cek: parallel fetch? code splitting?
- 🛑 GPU memory > 500MB → cek: material leak? geometry duplikat?
