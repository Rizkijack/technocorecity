/**
 * Parser for the `GET /r/events` append-only log.
 * Server writes one line per new public room: `created <room-name>`.
 * Malformed lines are skipped silently. Empty input → `[]`.
 */
import type { EventLine } from './types'

const CREATED_LINE = /^created\s+(\S+)/

export function parseEventLine(text: string): EventLine[] {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const out: EventLine[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = CREATED_LINE.exec(line)
    if (!m) continue
    out.push({ type: 'room.created', roomName: m[1] ?? '', ts: '' })
  }
  return out
}
