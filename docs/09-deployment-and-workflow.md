# 09 — Deployment & Development Workflow

Setup lokal, environment variables, build, deploy, dan git workflow untuk TechnocoreCity.

## Prasyarat

- **Node.js** 20.x LTS (atau 22.x terbaru)
- **npm** 10+ (atau pnpm/yarn — panduan ini pakai npm)
- **Git** 2.30+
- Browser modern untuk testing (Chrome 110+, Firefox 110+, Safari 16+)

Verifikasi versi:
```bash
node --version
npm --version
git --version
```

## Setup Lokal

### Clone & Install

```bash
git clone https://github.com/<your-username>/technocorecity.git
cd technocorecity
npm install
```

### Environment Variables

Copy template dan edit:

```bash
cp .env.example .env.local
```

`.env.example`:
```bash
# Override base URL for technocore.chat (optional)
# Default: https://technocore.chat
# Use this for self-hosted instances or staging
# NEXT_PUBLIC_API_BASE=https://technocore.chat
```

**Catatan:**
- Hanya `NEXT_PUBLIC_*` env yang dipakai di client.
- Tidak ada env wajib untuk MVP — default base URL built-in.
- `.env.local` masuk `.gitignore`, jangan commit.

### Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Catatan: Next.js akan auto-increment port (3001, 3002) jika 3000 sibuk. Cek output terminal untuk port yang aktif.

### Build Production Lokal

```bash
npm run build
npm start
```

Build artifacts di `.next/`. Production server jalan di port 3000.

### Linting & Type Check

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # Vitest
```

---

## Scripts di `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Tambah sesuai kebutuhan (`analyze`, `e2e`, dll).

---

## Deployment

### Vercel (Recommended)

**Setup one-time:**

1. Push repo ke GitHub.
2. Buka [vercel.com/new](https://vercel.com/new).
3. Import repo `technocorecity`.
4. Framework preset: auto-detect (Next.js).
5. Build command: `npm run build` (default).
6. Output directory: `.next` (default).
7. Environment variables: set `NEXT_PUBLIC_API_BASE` jika perlu (optional).
8. Click **Deploy**.

**Auto-deploy:**
- Push ke `main` → production deploy.
- Push ke branch lain → preview deploy (URL unik).
- PR otomatis dapat preview URL.

**Custom domain:**
- Vercel dashboard → Project → Settings → Domains.
- Tambah domain, update DNS sesuai instruksi.

### Self-Host (Vercel Alternatif)

Build static atau dengan Node runtime:

```bash
npm run build
```

Lalu jalankan di server:

```bash
# Dengan Node
npm start
# atau dengan PM2
pm2 start npm --name technocorecity -- start
```

Atau sebagai static export (jika tidak ada API route dinamis):

```js
// next.config.mjs
const config = {
  output: 'export',
  // ...
}
```

```bash
npm run build
# Output di ./out/ → upload ke S3, Cloudflare Pages, Netlify, dll
```

**Catatan:** static export意味着 tidak ada server-side function. Karena project ini 100% client-side fetch, ini perfectly fine.

### Docker (Optional)

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t technocorecity .
docker run -p 3000:3000 technocorecity
```

Tidak wajib untuk MVP. Vercel lebih simple.

---

## Git Workflow

### Branch Strategy: Trunk-Based

- `main` adalah trunk. Selalu deployable.
- Feature branch: `feat/<slug>` (e.g., `feat/agent-points`).
- Bugfix: `fix/<slug>`.
- Docs: `docs/<slug>`.
- Chore: `chore/<slug>`.

### Branch Naming

```
feat/add-fog
fix/long-poll-abort-leak
docs/update-readme
chore/bump-three-deps
refactor/extract-fingerprint-helper
perf/use-instanced-mesh
test/adapter-coverage
```

### Commit Convention: Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `chore` — Maintenance, deps
- `docs` — Documentation only
- `refactor` — Code change, no behavior change
- `perf` — Performance improvement
- `test` — Test addition/update
- `style` — Formatting only

**Examples:**

```bash
git commit -m "feat(scene): add building rendering from /rooms data"
git commit -m "fix(poll): cancel long-poll on tab hidden"
git commit -m "docs(readme): add quickstart section"
git commit -m "perf(agents): switch to InstancedMesh for 100+ agents"
```

### PR Workflow

1. Branch dari `main`:
   ```bash
   git checkout -b feat/<slug>
   ```
2. Commit dengan conventional format.
3. Push:
   ```bash
   git push origin feat/<slug>
   ```
4. Buka PR di GitHub.
5. Vercel auto-deploy preview URL.
6. Review self via checklist (lihat `10-conventions.md`).
7. Merge ke `main` (squash merge default).

**PR template** (`.github/pull_request_template.md`):

```markdown
## Description
<!-- What changed and why -->

## Type
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] chore
- [ ] perf

## Testing
- [ ] Unit tests passing
- [ ] Manual testing done
- [ ] Preview URL verified

## Checklist
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] No new console errors/warnings
- [ ] Conventional commit message

## Breaking Changes
<!-- Yes/No - describe if yes -->

## Related Issues
Closes #...
```

---

## Pre-Commit Checklist

Sebelum commit, jalankan:

```bash
npm run lint
npm run typecheck
npm test
```

Atau setup Husky + lint-staged untuk auto-run saat `git commit` (optional):

```bash
npm install -D husky lint-staged
npx husky init
```

`.husky/pre-commit`:
```bash
npm run lint
npm run typecheck
```

---

## Release Workflow

### Tagging

```bash
git tag -a v0.1.0 -m "MVP: 3D world with buildings and agents"
git push origin v0.1.0
```

### Changelog

Maintain `CHANGELOG.md` (atau generate dari conventional commits dengan `standard-version`):

```bash
npm install -D standard-version
npx standard-version
```

Atau manual:

```markdown
# Changelog

## [0.1.0] - 2026-XX-XX
### Added
- Initial MVP: 3D world rendering public rooms as buildings
- Agent points with DID fingerprint labels
- Real-time long-poll updates
- Room detail panel
- Agent popover

### Fixed
- N/A

### Changed
- N/A
```

---

## Environment-Specific Configuration

### Local Development

- `NODE_ENV=development` (auto)
- `NEXT_PUBLIC_API_BASE=https://technocore.chat` (default)
- Hot reload aktif
- Source maps untuk debugging

### Preview (Vercel)

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE` bisa di-override per environment di Vercel dashboard
- Optimized bundle

### Production

- `NODE_ENV=production`
- Same as preview
- Custom domain configured
- Analytics (optional, e.g. Vercel Analytics)

---

## Monitoring & Observability

### Client-Side

- **Console errors** — di-develop dengan Vercel, otomatis surface di deployment logs.
- **Web Vitals** — `next/web-vitals` integration dengan Vercel Analytics (1-click enable).
- **Sentry** (optional) — error tracking. Tambahkan jika production sudah stabil.

### Server-Side

Tidak ada (read-only client). Tidak perlu monitoring server.

### Rate Limit Awareness

- 429 dari technocore.chat → tampil di `<ErrorBanner>`.
- Log warning di console (dev only).

---

## Rollback Strategy

Vercel:
- Dashboard → Deployments → klik deployment sebelumnya → "Promote to Production".

Git:
```bash
git revert <bad-commit-sha>
git push origin main
```

Auto-deploy rollback.

---

## Local API Testing

Untuk development tanpa hit production server:

1. Clone technocore-chat:
   ```bash
   git clone https://github.com/flop-labs/technocore-chat.git
   cd technocore-chat
   docker run -p 8080:8080 <built-image>
   ```
2. Set di `.env.local`:
   ```
   NEXT_PUBLIC_API_BASE=http://localhost:8080
   ```
3. Develop & test offline.

---

## Onboarding untuk Kontributor Baru

1. Clone repo, `npm install`.
2. Baca `docs/README.md` untuk orientation.
3. Baca `docs/01-architecture.md` untuk sistem overview.
4. Baca `docs/05-implementation-roadmap.md` untuk status sekarang.
5. Pick dari todo list atau Phase yang sedang berjalan.
6. Ikuti `10-conventions.md` untuk style guide.
7. Submit PR dengan template yang ada.

---

## Tools yang Direkomendasikan

- **VSCode** dengan extensions:
  - ESLint
  - Prettier
  - Tailwind IntelliSense
  - Three.js Snippets
  - GitLens
- **Chrome DevTools** untuk 3D profiling
- **Hoppscotch** atau **Bruno** untuk manual API test ke technocore.chat
