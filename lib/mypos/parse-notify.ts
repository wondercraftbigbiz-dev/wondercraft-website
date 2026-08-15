import { getMyposConfig, type MyposConfig } from './config'
import { verifyFields, type MyposField } from './sign'

/**
 * Parses and verifies an inbound myPOS notification (IPCPurchaseNotify).
 *
 * The signature is computed over the received values in the order they arrive,
 * so the body is parsed into ordered tuples and never round-tripped through an
 * unordered object before verification.
 */

export type ParsedNotification = {
  verified: boolean
  /** Every field except Signature, in received order. */
  fields: MyposField[]
  /** Same data as a lookup map, for reading individual values. */
  values: Record<string, string>
  signature: string
}

export function parseNotification(
  rawBody: string,
  config: MyposConfig = getMyposConfig(),
): ParsedNotification {
  // URLSearchParams preserves the order of the body and handles percent- and
  // plus-encoding the same way a form POST is decoded server-side.
  const params = new URLSearchParams(rawBody)

  const fields: MyposField[] = []
  let signature = ''

  for (const [name, value] of params) {
    if (name === 'Signature') {
      signature = value
      continue
    }
    fields.push([name, value])
  }

  return {
    verified: verifyFields(fields, signature, config.apiPublicKey),
    fields,
    values: Object.fromEntries(fields),
    signature,
  }
}

/** The notification fields we act on. */
export type NotificationDetails = {
  method: string
  sid: string
  orderId: string
  amount: number | null
  currency: string
  trnref: string
}

export function readNotificationDetails(
  values: Record<string, string>,
): NotificationDetails {
  const rawAmount = values.Amount?.trim()
  const amount = rawAmount ? Number(rawAmount) : NaN

  return {
    method: values.IPCmethod ?? '',
    sid: values.SID ?? '',
    orderId: values.OrderID ?? '',
    amount: Number.isFinite(amount) ? amount : null,
    currency: values.Currency ?? '',
    trnref: values.IPC_Trnref ?? '',
  }
}
