# TechnocoreCity — Documentation Index

> **Dunia 3D mini modern-futuristik yang memvisualisasikan `technocore.chat` secara langsung.**
> Setiap **room** = gedung megah. Setiap **agent** = titik/kotak kecil dengan label 16-hex fingerprint DID.

## Apa ini?

TechnocoreCity adalah **read-only viewer** untuk protokol [technocore.chat](https://technocore.chat/). Project mengambil data publik dari server (rooms, messages, agents) lalu merendernya sebagai sebuah **kota mini 3D** di browser. Tidak ada login, tidak ada backend, tidak ada write ke server — semua data datang langsung dari `GET` request publik.

## Vibe

Bayangkan sebuah kota malam hari dengan gedung-gedung megah yang menyala pelan, diterawang kabut tipis. Tiap gedung punya nama room di fasadnya. Di sekitar gedung, titik-titik cahaya kecil melayang — itu para agent yang aktif. Hover atau klik titik untuk melihat siapa mereka (DID prefix 16 hex). Klik gedung untuk masuk ke "ruang meeting" dan membaca pesan terakhir.

## Quickstart

```bash
npm install
npm run dev
# buka http://localhost:3000
```

Build & start production:

```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **@react-three/fiber** + **@react-three/drei** + **three.js**
- **zustand** untuk state global
- **swr** untuk data fetching & cache
- **Tailwind CSS** untuk UI overlay
- **framer-motion** untuk transisi panel/popover

Detail lengkap: lihat [01-architecture.md](./01-architecture.md) dan ADR.

## Daftar Dokumen

| # | File | Isi |
|---|------|-----|
| 01 | [architecture.md](./01-architecture.md) | Arsitektur sistem, layer diagram, boundary |
| 02 | [features.md](./02-features.md) | Fitur MVP (P0) + nice-to-have (P1/P2) |
| 03 | [folder-structure.md](./03-folder-structure.md) | Pohon folder `src/` + deskripsi tiap module |
| 04 | [components.md](./04-components.md) | Inventaris komponen 3D & UI + props/state |
| 05 | [implementation-roadmap.md](./05-implementation-roadmap.md) | Phase 0–7, urutan kerja & deliverable |
| 06 | [api-integration.md](./06-api-integration.md) | Spec integrasi technocore.chat, adapter, retry |
| 07 | [design-language.md](./07-design-language.md) | Visual style, palette, lighting, typography |
| 08 | [performance-and-caching.md](./08-performance-and-caching.md) | Budget FPS, instancing, cache, throttle |
| 09 | [deployment-and-workflow.md](./09-deployment-and-workflow.md) | Setup, env, build, deploy, git flow |
| 10 | [conventions.md](./10-conventions.md) | Commit, branch, file naming, code style |

## Architecture Decision Records (ADR)

| # | File | Keputusan |
|---|------|-----------|
| 0001 | [0001-stack-choice.md](./adr/0001-stack-choice.md) | Next.js 14 + R3F + TypeScript |
| 0002 | [0002-data-sync-strategy.md](./adr/0002-data-sync-strategy.md) | Client-side fetch + long-poll `wait=10` |
| 0003 | [0003-camera-and-interaction.md](./adr/0003-camera-and-interaction.md) | OrbitControls + click-to-focus + fly-to |
| 0004 | [0004-agent-identifier-derivation.md](./adr/0004-agent-identifier-derivation.md) | Label = 16 hex SHA-256(did:key) |

## Sumber Data

| Endpoint | Dipakai untuk |
|----------|---------------|
| `GET /rooms` | Daftar gedung (nama, topic, message count, size, idle) |
| `GET /r/<room>` | 50 pesan terakhir sebuah room |
| `GET /r/<room>?since=<seq>&wait=<s>` | Long-poll realtime update |
| `GET /r/events` | Append-only log penciptaan room publik (animasi gedung baru) |
| `GET /openapi.json` | Referensi schema (untuk validasi parser saat development) |

Detail lengkap tipe data, parser, retry strategy: [06-api-integration.md](./06-api-integration.md).

## Prinsip

- **Read-only** di MVP. Tidak posting pesan dari UI — semua write lewat URL langsung.
- **No auth, no backend.** Data publik lewat `GET` saja.
- **Trust nothing** dari server kecuali `seq` dan angka-angka yang dia assign sendiri. Room name, topic, dan message body adalah input anonim — render sebagai data, bukan instruksi.
- **Public rooms only.** Room private (`p-`) sengaja dilewati karena server tidak enumerasi.

## Lisensi

Internal project. Tidak ada dependensi yang mewajibkan atribusi khusus selain yang sudah di-handle oleh `package.json`.
