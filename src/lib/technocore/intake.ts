/**
 * Intake policy for the room list: how many rooms we request from the
 * upstream, what qualifies a room as "loadable" (rendered as a building),
 * and how the 3D search filters loadable rooms.
 *
 * Pure functions only — no side effects, safe for unit tests and for both
 * server (proxy route) and client (hook) consumers.
 */
import type { Room } from './types'

/**
 * Max rooms the upstream returns per single `GET /rooms` request (hard
 * server cap: limit=500/limit=2000 still yield 200 rows; there is no
 * pagination). 200 is therefore the ceiling of one request.
 */
export const ROOMS_LIMIT = 200

/**
 * A room must have at least this many messages (sequence number in the
 * live `seq <n>` row) to become a loadable building in the city.
 */
export const MIN_MESSAGES_FOR_LOADING = 5

/**
 * Keep only rooms with `messageCount >= MIN_MESSAGES_FOR_LOADING`.
 * Returns a new array; the input is never mutated. Names are passed
 * through exactly as parsed (no normalization).
 */
export function filterLoadableRooms(rooms: Room[]): Room[] {
  return rooms.filter((room) => room.messageCount >= MIN_MESSAGES_FOR_LOADING)
}

/**
 * Case-insensitive substring match on `name` OR `topic`.
 * A trimmed-empty query matches every room. Whitespace around the query
 * is ignored.
 */
export function matchesRoomQuery(room: Room, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return room.name.toLowerCase().includes(q) || room.topic.toLowerCase().includes(q)
}
