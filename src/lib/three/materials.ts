import { MeshBasicMaterial, MeshStandardMaterial } from 'three'

import type { Room } from '@/lib/technocore/types'

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

/**
 * Factory wrappers for consumers that call materials as functions
 * (e.g. `signedAgentMaterial()`). They return the shared instance
 * so per-frame allocations are avoided. Callers that mutate the
 * material should clone first if they need per-instance state.
 */
export function signedAgentMaterial(): MeshBasicMaterial {
  return signedMaterial
}

export function unsignedAgentMaterial(): MeshBasicMaterial {
  return unsignedMaterial
}

/**
 * Create a building material. Each building gets its own instance
 * so per-building emissive intensity can vary without cloning at render.
 */
export function buildingMaterialFactory(
  _room?: Room,
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x1c2347,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.15,
    roughness: 0.55,
    metalness: 0.35,
  })
}

/** Alias kept for `Building.tsx` which imports `buildingMaterial`. */
export function buildingMaterial(room?: Room): MeshStandardMaterial {
  return buildingMaterialFactory(room)
}

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
