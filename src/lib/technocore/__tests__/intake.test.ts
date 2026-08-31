import { describe, expect, it } from 'vitest'

import {
  filterLoadableRooms,
  matchesRoomQuery,
  MIN_MESSAGES_FOR_LOADING,
  ROOMS_LIMIT,
} from '../intake'
import type { Room } from '../types'

function makeRoom(name: string, messageCount: number, topic = ''): Room {
  return { name, topic, messageCount, sizeBytes: 0, idleSeconds: 0 }
}

describe('intake constants', () => {
  it('requests the upstream hard cap (200) and requires 5+ messages', () => {
    expect(ROOMS_LIMIT).toBe(200)
    expect(MIN_MESSAGES_FOR_LOADING).toBe(5)
  })
})

describe('filterLoadableRooms', () => {
  it('drops rooms below MIN_MESSAGES_FOR_LOADING, keeps boundary and above', () => {
    const rooms = [
      makeRoom('muted', 0),
      makeRoom('quiet', 4),
      makeRoom('border', 5),
      makeRoom('busy', 1000),
    ]
    const result = filterLoadableRooms(rooms)
    expect(result.map((r) => r.name)).toEqual(['border', 'busy'])
  })

  it('returns a new array and never mutates the input', () => {
    const rooms = [makeRoom('a', 1), makeRoom('b', 5)]
    const result = filterLoadableRooms(rooms)
    expect(result).not.toBe(rooms)
    expect(rooms).toHaveLength(2)
    expect(result).toHaveLength(1)
    expect(rooms[0]?.messageCount).toBe(1)
  })

  it('passes unusual names through exactly as parsed', () => {
    const rooms = [makeRoom('UPPER_CASE', 9), makeRoom('with space!', 12)]
    const result = filterLoadableRooms(rooms)
    expect(result.map((r) => r.name)).toEqual(['UPPER_CASE', 'with space!'])
    expect(result[0]?.name).toBe('UPPER_CASE')
  })

  it('handles an empty list', () => {
    expect(filterLoadableRooms([])).toEqual([])
  })
})

describe('matchesRoomQuery', () => {
  const room = makeRoom('lobby', 10, 'General Chat')

  it('is case-insensitive on the room name', () => {
    expect(matchesRoomQuery(room, 'LOBBY')).toBe(true)
    expect(matchesRoomQuery(room, 'Lob')).toBe(true)
  })

  it('is case-insensitive on the topic', () => {
    expect(matchesRoomQuery(room, 'chartroom')).toBe(false) // exact topic 'General Chat'
    expect(matchesRoomQuery(room, 'general')).toBe(true)
    expect(matchesRoomQuery(room, 'CHAT')).toBe(true)
  })

  it('matches when query is a substring, not only full equality', () => {
    expect(matchesRoomQuery(room, 'bb')).toBe(true) // in 'loBBY'
    expect(matchesRoomQuery(room, 'en')).toBe(true) // in 'gENeral'
  })

  it('empty or whitespace-only query matches everything', () => {
    expect(matchesRoomQuery(room, '')).toBe(true)
    expect(matchesRoomQuery(room, '   ')).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    expect(matchesRoomQuery(room, '  lobby ')).toBe(true)
    expect(matchesRoomQuery(room, '\tchat\n')).toBe(true)
  })

  it('returns false when neither name nor topic matches', () => {
    expect(matchesRoomQuery(room, 'zzz-none')).toBe(false)
    expect(matchesRoomQuery(room, 'generous')).toBe(false)
  })
})
