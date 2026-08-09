import { getCityDetails } from '@/lib/econt/nomenclatures'
import {
  cachedJson,
  econtErrorResponse,
  positiveIntParam,
  rateLimitGuard,
} from '@/lib/econt/route-helpers'

export const runtime = 'nodejs'

/**
 * Streets and quarters for address-mode delivery.
 *
 * Empty lists are a normal answer, not a failure: Econt has no street
 * nomenclature for most villages, which is what the freeform street fallback in
 * the form is for.
 */
export async function GET(request: Request) {
  const limited = rateLimitGuard(request, 'nomenclature')
  if (limited) return limited

  const cityId = positiveIntParam(request, 'cityId')
  if ('error' in cityId) return cityId.error

  try {
    return cachedJson(request, await getCityDetails(cityId.value))
  } catch (error) {
    return econtErrorResponse(error, { streets: [], quarters: [] })
  }
}
