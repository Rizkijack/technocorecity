import { describe, test, expect } from 'vitest'
import {
  formatRelativeTime,
  formatTime,
  truncate,
  formatNumber,
  formatBytes,
  formatIdle,
} from '../format'

describe('formatRelativeTime', () => {
  test('returns empty string for invalid date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
    expect(formatRelativeTime('')).toBe('')
    expect(formatRelativeTime(Number.NaN)).toBe('')
  })

  test('happy: recent date returns string containing ago', () => {
    const past = new Date(Date.now() - 60_000) // 1 minute ago
    const result = formatRelativeTime(past)
    expect(result).toMatch(/ago/)
    expect(result.length).toBeGreaterThan(0)
  })

  test('accepts number timestamp', () => {
    const ts = Date.now() - 2 * 60_000
    const r = formatRelativeTime(ts)
    expect(r).toMatch(/ago/)
  })

  test('accepts ISO string', () => {
    const iso = new Date(Date.now() - 3600_000).toISOString()
    const r = formatRelativeTime(iso)
    expect(r).toMatch(/ago/)
  })

  test('accepts Date object', () => {
    const d = new Date(Date.now() - 5000)
    const r = formatRelativeTime(d)
    expect(typeof r).toBe('string')
    expect(r.length).toBeGreaterThan(0)
  })
})

describe('formatTime', () => {
  test('invalid returns empty', () => {
    expect(formatTime('invalid')).toBe('')
    expect(formatTime(Number.NaN)).toBe('')
  })

  test('formats valid date as yyyy-MM-dd HH:mm:ss', () => {
    const d = new Date('2026-01-15T12:34:56Z')
    const s = formatTime(d)
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  test('accepts timestamp number', () => {
    const ts = new Date('2020-06-01T00:00:00Z').getTime()
    const s = formatTime(ts)
    expect(s).toMatch(/2020-06-01/)
  })
})

describe('truncate', () => {
  test('n <=0 returns empty', () => {
    expect(truncate('hello', 0)).toBe('')
    expect(truncate('hello', -1)).toBe('')
  })

  test('short text unchanged', () => {
    expect(truncate('hi', 5)).toBe('hi')
    expect(truncate('hello', 5)).toBe('hello')
  })

  test('exact length unchanged', () => {
    expect(truncate('abc', 3)).toBe('abc')
  })

  test('n <=1 with overflow → …', () => {
    expect(truncate('hello', 1)).toBe('…')
  })

  test('truncates to n code points with ellipsis: n=4 on hello', () => {
    expect(truncate('hello', 4)).toBe('hel…')
    expect(truncate('hello', 3)).toBe('he…')
    expect(truncate('hello', 2)).toBe('h…')
  })

  test('unicode: emoji counts as one code point', () => {
    // "a😀b" = 3 code points
    expect(Array.from('a😀b').length).toBe(3)
    expect(truncate('a😀b', 3)).toBe('a😀b') // fits
    expect(truncate('a😀b', 2)).toBe('a…')
    expect(truncate('a😀b😀', 3)).toBe('a😀…')
  })

  test('unicode: CJK characters', () => {
    const text = 'こんにちは世界' // 7 chars
    expect(Array.from(text).length).toBe(7)
    expect(truncate(text, 5)).toBe('こんにち…')
    expect(truncate(text, 7)).toBe(text)
  })

  test('unicode: flag and family emoji (code points)', () => {
    const s = 'a👩‍👩‍👧‍👦b' // 👩‍👩‍👧‍👦 is multiple code points, but Array.from splits by code point
    // we just ensure truncate does not throw and respects n
    const truncated = truncate(s, 3)
    expect(truncated.endsWith('…')).toBe(true)
    expect(Array.from(truncated).length).toBe(3) // includes …
  })

  test('empty text returns empty', () => {
    expect(truncate('', 5)).toBe('')
    expect(truncate('', 0)).toBe('')
  })

  test('truncate handles surrogate pairs correctly: 100 emoji', () => {
    const many = '😀'.repeat(10)
    expect(truncate(many, 5)).toBe('😀'.repeat(4) + '…')
  })
})

describe('formatNumber', () => {
  test('non-finite returns 0', () => {
    expect(formatNumber(NaN)).toBe('0')
    expect(formatNumber(Infinity)).toBe('0')
    expect(formatNumber(-Infinity)).toBe('0')
  })

  test('abs <1000 returns rounded integer string', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(999.6)).toBe('1000') // rounded
    expect(formatNumber(12.3)).toBe('12')
    expect(formatNumber(-42.7)).toBe('-43')
    expect(formatNumber(0.4)).toBe('0')
  })

  test('1000 → compact 1K', () => {
    expect(formatNumber(1000)).toBe('1K')
    expect(formatNumber(1500)).toBe('1.5K')
  })

  test('large numbers compact', () => {
    expect(formatNumber(1_000_000)).toMatch(/1.*M/)
    expect(formatNumber(2_500_000)).toMatch(/2\.5M/)
    expect(formatNumber(1_500_000_000)).toMatch(/1\.5B/)
  })

  test('negative compact', () => {
    expect(formatNumber(-1500)).toBe('-1.5K')
  })
})

describe('formatBytes', () => {
  test('edge 0 and 0.5 and negative and NaN', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(0.5)).toBe('0.5 B')
    expect(formatBytes(0.9)).toBe('0.9 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
    expect(formatBytes(Infinity)).toBe('0 B')
  })

  test('1023 → 1023 B', () => {
    expect(formatBytes(1023)).toBe('1023 B')
  })

  test('1024 → 1.00 KB', () => {
    expect(formatBytes(1024)).toBe('1.00 KB')
  })

  test('1536 → 1.50 KB', () => {
    expect(formatBytes(1536)).toBe('1.50 KB')
  })

  test('1048576 → 1.00 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
  })

  test('1.5 MB', () => {
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.50 MB')
  })

  test('1 GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
  })

  test('decimals logic: 10KB → 1 decimal, 100KB → 0 decimal', () => {
    // 10 *1024 =10240 -> value 10 -> decimals 1 => "10.0 KB"
    expect(formatBytes(10 * 1024)).toBe('10.0 KB')
    // 100*1024=102400 -> value 100 -> decimals 0 => "100 KB"
    expect(formatBytes(100 * 1024)).toBe('100 KB')
    // 1 byte -> decimals 0 => "1 B"
    expect(formatBytes(1)).toBe('1 B')
  })

  test('large TB', () => {
    const tb = 1024 ** 4
    expect(formatBytes(tb)).toBe('1.00 TB')
    expect(formatBytes(tb * 1.5)).toBe('1.50 TB')
  })

  test('bytes with rounding', () => {
    // 1024 + 512 =1536 already tested
    // 1500 bytes => 1.46 KB (1500/1024=1.46484375) => toFixed(2) =>1.46
    expect(formatBytes(1500)).toBe('1.46 KB')
  })
})

describe('formatIdle', () => {
  test('invalid or negative → 0s', () => {
    expect(formatIdle(NaN)).toBe('0s')
    expect(formatIdle(Infinity)).toBe('0s')
    expect(formatIdle(-5)).toBe('0s')
    expect(formatIdle(-0.1)).toBe('0s')
  })

  test('seconds <60', () => {
    expect(formatIdle(0)).toBe('0s')
    expect(formatIdle(5)).toBe('5s')
    expect(formatIdle(30)).toBe('30s')
    expect(formatIdle(59)).toBe('59s')
    expect(formatIdle(59.9)).toBe('59s')
  })

  test('minutes <3600', () => {
    expect(formatIdle(60)).toBe('1m')
    expect(formatIdle(90)).toBe('1m')
    expect(formatIdle(119)).toBe('1m')
    expect(formatIdle(120)).toBe('2m')
    expect(formatIdle(3599)).toBe('59m')
  })

  test('hours <86400', () => {
    expect(formatIdle(3600)).toBe('1h')
    expect(formatIdle(7200)).toBe('2h')
    expect(formatIdle(86399)).toBe('23h')
  })

  test('days >=86400', () => {
    expect(formatIdle(86400)).toBe('1d')
    expect(formatIdle(86400 * 2)).toBe('2d')
    expect(formatIdle(86400 * 2.9)).toBe('2d')
    expect(formatIdle(86400 * 10)).toBe('10d')
  })
})
