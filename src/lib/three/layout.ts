import type { Room } from '@/lib/technocore/types'

export type RoomPosition = readonly [number, number]

/**
 * Place each room on the XZ plane in concentric rings around the origin.
 *
 * WHY RINGS (vs the old single circle): with 200+ buildings a single circle
 * forces every building onto the same radius — either they pile up on top of
 * each other (radius too small) or drift behind the fog (radius too large).
 * Rings fill the innermost ring first, then spill outward, so the city grows
 * outwards with bounded density and a predictable max radius.
 *
 * Geometry (building footprint width 4..8, depth 4 — see Building.tsx):
 *  - RING0_RADIUS = 16       first ring sits well inside fog near=50 so the
 *                            city core is fully visible from the camera.
 *  - RING_GAP = 14           radial distance between ring centers → radial
 *                            clearance ≈ 10 for a depth-4 building.
 *  - ARC_SPACING = 8.0       minimum arc distance between neighbours
 *                            (max building width 8). Slightly tighter than the
 *                            draft 8.5 so rings 0..8 fit ALL 500 rooms at
 *                            radius ≤ 128 (draft 8.5 only fits 474 — the last
 *                            ~26 rooms would sit at 142, behind fog far=140).
 *
 * Ring k has radius r_k = RING0_RADIUS + k * RING_GAP and capacity
 * c_k = floor(2π * r_k / ARC_SPACING). Rooms are assigned ring by ring:
 * room index i lives in the first ring whose cumulative capacity exceeds i.
 *
 * Capacity table (r_k, c_k, cumulative):
 *   k0 r=16   c=12  cum 12
 *   k1 r=30   c=23  cum 35
 *   k2 r=44   c=34  cum 69
 *   k3 r=58   c=45  cum 114
 *   k4 r=72   c=56  cum 170
 *   k5 r=86   c=67  cum 237
 *   k6 r=100  c=78  cum 315
 *   k7 r=114  c=89  cum 404
 *   k8 r=128  c=100 cum 504   ← n=500 still inside fog safe zone (<130)
 *   k9 r=142  c=111 cum 615   ← behind fog far=140; unreachable for n ≤ 504
 *
 * Within a ring, rooms are evenly spaced: angle = (j / c_k) * 2π, where j is
 * the index within the ring (first room at angle 0 → x = r, z = 0). No
 * stagger offset keeps the layout fully deterministic.
 */
const RING0_RADIUS = 16
const RING_GAP = 14
const ARC_SPACING = 8.0

function ringCapacity(ring: number): number {
  const radius = RING0_RADIUS + ring * RING_GAP
  return Math.floor((2 * Math.PI * radius) / ARC_SPACING)
}

export function computePositions(
  rooms: readonly Room[],
): Map<string, RoomPosition> {
  const map = new Map<string, RoomPosition>()
  if (rooms.length === 0) return map

  let ring = 0
  let ringStart = 0 // global index of the first room in the current ring
  let capacity = ringCapacity(ring)

  for (let i = 0; i < rooms.length; i++) {
    // Ring is full → spill to the next, larger ring.
    while (i - ringStart >= capacity) {
      ringStart += capacity
      ring += 1
      capacity = ringCapacity(ring)
    }

    const radius = RING0_RADIUS + ring * RING_GAP
    const j = i - ringStart
    const angle = (j / capacity) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    map.set(rooms[i]!.name, [x, z] as const)
  }

  return map
}
