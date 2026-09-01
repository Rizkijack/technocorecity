/**
 * LOD (Level of Detail) tiering untuk kota gedung — pure, tanpa dependensi THREE.
 *
 * Setiap Building = body + edges + floor bands + window planes (2 sisi) +
 * rooftop + antenna + sprite label ≈ 20 draw call. Pada 200+ gedung zoomed
 * out, detail tersebut sub-pixel dan tertelan fog (50-140), jadi perlu
 * di-ramp bertahap berdasarkan jarak kamera ke OrbitControls target:
 *
 *   tier 0 (NEAR, d <  60) — detail penuh: bands + windows + label sprite
 *   tier 1 (MID,  60 ≤ d < 110) — sembunyikan floor bands + window planes
 *                                  (hemat draw call terbesar)
 *   tier 2 (FAR,  d ≥ 110) — sembunyikan juga label sprite (kecuali
 *                             hovered/selected); silhouette tetap utuh
 *                             (body + edges + podium + rooftop + antenna).
 *
 * Threshold mengikuti FREE VIEW default [0,30,50] (d ≈ 58.3 → tier 0) dan
 * fog 50-140 (di d ≥ 110 gedung sudah nyaris tak terlihat — detail sia-sia).
 */

export type LodTier = 0 | 1 | 2

/** Di atas jarak ini (camera→target) detail (bands/windows) disembunyikan. */
export const LOD_NEAR_MAX = 60
/** Di atas jarak ini label sprite ikut disembunyikan. */
export const LOD_MID_MAX = 110

/**
 * Map camera-to-target distance → LOD tier.
 * Non-finite input (NaN/±Infinity) → 0: gagal ukur harus aman, yaitu
 * full detail, bukan kota kosong.
 */
export function lodTierForDistance(d: number): LodTier {
  if (!Number.isFinite(d)) return 0
  if (d < LOD_NEAR_MAX) return 0
  if (d < LOD_MID_MAX) return 1
  return 2
}
