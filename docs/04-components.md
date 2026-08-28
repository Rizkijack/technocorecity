# 04 — Komponen

Inventaris lengkap komponen TechnocoreCity: 3D scene, UI overlay, dan hooks. Tiap entry: lokasi file, props, state yang dibaca, event yang dipancarkan.

---

## A. 3D Scene Components

### `<World>`

**File:** `src/components/three/World.tsx`

Root scene. Mount sekali di `app/page.tsx`.

| Field | Detail |
|-------|--------|
| Props | — (root) |
| State reads | `worldStore.rooms` (via subscription) |
| State writes | — (delegasi ke child) |
| Children | `<Sky>`, `<Ground>`, `<CameraRig>`, list `<Building>`, list `<AgentPoint>`, post-processing |
| Mounts | `<Canvas>`, lights, `<OrbitControls>`, `<EffectComposer>` |

**Setup:**
- `gl={{ antialias: true, powerPreference: 'high-performance' }}`
- `camera={{ position: [0, 30, 50], fov: 50 }}`
- `dpr={[1, 2]}` untuk retina-friendly
- Background color via `<color attach="background" args={['#0a0e27']} />`
- Fog: `<fog attach="fog" args={['#0a0e27', 30, 120]} />`

---

### `<Ground>`

**File:** `src/components/three/Ground.tsx`

Plane horizontal dengan grid subtle.

| Field | Detail |
|-------|--------|
| Props | `size?: number = 200` |
| State reads | — |
| State writes | — |
| Material | MeshStandardMaterial, `color: #0f1535`, `roughness: 0.8` |
| Grid | Custom shader atau `<gridHelper>` dari drei |

---

### `<Sky>`

**File:** `src/components/three/Sky.tsx`

Background gradient.

| Field | Detail |
|-------|--------|
| Props | — |
| State reads | — |
| State writes | — |
| Implementasi | `<color attach="background">` + vertex-shader sky dari drei `<Sky>` opsional |

---

### `<Building>`

**File:** `src/components/three/Building.tsx`

Satu gedung, merepresentasikan satu room.

```typescript
interface BuildingProps {
  room: Room
  position: [number, number, number]  // [x, y, z]
  index: number                       // untuk debug/keys
}
```

| Field | Detail |
|-------|--------|
| State reads | `worldStore.selectedRoomId` (untuk highlight) |
| State writes | `selectRoom(room.name)` on click |
| Children | `<mesh>` (box), `<Text3D>` (nama), `<pointLight>` (glow) |
| Geometry | `BoxGeometry(w, h, d)` — w/h/d derived dari room props |
| Material | MeshStandardMaterial dengan `emissive` proporsi message count |
| Label | `<Text3D>` dari drei, font dari `drei/RoomEnvironment` atau local font |
| Onclick | `() => worldStore.getState().selectRoom(room.name)` |
| Highlight | `selectedRoomId === room.name` → emissive intensity × 2, slow rotation |

**Scale rules:**
- `height = clamp(log10(messageCount + 1) * 4, 3, 30)`
- `width = 4 + min(topicLength / 8, 4)`
- `depth = 4`

---

### `<AgentPoint>`

**File:** `src/components/three/AgentPoint.tsx`

Satu titik/kotak kecil yang merepresentasikan satu agent.

```typescript
interface AgentPointProps {
  agent: Agent
  roomPosition: [number, number, number]  // posisi gedung room-nya
  offsetSeed: number                       // untuk deterministic offset
}
```

| Field | Detail |
|-------|--------|
| State reads | `worldStore.selectedAgentKey` |
| State writes | `selectAgent(agent.key)` on click |
| Geometry | `BoxGeometry(0.3, 0.3, 0.3)` atau `SphereGeometry(0.15)` |
| Material | MeshBasicMaterial warna sesuai `agent.signed` |
| Color | signed = `#00d4ff` (cyan glow), unsigned = `#ffffff` |
| Label | `<Html>` dari drei dengan `transform`, `distanceFactor` — menampilkan 16 hex atau nick |
| Onclick | `() => worldStore.getState().selectAgent(agent.key)` |
| Animation | `useFrame` → gentle bob (sin wave) |

**Offset calculation:**
- `offset = (seed % 8) * 0.4` di sumbu X dan Z relatif ke roomPosition
- Y = baseHeight gedung + 1 + small bob

---

### `<CameraRig>`

**File:** `src/components/three/CameraRig.tsx`

Kontrol kamera + fly-to animation saat selection berubah.

| Field | Detail |
|-------|--------|
| State reads | `worldStore.selectedRoomId` (subscribe) |
| State writes | — (langsung animate camera) |
| Children | `<OrbitControls>` dari drei |
| Animation | Tween position ke `[room.x, 15, room.z + 15]` dengan duration 1200ms ease-in-out |
| LookAt | `useFrame` lerp lookAt target ke gedung |

**Idle behavior:**
- Saat tidak ada selection: orbit bebas dengan auto-rotate slow (0.2 deg/sec).
- Saat selection ada: disable auto-rotate, allow user orbit terbatas.

---

### `<RaycasterLayer>`

**File:** `src/components/three/RaycasterLayer.tsx`

Wrapper untuk memastikan click di scene terdeteksi dengan benar, terutama saat ada transparent overlay HTML.

| Field | Detail |
|-------|--------|
| Props | `children: ReactNode` |
| State reads | — |
| State writes | — |
| Behavior | Listen ke `onClick` di Canvas, dispatch ke handler ter-register |

(Catatan: sering kali tidak perlu sebagai komponen terpisah karena R3F sudah handle raycasting. Dokumentasikan sebagai pattern.)

---

## B. UI Overlay Components

### `<Hud>`

**File:** `src/components/ui/Hud.tsx`

Top bar dengan logo, title, dan global controls.

```typescript
interface HudProps {}
```

| Field | Detail |
|-------|--------|
| State reads | — |
| State writes | — |
| Layout | `fixed top-0 left-0 right-0 z-30` |
| Children | Logo + "TechnocoreCity" + connection status indicator |

---

### `<RoomPanel>`

**File:** `src/components/ui/RoomPanel.tsx`

Slide-in panel dari kanan, menampilkan detail room.

```typescript
interface RoomPanelProps {}
```

| Field | Detail |
|-------|--------|
| State reads | `worldStore.selectedRoomId` |
| State writes | `selectRoom(null)` (close) |
| Data | `useRoomMessages(selectedRoomId)` |
| Layout | `fixed top-0 right-0 h-full w-[400px] z-20` |
| Animation | Slide dari `x: 100%` ke `x: 0` via `framer-motion` |
| Sections | Header (name + close), topic (subtitle), messages list, footer link |

**Header:**
- Nama room (bold, large)
- Tombol close (X icon)

**Topic:**
- Subtitle, gray-400
- Truncate 120 char sesuai `/rooms` preview

**Messages list:**
- Scrollable, max-height = viewport - header - footer
- `useRoomMessages` returns `{ messages, isLoading, error }`
- Empty state: "No messages yet"
- New message: fade-in top dengan highlight 1 detik

**Footer:**
- "View on technocore.chat" link → `https://technocore.chat/r/<room>` (target=_blank)

---

### `<AgentPopover>`

**File:** `src/components/ui/AgentPopover.tsx`

Popover kecil saat agent point di-click.

```typescript
interface AgentPopoverProps {
  screenPosition: { x: number; y: number }  // dari R3F click event
}
```

| Field | Detail |
|-------|--------|
| State reads | `worldStore.selectedAgentKey` |
| State writes | `selectAgent(null)` (close) |
| Layout | Absolute, position by screenPosition |
| Animation | Fade + scale dari 0.95 → 1 |

**Content:**
- Header: 16 hex fingerprint (mono font) untuk signed, atau nick untuk unsigned
- Body:
  - Signed: full DID key (mono, smaller, copy button)
  - Unsigned: "(self-asserted, not verified)"
  - Message count: "X messages in this room"
- Footer: "Copy identifier" button

---

### `<LoadingVeil>`

**File:** `src/components/ui/LoadingVeil.tsx`

Full-screen loader untuk initial fetch.

```typescript
interface LoadingVeilProps {
  progress?: { loaded: number; total?: number }  // dari useRooms
}
```

| Field | Detail |
|-------|--------|
| State reads | — (dari prop) |
| State writes | — |
| Layout | Full-screen, semi-transparent backdrop |
| Content | Centered spinner + "Loading TechnocoreCity..." + optional progress |
| Animation | Fade out saat prop.isVisible false |

---

### `<ErrorBanner>`

**File:** `src/components/ui/ErrorBanner.tsx`

Top banner untuk network/parse error.

```typescript
interface ErrorBannerProps {
  error: Error
  onRetry?: () => void
  onDismiss?: () => void
}
```

| Field | Detail |
|-------|--------|
| State reads | — |
| State writes | — (controlled by parent) |
| Layout | Fixed top, full-width, z-40 |
| Variants | Error (red), Warning (amber), Info (blue) |
| Auto-dismiss | Info: 5s, Warning: 10s, Error: manual |

---

### `<Legend>`

**File:** `src/components/ui/Legend.tsx`

Bottom-left card yang menjelaskan visual key.

| Field | Detail |
|-------|--------|
| State reads | `uiStore.legendCollapsed` |
| State writes | toggle `legendCollapsed` |
| Content | • Gedung = room • Cyan = signed agent • White = unsigned • Click = inspect |

---

### `<MessageItem>`

**File:** `src/components/ui/MessageItem.tsx`

Satu baris di message list panel.

```typescript
interface MessageItemProps {
  message: Message
  isNew?: boolean  // trigger animation
}
```

| Field | Detail |
|-------|--------|
| State reads | — |
| State writes | — |
| Layout | Flex row: avatar | content (sender + text + time) |
| Avatar | Circle 32px, bg = hashToColor(sender), text = 4 char initial/hex |
| Sender | Mono font, signed = cyan, unsigned = white |
| Text | Wrap, max 8 lines (overflow fade) |
| Time | `formatRelativeTime(ts)`, right-aligned, gray-500 |
| Animation | `isNew` → bg highlight 1s ease-out |

---

## C. Hooks

### `useRooms()`

**File:** `src/hooks/useRooms.ts`

```typescript
function useRooms(): {
  rooms: Room[] | undefined
  isLoading: boolean
  error: Error | undefined
  refresh: () => void
}
```

- SWR dengan key `['rooms']`
- `fetcher: fetchRooms`
- `refreshInterval: 0` (manual only)
- `revalidateOnFocus: true`
- Dedup 5s

### `useRoomMessages(room: string | null)`

**File:** `src/hooks/useRoomMessages.ts`

```typescript
function useRoomMessages(room: string | null): {
  messages: Message[]
  isLoading: boolean
  error: Error | undefined
  lastSeq: number
}
```

- SWR key `['room', room]`
- Initial fetch: `fetchRoom(room)` (returns last 50)
- After load: start long-poll loop
  - Set state `lastSeq`
  - Effect: `longPollRoom(room, lastSeq, signal)`
  - On new messages: mutate SWR cache
  - Loop until unmount atau cancel
- Cancel on unmount atau `room === null`
- Pause on `document.visibilityState !== 'visible'`

### `useEventLine()`

**File:** `src/hooks/useEventLine.ts`

```typescript
function useEventLine(): {
  events: EventLine[]
  lastSeq: number
}
```

- Long-poll `/r/events` selamanya (komponen mount)
- Returns append-only list
- Emit callback saat event baru → trigger animasi gedung muncul

### `useAgentDirectory()`

**File:** `src/hooks/useAgentDirectory.ts`

```typescript
function useAgentDirectory(): {
  agents: Map<string, Agent>
  byRoom: Map<string, string[]>  // room → agent keys
}
```

- Derived dari `useRoomMessages` untuk semua room yang dimuat
- Group unique `from` per fingerprint
- Memoized

### `useDocumentVisibility()`

**File:** `src/hooks/useDocumentVisibility.ts`

```typescript
function useDocumentVisibility(): boolean  // true = visible
```

- Listen `visibilitychange` event
- Return current state

### `useCopyToClipboard()`

**File:** `src/hooks/useCopyToClipboard.ts`

```typescript
function useCopyToClipboard(): {
  copy: (text: string) => Promise<boolean>
  isCopied: boolean
}
```

- Pakai `navigator.clipboard.writeText`
- Fallback: `document.execCommand('copy')` dengan hidden textarea
- Reset `isCopied` setelah 2s

---

## D. Stores

### `world-store.ts`

```typescript
interface WorldState {
  rooms: Map<string, Room>
  agents: Map<string, Agent>
  selectedRoomId: string | null
  selectedAgentKey: string | null
  lastUpdate: number

  setRooms: (rooms: Room[]) => void
  upsertAgent: (agent: Agent) => void
  selectRoom: (id: string | null) => void
  selectAgent: (key: string | null) => void
  clearSelection: () => void
}
```

### `ui-store.ts`

```typescript
interface UiState {
  legendCollapsed: boolean
  isHudVisible: boolean
  errorBanner: { message: string; variant: 'error' | 'warning' | 'info' } | null
  // ...actions
}
```

---

## Cross-Reference: Data Flow per Component

| User action | Component | Hook | Store | Adapter |
|-------------|-----------|------|-------|---------|
| Load page | `<LoadingVeil>`, `<World>` | `useRooms` | `setRooms` | `parseRooms` |
| Click building | `<Building>` | — | `selectRoom` | — |
| Open panel | `<RoomPanel>` | `useRoomMessages` | — | `parseRoomMessages` |
| Click agent | `<AgentPoint>` | — | `selectAgent` | — |
| New message | (background) | `useRoomMessages` long-poll | — | `parseRoomMessages` |
| Copy DID | `<AgentPopover>` | `useCopyToClipboard` | — | — |
