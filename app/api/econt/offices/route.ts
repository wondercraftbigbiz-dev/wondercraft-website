import { getOffices } from '@/lib/econt/nomenclatures'
import {
  cachedJson,
  econtErrorResponse,
  positiveIntParam,
  rateLimitGuard,
} from '@/lib/econt/route-helpers'

export const runtime = 'nodejs'

/** Offices and automats in one city. Mobile post stations are already excluded. */
export async function GET(request: Request) {
  const limited = rateLimitGuard(request, 'nomenclature')
  if (limited) return limited

  const cityId = positiveIntParam(request, 'cityId')
  if ('error' in cityId) return cityId.error

  try {
    return cachedJson(request, { offices: await getOffices(cityId.value) })
  } catch (error) {
    return econtErrorResponse(error, { offices: [] })
  }
}
