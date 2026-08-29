import { MeshBasicMaterial, MeshStandardMaterial } from 'three'

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
