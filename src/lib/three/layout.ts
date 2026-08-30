import type { Room } from '@/lib/technocore/types'

export type RoomPosition = readonly [number, number]

/**
 * Place each room on the XZ plane in a circle around the origin.
 *
 * Radius scales sub-linearly with room count so the circle stays within
 * the camera's frustum and the fog plane (~120 units). With 50 rooms the
 * naive `n * 3` formula would place them at radius 150 — well behind the
 * fog — and the user would see an empty scene. Capping at 60 keeps the
 * ring visible for any reasonable count.
 *
 * Each room is evenly spaced: angle = (i / n) * 2π.
 */
export function computePositions(
  rooms: readonly Room[],
): Map<string, RoomPosition> {
  const map = new Map<string, RoomPosition>()
  if (rooms.length === 0) return map

  const n = rooms.length
  // sqrt growth: 12 rooms -> 35, 50 rooms -> 50, 200 rooms -> 60 (capped)
  const radius = Math.min(60, 10 + Math.sqrt(n) * 7)

  for (let i = 0; i < n; i++) {
    const room = rooms[i]!
    const angle = (i / n) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    map.set(room.name, [x, z] as const)
  }

  return map
}
