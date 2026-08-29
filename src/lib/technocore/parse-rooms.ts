/**
 * Parser for the markdown table returned by `GET /rooms`.
 * Row layout: `| name | topic | notes | size | idle | share |` (share optional).
 */
import { ParseError } from './errors'
import type { Room } from './types'

const SEPARATOR_CELL = /^:?-+:?$/

export function parseSizeBytes(s: string, line: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*([KMG]?B?)$/i.exec(s.trim())
  if (!m) {
    // Regex failed — accept only a bare integer (e.g. "640"). Anything else
    // (multi-dot "1.2.3k", trailing junk) is malformed and throws rather than
    // silently truncating via parseFloat/parseInt.
    const n = Number.parseInt(s, 10)
    if (Number.isFinite(n) && String(n) === s.trim()) return n
    throw new ParseError('rooms', `unparseable size cell: "${s}"`, { line })
  }
  const value = Number.parseFloat(m[1] ?? '0')
  const unit = (m[2] ?? '').toUpperCase()
  if (unit.startsWith('K')) return Math.round(value * 1024)
  if (unit.startsWith('M')) return Math.round(value * 1024 * 1024)
  if (unit.startsWith('G')) return Math.round(value * 1024 * 1024 * 1024)
  return Math.round(value)
}

export function parseIdleSeconds(s: string, line: string): number {
  // "5s ago", "2m ago", "3h ago", "1d ago"
  const m = /^(\d+)\s*([smhd])/i.exec(s.trim())
  if (!m) {
    const n = Number.parseInt(s, 10)
    if (Number.isFinite(n)) return n
    throw new ParseError('rooms', `unparseable idle cell: "${s}"`, { line })
  }
  const n = Number.parseInt(m[1] ?? '0', 10)
  const unit = (m[2] ?? 's').toLowerCase()
  if (unit === 'd') return n * 86400
  if (unit === 'h') return n * 3600
  if (unit === 'm') return n * 60
  return n
}

/**
 * Parse the markdown table from `GET /rooms`.
 *
 * Prose lines, `#` comments, the header row and the `|---|` separator are
 * skipped. Empty topic is fine. Empty or header-only input → `[]`.
 * Structurally broken rows → `ParseError('rooms', ...)`.
 * Garbage input with no table at all → `ParseError`.
 */
export function parseRooms(text: string): Room[] {
  if (!text) return []
  const rooms: Room[] = []
  const lines = text.split(/\r?\n/)
  // `sawTable` flips to true the moment we observe any structural table
  // element (header row, separator row, or a well-formed data row). If we
  // never see one, the input is garbage and we throw below.
  let sawTable = false

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue

    if (!trimmed.startsWith('|')) {
      // Prose around the table is fine, but it does not count as "table
      // structure" — only headers, separators, or valid rows do.
      continue
    }

    // Drop leading/trailing empty cells from the surrounding pipes.
    const parts = trimmed.split('|').map((c) => c.trim())
    const cells =
      parts.length >= 2 && parts[0] === '' && parts[parts.length - 1] === ''
        ? parts.slice(1, -1)
        : parts

    if (cells.length === 0) continue

    // Separator row: |---|---|...
    if (cells.every((c) => SEPARATOR_CELL.test(c))) {
      sawTable = true
      continue
    }
    // Header row: | name | topic | notes | size | idle | share |
    if (cells[0]?.toLowerCase() === 'name' && cells[1]?.toLowerCase() === 'topic') {
      sawTable = true
      continue
    }

    // Trailing "share" cell is optional → need at least 5 cells.
    if (cells.length < 5) {
      throw new ParseError('rooms', 'unexpected row format', { line: trimmed })
    }
    sawTable = true

    const nameCell = (cells[0] ?? '').replace(/^\/r\//, '').trim()
    if (!nameCell) {
      throw new ParseError('rooms', 'row is missing a room name', { line: trimmed })
    }
    const topic = cells[1] ?? ''
    const notesCell = (cells[2] ?? '').replace(/,/g, '')
    const sizeCell = cells[3] ?? ''
    const idleCell = cells[4] ?? ''

    const messageCount = Number.parseInt(notesCell, 10)
    if (!Number.isFinite(messageCount)) {
      throw new ParseError('rooms', `unparseable notes cell: "${notesCell}"`, {
        line: trimmed,
      })
    }

    rooms.push({
      name: nameCell,
      topic,
      messageCount,
      sizeBytes: parseSizeBytes(sizeCell, trimmed),
      idleSeconds: parseIdleSeconds(idleCell, trimmed),
    })
  }

  // Empty table (header + no rows, or just rows=none) is fine. Garbage with
  // no table structure is a parse failure.
  if (rooms.length === 0 && !sawTable) {
    throw new ParseError('rooms', 'no parseable room rows in response', { text })
  }
  return rooms
}
