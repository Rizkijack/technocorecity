/**
 * djb2 hash — simple, fast, deterministic for short strings.
 */
function djb2(seed: string): number {
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

/**
 * Map a string seed to a deterministic HSL color.
 * Hue is spread 0-359 via djb2; saturation/lightness fixed for readability.
 */
export function hashToColor(seed: string): string {
  const h = djb2(seed) % 360
  return `hsl(${h} 70% 55%)`
}
