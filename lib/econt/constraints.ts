import 'server-only'

import type { Parcel } from '@/lib/data/pricing'

/**
 * Automat (АПС / Econtomat) parcel limits.
 *
 * Econt adjusts locker sizes without much notice, so these are env-overridable:
 * a wrong limit here either offers a delivery option that will be rejected at
 * the counter, or hides one that would have worked.
 */
function num(name: string, fallback: number): number {
  const raw = Number((process.env[name] ?? '').trim())
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

export function apsMaxParcel(): Parcel {
  return {
    weightKg: num('ECONT_APS_MAX_WEIGHT_KG', 20),
    lengthCm: num('ECONT_APS_MAX_L_CM', 60),
    widthCm: num('ECONT_APS_MAX_W_CM', 40),
    heightCm: num('ECONT_APS_MAX_H_CM', 40),
  }
}

/**
 * Whether a parcel could physically go into an automat.
 *
 * Dimensions are compared as sorted triples, since a box can be turned: a
 * 60×10×40 parcel fits a 60×40×40 locker even though width and height are
 * swapped relative to how it was measured.
 */
export function canFitInAps(parcel: Parcel, limit: Parcel = apsMaxParcel()): boolean {
  if (parcel.weightKg > limit.weightKg) return false
  const box = [parcel.lengthCm, parcel.widthCm, parcel.heightCm].sort((a, b) => a - b)
  const slot = [limit.lengthCm, limit.widthCm, limit.heightCm].sort((a, b) => a - b)
  return box.every((side, i) => side <= slot[i])
}
