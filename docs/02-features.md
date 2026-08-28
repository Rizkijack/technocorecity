# 02 — Fitur

Daftar fitur TechnocoreCity, dikelompokkan berdasarkan prioritas.

## Prioritas

- **P0** — wajib di MVP. Tanpa ini, project tidak berguna.
- **P1** — polish yang sangat diharapkan user. Sebaiknya selesai sebelum launch.
- **P2** — nice-to-have. Bisa ditunda ke iterasi berikutnya.
- **P3** — future. Eksplorasi, bukan komitmen.

---

## P0 — MVP (v0.1.0)

### F-001: Render semua public room sebagai gedung megah

**Sebagai** viewer, **saya ingin** melihat semua public room di technocore.chat divisualisasikan sebagai gedung-gedung di dunia 3D, **sehingga** saya bisa merasakan "bentuk" ekosistem chat tersebut secara spasial.

- Source: `GET /rooms`
- Setiap room = satu `<Building>` dengan:
  - Nama room di fasad (text 3D dari drei)
  - Tinggi/scale proporsional dengan `messageCount` (log scale)
  - Lebar proporsional dengan `topic.length` (clamped)
  - Material emissive glow halus
  - Layout: circle pattern di sekeliling center world
- Topic ditampilkan di base plaque (optional MVP) atau di panel detail.

**Acceptance:**
- Minimal 1 gedung muncul untuk tiap entry di `/rooms`.
- Click gedung → event `selectRoom` ter-dispatch.
- Nama room terbaca dari jarak 20 unit kamera.

### F-002: Render manusia/agent sebagai titik dengan label DID

**Sebagai** viewer, **saya ingin** melihat agent yang aktif muncul di sekitar gedung-gedung room mereka, **sehingga** saya bisa tahu siapa yang sedang bicara.

- Source: derive dari messages (50 terakhir per room) di `useRoomMessages`
- Setiap unique `from` = satu `<AgentPoint>`:
  - Geometry: 0.3×0.3×0.3 box (kotak kecil) atau sphere kecil (titik)
  - Warna: signed writer = cyan glow, unsigned = neutral white
  - Label: 16 hex pertama SHA-256(did:key) untuk signed; nick untuk unsigned
  - Posisi: random offset kecil di sekitar gedung room-nya (deterministic dari hash)
- Label selalu menghadap camera (billboard via drei `<Billboard>`).

**Acceptance:**
- Minimal 1 titik muncul per agent unik yang punya pesan di data yang dimuat.
- Label bisa dibaca dari jarak dekat.
- Click titik → popover muncul.

### F-003: Click gedung → panel detail room

**Sebagai** viewer, **saya ingin** ketika saya click sebuah gedung, sebuah panel terbuka menunjukkan 50 pesan terakhir, **sehingga** saya bisa baca percakapan.

- Panel slide-in dari kanan (`framer-motion`).
- Isi:
  - Nama room (header)
  - Topic (subtitle)
  - List 50 pesan terakhir (avatar/initials, sender, text, timestamp)
  - Footer: link "open in technocore.chat" → `https://technocore.chat/r/<room>`
- Tutup: tombol X atau Escape key.

**Acceptance:**
- Panel tidak block lebih dari 40% viewport width di desktop.
- Pesan di-render dengan text wrapping yang rapi.
- Link eksternal buka tab baru.

### F-004: Click titik agent → popover

**Sebagai** viewer, **saya ingin** ketika saya click sebuah agent point, popover muncul dengan info, **sehingga** saya tahu siapa mereka.

- Popover absolute-positioned di atas titik.
- Isi:
  - Untuk signed: 16 hex fingerprint (label), full DID key (kecil, copy-able)
  - Untuk unsigned: nick
  - Jumlah pesan di room yang sedang dilihat
- Tutup: click di luar atau Escape.

**Acceptance:**
- Popover tidak overflow viewport.
- DID key bisa di-copy ke clipboard.

### F-005: Realtime update via long-poll

**Sebagai** viewer, **saya ingin** pesan baru di room aktif langsung muncul tanpa refresh, **sehingga** saya bisa mengikuti percakapan live.

- Implementasi:
  - Saat `<RoomPanel>` terbuka, hook `useRoomMessages` start long-poll `?since=<lastSeq>&wait=10`.
  - Setiap balikan (bahkan kosong), parse → jika ada msg baru, append ke list.
  - Cancel `AbortController` saat panel ditutup atau tab hidden.
- Visual feedback: pesan baru fade-in dari atas (300ms).
- Animated pulse di agent point saat mengirim pesan.

**Acceptance:**
- Pesan baru muncul dalam ≤ 11 detik (1 wait cycle + parse overhead).
- Tidak ada double-fetch saat user navigate cepat.

### F-006: Layout & lighting dasar

**Sebagai** viewer, **saya ingin** dunia 3D-nya terlihat bagus tanpa saya harus mengerti 3D, **sehingga** experience langsung enjoyable.

- Sky/background: gradient deep navy → near-black.
- Ground: plane gelap dengan grid subtle (referensi spasial).
- Lighting: hemisphere + 1 directional low-angle (sunset/dawn feel).
- Fog: distance fog, far ~80 unit, agar gedung jauh tetap soft.

**Acceptance:**
- First load < 3 detik untuk render gedung pertama (di broadband normal).
- Frame rate stabil ≥ 30 FPS dengan 50 gedung.

---

## P1 — Polish (v0.2.0)

### F-101: Animasi gedung baru muncul

**Sebagai** viewer, **saya ingin** ketika room baru dibuat, gedungnya muncul dengan animasi, **sehingga** kota terasa hidup.

- Source: long-poll `GET /r/events`.
- Animasi: gedung muncul dari bawah tanah dengan scale tween (0→1 dalam 1.5s, ease-out).
- Toast notification kecil: "New room: <name>".

**Acceptance:**
- Tidak spam toast (debounce 1 toast per 5 detik).

### F-102: Agent point breathing

- Idle agent: gentle vertical bob (0.05 unit, 2 detik cycle).
- Active agent (sedang kirim pesan): pulse glow lebih terang selama 2 detik.

### F-103: Message ticker

- Panel room: top 3 pesan terbaru auto-scroll dengan highlight subtle.
- Atau: ticker horizontal di bottom screen yang broadcast last message dari semua room.

### F-104: Loading & error state

- Initial load: `<LoadingVeil>` dengan spinner + progress (X/Y rooms loaded).
- Network error: banner di top, retry button.
- 429 dari server: banner "Server busy, retrying in Xs..." dengan countdown.

### F-105: Legend overlay

- Bottom-left: legend yang menjelaskan:
  - Gedung besar = room
  - Titik cyan = signed agent (DID)
  - Titik putih = unsigned agent (nick)
  - Hover instruksi

### F-106: Responsive sizing

- Desktop: full 3D experience.
- Tablet: panel jadi bottom-sheet.
- Mobile: disable 3D, fallback ke list view (atau warning "best on desktop").

---

## P2 — Nice-to-have (v0.3.0+)

### F-201: Filter & search

- Search bar: filter gedung by name (substring match).
- Toggle: hide unsigned agents.
- Toggle: hide idle rooms (idle > 24 jam).

### F-202: Dark/light toggle

- Default: dark (sesuai estetika futuristik).
- Light mode: warm gradient, gedung lebih kontras.

### F-203: Export snapshot

- Tombol "screenshot": capture current camera angle, download PNG.
- Tombol "share view": copy URL dengan camera state encoded.

### F-204: Statistik room

- Click kanan gedung → context menu: "Stats" → modal dengan grafik message/hour (last 24h).

### F-205: Sound effects (optional)

- Click gedung: soft chime.
- New message: subtle blip.
- Default: OFF. Toggle di settings.

---

## P3 — Future / Eksplorasi

### F-301: Tulis pesan dari UI (gated by CORS)

Saat ini CORS technocore.chat mungkin memblokir POST dari browser. Jika tidak, sediakan input box di panel.

### F-302: Multi-language support

i18n dengan next-intl. Default English + Indonesian.

### F-303: PWA / offline mode

Service worker + cache static assets. Cocok untuk "city tetap berdiri saat tidak ada koneksi baru".

### F-304: VR mode

WebXR, jalan-jalan di dalam kota dengan headset. Butuh effort besar.

### F-305: Music generative

Audio reactive: pulse rate gedung berdasarkan message rate. Atau ambient drone yang bereaksi terhadap traffic.

---

## Out of Scope (TIDAK akan dibangun)

- **Native mobile app.** Web only.
- **Server-side data enrichment** (analytics, ML, dll). Read-only viewer.
- **Posting/chat functionality** dalam UI MVP. Hard rule: ini viewer.
- **Login/account system.** Tidak relevan untuk read-only public data.
- **Self-hosting technocore.chat.** Itu project lain (`flop-labs/technocore-chat`).
