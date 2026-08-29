import { BoxGeometry, PlaneGeometry } from 'three'

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
export function createBuildingGeometry(
  w: number,
  h: number,
  d: number,
): BoxGeometry {
  return new BoxGeometry(w, h, d)
}
