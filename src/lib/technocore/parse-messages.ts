/**
 * Parser for `GET /r/<room>` text response.
 *
 * Accepts two wire formats the server has shipped:
 *   - bracket: `[<seq>] <ts> <writer> <text>`   (live)
 *   - pipe:    `<seq>|<writer>|<text>`            (with optional `seq ` prefix)
 *   writer = `<did:key:z6Mk...>` (signed) or `<~nick>` (unsigned)
 * Comment lines start with `#` or `!!`. Empty input → `[]`.
 *
 * Returns `{ messages, dropped }`. `dropped` is regression telemetry: it
 * counts message-looking lines that were rejected ONLY because the sender
 * lacked a `~` or `did:key:` marker. Blank, comment and header lines are
 * structural and never counted.
 */
import type { Message } from './types'

const BRACKET_RE = /^\[(\d+)\]\s+(\S+)\s+(<[^>]+>)\s+(.*)$/

export function parseRoomMessages(text: string): {
  messages: Message[]
  dropped: number
} {
  if (!text) return { messages: [], dropped: 0 }
  const lines = text.split(/\r?\n/)
  const out: Message[] = []
  let dropped = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#') || line.startsWith('!!')) continue

    const bracket = BRACKET_RE.exec(line)
    if (bracket) {
      const seq = Number.parseInt(bracket[1] ?? '0', 10)
      const ts = bracket[2] ?? ''
      const writer = bracket[3] ?? ''
      const inner = writer.slice(1, -1)
      const isSigned = inner.startsWith('did:key:')
      const from = isSigned ? inner : inner.startsWith('~') ? inner : `~${inner}`
      out.push({ seq, from, isSigned, text: bracket[4] ?? '', ts })
      continue
    }

    // Pipe form.
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
    // Require a recognizable writer marker: `~nick` or `did:key:...`. Bare
    // names without a marker are malformed and skipped; each such line is
    // counted in `dropped` so server-side marker regressions stay visible.
    if (!rawSender.startsWith('~') && !rawSender.startsWith('did:key:')) {
      dropped += 1
      continue
    }
    const isSigned = rawSender.startsWith('did:key:')
    out.push({
      seq,
      from: rawSender,
      isSigned,
      text: body.slice(idx2 + 1),
      ts: '',
    })
  }

  return { messages: out, dropped }
}
