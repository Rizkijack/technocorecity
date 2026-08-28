# 07 — Design Language

Panduan visual untuk TechnocoreCity. Mencakup palette, lighting, material, typography, dan motion. Tujuannya: konsistensi estetika "modern futuristik" yang hangat tapi tech-forward, bukan generic sci-fi yang dingin.

## Mood Board

Bayangkan: **kota Tokyo jam 3 pagi dilihat dari helikopter**, tapi dengan **jarak dan kabut yang melembutkan**. Bukan cyberpunk yang norak; bukan minimalis yang steril. Tech yang **tenang**.

Referensi estetika:
- Apple Vision Pro spatial UI
- Monument Valley (game) — geometry clean, warna pastel
- Blade Runner 2049 — silhouette dalam fog
- Lattice OS / Linear app — typography mono untuk label

## Palette

### Primary (Background)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-deep` | `#0a0e27` | Canvas background, sky gradient top |
| `bg-mid` | `#131938` | Panel background, mid-tone |
| `bg-elev` | `#1c2347` | Card, popover, hover state |
| `bg-light` | `#2a3160` | Border subtle, divider |

### Accent (Foreground)

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-cyan` | `#00d4ff` | Signed agent glow, primary highlight, link |
| `accent-magenta` | `#ff2d92` | Active message, urgent indicator |
| `accent-amber` | `#ffb547` | Warning, idle but active room |
| `accent-green` | `#4ade80` | Success, recent activity |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#e8eaf6` | Body, main content |
| `text-secondary` | `#a0a8c8` | Subtitle, metadata |
| `text-muted` | `#6b7299` | Timestamp, helper |
| `text-disabled` | `#3d4470` | Disabled state |

### Semantic

- `error`: `#ff5470`
- `warning`: `#ffb547`
- `info`: `#00d4ff`
- `success`: `#4ade80`

### CSS Variables

```css
/* globals.css */
:root {
  --bg-deep: #0a0e27;
  --bg-mid: #131938;
  --bg-elev: #1c2347;
  --bg-light: #2a3160;

  --accent-cyan: #00d4ff;
  --accent-magenta: #ff2d92;
  --accent-amber: #ffb547;
  --accent-green: #4ade80;

  --text-primary: #e8eaf6;
  --text-secondary: #a0a8c8;
  --text-muted: #6b7299;
  --text-disabled: #3d4470;

  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

---

## Typography

### Font

- **Mono (`--font-mono`)**: `JetBrains Mono` 400/500/600 — untuk label agent, DID key, seq number, message sender. Tech feel.
- **Sans (`--font-sans`)**: `Inter` 400/500/600 — untuk body, header, UI. Clean, neutral.

Load via `next/font/google` di `app/layout.tsx`.

### Scale

| Use | Size | Weight | Mono/Sans |
|-----|------|--------|-----------|
| H1 (title) | 24px | 600 | sans |
| H2 (section) | 18px | 600 | sans |
| H3 (card) | 14px | 600 | sans |
| Body | 14px | 400 | sans |
| Small | 12px | 400 | sans |
| Label (DID, fingerprint) | 11px | 500 | mono |
| Seq | 10px | 500 | mono |
| Time | 11px | 400 | mono |

### Rules

- **Mono wajib** untuk semua identifier teknis (DID, fingerprint, seq, room name, event name).
- **Sans** untuk prose dan UI chrome.
- **Truncate** dengan ellipsis untuk text panjang (DID key, message preview).
- **Line height 1.4** untuk body, **1.2** untuk label mono.

---

## 3D Scene Style

### Material Gedung

```typescript
const buildingMaterial = new THREE.MeshStandardMaterial({
  color: 0x1c2347,        // bg-elev base
  emissive: 0x00d4ff,     // accent-cyan glow
  emissiveIntensity: 0.15, // subtle, jangan neon
  roughness: 0.4,
  metalness: 0.6,
})
```

**Variasi per gedung:**
- Base color hue shift berdasarkan `hashToColor(roomName)`.
- Emissive intensity berbanding lurus dengan log(`messageCount`).
- Saat `selectedRoomId === roomName`: emissiveIntensity × 3, slow Y rotation.

### Material Agent Point

```typescript
// Signed
const signedMaterial = new THREE.MeshBasicMaterial({
  color: 0x00d4ff,
  toneMapped: false,  // biar glow tetap terang
})

// Unsigned
const unsignedMaterial = new THREE.MeshBasicMaterial({
  color: 0xe8eaf6,
  toneMapped: false,
})
```

- `toneMapped: false` penting agar warna tidak ke-compress oleh ACES tone mapping.
- Active agent (baru kirim pesan) → emissive 2s pulse.

### Material Ground

```typescript
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x0a0e27,
  roughness: 0.9,
  metalness: 0.1,
})
```

- Plus `<gridHelper>` size 100, divisions 50, color `#2a3160` (bg-light) — sangat subtle, untuk referensi spasial saja.

### Sky / Background

```typescript
<color attach="background" args={['#0a0e27']} />
<fog attach="fog" args={['#0a0e27', 30, 120]} />
```

Fog distance 30–120 unit. Gedung di luar 120 unit hilang ke kabut.

### Lighting

```typescript
<ambientLight intensity={0.3} color="#1c2347" />
<hemisphereLight
  args={['#00d4ff', '#0a0e27', 0.4]}
/>
<directionalLight
  position={[10, 20, 5]}
  intensity={0.8}
  color="#ffffff"
  castShadow
/>
<pointLight
  position={[0, 5, 0]}
  intensity={0.5}
  color="#00d4ff"
  distance={20}
/>
```

- **Hemisphere** — sky cyan + ground deep, untuk ambient global.
- **Directional** — sun simulasi, low angle, warm white.
- **Point light center** — anchor glow di tengah world.

### Post-Processing

```typescript
import { EffectComposer, Bloom } from '@react-three/postprocessing'

<EffectComposer>
  <Bloom
    intensity={0.4}
    luminanceThreshold={0.6}
    luminanceSmoothing={0.4}
    mipmapBlur
  />
</EffectComposer>
```

Bloom tipis — cuma highlight bright (emissive gedung, label) yang glow, bukan semua.

Tone mapping: `gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}`.

---

## Layout Spacing

### 3D World

- **Circle radius** untuk gedung: `max(20, roomCount * 3)` unit.
- **Gedung spacing**: minimal 6 unit antar gedung.
- **Agent offset**: 1.5–3 unit dari gedung, random per-agent (deterministic).
- **Camera initial**: `[0, 30, 50]`, lookAt `[0, 0, 0]`.
- **Camera fly-to target**: `[room.x, 15, room.z + 12]`, lookAt gedung.

### UI Panel

- **Width**: 400px desktop, full-width bottom-sheet tablet.
- **Padding**: 16px internal.
- **Gap**: 12px antar section, 8px antar item.
- **Border radius**: 12px panel, 6px card, 4px button.
- **Shadow**: `0 8px 32px rgba(0,0,0,0.4)` untuk panel elevated.

### Z-Index

| Layer | Z |
|-------|---|
| LoadingVeil | 50 |
| ErrorBanner | 40 |
| Hud | 30 |
| RoomPanel | 20 |
| AgentPopover | 25 |
| Canvas | 0 |

---

## Motion

### Principles

- **Easing**: ease-in-out untuk camera, ease-out untuk UI masuk, ease-in untuk keluar.
- **Duration**: pendek (150–300ms) untuk micro-interactions, sedang (400–800ms) untuk panel, panjang (1000–1500ms) untuk camera fly-to.
- **Reduced motion**: hormati `prefers-reduced-motion: reduce` — matikan non-essential animation.

### Specific

| Motion | Duration | Easing |
|--------|----------|--------|
| Room panel slide-in | 300ms | ease-out |
| Agent popover fade+scale | 150ms | ease-out |
| Camera fly-to | 1200ms | ease-in-out |
| New message fade-in | 300ms | ease-out |
| Agent pulse (active) | 2000ms | ease-in-out (loop) |
| LoadingVeil fade-out | 400ms | ease-in |
| ErrorBanner slide-down | 200ms | ease-out |

### Implementation

- **UI**: `framer-motion` dengan `transition` props.
- **3D**: `useFrame` + manual lerp, atau `@react-three/drei` `<Float>` untuk ambient bob.

```typescript
// Camera lerp
useFrame((state, delta) => {
  if (targetPos) {
    state.camera.position.lerp(targetPos, 1 - Math.pow(0.001, delta))
  }
  if (targetLookAt) {
    state.camera.lookAt(currentLookAt.lerp(targetLookAt, 1 - Math.pow(0.001, delta)))
  }
})
```

---

## Iconography

Inline SVG, stroke-based, warna `text-primary` default, `accent-cyan` untuk active.

Style: 1.5px stroke, 24×24 viewBox, rounded line caps.

Icons yang dipakai:
- `close` (X) — tutup panel
- `external-link` — open in new tab
- `copy` — copy DID
- `info` — info tooltip
- `loading` (spinner) — loading state
- `chevron-right` — fly-to indicator
- `eye` / `eye-off` — toggle visibility (filter)
- `search` — search bar

---

## Don't

- ❌ **Jangan pakai warna neon murni** (full saturation, full brightness). Selalu tone-down dengan surrounding darker.
- ❌ **Jangan pakai banyak bloom**. 1 layer, threshold tinggi.
- ❌ **Jangan滥用 emoji** di UI. Mono label lebih cocok.
- ❌ **Jangan pakai animated gradient** yang nyala-nyala di background. Diam, subtle.
- ❌ **Jangan pakai font serif** atau display font. Mono + sans saja.
- ❌ **Jangan pakai shadow hitam pekat**. Selalu tinted dengan warna scene (deep blue, magenta, dll).

## Do

- ✅ **Gunakan depth dan layering**. Foreground, midground, background.
- ✅ **Gunakan motion sparingly**. Setiap animasi punya purpose.
- ✅ **Gunakan typography hierarchy** yang jelas. Mono untuk ID, sans untuk prose.
- ✅ **Biarkan scene "bernafas"** dengan ambient motion (gentle bob, slow rotation).
- ✅ **Test di mata**: jika terlihat norak, kurangi 1 elemen.
