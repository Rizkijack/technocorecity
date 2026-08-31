import { describe, test, expect } from 'vitest'
import { computePositions } from '../layout'
import type { Room } from '@/lib/technocore/types'

// Test-side copy of the layout constants — duplicated deliberately so a
// change in layout.ts that moves buildings into the fog fails loudly here.
const RING0_RADIUS = 16
const RING_GAP = 14
const ARC_SPACING = 8.0

function capacity(k: number): number {
  return Math.floor((2 * Math.PI * (RING0_RADIUS + k * RING_GAP)) / ARC_SPACING)
}

// c0=12, c1=23, c2=34, ... (rings fill from the inside out)
const C0 = capacity(0)
const C1 = capacity(1)
const C2 = capacity(2)

function makeRoom(name: string): Room {
  return { name, topic: '', messageCount: 0, sizeBytes: 0, idleSeconds: 0 }
}

function radii(rooms: Room[]): number[] {
  return [...computePositions(rooms).values()].map(([x, z]) => Math.hypot(x, z))
}

describe('computePositions — concentric ring layout', () => {
  test('0 rooms → empty map', () => {
    const map = computePositions([])
    expect(map.size).toBe(0)
    expect(map).toBeInstanceOf(Map)
  })

  test('1 room at ring 0, radius 16, angle 0 (x=16, z=0)', () => {
    const rooms = [makeRoom('a')]
    const map = computePositions(rooms)
    expect(map.size).toBe(1)
    const [x, z] = map.get('a')!
    expect(x).toBeCloseTo(RING0_RADIUS, 5)
    expect(z).toBeCloseTo(0, 5)
    expect(Math.hypot(x, z)).toBeCloseTo(RING0_RADIUS, 5)
  })

  test('ring 0 fills first: 11 rooms all at radius 16', () => {
    const rooms = Array.from({ length: 11 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(11)
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(RING0_RADIUS, 5)
    }
  })

  test('ring 0 fully packed at exactly C0=12 rooms (all radius 16)', () => {
    const rooms = Array.from({ length: C0 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(C0)
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeCloseTo(RING0_RADIUS, 5)
    }
    // every ring-0 slot occupied → unique angle per room
    const angles = [...map.values()].map(([x, z]) => Math.atan2(z, x)).sort()
    expect(new Set(angles.map((a) => a.toPrecision(10))).size).toBe(C0)
  })

  test('room C0+1 (13th) spills to ring 1 at radius 30 (RING0 + RING_GAP)', () => {
    const rooms = Array.from({ length: C0 + 1 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(C0 + 1)
    for (let i = 0; i < C0; i++) {
      const [x, z] = map.get(`r${i}`)!
      expect(Math.hypot(x, z)).toBeCloseTo(RING0_RADIUS, 5)
    }
    const [x, z] = map.get(`r${C0}`)!
    expect(Math.hypot(x, z)).toBeCloseTo(RING0_RADIUS + RING_GAP, 5)
    // first room of ring 1 sits at angle 0
    expect(x).toBeCloseTo(30, 5)
    expect(z).toBeCloseTo(0, 5)
  })

  test('ring capacity respected: same-ring rooms share radius, overflow jumps one ring farther', () => {
    // n = C0 + C1 + 1 → ring 0 full, ring 1 full, one room in ring 2
    const rooms = Array.from({ length: C0 + C1 + 1 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)

    for (let i = 0; i < C0; i++) {
      expect(Math.hypot(...map.get(`r${i}`)!)).toBeCloseTo(RING0_RADIUS, 5)
    }
    for (let i = C0; i < C0 + C1; i++) {
      expect(Math.hypot(...map.get(`r${i}`)!)).toBeCloseTo(RING0_RADIUS + RING_GAP, 5)
    }
    const last = map.get(`r${C0 + C1}`)!
    expect(Math.hypot(...last)).toBeCloseTo(RING0_RADIUS + 2 * RING_GAP, 5)
  })

  test('first room of each ring at angle 0, second at angle 2π/c_k', () => {
    // ring 0 (c=12), ring 1 (c=23), ring 2 (c=34) — take 2 rooms per ring
    const rooms = Array.from({ length: C0 + C1 + 2 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)

    const ringSpecs = [
      { ringStart: 0, cap: C0, radius: RING0_RADIUS },
      { ringStart: C0, cap: C1, radius: RING0_RADIUS + RING_GAP },
      { ringStart: C0 + C1, cap: C2, radius: RING0_RADIUS + 2 * RING_GAP },
    ]
    for (const { ringStart, cap, radius } of ringSpecs) {
      const [x0, z0] = map.get(`r${ringStart}`)!
      expect(x0).toBeCloseTo(radius, 5) // angle 0 → x = r
      expect(z0).toBeCloseTo(0, 5) // angle 0 → z = 0

      const [x1, z1] = map.get(`r${ringStart + 1}`)!
      const angle1 = (1 / cap) * Math.PI * 2
      expect(x1).toBeCloseTo(Math.cos(angle1) * radius, 5)
      expect(z1).toBeCloseTo(Math.sin(angle1) * radius, 5)
    }
  })

  test('50 rooms: max radius ≤ 44 (finished within ring 2)', () => {
    const rooms = Array.from({ length: 50 }, (_, i) => makeRoom(`room-${i}`))
    const dists = radii(rooms)
    expect(dists.length).toBe(50)
    expect(Math.max(...dists)).toBeLessThanOrEqual(RING0_RADIUS + 2 * RING_GAP + 1e-9)
    // ring 2 is actually used → the layout is doing real layering, not a cap
    expect(dists.some((d) => d > RING0_RADIUS + RING_GAP)).toBe(true)
  })

  test('200 rooms: max radius ≤ 86 (finished within ring 5)', () => {
    const rooms = Array.from({ length: 200 }, (_, i) => makeRoom(`room-${i}`))
    const dists = radii(rooms)
    expect(dists.length).toBe(200)
    expect(Math.max(...dists)).toBeLessThanOrEqual(RING0_RADIUS + 5 * RING_GAP + 1e-9)
  })

  test('500 rooms: all within radius 128 — safe inside fog far=140', () => {
    const rooms = Array.from({ length: 500 }, (_, i) => makeRoom(`room-${i}`))
    const dists = radii(rooms)
    expect(dists.length).toBe(500)
    for (const d of dists) {
      expect(d).toBeLessThanOrEqual(128 + 1e-9)
      expect(d).toBeLessThan(130) // fog-safe hard limit
    }
  })

  test('no two rooms share the same position (500 rooms)', () => {
    const rooms = Array.from({ length: 500 }, (_, i) => makeRoom(`room-${i}`))
    const map = computePositions(rooms)
    const keys = [...map.values()].map(([x, z]) => `${x.toFixed(6)},${z.toFixed(6)}`)
    expect(new Set(keys).size).toBe(500)
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
    const rooms = Array.from({ length: 500 }, (_, i) => makeRoom(`r${i}`))
    const a = computePositions(rooms)
    const b = computePositions(rooms)
    expect(a.size).toBe(500)
    for (const k of a.keys()) {
      expect(a.get(k)).toEqual(b.get(k))
    }
  })

  test('capacity cliff: 504 fit inside fog (r≤128), 505th spills behind fog far=140', () => {
    // Rings 0..8 hold exactly 504 buildings (ring 8 r=128 < fog far 140).
    const at504 = Array.from({ length: 504 }, (_, i) => makeRoom(`cap-a-${i}`))
    const map504 = computePositions(at504)
    expect(map504.size).toBe(504)
    for (const pos of map504.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeLessThanOrEqual(128 + 1e-9)
    }
    // The 505th building spills to ring 9 (r=142) — behind fog far=140.
    // Locks the cliff: raising ROOMS_LIMIT past 504 requires a fog/camera change first.
    const at505 = Array.from({ length: 505 }, (_, i) => makeRoom(`cap-b-${i}`))
    const map505 = computePositions(at505)
    expect(map505.size).toBe(505)
    const spill = map505.get('cap-b-504')!
    expect(Math.hypot(spill[0], spill[1])).toBeGreaterThan(140)
  })
})
