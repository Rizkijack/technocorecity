# ADR 0003: Camera & Interaction — OrbitControls + Click-to-Focus + Fly-to

**Status:** Superseded (2026-08-31) — FREE VIEW
**Date:** 2026-08-28
**Superseded:** 2026-08-31 — FREE VIEW: OrbitControls bebas tanpa batas, hapus fly-to/autoRotate/minDistance/maxDistance/maxPolarAngle. Click Building tetap selectRoom tanpa kamera move. Camera initial tetap [0,30,50] fov 50. Rationale: user request free 360 orbit/pan/zoom + WASD pan. Implementation: `src/components/three/CameraRig.tsx` (FREE VIEW), `src/components/three/World.tsx` (camera unchanged).
**Deciders:** Project maintainer

## Context

TechnocoreCity adalah "mini world" 3D. User perlu cara untuk:
1. Mengeksplorasi dunia secara bebas (lihat gedung dari berbagai sudut).
2. Fokus ke satu room untuk baca detail (panel).
3. Kembali ke overview dengan mudah.

Pattern kamera di 3D apps:
- **Orbit**: kamera berputar di sekitar target (bagus untuk object inspection).
- **First-person**: kamera = avatar user (bagus untuk explorable worlds).
- **Fixed cinematic**: kamera bergerak otomatis (bagus untuk cutscene).
- **Hybrid**: kombinasi di atas.

## Decision

**OrbitControls sebagai default, dengan click-to-focus trigger fly-to animation ke gedung yang dipilih, plus ability to zoom in/out.**

## Rationale

### Why OrbitControls (bukan first-person)

- **Mini world = dilihat dari luar** — user ingin lihat keseluruhan kota, bukan jalan di dalamnya.
- **Gedung sebagai landmark** — bukan level untuk dinavigasi internal.
- **Lower cognitive load** — user tidak perlu belajar kontrol movement.
- **Familiar pattern** — Google Maps 3D, Apple Maps Flyover, dll.
- **Touch + mouse friendly** — drei OrbitControls support keduanya.

### Why click-to-focus (bukan auto-focus semua)

- **User-driven** — biarkan user pilih apa yang penting.
- **Avoid camera chaos** — kalau auto-focus, user kehilangan sense of place.
- **Cinematic value** — fly-to animation terasa premium.
- **Standard 3D app pattern** — Sketchfab, Spline, dll pakai pattern sama.

### Why fly-to (bukan instant teleport)

- **Maintain spatial awareness** — user lihat "dari mana" ke "kemana".
- **Smooth feel** — abrupt teleport terasa glitchy.
- **Branding** — kasih moment of delight, sesuai estetika "modern futuristik".

### Why not WASD/first-person

- **Skala dunia** — gedung radius 20+ unit, terlalu besar untuk first-person.
- **Detail yang ditampilkan** — building, agent points; bukan immersive world.
- **Audience target** — viewer/dashboard use case, bukan game use case.

## Implementation

### Default Camera

```typescript
<Canvas
  camera={{
    position: [0, 30, 50],
    fov: 50,
    near: 0.1,
    far: 200,
  }}
>
```

- Elevated position (Y=30) → bird's eye view.
- Distance 50 dari center → bisa lihat circle radius ~30.
- FOV 50 → natural perspective, tidak wide-angle distortion.

### OrbitControls

```typescript
<OrbitControls
  enableDamping
  dampingFactor={0.05}
  minDistance={10}
  maxDistance={120}
  maxPolarAngle={Math.PI / 2.1}  // prevent going underground
  autoRotate={!selectedRoomId}
  autoRotateSpeed={0.3}
/>
```

- `enableDamping` → smooth orbit.
- `minDistance` 10 → jangan terlalu dekat.
- `maxDistance` 120 → fog cutoff, view dunia penuh.
- `maxPolarAngle` ~85° → tidak boleh di bawah tanah.
- `autoRotate` saat tidak ada selection → ambience.

### Click-to-Focus Flow

```
1. User click <Building>
2. worldStore.selectRoom(name)
3. <CameraRig> subscribe → set target
4. useFrame loop → camera.lerp ke target position
5. lookAt lerp ke gedung position
6. Saat dekat → stop lerp, OrbitControls re-enabled
```

### Lerp Implementation

```typescript
useFrame((state, delta) => {
  if (targetPosition) {
    state.camera.position.lerp(targetPosition, 1 - Math.pow(0.001, delta))
  }
  if (targetLookAt) {
    currentLookAt.lerp(targetLookAt, 1 - Math.pow(0.001, delta))
    state.camera.lookAt(currentLookAt)
  }
})
```

`Math.pow(0.001, delta)` memberi frame-rate independent easing. ~1200ms untuk sampai target.

### Target Calculation

```typescript
function getFocusTarget(buildingPos: [number, number, number]) {
  return {
    position: new Vector3(buildingPos[0], 15, buildingPos[2] + 12),
    lookAt: new Vector3(buildingPos[0], buildingPos[1] / 2, buildingPos[2])
  }
}
```

- Y=15 → eye level, tidak bird's eye.
- Z+12 → offset 12 unit dari gedung (tidak terhalang).

### Reset (click elsewhere / Escape)

```typescript
// Back to overview
const overviewPos = new Vector3(0, 30, 50)
const overviewLookAt = new Vector3(0, 0, 0)
```

Tombol "back" di HUD atau double-click empty space.

## Alternatives Considered

### First-person WASD

- **Pros:** Imersive, kontrol eksplisit.
- **Cons:** 
  - Skala dunia tidak cocok (gedung terlalu besar).
  - Lebih susah untuk lihat "layout" kota.
  - Motion sickness risk.
  - Kompleksitas kontrol (WASD + mouse + click conflict).
- **Rejected because:** Use case adalah "viewer", bukan "explorer".

### Top-down only (no orbit)

- **Pros:** Simpler, prediktable.
- **Cons:** Kurang dramatis, tidak bisa lihat gedung dari samping.
- **Rejected because:** Estetika penting, top-down terasa datar.

### Auto-tour (kamera jalan otomatis)

- **Pros:** Zero interaction, "set and forget".
- **Cons:** Tidak personalized, user pasif.
- **Rejected because:** User agency penting, exploration乐趣 hilang.

### Hybrid (toggle first-person ↔ orbit)

- **Pros:** Flexibility.
- **Cons:** Kompleksitas 2×, mode switch confusing.
- **Rejected because:** Tidak ada clear use case untuk first-person di viewer.

### Free camera (no constraints)

- **Pros:** Maximum freedom.
- **Cons:** User bisa nyasar, frustum, bawah tanah.
- **Rejected because:** Constraints membantu onboarding.

## Consequences

### Positive

- Familiar, low learning curve.
- Cinematic feel via fly-to.
- Works on touch + mouse + keyboard.
- Smooth via damping.

### Negative

- Fly-to bisa terasa lambat untuk user impatient (tapi acceptable trade-off untuk estetika).
- OrbitControls sedikit konflik dengan click pada touch device — solved dengan tap detection threshold.
- Auto-rotate bisa di-disable user preference (P2: setting toggle).

### Neutral

- Tidak ada VR/AR mode (P3 future).

## Accessibility Considerations

- `prefers-reduced-motion` → disable fly-to, instant teleport.
- Keyboard alternative: arrow keys untuk pan, +/- untuk zoom (P2, extend via custom hook).
- Focus indicator di gedung yang dipilih (CSS outline equivalent di 3D = highlight emissive).

## References

- [drei OrbitControls](https://github.com/pmndrs/drei#controls)
- [three.js OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)
- [Spline.design interaction patterns](https://spline.design/) — reference for click-to-focus
