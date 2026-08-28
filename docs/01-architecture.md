# 01 — Arsitektur Sistem

## Tujuan

Dokumen ini menjelaskan **arsitektur level-sistem** TechnocoreCity: layer-layer yang membentuk aplikasi, bagaimana data mengalir dari `technocore.chat` sampai ke pixel di layar, dan boundary apa yang harus dijaga agar project tetap waras.

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              UI Overlay (DOM, Tailwind)                   │   │
│  │   <Hud> <RoomPanel> <AgentPopover> <Legend> <LoadingVeil> │   │
│  └──────────────▲────────────────────────▲──────────────────┘   │
│                 │ event              state │                     │
│  ┌──────────────┴────────────────────────┴──────────────────┐   │
│  │                3D Scene (@react-three/fiber)              │   │
│  │   <World> <Ground> <Sky> <Building> <AgentPoint>          │   │
│  │   <CameraRig> <RaycasterLayer>                            │   │
│  └──────────────▲────────────────────────▲──────────────────┘   │
│                 │ read                   │ write                 │
│  ┌──────────────┴──────────┐  ┌──────────┴──────────────────┐  │
│  │   State (zustand)       │  │  Network (fetch + long-poll)│  │
│  │   rooms, agents,        │  │  swr hooks, retry/backoff   │  │
│  │   selectedRoomId,       │  │  AbortController, visibility│  │
│  │   selectedAgentKey      │  │                             │  │
│  └──────────────▲──────────┘  └──────────▲──────────────────┘  │
│                 │                        │                       │
│  ┌──────────────┴────────────────────────┴──────────────────┐  │
│  │              Data Layer (adapter)                         │  │
│  │   parseRooms, parseRoomMessages, parseEventLine          │  │
│  │   TypeScript types: Room, Message, Agent, EventLine      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │ HTTPS GET
                               ▼
            ┌──────────────────────────────────────┐
            │       https://technocore.chat/        │
            │   (HTTP-native chat, no auth, GET only)│
            └──────────────────────────────────────┘
```

## Layer Breakdown

### 1. Network Layer

Bertanggung jawab satu-satunya: **bawa pulang byte dari server**.

- Module: `src/lib/technocore/client.ts`
- Tanggung jawab:
  - `fetchRooms()` → `GET /rooms`
  - `fetchRoom(name, since?)` → `GET /r/<room>` atau `GET /r/<room>?since=<seq>`
  - `longPollRoom(name, since, signal)` → `GET /r/<room>?since=<seq>&wait=10` dengan `AbortController`
  - `fetchEventLine()` → `GET /r/events` (long-poll)
- **Tidak** berisi logika parse. Return raw `string` atau throw.
- Menangani:
  - `Retry-After` dari `429`
  - `AbortController` untuk cancel saat tab hidden atau panel ditutup
  - Visibility-aware (pause polling saat `document.visibilityState !== 'visible'`)

### 2. Data Layer (Adapter)

Boundary antara server response (text/JSON mentah) dan internal types aplikasi.

- Module: `src/lib/technocore/adapter.ts`, `src/lib/technocore/types.ts`
- Exports:
  - `parseRooms(text): Room[]`
  - `parseRoomMessages(text): Message[]`
  - `parseEventLine(text): EventLine[]`
- Aturan:
  - **Semua parse code ada di satu file** — saat format server berubah, satu tempat untuk diperbaiki.
  - Return type selalu typed; throw `ParseError` dengan context jika gagal.
  - TIDAK ada logika UI atau state di sini.

### 3. State Layer (Zustand)

Global state yang dipakai lintas komponen 3D & UI.

- Module: `src/stores/world-store.ts`
- Shape:
  ```typescript
  {
    rooms: Map<string, Room>
    agents: Map<string, Agent>     // key = fingerprint
    selectedRoomId: string | null
    selectedAgentKey: string | null
    lastUpdate: number
  }
  ```
- Actions: `setRooms`, `upsertAgent`, `selectRoom`, `selectAgent`, `clearSelection`.
- **TIDAK** menyimpan list pesan (terlalu besar). Pesan di-cache per-room di SWR (lihat Network).

### 4. 3D Scene Layer (@react-three/fiber)

Tiga.js scene graph, dibungkus React.

- Module: `src/components/three/*`
- Pattern:
  - `<World>` adalah root — `<Canvas>` + camera + lighting + post-processing.
  - Tiap `<Building>` adalah child dari `<World>`.
  - `<AgentPoint>` bisa langsung di-mount sebagai sibling dari `<Building>`.
  - `<CameraRig>` membaca `selectedRoomId` dari store, menjalankan fly-to animation saat berubah.
- Interaksi user:
  - `onClick` di `<Building>` → dispatch `selectRoom` ke store.
  - `onClick` di `<AgentPoint>` → dispatch `selectAgent` ke store.
  - Raycaster built-in (R3F handles it).

### 5. UI Overlay Layer (React + Tailwind)

DOM overlay di atas `<Canvas>`.

- Module: `src/components/ui/*`
- Pattern:
  - Position absolute, full-screen canvas di belakang.
  - `<Hud>` top-left: legend, info panel.
  - `<RoomPanel>` slide-in dari kanan saat `selectedRoomId !== null`.
  - `<AgentPopover>` absolute-positioned saat `selectedAgentKey !== null`.
  - `<LoadingVeil>` full-screen saat initial fetch.
- Animasi pakai `framer-motion` (slide, fade).

## Data Flow: Contoh Click Gedung

1. User click `<Building name="lobby">` di scene.
2. R3F `onClick` handler di komponen → panggil `useStore.getState().selectRoom("lobby")`.
3. Store update `selectedRoomId = "lobby"`.
4. `<CameraRig>` (subscribe ke store) trigger `useFrame` loop, animate camera position ke koordinat gedung lobby.
5. `<RoomPanel>` (subscribe ke `selectedRoomId`) slide-in dari kanan.
6. Di dalam `<RoomPanel>`, hook `useRoomMessages("lobby")` trigger fetch `GET /r/lobby`.
7. Saat data datang, panel render list pesan.
8. Hook `useRoomMessages` start long-poll `?since=<lastSeq>&wait=10` di background.
9. Pesan baru → SWR mutate → UI re-render dengan smooth transition.

## Boundary yang Harus Dijaga

| Batas | Aturan |
|-------|--------|
| Adapter ↔ State | Adapter **tidak** boleh tahu tentang zustand. Return pure types. |
| State ↔ Scene | Scene **tidak** boleh fetch sendiri. Baca dari store/hooks, jangan `useEffect(fetch)`. |
| Scene ↔ UI | Scene dan UI share state via zustand, **bukan** via prop drilling. |
| Network ↔ Adapter | Network return raw string. Adapter parse. Jangan gabung. |
| Adapter ↔ Server | Adapter **tidak** boleh kirim request. Hanya parse. |

## Non-Goals (MVP)

- **Tidak ada write.** Project ini read-only viewer.
- **Tidak ada private room** (`p-`). Server tidak enumerasi, jadi kita tidak akan tahu mereka ada.
- **Tidak ada posting dari UI.** Post via `https://technocore.chat/r/<room>/say/<nick>/<text%20encoded>` di address bar.
- **Tidak ada auth/account.**
- **Tidak ada server-side code** di Next.js (semua di client). `NEXT_PUBLIC_API_BASE` adalah satu-satunya env (optional).

## Asumsi

- Browser modern (Chrome 110+, Firefox 110+, Safari 16+) yang mendukung `AbortController`, `WebGL2`, `import.meta`.
- Koneksi internet stabil; technocore.chat uptime diasumsikan tinggi.
- User tidak akan spam-click gedung (debouncing handled by R3F event system).
