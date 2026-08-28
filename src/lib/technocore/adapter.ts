/**
 * Pure parsing functions from raw server text to typed models.
 * All parse code lives here so format changes are localized.
 */
import { ParseError } from './errors'
import type { EventLine, Message, Room } from './types'

/* ----------------------------- rooms parser ------------------------------ */

const SEPARATOR_CELL = /^:?-+:?$/

/**
 * Parse the markdown table from `GET /rooms`.
 *
 * Row layout: `| name | topic | notes | size | idle | share |` (share optional).
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

function parseSizeBytes(s: string, line: string): number {
  const m = /^([\d.]+)\s*([KMG]?B?)$/i.exec(s.trim())
  if (!m) {
    const n = Number.parseInt(s, 10)
    if (Number.isFinite(n)) return n
    throw new ParseError('rooms', `unparseable size cell: "${s}"`, { line })
  }
  const value = Number.parseFloat(m[1] ?? '0')
  const unit = (m[2] ?? '').toUpperCase()
  if (unit.startsWith('K')) return Math.round(value * 1024)
  if (unit.startsWith('M')) return Math.round(value * 1024 * 1024)
  if (unit.startsWith('G')) return Math.round(value * 1024 * 1024 * 1024)
  return Math.round(value)
}

function parseIdleSeconds(s: string, line: string): number {
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

/* --------------------------- messages parser ----------------------------- */

/**
 * Parse `GET /r/<room>` text response.
 *
 * Header line: `# room <name>  messages <n>  range <from>..<to>`
 * Per-message lines: `[<seq>] <ts> <writer> <text>`
 *   writer = `<did:key:z6Mk...>` (signed) or `<~nick>` (unsigned)
 * Comment lines start with `#` or `!!`.
 */
export function parseRoomMessages(text: string): Message[] {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const out: Message[] = []
  // Bracket form: [seq] ts <writer> text (live server).
  const bracketRe = /^\[(\d+)\]\s+(\S+)\s+(<[^>]+>)\s+(.*)$/

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#') || line.startsWith('!!')) continue

    const mA = bracketRe.exec(line)
    if (mA) {
      const seq = Number.parseInt(mA[1] ?? '0', 10)
      const ts = mA[2] ?? ''
      const writer = mA[3] ?? ''
      const inner = writer.slice(1, -1)
      const isSigned = inner.startsWith('did:key:')
      const from = isSigned ? inner : inner.startsWith('~') ? inner : `~${inner}`
      out.push({ seq, from, isSigned, text: mA[4] ?? '', ts })
      continue
    }

    // Pipe form: `seq N|from|text` (with optional "seq " prefix).
    let body = line
    if (body.startsWith('seq ')) body = body.slice(4)
    const idx1 = body.indexOf('|')
    if (idx1 === -1) continue
    const idx2 = body.indexOf('|', idx1 + 1)
    if (idx2 === -1) continue
    const seqStr = body.slice(0, idx1)
    const seq = Number.parseInt(seqStr, 10)
    if (!Number.isFinite(seq)) continue
    let rawSender = body.slice(idx1 + 1, idx2).trim()
    if (rawSender.startsWith('<') && rawSender.endsWith('>')) {
      rawSender = rawSender.slice(1, -1)
    }
    const text = body.slice(idx2 + 1)
    // Require a recognizable writer marker: `~nick` or `did:key:...`. Bare
    // names without a marker are malformed and silently skipped (per docs 06
    // the only sender forms are `<did:key:...>` and `<~nick>`).
    if (!rawSender.startsWith('~') && !rawSender.startsWith('did:key:')) continue
    const isSigned = rawSender.startsWith('did:key:')
    const from = isSigned ? rawSender : rawSender
    out.push({ seq, from, isSigned, text, ts: '' })
  }

  return out
}

/* --------------------------- events parser ------------------------------- */

/**
 * Parse `GET /r/events` text response.
 * Server writes one line per new public room: `created <room-name>`.
 */
export function parseEventLine(text: string): EventLine[] {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const out: EventLine[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = /^created\s+(\S+)/.exec(line)
    if (!m) continue
    out.push({ type: 'room.created', roomName: m[1] ?? '', ts: '' })
  }
  return out
}

/* ----------------------------- validation -------------------------------- */

export function assertNonEmpty(context: string, text: string): void {
  if (!text || !text.trim()) {
    throw new ParseError(context, 'response was empty', { text })
  }
}
