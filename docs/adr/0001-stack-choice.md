# ADR 0001: Stack Choice — Next.js 14 + R3F

**Status:** Accepted
**Date:** 2026-08-28
**Deciders:** Project maintainer

## Context

TechnocoreCity adalah 3D web visualization untuk data publik technocore.chat. Kita butuh:
- 3D rendering performant (WebGL/Three.js)
- UI overlay (panel, popover, controls)
- Data fetching dengan caching
- Hosting gratis dengan deployment mudah
- TypeScript untuk type safety (data API tidak stable)

## Decision

**Next.js 14 (App Router) + TypeScript + @react-three/fiber + @react-three/drei + three.js + zustand + swr + Tailwind CSS.**

## Rationale

### Why Next.js

- **Vercel deployment zero-config** — push to main, auto-deploy.
- **App Router** dengan RSC + Client Components hybrid (sesuai kebutuhan: data fetching client-side, rendering mostly client untuk 3D).
- **TypeScript first-class** — `tsconfig.json` strict, plugin resmi.
- **Image optimization, font loading, code splitting** built-in.
- **SEO-friendly** untuk landing page (jika ada nanti).
- **Ecosistem tooling** mature: ESLint config, Prettier, testing setup.

### Why @react-three/fiber (R3F)

- **Declarative React API** untuk Three.js — natural fit untuk React-based stack.
- **Ecosistem drei** untuk helpers (OrbitControls, Text, Html, Environment, dll) yang menghemat 100+ lines boilerplate.
- **TypeScript support** solid.
- **Performance** sebanding vanilla three.js (zero-cost abstraction).
- **Auto-cleanup** saat unmount (no manual `.dispose()`).

### Why zustand (not Redux/Jotai/Recoil)

- **Boilerplate minimal** — tidak perlu actions, reducers, providers.
- **Selector pattern** untuk re-render control.
- **Sync API** — mudah di-test, tidak ada context wrapper.
- **TypeScript inference** excellent.

### Why swr (not TanStack Query, not custom)

- **Lightweight** — fokus ke caching, retries, revalidation.
- **Built-in deduping, focus revalidation, error retry**.
- **Pattern simple**: `useSWR(key, fetcher)`.
- **Cocok dengan Next.js** (ada integrasi dengan `_app`).

### Why Tailwind

- **Utility-first** cocok untuk UI overlay yang mostly composed dari spacing & color.
- **Bundle size** kecil (tree-shake unused classes).
- **Konvensi** — `cn()` helper + class names yang deterministic.

## Alternatives Considered

### Vite + React + R3F

- **Pros:** Faster dev server, lighter bundle.
- **Cons:** Lose Vercel zero-config, need custom SSR setup if needed, more boilerplate untuk production deploy.
- **Rejected because:** Deployment friction tidak sebanding dengan dev speed gain.

### Vanilla Three.js + TypeScript

- **Pros:** No framework overhead, full control.
- **Cons:** UI overlay (panel, popover) perlu ditulis manual atau pakai vanilla DOM — kehilangan komposability React.
- **Rejected because:** UI overlay + 3D scene lebih natural sebagai hybrid React.

### React Three Fiber + Remix

- **Pros:** Loader pattern lebih clean.
- **Cons:** Vercel support untuk Remix OK tapi ekosistem lebih kecil, lebih banyak setup.
- **Rejected because:** Next.js lebih familiar dan tooling lebih mature.

### Solid.js + Three.js

- **Pros:** Lebih performant dari React.
- **Cons:** Ekosistem R3F-equivalent kurang, kontributor lebih sedikit.
- **Rejected because:** Hire-ability & long-term maintenance.

## Consequences

### Positive

- Easy onboarding untuk developer React.
- Deploy satu-klik ke Vercel.
- TypeScript end-to-end.
- Library yang dipilih saling melengkapi (tidak overlap).

### Negative

- Bundle size Next.js shell ~80KB (tetap kecil setelah gzip).
- R3F ada learning curve untuk developer yang belum pernah three.js.
- Harus aware akan React 18 strict mode (double-render di dev).

### Neutral

- Tidak ada backend sama sekali — semua data fetched client-side.
- Hosting Vercel punya limitasi di free tier (cukup untuk MVP, monitor jika viral).

## References

- [Next.js docs](https://nextjs.org/docs)
- [@react-three/fiber](https://r3f.docs.pmnd.rs/)
- [@react-three/drei](https://github.com/pmndrs/drei)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [SWR](https://swr.vercel.app/)
