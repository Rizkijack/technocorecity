# 10 — Conventions

Konvensi penulisan kode, file, branch, dan commit untuk TechnocoreCity. Konsistensi = mudah di-review dan di-maintain.

## File & Folder Naming

### Files

- **React component**: PascalCase, `.tsx` extension. Contoh: `Building.tsx`, `RoomPanel.tsx`.
- **Hook**: camelCase, `use-` prefix. Contoh: `useRooms.ts`, `useRoomMessages.ts`.
- **Library/util**: camelCase. Contoh: `adapter.ts`, `fingerprint.ts`, `format.ts`.
- **Type-only file**: camelCase dengan suffix `.types.ts` atau dalam `types.ts`. Contoh: `types.ts`.
- **Test**: `.test.ts` atau `.test.tsx` di folder `__tests__/` atau co-located.
- **Config**: lowercase atau `kebab-case`. Contoh: `tailwind.config.ts`, `next.config.mjs`.

### Folders

- Semua lowercase, **kebab-case** untuk multi-word. Contoh: `src/components/three/`, `src/lib/technocore/`.
- Co-located tests: `__tests__/` (double underscore convention).
- Route groups Next.js: `(group-name)`.

### Contoh Struktur

```
✅ src/components/three/Building.tsx
✅ src/components/three/CameraRig.tsx
✅ src/components/ui/RoomPanel.tsx
✅ src/hooks/useRooms.ts
✅ src/lib/technocore/adapter.ts
✅ src/lib/three/layout.ts
✅ src/lib/utils/format.ts
✅ src/lib/technocore/__tests__/adapter.test.ts

❌ src/components/Three/building.tsx
❌ src/hooks/UseRooms.ts
❌ src/lib/utils/Format.ts
```

---

## Component Naming

- **PascalCase** untuk component name dan file.
- Nama harus deskriptif, single-purpose.
- Default export HANYA untuk component utama di file.
- Helper components (tidak di-export): PascalCase, defined di top of file.

```typescript
// ✅ Good
export function Building({ room, position }: BuildingProps) { ... }

// ❌ Avoid
export default function building({ room, position }: BuildingProps) { ... }
```

---

## TypeScript

### Strict Mode

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Types vs Interfaces

- **Interface** untuk object shapes yang akan di-extend.
- **Type alias** untuk unions, tuples, computed types.

```typescript
// ✅ Interface
export interface Room {
  name: string
  topic: string
}

// ✅ Type
export type Selection = { roomId: string } | { agentKey: string } | null
```

### Avoid `any`

Dilarang kecuali di **boundary adapter** dengan komentar alasan:

```typescript
// ❌ Bad
function parseResponse(data: any) { ... }

// ✅ Acceptable at boundary, with comment
// Server response shape is not stable; cast through unknown for safety.
function parseResponse(data: unknown): Room[] {
  // ...
}
```

### Naming Conventions

- **Type/Interface**: PascalCase.
- **Generic**: `T`, `K`, `V` untuk simple; `<TItem>` untuk domain.
- **Enum-like union**: kebab-case string literal.

```typescript
type EventType = 'room.created' | 'agent.active' | 'message.new'
```

---

## React Patterns

### Component Structure

```typescript
// 1. Imports
import { useState } from 'react'
import { useStore } from '@/stores/world-store'

// 2. Types
interface BuildingProps {
  room: Room
  position: [number, number, number]
}

// 3. Component
export function Building({ room, position }: BuildingProps) {
  // 3a. Hooks
  const selected = useStore(s => s.selectedRoomId === room.name)
  
  // 3b. Handlers
  const handleClick = () => {
    useStore.getState().selectRoom(room.name)
  }
  
  // 3c. Render
  return (
    <mesh position={position} onClick={handleClick}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="cyan" />
    </mesh>
  )
}
```

### Hooks Order

1. State hooks
2. Store/Context hooks
3. Refs
4. Custom hooks
5. Effects
6. Memoed callbacks/values
7. Event handlers

### Memoization

Hanya memoize jika:
- Computed value expensive (>1ms).
- Passed to memoized child component.
- Used in dependency array yang sering berubah.

Jangan over-memoize — `useMemo`/`useCallback` punya cost sendiri.

### Avoid Prop Drilling

Untuk state yang dipakai di banyak tempat → zustand store.
Untuk 1–2 level → props OK.

---

## Styling

### Tailwind

- Utility-first.
- Pakai `cn()` helper untuk conditional classes:

```typescript
import { cn } from '@/lib/utils/cn'

className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' ? 'text-accent-cyan' : 'text-text-primary'
)}
```

### CSS Variables

Gunakan untuk theme tokens (lihat `07-design-language.md`):

```tsx
<div style={{ color: 'var(--accent-cyan)' }} />
```

```css
/* globals.css */
:root {
  --accent-cyan: #00d4ff;
}
```

### Don't

- ❌ Inline `style` objects untuk hal yang bisa di-Tailwind.
- ❌ Custom CSS kecuali benar-benar perlu (animation, pseudo-element).
- ❌ `@apply` berlebihan — biasakan utility langsung di JSX.

---

## Error Handling

### Throw at Boundaries, Catch at UI

- Library code: `throw new XxxError(...)`.
- Component code: `try/catch` di event handler atau SWR error state.
- Top-level: `<ErrorBoundary>` di `app/layout.tsx` (P1).

```typescript
// adapter.ts — throw
export function parseRooms(text: string): Room[] {
  if (!text.includes('|')) {
    throw new ParseError('rooms', 'Response missing table', { text })
  }
  // ...
}

// useRooms.ts — catch via SWR
const { data, error } = useSWR(['rooms'], fetchAndParse)
if (error) return <ErrorBanner error={error} />
```

### Error Messages

- User-facing: jelas, actionable. "Couldn't load rooms. Retry?" bukan "NetworkError 500".
- Dev-facing: sertakan context. `ParseError: rooms table missing at line 5`.

---

## Testing

### Unit Tests

File co-located di `__tests__/` atau `.test.ts` next to source.

```typescript
// adapter.test.ts
import { describe, it, expect } from 'vitest'
import { parseRoomMessages } from './adapter'

describe('parseRoomMessages', () => {
  it('parses signed and unsigned writers', () => {
    const text = `1|~alice|hello
2|<did:key:z6MkhaX...>|signed`
    const result = parseRoomMessages(text)
    expect(result).toHaveLength(2)
    expect(result[0].isSigned).toBe(false)
    expect(result[1].isSigned).toBe(true)
  })

  it('handles text containing pipe character', () => {
    const text = `1|~alice|hello | world`
    const result = parseRoomMessages(text)
    expect(result[0].text).toBe('hello | world')
  })
})
```

### Integration Tests

Pakai Vitest + mock fetch. Atau Playwright untuk E2E (P1).

### Coverage Target

- **Adapter**: 90%+ (critical path).
- **Hooks**: 70%+ (logical paths).
- **Components**: smoke test only (rendering + key interaction).

---

## Comments

### When to Comment

- ✅ **Why** something is done (rationale, trade-off).
- ✅ **Gotchas** (subtle behavior, browser quirks).
- ✅ **References** (link to docs, ticket, ADR).
- ❌ **What** the code does (jelas dari nama).

```typescript
// ✅ Good
// Server's long-poll may return empty after full wait — normal, re-poll.
if (!text.trim()) continue

// ❌ Bad
// Increment counter
counter++
```

### JSDoc for Public APIs

Untuk exported function di `lib/`, pakai JSDoc ringkas:

```typescript
/**
 * Parse markdown table from GET /rooms response.
 * @throws {ParseError} if response format is unrecognized.
 */
export function parseRooms(text: string): Room[] { ... }
```

---

## Imports

### Order

1. External (React, third-party)
2. Internal (`@/...`)
3. Relative (`./...`)
4. Types

Pisahkan dengan blank line. ESLint auto-sort bisa di-setup.

```typescript
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import { useStore } from '@/stores/world-store'
import { parseRoomMessages } from '@/lib/technocore/adapter'

import { Building } from './Building'
import type { BuildingProps } from './Building.types'
```

### Path Aliases

Setup di `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Gunakan `@/...` bukan relative panjang.

---

## Git Conventions

Lihat `09-deployment-and-workflow.md` untuk commit format dan branch naming.

### Commit Message Style

- Subject ≤ 72 char.
- Imperative mood: "add", "fix", "refactor" — bukan "added", "fixes".
- No trailing period.
- Body wrap at 72 char.

```bash
feat(scene): add building rendering from /rooms data

Use circle layout with radius scaled to room count. Each building
height reflects log(messageCount) so active rooms stand taller.
Materials use emissive cyan with intensity proportional to activity.

Closes #42
```

### Don't Commit

- `.env.local`, secrets, credentials
- `node_modules/`, `.next/`, `out/`, `dist/`
- `.DS_Store`, IDE-specific files
- Console.log debug statements (kecuali intentional dengan prefix `// DEBUG:`)

Sudah di-handle oleh `.gitignore`.

---

## Performance Conventions

Lihat `08-performance-and-caching.md` untuk detail. Singkatnya:

- ✅ Memoize expensive computation.
- ✅ Cleanup effect (abort, unsubscribe).
- ✅ Share geometry/material.
- ❌ Create new object di render body (selalu useMemo atau di luar).
- ❌ Subscribe ke seluruh store jika cuma butuh 1 field.

```typescript
// ❌ Bad — re-render setiap store update
const state = useStore()

// ✅ Good — re-render hanya saat selectedRoomId berubah
const selectedRoomId = useStore(s => s.selectedRoomId)
```

---

## Accessibility (A11y)

- Semantic HTML (`<button>`, `<nav>`, `<main>`).
- ARIA labels untuk icon-only buttons.
- Focus visible (jangan `outline: none` tanpa replacement).
- Keyboard navigable (Tab order, Escape to close).
- Color contrast minimum WCAG AA (4.5:1 untuk body text).
- Reduced motion: hormati `prefers-reduced-motion`.

---

## Documentation

- Setiap file module exported → ada 1-line JSDoc ringkas.
- Logic non-obvious → inline comment.
- ADRs untuk keputusan arsitektur.
- `docs/` untuk human-readable overview.

Update docs saat behavior berubah.

---

## Linting

ESLint config mengikuti Next.js preset. Tambahan:

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react/jsx-key": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

Prettier config default. Jangan custom formatter rules tanpa diskusi.

---

## Code Review Checklist

Sebelum approve PR:

- [ ] Lint, typecheck, test pass
- [ ] Conventional commit message
- [ ] No `console.log` debug statements tertinggal
- [ ] No new `any` tanpa komentar
- [ ] Cleanup functions di effects
- [ ] Performance impact dipertimbangkan (memoization, instancing)
- [ ] A11y dipertimbangkan (keyboard, ARIA)
- [ ] Update docs jika behavior berubah
- [ ] Manual testing di local
- [ ] Preview URL (Vercel) di-test
