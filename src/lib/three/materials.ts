import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three'

/**
 * Shared material for signed agents (DID-key holders).
 * `toneMapped: false` keeps the cyan bright through the bloom pass.
 */
export const signedMaterial = new MeshBasicMaterial({
  color: 0x00d4ff,
  toneMapped: false,
})

/**
 * Shared material for unsigned agents (anonymous nicks).
 */
export const unsignedMaterial = new MeshBasicMaterial({
  color: 0xe8eaf6,
  toneMapped: false,
})

// Ground material — shared, matte plane.
const groundMat = new MeshStandardMaterial({
  color: 0x0a0e27,
  roughness: 0.9,
  metalness: 0.1,
})

export const groundMaterialInst = groundMat

export function groundMaterial(): MeshStandardMaterial {
  return groundMat
}

// ——— Building detail materials ———

export const podiumMaterialInst = new MeshStandardMaterial({
  color: 0x2a3160,
  roughness: 0.85,
  metalness: 0.15,
})

export const rooftopMaterialInst = new MeshStandardMaterial({
  color: 0x1e2a5a,
  roughness: 0.5,
  metalness: 0.45,
})

export const floorBandMaterialInst = new MeshStandardMaterial({
  color: 0x263166,
  emissive: 0x00d4ff,
  emissiveIntensity: 0.15,
  roughness: 0.6,
  metalness: 0.4,
})

export const windowMaterialInst = new MeshStandardMaterial({
  color: 0x0f1e38,
  emissive: 0x00d4ff,
  emissiveIntensity: 0.9,
  roughness: 0.25,
  metalness: 0.2,
  side: DoubleSide,
})

export const antennaMaterialInst = new MeshStandardMaterial({
  color: 0x2a3160,
  roughness: 0.4,
  metalness: 0.6,
})

// ——— Ground road/curb ———
export const roadMaterialInst = new MeshStandardMaterial({
  color: 0x1a1f3d,
  roughness: 0.9,
  metalness: 0.1,
})
export function roadMaterial(): MeshStandardMaterial {
  return roadMaterialInst
}

export const curbMaterialInst = new MeshStandardMaterial({
  color: 0x2a3160,
  roughness: 0.85,
  metalness: 0.15,
})
export function curbMaterial(): MeshStandardMaterial {
  return curbMaterialInst
}
