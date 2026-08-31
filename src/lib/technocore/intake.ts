/**
 * Intake policy for the room list: how many rooms we request from the
 * upstream, what qualifies a room as "empty" (rendered as a ghost
 * building), and how the 3D search filters rooms.
 *
 * Intake now KEEPS every room — nothing is dropped. Rooms with
 * messageCount < MIN_MESSAGES_FOR_LOADING are rendered as ghost (empty)
 * buildings by the scene; the rest are fully lit buildings.
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
 * A room with fewer than this many messages (sequence number in the
 * live `seq <n>` row) is rendered as an empty "ghost" building instead
 * of a fully lit one.
 */
export const MIN_MESSAGES_FOR_LOADING = 5

/**
 * True when a room has fewer than MIN_MESSAGES_FOR_LOADING messages and
 * is therefore rendered as a ghost (empty) building: dark silhouette,
 * no windows / floor bands / glow, label badge reads "empty".
 * Pure predicate — never mutates the room.
 */
export function isEmptyRoom(room: Room): boolean {
  return room.messageCount < MIN_MESSAGES_FOR_LOADING
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
