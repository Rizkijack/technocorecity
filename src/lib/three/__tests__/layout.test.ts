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

  test('1 room at radius 17 (min(60, 10+sqrt(1)*7)=17)', () => {
    const rooms = [makeRoom('a')]
    const map = computePositions(rooms)
    expect(map.size).toBe(1)
    const [x, z] = map.get('a')!
    expect(x).toBeCloseTo(17, 5)
    expect(z).toBeCloseTo(0, 5)
    expect(Math.hypot(x, z)).toBeCloseTo(17, 5)
  })

  test('6 rooms evenly spaced at 60deg', () => {
    const rooms = Array.from({ length: 6 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(6)
    const radius = 10 + Math.sqrt(6) * 7
    for (let i = 0; i < 6; i++) {
      const [x, z] = map.get(`r${i}`)!
      expect(Math.hypot(x, z)).toBeCloseTo(radius, 5)
      const expectedAngle = (i / 6) * Math.PI * 2
      expect(x).toBeCloseTo(Math.cos(expectedAngle) * radius, 5)
      expect(z).toBeCloseTo(Math.sin(expectedAngle) * radius, 5)
    }
  })

  test('2 rooms opposite at radius 10+sqrt(2)*7', () => {
    const rooms = [makeRoom('a'), makeRoom('b')]
    const map = computePositions(rooms)
    const [ax, az] = map.get('a')!
    const [bx, bz] = map.get('b')!
    const radius = 10 + Math.sqrt(2) * 7
    expect(ax).toBeCloseTo(radius, 5)
    expect(az).toBeCloseTo(0, 5)
    expect(bx).toBeCloseTo(-radius, 5)
    expect(bz).toBeCloseTo(0, 5)
  })

  test('7 rooms evenly spaced', () => {
    const rooms = Array.from({ length: 7 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    const radius = 10 + Math.sqrt(7) * 7
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(radius, 5)
    }
  })

  test('50 rooms capped at radius 60 (10+sqrt(50)*7≈59.5)', () => {
    const rooms = Array.from({ length: 50 }, (_, i) => makeRoom(`room-${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(50)
    // 10 + sqrt(50)*7 = 10 + 49.497 ≈ 59.497 — well within cap of 60
    const radius = 10 + Math.sqrt(50) * 7
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(radius, 5)
    }
  })

  test('200 rooms also cap at 60', () => {
    const rooms = Array.from({ length: 200 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(200)
    // 10 + sqrt(200)*7 = 10 + 98.99 = 108.99 → cap at 60
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(60, 5)
    }
  })

  test('10 rooms at radius 10+sqrt(10)*7≈32.1', () => {
    const rooms = Array.from({ length: 10 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    const radius = 10 + Math.sqrt(10) * 7
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(radius, 5)
    }
  })

  test('radius formula min(60, 10+sqrt(n)*7)', () => {
    const cases: Array<[number, number]> = [
      [1, 17],
      [5, 10 + Math.sqrt(5) * 7],
      [10, 10 + Math.sqrt(10) * 7],
      [50, 10 + Math.sqrt(50) * 7],
      [200, 60], // cap
    ]
    for (const [n, expectedRadius] of cases) {
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
