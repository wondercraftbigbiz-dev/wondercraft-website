import { getCities } from '@/lib/econt/nomenclatures'
import {
  cachedJson,
  econtErrorResponse,
  rateLimitGuard,
} from '@/lib/econt/route-helpers'

// Buffer.from for Basic auth and the in-memory caches both need Node.
export const runtime = 'nodejs'

/**
 * The whole city list, once.
 *
 * Deliberately not a search endpoint. Bulgaria has a few thousand settlements
 * and six short fields each; shipping them in one cacheable response makes the
 * combobox instant, removes per-keystroke traffic, and removes the abuse surface
 * a `?q=` endpoint would add. If the payload ever outgrows its budget, the
 * fallback is to send only cities with an Econt presence and add a search
 * endpoint for address mode — the client's useCities() hook is the seam for that.
 *
 * Budget: 150 KB gzipped. Measured against the fixtures at 138 bytes per city
 * raw and a 3.5x gzip ratio, which extrapolates to roughly 90-115 KB for
 * Bulgaria's ~5000 settlements — inside the budget but not by much. Re-measure
 * on a preview deploy against the real nomenclature before launch:
 *
 *   curl -s --compressed -o /dev/null -w '%{size_download}\n' <preview>/api/econt/cities
 */
export async function GET(request: Request) {
  const limited = rateLimitGuard(request, 'nomenclature')
  if (limited) return limited

  try {
    return cachedJson(request, { cities: await getCities() })
  } catch (error) {
    return econtErrorResponse(error, { cities: [] })
  }
}
