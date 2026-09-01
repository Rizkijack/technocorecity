import { describe, test, expect } from 'vitest'
import { LOD_NEAR_MAX, LOD_MID_MAX, lodTierForDistance } from '../lod'

describe('lodTierForDistance — thresholds', () => {
  test('constants pinned: LOD_NEAR_MAX=60, LOD_MID_MAX=110 (camera→target units)', () => {
    expect(LOD_NEAR_MAX).toBe(60)
    expect(LOD_MID_MAX).toBe(110)
  })

  test('0 → tier 0 (near)', () => {
    expect(lodTierForDistance(0)).toBe(0)
  })

  test('59.999 → tier 0 (just under NEAR boundary)', () => {
    expect(lodTierForDistance(59.999)).toBe(0)
  })

  test('60 → tier 1 (exact NEAR boundary flips to MID)', () => {
    expect(lodTierForDistance(60)).toBe(1)
  })

  test('109.999 → tier 1 (just under MID boundary)', () => {
    expect(lodTierForDistance(109.999)).toBe(1)
  })

  test('110 → tier 2 (exactly at FAR boundary)', () => {
    expect(lodTierForDistance(110)).toBe(2)
  })

  test('500 → tier 2 (deep zoom-out)', () => {
    expect(lodTierForDistance(500)).toBe(2)
  })

  test('deterministic: repeated calls with the same input give the same tier', () => {
    for (const d of [0, 59.999, 60, 109.999, 110, 500]) {
      const first = lodTierForDistance(d)
      for (let i = 0; i < 3; i++) {
        expect(lodTierForDistance(d)).toBe(first)
      }
    }
  })
})

describe('lodTierForDistance — safety (non-finite input → tier 0)', () => {
  test('NaN → 0 (full detail, never a blank city)', () => {
    expect(lodTierForDistance(Number.NaN)).toBe(0)
  })

  test('Infinity → 0', () => {
    expect(lodTierForDistance(Number.POSITIVE_INFINITY)).toBe(0)
  })

  test('-Infinity → 0', () => {
    expect(lodTierForDistance(Number.NEGATIVE_INFINITY)).toBe(0)
  })

  test('negative distance (degenerate input) → 0', () => {
    expect(lodTierForDistance(-5)).toBe(0)
  })
})
