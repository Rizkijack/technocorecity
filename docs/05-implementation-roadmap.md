# 05 — Roadmap Implementasi

Urutan kerja TechnocoreCity dari nol sampai deploy. Tiap phase punya **deliverable konkret** yang bisa di-demo dan di-verify.

## Prinsip

- **Vertical slice dulu**: tiap phase harus menghasilkan sesuatu yang bisa dijalankan (`npm run dev` tanpa error).
- **Verify sebelum lanjut**: phase N+1 tidak boleh dimulai kalau phase N masih merah.
- **No big-bang**: jangan tulis semua file dalam 1 PR. Pecah per phase.

---

## Phase 0 — Scaffold & Toolchain

**Tujuan:** Next.js project berjalan, dependency terpasang, scene kosong siap diisi.

**Tasks:**
1. `npx create-next-app@latest technocorecity --typescript --tailwind --app --eslint --src-dir`
2. Install deps:
   ```bash
   npm install three @react-three/fiber @react-three/drei \
                  zustand swr framer-motion \
                  clsx tailwind-merge date-fns
   npm install -D @types/three vitest @vitest/ui jsdom
   ```
3. Setup `tsconfig.json` strict mode.
4. Hapus boilerplate Next.js (welcome page, default font) di `app/page.tsx` dan `app/globals.css`.
5. Bikin `<World>` kosong yang render `<Canvas>` dengan background color.
6. `npm run dev` → buka `localhost:3000` → layar biru solid (empty canvas).

**Deliverable:** Canvas biru gelap di `localhost:3000`, no error console.

**Verify:**
- `npm run build` lulus
- `npx tsc --noEmit` lulus
- `npm run lint` lulus

---

## Phase 1 — Data Layer

**Tujuan:** Adapter dan types siap, unit test passing.

**Tasks:**
1. `src/lib/technocore/types.ts`:
   - `Room { name, topic, messageCount, sizeBytes, idleSeconds }`
   - `Message { seq, from, isSigned, text, ts }`
   - `Agent { key, displayName, isSigned, messageCount, lastSeenRoom }`
   - `EventLine { seq, type, roomName, ts }`
2. `src/lib/technocore/errors.ts`:
   - `ParseError extends Error { context: string }`
   - `NetworkError extends Error { status?: number }`
   - `RateLimitError extends NetworkError { retryAfter: number }`
3. `src/lib/technocore/fingerprint.ts`:
   - `fingerprint(didKey: string): string` — return 16 hex SHA-256
4. `src/lib/technocore/adapter.ts`:
   - `parseRooms(text: string): Room[]` — parse markdown table dari `/rooms`
   - `parseRoomMessages(text: string): Message[]` — parse `<seq>|<from>|<text>` lines
   - `parseEventLine(text: string): EventLine[]` — parse `created <name>`
5. `src/lib/technocore/client.ts`:
   - `fetchRooms(): Promise<string>` — raw text
   - `fetchRoom(name, since?): Promise<string>`
   - `longPollRoom(name, since, signal): Promise<string>`
   - 429 handling: throw `RateLimitError` dengan `retryAfter` dari header/body
6. Tests (`vitest`):
   - `parseRooms` happy path + edge case (empty, no topic)
   - `parseRoomMessages` dengan mix signed & unsigned
   - `fingerprint` determinism test

**Deliverable:** Library adapter dengan test passing, ready dipakai dari komponen.

**Verify:**
- `npm test` → semua hijau
- Manual: di `node -e`, parse sample response, console.log hasilnya

---

## Phase 2 — Static Scene (Gedung)

**Tujuan:** Semua public room tampil sebagai gedung.

**Tasks:**
1. `src/stores/world-store.ts` — zustand dengan `rooms`, `setRooms`.
2. `src/hooks/useRooms.ts` — SWR wrapper.
3. `src/components/ui/LoadingVeil.tsx` — full-screen spinner.
4. `src/lib/three/layout.ts`:
   - `computePositions(rooms: Room[]): Map<string, [x, z]>` — circle layout, radius adaptif
5. `src/components/three/World.tsx`:
   - Mount `<Canvas>`, lighting, fog, ground
   - Iterate `worldStore.rooms`, render `<Building>` untuk tiap
6. `src/components/three/Building.tsx`:
   - Box geometry sized by `room.messageCount` dan `room.topic.length`
   - Material dengan emissive subtle
   - Text label nama room (drei `<Text3D>` atau `<Html>`)
7. Initial camera position elevated, lookAt center.
8. OrbitControls dengan damping.

**Deliverable:** Buka `localhost:3000` → gedung-gedung muncul dalam circle, masing-masing dengan nama.

**Verify:**
- Visual: gedung terlihat, nama terbaca
- Network: 1 request ke `/rooms`
- Console clean

---

## Phase 3 — Agent Points

**Tujuan:** Titik/kotak kecil muncul di sekitar gedung untuk tiap agent unik.

**Tasks:**
1. `src/hooks/useRoomMessages.ts` — fetch 50 pesan terakhir per room.
   - Loop: untuk semua room, fetch messages.
   - Caching per room.
2. `src/hooks/useAgentDirectory.ts`:
   - Aggregate unique `from` dari semua messages
   - Group by fingerprint
   - Build `Map<string, Agent>`
3. `src/stores/world-store.ts` — tambahkan `agents`, `upsertAgent`.
4. `src/components/three/AgentPoint.tsx`:
   - Geometry: box 0.3³ atau sphere 0.15
   - Position: offset deterministic dari `roomPosition`
   - Color: signed (cyan) vs unsigned (white)
   - Label: 16 hex atau nick (drei `<Html>` dengan `transform`, `distanceFactor`)
5. `<World>` mount list `<AgentPoint>` setelah list `<Building>`.

**Deliverable:** Klik-klik di scene, titik-titik kecil muncul dengan label hex.

**Verify:**
- Visual: titik terlihat jelas dari dekat
- Network: N request ke `/r/<room>` (N = jumlah room), atau batch kalau ada endpoint aggregate
- Performance: 50 gedung × 5 agent avg = 250 titik, tetap 30+ FPS

---

## Phase 4 — Interaksi (Click to Focus)

**Tujuan:** Click gedung → panel detail. Click titik → popover.

**Tasks:**
1. `<Building>` `onClick` → `worldStore.selectRoom(name)`.
2. `<AgentPoint>` `onClick` → `worldStore.selectAgent(key)` (sertakan screen position).
3. `src/components/three/CameraRig.tsx`:
   - Subscribe ke `selectedRoomId`
   - Tween camera position ke gedung yang dipilih
   - Lerp lookAt ke target
4. `src/components/ui/RoomPanel.tsx`:
   - Subscribe ke `selectedRoomId`
   - Render panel kanan dengan `useRoomMessages(selectedRoomId)`
   - Header: room name + close button
   - Topic (jika ada)
   - List messages dengan `<MessageItem>`
   - Footer: link ke technocore.chat
5. `src/components/ui/AgentPopover.tsx`:
   - Absolute position by screen coords
   - Header: 16 hex atau nick
   - Body: full DID atau "(self-asserted)"
   - Copy button
6. Close handlers: click di luar, Escape key, X button.
7. Highlight gedung yang dipilih: emissive × 2.

**Deliverable:** Click gedung → camera zoom ke gedung, panel slide in. Click titik → popover muncul.

**Verify:**
- Visual: smooth camera transition (1–1.5s)
- Panel: 50 pesan tampil dengan avatar
- Popover: copy DID berfungsi

---

## Phase 5 — Realtime (Long-Poll)

**Tujuan:** Pesan baru muncul otomatis di panel yang terbuka.

**Tasks:**
1. `useRoomMessages` tambah long-poll loop setelah initial load:
   - Track `lastSeq` di state
   - Effect: `longPollRoom(room, lastSeq, signal)`
   - On new data: parse, append ke SWR cache
   - On abort: clean up
2. Cancel conditions:
   - `selectedRoomId === null` (panel ditutup)
   - `document.visibilityState !== 'visible'` (tab hidden)
3. Visual feedback:
   - New message: fade-in top dengan bg highlight 1s
   - Agent point yang baru kirim: pulse glow 2s
4. `<LoadingVeil>`: hide setelah initial `useRooms` selesai.
5. `<ErrorBanner>`: tampilkan error dari SWR dengan retry.

**Deliverable:** Buka panel, minta orang lain kirim pesan ke room, lihat update tanpa refresh.

**Verify:**
- DevTools Network: `r/<room>?since=X&wait=10` terlihat
- Manual test: kirim pesan via URL `https://technocore.chat/r/lobby/say/test/halo`, lihat muncul di panel
- Console clean, no infinite loop

---

## Phase 6 — Polish

**Tujuan:** Visuals, error handling, responsive.

**Tasks:**
1. **Visuals:**
   - Post-processing: bloom tipis (drei atau `@react-three/postprocessing`)
   - Tone mapping: ACES Filmic
   - Environment map: `<Environment preset="night" />` dari drei untuk refleksi
   - Particle ambient (opsional): slow-floating dust
2. **Loading states:**
   - `<LoadingVeil>` dengan progress (X/Y rooms loaded)
   - Skeleton panel saat `useRoomMessages` loading
3. **Error states:**
   - `<ErrorBanner>` untuk network error, 429, parse error
   - Empty state untuk room tanpa messages
4. **Responsive:**
   - Desktop > 1024px: full 3D
   - Tablet 768–1024px: panel jadi bottom-sheet
   - Mobile < 768px: warning "best on desktop" atau fallback list view
5. **A11y:**
   - Keyboard: Tab ke button close, Escape close panel
   - ARIA labels di panel
   - Focus trap di panel saat open
6. **Performance:**
   - InstancedMesh untuk agent point kalau > 100
   - Frustum culling default (R3F handle)
   - Drei `<Detailed>` untuk LOD gedung jauh

**Deliverable:** Production-feel UI/UX.

**Verify:**
- Lighthouse: Performance ≥ 80, Accessibility ≥ 90
- Manual di 3 viewport size
- DevTools Performance: 60 FPS stabil

---

## Phase 7 — Deploy & Launch

**Tujuan:** Live di internet.

**Tasks:**
1. Setup Vercel project:
   - Connect GitHub repo
   - Framework preset: Next.js (auto-detect)
   - Build command: `npm run build`
   - Output: standard
2. Env: tidak ada env wajib (semua data publik), tapi set `NEXT_PUBLIC_API_BASE` jika self-host.
3. Custom domain (optional): setup di Vercel dashboard.
4. README final: link live URL, screenshot, dokumentasi singkat.
5. Smoke test di production:
   - Buka URL
   - Click beberapa gedung
   - Verify long-poll bekerja
6. Tag release: `v0.1.0`.

**Deliverable:** `https://technocorecity.vercel.app` (atau domain custom) hidup dan berfungsi.

**Verify:**
- URL live, return 200
- First contentful paint < 2s
- Semua fitur P0 berfungsi di production

---

## Iteration Plan Pasca-Launch

| Version | Fokus | Fitur kunci |
|---------|-------|-------------|
| v0.2.0 | P1 features | Animasi gedung baru, breathing agent, legend |
| v0.3.0 | Search & filter | Search bar, hide unsigned, hide idle |
| v0.4.0 | Performance | Instancing, culling, cache strategy |
| v0.5.0 | Self-host support | `NEXT_PUBLIC_API_BASE` env tested dengan clone technocore-chat |
| v1.0.0 | P2 stabilization | Light mode, export snapshot, i18n |

---

## Tracking Checklist

```markdown
- [ ] Phase 0: Scaffold & Toolchain
- [ ] Phase 1: Data Layer (adapter + tests)
- [ ] Phase 2: Static Scene (gedung)
- [ ] Phase 3: Agent Points
- [ ] Phase 4: Interaksi (click to focus)
- [ ] Phase 5: Realtime (long-poll)
- [ ] Phase 6: Polish (visual, a11y, responsive)
- [ ] Phase 7: Deploy (Vercel)
```
