import { describe, test, expect } from 'vitest'
import { computePositions } from '../layout'
import type { Room } from '@/lib/technocore/types'

function makeRoom(name: string): Room {
  return { name, topic: '', messageCount: 0, sizeBytes: 0, idleSeconds: 0 }
}

describe('computePositions', () => {
  test('0 rooms → empty map', () => {
    const map = computePositions([])
    expect(map.size).toBe(0)
    expect(map).toBeInstanceOf(Map)
  })

  test('1 room radius 20 at (20,0)', () => {
    const rooms = [makeRoom('a')]
    const map = computePositions(rooms)
    expect(map.size).toBe(1)
    const pos = map.get('a')!
    expect(pos).toBeDefined()
    const [x, z] = pos
    expect(x).toBeCloseTo(20, 5)
    expect(z).toBeCloseTo(0, 5)
    // distance from origin ≈20
    expect(Math.hypot(x, z)).toBeCloseTo(20, 5)
  })

  test('6 rooms radius max(20, n*3)=20, even spacing 60deg', () => {
    const rooms = Array.from({ length: 6 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(6)
    const radius = 20
    for (let i = 0; i < 6; i++) {
      const [x, z] = map.get(`r${i}`)!
      expect(Math.hypot(x, z)).toBeCloseTo(radius, 5)
      const expectedAngle = (i / 6) * Math.PI * 2
      expect(x).toBeCloseTo(Math.cos(expectedAngle) * radius, 5)
      expect(z).toBeCloseTo(Math.sin(expectedAngle) * radius, 5)
    }
  })

  test('2 rooms opposite', () => {
    const rooms = [makeRoom('a'), makeRoom('b')]
    const map = computePositions(rooms)
    const [ax, az] = map.get('a')!
    const [bx, bz] = map.get('b')!
    expect(ax).toBeCloseTo(20, 5)
    expect(az).toBeCloseTo(0, 5)
    expect(bx).toBeCloseTo(-20, 5)
    expect(bz).toBeCloseTo(0, 5) // sin(pi) ≈0
  })

  test('7 rooms radius 21 (7*3=21)', () => {
    const rooms = Array.from({ length: 7 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    const radius = 21
    for (const [roomName, pos] of map) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(radius, 5)
      void roomName
    }
  })

  test('50 rooms radius 150 (50*3)', () => {
    const rooms = Array.from({ length: 50 }, (_, i) => makeRoom(`room-${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(50)
    const radius = 150
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(radius, 5)
    }
    // verify spacing: angle between first and second = 360/50 =7.2deg
    const [x0, z0] = map.get('room-0')!
    const [x1, z1] = map.get('room-1')!
    // angle check via dot product or direct
    expect(x0).toBeCloseTo(radius, 5)
    expect(z0).toBeCloseTo(0, 5)
    const expectedAngle1 = (1 / 50) * Math.PI * 2
    expect(x1).toBeCloseTo(Math.cos(expectedAngle1) * radius, 5)
    expect(z1).toBeCloseTo(Math.sin(expectedAngle1) * radius, 5)
  })

  test('10 rooms radius 30', () => {
    const rooms = Array.from({ length: 10 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    const radius = 30
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(radius, 5)
    }
  })

  test('radius formula max(20, n*3)', () => {
    const cases: Array<[number, number]> = [
      [0, 20], // not used but 0 length returns early; for n>=1 test
      [1, 20],
      [5, 20],
      [6, 20],
      [7, 21],
      [10, 30],
      [20, 60],
      [50, 150],
    ]
    for (const [n, expectedRadius] of cases) {
      if (n === 0) continue
      const rooms = Array.from({ length: n }, (_, i) => makeRoom(`c${n}-${i}`))
      const map = computePositions(rooms)
      const anyPos = map.values().next().value as readonly [number, number]
      expect(Math.hypot(anyPos[0], anyPos[1])).toBeCloseTo(expectedRadius, 5)
    }
  })

  test('map keys correspond to room names', () => {
    const rooms = [makeRoom('lobby'), makeRoom('meta'), makeRoom('archive')]
    const map = computePositions(rooms)
    expect(Array.from(map.keys()).sort()).toEqual(['archive', 'lobby', 'meta'])
  })

  test('positions are readonly tuples of length 2', () => {
    const rooms = [makeRoom('x')]
    const map = computePositions(rooms)
    const pos = map.get('x')!
    expect(pos.length).toBe(2)
    expect(typeof pos[0]).toBe('number')
    expect(typeof pos[1]).toBe('number')
  })

  test('determinism: same input → same output', () => {
    const rooms = Array.from({ length: 8 }, (_, i) => makeRoom(`r${i}`))
    const a = computePositions(rooms)
    const b = computePositions(rooms)
    for (const k of a.keys()) {
      expect(a.get(k)).toEqual(b.get(k))
    }
  })
})
