import { NextResponse } from 'next/server'
import { callEcont, EcontError } from '@/lib/econt/client'
import { COUNTRY_CODE, PARCEL, SENDER } from '@/lib/econt/config'
import type { RawLabelResponse, ShippingQuote } from '@/lib/econt/types'

/**
 * Quotes the courier price for delivery to a chosen office.
 *
 * Uses createLabel in "calculate" mode, which computes a price and returns it
 * WITHOUT creating a shipment. The distinction matters: dropping the mode field
 * would write a real waybill into Econt's shared demo system.
 *
 * Not cached — quotes depend on the chosen office.
 */
export async function POST(request: Request) {
  let officeCode: unknown
  try {
    officeCode = (await request.json())?.officeCode
  } catch {
    return NextResponse.json({ error: 'Невалидна заявка.' }, { status: 400 })
  }

  if (typeof officeCode !== 'string' || !officeCode) {
    return NextResponse.json({ error: 'Липсва officeCode.' }, { status: 400 })
  }

  try {
    const data = await callEcont<RawLabelResponse>(
      'Shipments/LabelService',
      'createLabel',
      {
        mode: 'calculate',
        label: {
          senderClient: {
            name: SENDER.contactName,
            phones: [SENDER.phone],
          },
          senderAddress: {
            city: {
              country: { code3: COUNTRY_CODE },
              name: SENDER.cityName,
              postCode: SENDER.postCode,
            },
            street: SENDER.street,
            num: SENDER.streetNum,
          },
          receiverClient: {
            name: 'Получател',
            phones: ['0888000000'],
          },
          receiverOfficeCode: officeCode,
          packCount: 1,
          shipmentType: 'PACK',
          weight: PARCEL.weightKg,
          shipmentDescription: 'Картонена къщичка',
          // Prepaid: the sender covers the courier price, no COD (D4).
          paymentSenderMethod: 'cash',
        },
      },
    )

    const quote: ShippingQuote = {
      total: numberOrNull(
        data.label?.totalPrice ?? data.label?.courierServicePrice,
      ),
      currency: data.label?.currency ?? 'BGN',
    }

    return NextResponse.json(quote)
  } catch (err) {
    const status = err instanceof EcontError ? err.status : 500
    console.error('[econt/shipping-price]', err)
    // The picker treats any failure here as "price unavailable" and keeps the
    // order flow usable — a missing quote must not block choosing an office.
    return NextResponse.json(
      { error: 'Цената на доставката не можа да бъде изчислена.' },
      { status: status >= 400 && status < 600 ? status : 500 },
    )
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
