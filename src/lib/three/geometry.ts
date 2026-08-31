import { BoxGeometry, BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'

/**
 * Shared agent geometry — a small cube reused for every agent point
 * to keep GPU memory to a single buffer.
 */
export const sharedAgentGeometry = new BoxGeometry(0.3, 0.3, 0.3)

/** Shared ground plane — unit square, scaled at mesh level. */
export const groundPlaneGeometry = new PlaneGeometry(1, 1)

/**
 * Create a building box geometry with given dimensions.
 */
export function createBuildingGeometry(w: number, h: number, d: number): BoxGeometry {
  return new BoxGeometry(w, h, d)
}

// ——— Podium / Rooftop / Floor helpers — cheap, cached ———

const podiumCache = new Map<string, BoxGeometry>()
export function podiumGeometryFor(w: number, d: number): BoxGeometry {
  const key = `${w.toFixed(2)}|${d.toFixed(2)}`
  let g = podiumCache.get(key)
  if (!g) {
    g = new BoxGeometry(w + 0.6, 0.4, d + 0.6)
    podiumCache.set(key, g)
  }
  return g
}

const rooftopCache = new Map<string, BoxGeometry>()
export function rooftopGeometryFor(w: number, d: number): BoxGeometry {
  const key = `${w.toFixed(2)}|${d.toFixed(2)}`
  let g = rooftopCache.get(key)
  if (!g) {
    g = new BoxGeometry(w * 0.58, 0.6, d * 0.58)
    rooftopCache.set(key, g)
  }
  return g
}

const floorBandCache = new Map<string, BoxGeometry>()
export function floorBandGeometryFor(w: number, d: number): BoxGeometry {
  const key = `${w.toFixed(2)}|${d.toFixed(2)}`
  let g = floorBandCache.get(key)
  if (!g) {
    g = new BoxGeometry(w + 0.05, 0.05, d + 0.05)
    floorBandCache.set(key, g)
  }
  return g
}

const floorLineCache = new Map<string, BufferGeometry>()
export function floorLineGeometryFor(w: number, d: number): BufferGeometry {
  const key = `${w.toFixed(2)}|${d.toFixed(2)}`
  let g = floorLineCache.get(key)
  if (!g) {
    const hw = w / 2
    const hd = d / 2
    const geo = new BufferGeometry()
    const pos = new Float32Array([
      -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd, -hw, 0, -hd,
    ])
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g = geo
    floorLineCache.set(key, g)
  }
  return g
}

/** Small window plane shared by all buildings */
export const sharedWindowGeometry = new PlaneGeometry(0.55, 0.75)

/** Antenna stick */
export const sharedAntennaGeometry = new BoxGeometry(0.1, 1.0, 0.1)

// ——— Ground road/curb — shared, scaled at mesh level ———
/** Road uses the same unit plane, scaled to [len, width] */
export const sharedRoadGeometry = groundPlaneGeometry
/** Curb along X (east-west): length scaled on X, 0.08 high, 0.4 deep */
export const sharedCurbXGeometry = new BoxGeometry(1, 0.08, 0.4)
/** Curb along Z (north-south): 0.4 wide, 0.08 high, length scaled on Z */
export const sharedCurbZGeometry = new BoxGeometry(0.4, 0.08, 1)
