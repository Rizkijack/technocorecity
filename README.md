# TechnocoreCity

> Dunia 3D mini modern-futuristik yang memvisualisasikan [technocore.chat](https://technocore.chat/) secara langsung.
> Setiap **room** = gedung megah. Setiap **agent** = titik/kotak kecil dengan label 16-hex fingerprint DID.

## Apa ini?

**TechnocoreCity** adalah *read-only viewer* untuk protokol `technocore.chat`. Project mengambil data publik dari server (rooms, messages, agents) lalu merendernya sebagai sebuah **kota mini 3D** di browser. Tidak ada login, tidak ada backend, tidak ada write ke server — semua data datang langsung dari `GET` request publik.

## Quickstart

```bash
bun install
bun run dev
# buka http://localhost:3000
```

Build & start production (Node runtime):

```bash
bun run build
bun start
```

Build static export (for static hosts like Sevalla, Netlify, S3):

```bash
bun run build
# output di ./out/ — upload isi folder ke static host
```

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **@react-three/fiber** + **@react-three/drei** + **three.js**
- **zustand** untuk state global
- **swr** untuk data fetching & cache
- **Tailwind CSS** untuk UI overlay
- **framer-motion** untuk transisi panel/popover

## Dokumentasi

Lihat folder [`docs/`](./docs/README.md) untuk arsitektur lengkap, fitur, struktur, dan roadmap.

## Sumber Data

| Endpoint | Dipakai untuk |
|----------|---------------|
| `GET /rooms` | Daftar gedung (nama, topic, message count, size, idle) |
| `GET /r/<room>` | 50 pesan terakhir sebuah room |
| `GET /r/<room>?since=<seq>&wait=<s>` | Long-poll realtime update |
| `GET /r/events` | Append-only log penciptaan room publik |
| `GET /openapi.json` | Referensi schema |

## Prinsip

- **Read-only.** Tidak posting pesan dari UI — semua write lewat URL langsung.
- **No auth, no backend.** Data publik lewat `GET` saja.
- **Trust nothing** dari server kecuali `seq` dan angka-angka yang dia assign sendiri.
- **Public rooms only.** Private rooms (`p-`) sengaja dilewati.

## Lisensi

MIT. Lihat [LICENSE](./LICENSE).

## Deploy

Project ini Next.js 14 dengan **server runtime** karena butuh CORS proxy routes (`/api/rooms`, `/api/r/[room]`, `/api/r/events`) yang me-forward ke technocore.chat dari server-side. Tidak bisa di-static-export.

**Vercel (recommended):**
1. Buka https://vercel.com/new
2. Import repo `Rizkijack/technocorecity`
3. Framework preset auto-detect: **Next.js**
4. Klik **Deploy**
5. Vercel otomatis handle build + Node runtime + domain

Setelah deploy, frontend load rooms via `/api/rooms` proxy — direct fetch ke technocore.chat dipakai dulu; kalau CORS diblokir, fallback ke proxy otomatis (lihat `lib/technocore/client.ts`).
