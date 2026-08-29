import { describe, test, expect } from 'vitest'
import { hashToColor } from '../color'

describe('hashToColor', () => {
  test('determinism: same input → same output', () => {
    expect(hashToColor('lobby')).toBe(hashToColor('lobby'))
    expect(hashToColor('')).toBe(hashToColor(''))
    expect(hashToColor('test-seed-123')).toBe(hashToColor('test-seed-123'))
  })

  test('different inputs produce different colors (likely)', () => {
    const a = hashToColor('lobby')
    const b = hashToColor('meta')
    expect(a).not.toBe(b)
  })

  test('output format hsl(h 70% 55%) with h 0-359', () => {
    const re = /^hsl\((\d+) 70% 55%\)$/
    const colors = ['lobby', 'meta', 'general', '', '   ', 'a', 'ab', 'abc', 'very-long-string-with-unicode-😀'].map(hashToColor)
    for (const c of colors) {
      const m = re.exec(c)
      expect(m).not.toBeNull()
      const h = Number(m![1])
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
      expect(Number.isInteger(h)).toBe(true)
    }
  })

  test('empty string is deterministic and hue 341 (5381%360)', () => {
    // djb2('') =5381, 5381%360=341
    expect(hashToColor('')).toBe('hsl(341 70% 55%)')
  })

  test('single char hue differs', () => {
    expect(hashToColor('a')).not.toBe(hashToColor('b'))
  })

  test('unicode consistency', () => {
    const s = 'héllo 🌏'
    expect(hashToColor(s)).toBe(hashToColor(s))
    expect(hashToColor(s)).toMatch(/^hsl\(\d+ 70% 55%\)$/)
  })

  test('long string deterministic', () => {
    const long = 'x'.repeat(500)
    expect(hashToColor(long)).toBe(hashToColor(long))
  })
})
