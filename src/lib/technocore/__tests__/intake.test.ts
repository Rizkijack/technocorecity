import { describe, expect, it } from 'vitest'

import { isEmptyRoom, matchesRoomQuery, MIN_MESSAGES_FOR_LOADING, ROOMS_LIMIT } from '../intake'
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

describe('isEmptyRoom', () => {
  it('is true below MIN_MESSAGES_FOR_LOADING (boundary: 0, 1, 4)', () => {
    expect(isEmptyRoom(makeRoom('muted', 0))).toBe(true)
    expect(isEmptyRoom(makeRoom('quiet', 1))).toBe(true)
    expect(isEmptyRoom(makeRoom('almost', 4))).toBe(true)
  })

  it('is false at and above MIN_MESSAGES_FOR_LOADING (boundary: 5, 6, 1000)', () => {
    expect(isEmptyRoom(makeRoom('border', 5))).toBe(false)
    expect(isEmptyRoom(makeRoom('six', 6))).toBe(false)
    expect(isEmptyRoom(makeRoom('busy', 1000))).toBe(false)
  })

  it('classifies each room independently in a mixed list', () => {
    const rooms = [
      makeRoom('muted', 0),
      makeRoom('quiet', 4),
      makeRoom('border', 5),
      makeRoom('busy', 1000),
    ]
    expect(rooms.map(isEmptyRoom)).toEqual([true, true, false, false])
  })

  it('is a pure predicate — never mutates the room', () => {
    const room = makeRoom('quiet', 3, 'still here')
    const result = isEmptyRoom(room)
    expect(result).toBe(true)
    expect(room.messageCount).toBe(3)
    expect(room.topic).toBe('still here')
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
