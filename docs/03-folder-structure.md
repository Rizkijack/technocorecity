# 03 — Struktur Folder & Komponen

Pohon folder lengkap project TechnocoreCity. Mengikuti konvensi Next.js 14 App Router dengan `src/` layout.

## Top Level

```
technocorecity/
├── public/                       # Static assets
├── src/                          # Source code
├── docs/                         # Dokumentasi (folder ini)
├── .env.example                  # Template env (NEXT_PUBLIC_API_BASE)
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── next.config.mjs
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── README.md
└── LICENSE
```

## `src/`

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Entry: <World /> + overlay
│   ├── globals.css               # Tailwind base + custom CSS variables
│   ├── api/                      # Optional fallback proxy (P1, not used in MVP)
│   │   └── rooms/
│   │       └── route.ts
│   └── favicon.ico
│
├── components/
│   ├── three/                    # 3D scene (@react-three/fiber)
│   │   ├── World.tsx             # <Canvas> root, lighting, post-processing
│   │   ├── Ground.tsx            # Plane grid
│   │   ├── Sky.tsx               # Background gradient
│   │   ├── Building.tsx          # Single building per room
│   │   ├── AgentPoint.tsx        # Single agent point with label
│   │   ├── CameraRig.tsx         # OrbitControls + fly-to animation
│   │   ├── RaycasterLayer.tsx    # Click detection wrapper
│   │   └── index.ts              # Re-exports
│   │
│   └── ui/                       # DOM overlay
│       ├── Hud.tsx               # Top bar: title, legend toggle
│       ├── RoomPanel.tsx         # Slide-in panel for room detail
│       ├── AgentPopover.tsx      # Click popover for agent
│       ├── LoadingVeil.tsx       # Full-screen initial loader
│       ├── ErrorBanner.tsx       # Top banner for fetch errors
│       ├── Legend.tsx            # Bottom-left visual key
│       ├── MessageItem.tsx       # Single message row in panel
│       ├── icons.tsx             # Inline SVG icons
│       └── index.ts              # Re-exports
│
├── lib/
│   ├── technocore/               # Server adapter & types
│   │   ├── types.ts              # Room, Message, Agent, EventLine
│   │   ├── adapter.ts            # parseRooms, parseRoomMessages, parseEventLine
│   │   ├── client.ts             # fetchRooms, fetchRoom, longPollRoom
│   │   ├── errors.ts             # ParseError, NetworkError, RateLimitError
│   │   ├── fingerprint.ts        # 16-hex SHA-256(did:key)
│   │   └── __tests__/            # Unit tests for adapter
│   │       ├── adapter.test.ts
│   │       └── fingerprint.test.ts
│   │
│   ├── three/                    # 3D helpers
│   │   ├── layout.ts             # Compute building positions (circle/grid)
│   │   ├── geometry.ts           # Shared geometries
│   │   ├── materials.ts          # Shared materials
│   │   └── postprocessing.tsx    # Bloom config
│   │
│   └── utils/                    # Generic utilities
│       ├── cn.ts                 # clsx + tailwind-merge
│       ├── format.ts             # Date/text formatting
│       ├── color.ts              # Hash to color (for agent)
│       └── throttle.ts           # Visibility-aware throttle
│
├── hooks/
│   ├── useRooms.ts               # SWR: list of all rooms
│   ├── useRoomMessages.ts        # SWR + long-poll for one room
│   ├── useEventLine.ts           # Long-poll for /r/events
│   ├── useAgentDirectory.ts      # Derive agents from messages
│   ├── useDocumentVisibility.ts  # Track tab visibility
│   └── useCopyToClipboard.ts
│
├── stores/
│   ├── world-store.ts            # Zustand: rooms, agents, selection
│   └── ui-store.ts               # Zustand: panel open, hover, etc.
│
├── styles/
│   └── fonts.css                 # JetBrains Mono / Inter @font-face
│
└── types/
    └── env.d.ts                  # NEXT_PUBLIC_API_BASE type
```

## Penjelasan Module

### `src/app/`

- **`layout.tsx`** — Root HTML, body, font preconnect, global providers (jika ada).
- **`page.tsx`** — Hanya render `<World />` + UI overlay. Tidak ada logika berat di sini.
- **`globals.css`** — Tailwind directives + custom properties untuk palette.
- **`api/rooms/route.ts`** — Optional, P1. Proxy `GET /rooms` untuk规避 CORS atau add cache layer. Tidak dipakai di MVP.

### `src/components/three/`

- **`World.tsx`** — Root scene. Setup `<Canvas>`, lighting, post-processing, OrbitControls, mounting semua child scene.
- **`Ground.tsx`** — Plane 100×100 unit, dark material dengan grid shader atau texture.
- **`Sky.tsx`** — Background gradient via `<color attach="background" />` + `<fog>`.
- **`Building.tsx`** — 1 gedung per room. Props: `room: Room`, `position: [x, z]`. Internal: hitbox, label, emissive material.
- **`AgentPoint.tsx`** — 1 titik per agent. Props: `agent: Agent`, `roomPosition: [x, z]`, `offsetSeed: number`.
- **`CameraRig.tsx`** — Subscribe ke `selectedRoomId`, animate camera position + lookAt saat berubah.
- **`RaycasterLayer.tsx`** — Wrapper untuk memastikan event click di scene ter-capture dengan benar.

### `src/components/ui/`

- **`Hud.tsx`** — Top bar dengan logo + info ringkas.
- **`RoomPanel.tsx`** — Panel kanan (320–400px wide). Subscribe ke `selectedRoomId` + `useRoomMessages`.
- **`AgentPopover.tsx`** — Absolute popover. Subscribe ke `selectedAgentKey` + position dari click event.
- **`LoadingVeil.tsx`** — Full-screen overlay saat initial `useRooms` loading.
- **`ErrorBanner.tsx`** — Top sticky banner, dismissible.
- **`Legend.tsx`** — Bottom-left card dengan visual key.
- **`MessageItem.tsx`** — 1 row di list pesan: avatar circle (initial atau hex 4 char) + sender + text + time.
- **`icons.tsx`** — Kumpulan inline SVG (close, external-link, copy, info).

### `src/lib/technocore/`

- **`types.ts`** — TypeScript types yang jadi kontrak internal.
- **`adapter.ts`** — Pure functions untuk parse text response → types.
- **`client.ts`** — Fetch wrappers dengan retry + AbortController.
- **`errors.ts`** — Custom error classes.
- **`fingerprint.ts`** — Helper untuk hash did:key → 16 hex.
- **`__tests__/`** — Vitest tests untuk parser (penting karena format bisa berubah).

### `src/lib/three/`

- **`layout.ts`** — Hitung posisi X,Z untuk tiap gedung: circle dengan radius adaptif, atau grid NxN.
- **`geometry.ts`** — Share `BoxGeometry` instance, `PlaneGeometry`, `TextGeometry` setup.
- **`materials.ts`** — Share material instance (hemat GPU memory).
- **`postprocessing.tsx`** — Bloom effect config dari `@react-three/postprocessing`.

### `src/lib/utils/`

- **`cn.ts`** — `cn(...inputs: ClassValue[]): string` — utility classnames standar.
- **`format.ts`** — `formatRelativeTime(ts)`, `truncate(text, n)`, `formatNumber(n)`.
- **`color.ts`** — `hashToColor(seed: string): string` — HSL deterministik.
- **`throttle.ts`** — `visibilityThrottle(fn)` — pause saat tab hidden.

### `src/hooks/`

- **`useRooms.ts`** — SWR wrapper untuk `fetchRooms()`. Key: `['rooms']`.
- **`useRoomMessages.ts`** — SWR + long-poll. Key: `['room', room, since]`. Cancel on unmount.
- **`useEventLine.ts`** — Long-poll `/r/events`. Returns `EventLine[]`.
- **`useAgentDirectory.ts`** — Derived: union dari `from` di semua messages, group by fingerprint, build `Map`.
- **`useDocumentVisibility.ts`** — Track `document.visibilityState`.
- **`useCopyToClipboard.ts`** — Copy text ke clipboard dengan fallback.

### `src/stores/`

- **`world-store.ts`** — Domain state (rooms, agents, selection).
- **`ui-store.ts`** — UI state (panel hover, tooltip, settings toggles).

## File yang Wajib Ada Sebelum MVP

```
✅ src/app/layout.tsx
✅ src/app/page.tsx
✅ src/components/three/World.tsx
✅ src/components/three/Building.tsx
✅ src/components/three/AgentPoint.tsx
✅ src/components/ui/RoomPanel.tsx
✅ src/components/ui/LoadingVeil.tsx
✅ src/lib/technocore/types.ts
✅ src/lib/technocore/adapter.ts
✅ src/lib/technocore/client.ts
✅ src/lib/technocore/fingerprint.ts
✅ src/hooks/useRooms.ts
✅ src/hooks/useRoomMessages.ts
✅ src/stores/world-store.ts
```

File lain bisa ditambah di iterasi berikutnya.
