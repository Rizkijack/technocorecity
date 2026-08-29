import { describe, expect, it } from 'vitest'

import { ParseError } from '../errors'
import { parseEventLine, parseRoomMessages, parseRooms } from '../adapter'

describe('parseRooms', () => {
  it('parses a single room from a typical /rooms response', () => {
    const text = [
      'rooms (server uptime 12h)',
      '| name | topic | notes | size | idle | share |',
      '|------|-------|-------|------|------|-------|',
      '| lobby | general chat | 42 | 12k | 5m | share |',
    ].join('\n')
    const rooms = parseRooms(text)
    expect(rooms).toHaveLength(1)
    expect(rooms[0]).toEqual({
      name: 'lobby',
      topic: 'general chat',
      messageCount: 42,
      sizeBytes: 12 * 1024,
      idleSeconds: 5 * 60,
    })
  })

  it('parses multiple rooms with mixed empty and non-empty topics', () => {
    const text = [
      '| name | topic | notes | size | idle | share |',
      '|------|-------|-------|------|------|-------|',
      '| lobby | general chat | 42 | 12k | 5m | share |',
      '| meta | | 3 | 1k | 2h | share |',
      '| d-bart-room | private-ish | 7 | 2k | 30s | share |',
      '| archive | old stuff | 99 | 5k | 3d |',
    ].join('\n')
    const rooms = parseRooms(text)
    expect(rooms).toHaveLength(4)
    expect(rooms[0]!.topic).toBe('general chat')
    expect(rooms[1]!.topic).toBe('')
    expect(rooms[2]!.name).toBe('d-bart-room')
    expect(rooms[3]!.idleSeconds).toBe(3 * 24 * 3600)
  })

  it('handles size k suffix and idle s/m/h/d units', () => {
    const text = [
      '| name | topic | notes | size | idle | share |',
      '|------|-------|-------|------|------|-------|',
      '| a | t | 1 | 1k | 30s | share |',
      '| b | t | 2 | 2k | 5m | share |',
      '| c | t | 3 | 3k | 2h | share |',
      '| d | t | 4 | 4k | 3d | share |',
    ].join('\n')
    const rooms = parseRooms(text)
    expect(rooms.map(r => r.sizeBytes)).toEqual([1024, 2048, 3072, 4096])
    expect(rooms.map(r => r.idleSeconds)).toEqual([
      30,
      5 * 60,
      2 * 3600,
      3 * 86400,
    ])
  })

  it('parses decimal and bare size cells and rejects multi-dot sizes', () => {
    const text = [
      '| name | topic | notes | size | idle | share |',
      '|------|-------|-------|------|------|-------|',
      '| a | t | 1 | 1.2k | 1m | share |',
      '| b | t | 2 | 640 | 1m | share |',
      '| c | t | 3 | 3M | 1m | share |',
    ].join('\n')
    const rooms = parseRooms(text)
    expect(rooms.map((r) => r.sizeBytes)).toEqual([1229, 640, 3145728])

    // Multi-dot is malformed: must throw, not silently truncate to 1.2.
    expect(() => parseRooms('| d | t | 4 | 1.2.3k | 1m |')).toThrow(ParseError)
  })

  it('returns [] for empty input', () => {
    expect(parseRooms('')).toEqual([])
  })

  it('returns [] for header-only table (no rooms yet)', () => {
    const text = [
      'rooms (server uptime 12h)',
      '| name | topic | notes | size | idle | share |',
      '|------|-------|-------|------|------|-------|',
    ].join('\n')
    expect(parseRooms(text)).toEqual([])
  })

  it('throws ParseError on structurally broken rows', () => {
    expect(() => parseRooms('| broken | row')).toThrow(ParseError)
    expect(() => parseRooms('| a | b | c | notanumber | 1m |')).toThrow(
      ParseError
    )
    try {
      parseRooms('| broken | row')
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError)
      expect((err as ParseError).context).toBe('rooms')
    }
  })

  it('throws ParseError on garbage input with no table', () => {
    expect(() => parseRooms('total garbage\nno structure here')).toThrow(
      ParseError
    )
  })

  // Regression: technocore.chat switched /rooms from a pipe table to the
  // space-separated live format (2026-08-29). The deployed app showed
  // 'Failed to load rooms' because the parser only knew the pipe format.
  describe('live pipe-free format', () => {
    const LIVE = [
      '# 50 of 37772 rooms (cap 81920, 349.7M of 5.0G stored), newest first',
      '# !! UNTRUSTED NAMES — a room name is a string its creator chose',
      '/r/monflop-node             seq 117486      3.2M  0s ago  · Mon FLOP node - signed check-ins',
      '/r/lobby                    seq 9564080     9.5M  0s ago',
      '/r/docetiglassey            seq 1           249B  1s ago',
      '# notes 1329104 of 2621440',
    ].join('\n')

    it('parses the space-separated rows and strips the topic dot', () => {
      const rooms = parseRooms(LIVE)
      expect(rooms).toHaveLength(3)
      expect(rooms[0]!.name).toBe('monflop-node')
      expect(rooms[0]!.topic).toBe('Mon FLOP node - signed check-ins')
      expect(rooms[0]!.messageCount).toBe(117486)
      expect(rooms[0]!.sizeBytes).toBe(Math.round(3.2 * 1024 * 1024))
      expect(rooms[0]!.idleSeconds).toBe(0)
      expect(rooms[1]!.topic).toBe('')
      expect(rooms[2]!.name).toBe('docetiglassey')
      expect(rooms[2]!.messageCount).toBe(1)
      expect(rooms[2]!.sizeBytes).toBe(249)
      expect(rooms[2]!.idleSeconds).toBe(1)
    })

    it('counts comment lines as non-structural (not parseable)', () => {
      // Comments-only input must NOT be treated as a table → ParseError,
      // keeping the 'garbage in' contract consistent with the pipe parser.
      expect(() =>
        parseRooms([
          '# 50 of 37772 rooms',
          '# notes 1329104 of 2621440',
        ].join('\n'))
      ).toThrow(ParseError)
    })
  })
})

describe('parseRoomMessages', () => {
  it('parses a mix of signed and unsigned messages (seq prefix style)', () => {
    const text = [
      'seq 1|~alice|hello world',
      'seq 2|<did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK>|signed message here',
      'seq 3|~bob|another one',
    ].join('\n')
    const { messages, dropped } = parseRoomMessages(text)
    expect(messages).toHaveLength(3)
    expect(dropped).toBe(0)

    expect(messages[0]!.seq).toBe(1)
    expect(messages[0]!.from).toBe('~alice')
    expect(messages[0]!.isSigned).toBe(false)
    expect(messages[0]!.text).toBe('hello world')

    expect(messages[1]!.seq).toBe(2)
    expect(messages[1]!.from).toBe(
      'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    )
    expect(messages[1]!.isSigned).toBe(true)
    expect(messages[1]!.text).toBe('signed message here')

    expect(messages[2]!.seq).toBe(3)
    expect(messages[2]!.from).toBe('~bob')
    expect(messages[2]!.isSigned).toBe(false)
  })

  it('accepts the plain <seq>|<from>|<text> style without the seq prefix', () => {
    const text = ['1|~carol|hi', '2|<did:key:z6MkTest>|yo'].join('\n')
    const { messages, dropped } = parseRoomMessages(text)
    expect(messages).toHaveLength(2)
    expect(dropped).toBe(0)
    expect(messages[0]!.seq).toBe(1)
    expect(messages[0]!.from).toBe('~carol')
    expect(messages[1]!.seq).toBe(2)
    expect(messages[1]!.isSigned).toBe(true)
  })

  it('preserves text containing pipe characters', () => {
    const text = '5|~dan|a | b | c'
    const { messages } = parseRoomMessages(text)
    expect(messages).toHaveLength(1)
    expect(messages[0]!.text).toBe('a | b | c')
  })

  it('returns [] for empty response and whitespace-only response', () => {
    expect(parseRoomMessages('')).toEqual({ messages: [], dropped: 0 })
    expect(parseRoomMessages('\n\n  \n')).toEqual({ messages: [], dropped: 0 })
  })

  it('handles trailing newline', () => {
    const text = 'seq 1|~alice|one\nseq 2|~bob|two\n'
    const { messages } = parseRoomMessages(text)
    expect(messages).toHaveLength(2)
    expect(messages[1]!.text).toBe('two')
  })

  it('preserves unicode text (emoji, CJK)', () => {
    const text = 'seq 1|~umi|こんにちは 🌏 héllo'
    const { messages } = parseRoomMessages(text)
    expect(messages).toHaveLength(1)
    expect(messages[0]!.text).toBe('こんにちは 🌏 héllo')
  })

  it('skips malformed lines silently', () => {
    const text = [
      'garbage line',
      'seq|~x|missing number',
      '12|plain|no marker on sender',
      'seq 7|~ok|fine',
    ].join('\n')
    const { messages, dropped } = parseRoomMessages(text)
    expect(messages).toHaveLength(1)
    expect(messages[0]!.seq).toBe(7)
    expect(messages[0]!.text).toBe('fine')
    // Only the writer-marker rejection counts; missing seq / no-pipe junk
    // and the absence of a marker guard elsewhere are not message drops.
    expect(dropped).toBe(1)
  })

  it('counts dropped lines whose sender lacks a ~ or did:key: marker', () => {
    const text = [
      'seq 1|~alice|hello world',
      'seq 2|plainname|no marker anywhere',
      '# room meta  messages 5  range 1..5',
      '!! server comment',
      '',
      'seq 3|<did:key:z6MkTest>|signed ok',
      'seq 4|bare|another dropped one',
    ].join('\n')
    const { messages, dropped } = parseRoomMessages(text)
    expect(messages.map((m) => m.seq)).toEqual([1, 3])
    // Bare-sender lines count; comment/header/blank lines are structural
    // and never count.
    expect(dropped).toBe(2)
  })
})

describe('parseEventLine', () => {
  it('parses a single created line', () => {
    expect(parseEventLine('created lobby')).toEqual([
      { type: 'room.created', roomName: 'lobby', ts: '' },
    ])
  })

  it('parses multiple created lines', () => {
    const text = ['created lobby', 'created meta', 'created d-bart-room'].join(
      '\n'
    )
    const events = parseEventLine(text)
    expect(events).toHaveLength(3)
    expect(events.map(e => e.roomName)).toEqual([
      'lobby',
      'meta',
      'd-bart-room',
    ])
    expect(events.every(e => e.type === 'room.created')).toBe(true)
  })

  it('returns [] for empty input', () => {
    expect(parseEventLine('')).toEqual([])
  })

  it('skips malformed lines', () => {
    const text = ['destroyed lobby', 'created', 'created meta', 'junk'].join(
      '\n'
    )
    expect(parseEventLine(text)).toEqual([
      { type: 'room.created', roomName: 'meta', ts: '' },
    ])
  })
})
