import { describe, test, expect } from 'vitest'
import { computePositions } from '../layout'
import type { Room } from '@/lib/technocore/types'

function makeRoom(name: string): Room {
  return { name, topic: '', messageCount: 0, sizeBytes: 0, idleSeconds: 0 }
}

// Regression for "gedung tidak muncul" — 50 rooms at radius 150 are behind fog far=120
describe('layout fog regression (Phase 1 tight loop)', () => {
  test('50 rooms must be within fog far=120 and capped at 60', () => {
    const rooms = Array.from({ length: 50 }, (_, i) => makeRoom(`room-${i}`))
    const map = computePositions(rooms)
    expect(map.size).toBe(50)
    for (const pos of map.values()) {
      const dist = Math.hypot(pos[0], pos[1])
      // Fog far is 120 in World.tsx: <fog args={['#0a0e27', 30, 120]} />
      expect(dist).toBeLessThanOrEqual(120)
      // Cap at 60 keeps ring visible for any n (docs/08)
      expect(dist).toBeLessThanOrEqual(60 + 1e-9)
    }
  })

  test('200 rooms also capped at 60', () => {
    const rooms = Array.from({ length: 200 }, (_, i) => makeRoom(`r${i}`))
    const map = computePositions(rooms)
    for (const pos of map.values()) {
      expect(Math.hypot(pos[0], pos[1])).toBeLessThanOrEqual(60 + 1e-9)
    }
  })
})
