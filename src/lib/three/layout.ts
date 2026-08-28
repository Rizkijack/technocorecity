import type { Room } from '@/lib/technocore/types'

export type RoomPosition = readonly [number, number]

/**
 * Place each room on the XZ plane in a circle around the origin.
 * Radius = max(20, roomCount * 3). Each room is evenly spaced:
 * angle = (i / roomCount) * 2π, x = cos(angle) * radius, z = sin(angle) * radius.
 */
export function computePositions(
  rooms: readonly Room[],
): Map<string, RoomPosition> {
  const map = new Map<string, RoomPosition>()
  if (rooms.length === 0) return map

  const radius = Math.max(20, rooms.length * 3)
  const n = rooms.length

  for (let i = 0; i < n; i++) {
    const room = rooms[i]!
    const angle = (i / n) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    map.set(room.name, [x, z] as const)
  }

  return map
}
