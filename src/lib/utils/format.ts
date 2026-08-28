import { formatDistanceToNow } from 'date-fns'
import { format as fmt } from 'date-fns'

/**
 * Human-readable relative time, e.g. "3 minutes ago".
 */
export function formatRelativeTime(
  value: string | number | Date,
): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * Absolute time in project display format (yyyy-MM-dd HH:mm:ss).
 */
export function formatTime(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return fmt(d, 'yyyy-MM-dd HH:mm:ss')
}

/**
 * Truncate text to at most `n` code points with an ellipsis.
 */
export function truncate(text: string, n: number): string {
  if (n <= 0) return ''
  const codePoints = Array.from(text)
  if (codePoints.length <= n) return text
  if (n <= 1) return '…'
  return `${codePoints.slice(0, n - 1).join('')}…`
}

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/**
 * Compact number formatting, e.g. 1500 → "1.5K".
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) < 1000) return String(Math.round(n))
  return COMPACT.format(n)
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

/**
 * Bytes to human-readable string.
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B'
  if (n < 1) return `${n} B`
  const i = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(n) / Math.log(1024)),
  )
  const value = n / 1024 ** i
  const decimals = value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(decimals)} ${BYTE_UNITS[i]}`
}

/**
 * Seconds to short idle label, e.g. 90 → "1m".
 */
export function formatIdle(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s'
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}
