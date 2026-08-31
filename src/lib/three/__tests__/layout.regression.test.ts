import { describe, test, expect } from 'vitest'
import { computePositions } from '../layout'
import type { Room } from '@/lib/technocore/types'

function makeRoom(name: string): Room {
  return { name, topic: '', messageCount: 0, sizeBytes: 0, idleSeconds: 0 }
}

// Regression for "gedung tidak muncul" — 50 rooms at radius 150 are behind fog far=140
describe('layout fog regression (Phase 1 tight loop)', () => {
  test('50 rooms must be within fog far=140 (finished inside ring 2, r=44)', () => {
    const rooms = Array.from({ length: 50 }, (_, i) => makeRoom(`room-${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(50)
    for (const pos of map.values()) {
      const dist = Math.hypot(pos[0], pos[1])
      // Fog far is 140 in World.tsx: <fog args={['#0a0e27', 50, 140]} /> — bound below is stricter.
      expect(dist).toBeLessThanOrEqual(120)
      // Ring layout: 50 rooms finish inside ring 2 (r=44) — well within fog.
      expect(dist).toBeLessThanOrEqual(44 + 1e-9)
    }
  })

  test('200 rooms stay inside ring 5 (r=86) — fog-safe', () => {
    const rooms = Array.from({ length: 200 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    for (const pos of map.values()) {
      // 200 rooms finish inside ring 5 (capacity 237) → max r=86, far from fog.
      expect(Math.hypot(pos[0], pos[1])).toBeLessThanOrEqual(86 + 1e-9)
    }
  })
})
