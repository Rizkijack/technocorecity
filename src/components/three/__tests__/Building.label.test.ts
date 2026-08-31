/**
 * Regression test for the "room name invisible" bug.
 *
 * Bug history:
 *   1. The building label was implemented as a drei `<Html>` element.
 *   2. The label was migrated to a THREE.Sprite + CanvasTexture approach
 *      (the `makeLabelTexture` function in Building.tsx) so it works
 *      under any DOM stacking and always faces the camera.
 *   3. During that migration the `<sprite>` consumer in the JSX was
 *      accidentally removed, leaving `makeLabelTexture` as dead code.
 *      Result: no label was rendered on any building.
 *   4. A later attempt re-introduced a `<Html>` block without restoring
 *      the `Html` import from `@react-three/drei`, breaking the build.
 *
 * This test pins the contract at the module boundary so the bug cannot
 * silently regress:
 *   - `makeLabelTexture` is exported (the label mechanism exists).
 *   - The module imports `THREE` (the sprite implementation depends on it)
 *     and does NOT import `Html` from drei (the broken state is detected).
 *   - `Building` is exported as a named export.
 *   - The JSX contains a `<sprite>` consumer (the label is actually wired up).
 *
 * The visual correctness (label actually appears on screen, correct size,
 * correct text) is verified manually + via the dev server smoke test,
 * because it requires a real WebGL canvas that jsdom cannot provide.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as BuildingModule from '../Building'
import { Building, makeLabelTexture } from '../Building'

// `import.meta.url` → path to this test file. Vitest ESM supports it.
const here = fileURLToPath(import.meta.url)
const buildingSource = readFileSync(resolve(dirname(here), '../Building.tsx'), 'utf8')

describe('Building module — label regression guards', () => {
  it('exports makeLabelTexture (the sprite label mechanism must exist)', () => {
    expect(makeLabelTexture).toBeDefined()
    expect(typeof makeLabelTexture).toBe('function')
  })

  it('exports Building component', () => {
    expect(Building).toBeDefined()
    expect(typeof Building).toBe('function')
  })

  it('does NOT import Html from @react-three/drei (the broken state)', () => {
    // The migration to sprite-based labels intentionally removed the drei
    // <Html> import. Re-introducing it without restoring the consumer in
    // JSX is what caused the original "room name invisible" bug + a build
    // failure. Guard against that.
    expect(buildingSource).not.toMatch(/from\s+['"]@react-three\/drei['"]/)
  })

  it('imports THREE (required by Sprite / SpriteMaterial / CanvasTexture)', () => {
    expect(buildingSource).toMatch(/from\s+['"]three['"]/)
  })

  it('renders a <sprite> element in the JSX (the label consumer is wired up)', () => {
    // The single most important regression guard: the JSX must contain a
    // <sprite element. If the sprite is removed, the label is invisible
    // (the bug we are fixing).
    expect(buildingSource).toMatch(/<sprite[\s>]/)
    // And the sprite must be configured for constant screen size, so the
    // name is legible at any camera distance (free view + inside gedung).
    expect(buildingSource).toMatch(/sizeAttenuation=\{false\}/)
  })

  it('module exports the expected public surface', () => {
    // If this set changes unintentionally, reviewers should be alerted —
    // downstream code (e.g. components/three/index.ts) re-exports Building.
    const exportNames = Object.keys(BuildingModule).sort()
    expect(exportNames).toContain('Building')
    expect(exportNames).toContain('makeLabelTexture')
  })
})

describe('Building module — ghost (empty) building guards', () => {
  it('label badge has both variants: "N msgs" (active) and "empty" (ghost)', () => {
    // Active rooms keep the compact message-count badge…
    expect(buildingSource).toMatch(/formatNumber\(room\.messageCount\)/)
    // …while ghost rooms (< MIN_MESSAGES_FOR_LOADING) show a literal "empty" badge.
    expect(buildingSource).toMatch(/ghost \? 'empty'/)
  })

  it('ghost buildings suppress floor bands and window planes', () => {
    // An empty building has no floors to segment and no lit windows.
    expect(buildingSource).toMatch(/!ghost &&\s*bandYs\.map/)
    expect(buildingSource).toMatch(/!ghost &&\s*windowYs\.map/)
  })

  it('ghost buildings use a dark silhouette with zero glow', () => {
    // Dim slate edges (not cyan) — silhouette readable but cold.
    expect(buildingSource).toMatch(/#3f5f96/)
    // No emissive glow on body or antenna, and no selected point light.
    expect(buildingSource).toMatch(/ghost \? 0 : emissiveIntensity/)
    expect(buildingSource).toMatch(/ghost \? 0 : isSelected \? 0\.6 : 0\.22/)
    expect(buildingSource).toMatch(/isSelected && !ghost/)
  })
})
