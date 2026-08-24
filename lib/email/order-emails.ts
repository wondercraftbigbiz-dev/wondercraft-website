import 'server-only'

import { getResend } from './resend'

/** The subset of an `orders` row (plus the joined customer email) an email needs. */
export type PaidOrderEmailData = {
  orderNumber: number
  productName: string
  contactName: string
  contactPhone: string
  contactEmail: string
  totalEur: number
  shippingEur: number
  deliveryType: string | null
  econtCityName: string | null
  econtOfficeName: string | null
  street: string | null
  streetNum: string | null
  quarter: string | null
  floor: string | null
  apt: string | null
  deliveryNote: string | null
  printName: string | null
  customization: string | null
  message: string | null
}

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

function fromAddress(): string {
  const from = env('EMAIL_FROM')
  if (!from) throw new Error('Email is misconfigured: missing EMAIL_FROM')
  return from
}

function deliveryLine(o: PaidOrderEmailData): string {
  if (o.deliveryType === 'office' || o.deliveryType === 'aps') {
    return `${o.econtOfficeName ?? '(офис/автомат)'}, ${o.econtCityName ?? ''}`
  }
  const parts = [
    [o.street, o.streetNum].filter(Boolean).join(' '),
    o.quarter,
    o.econtCityName,
  ].filter(Boolean)
  return parts.join(', ') || 'адресът не е потвърден'
}

/**
 * Notify the shop that an order was paid. Sent once, from the Stripe webhook,
 * after `mark_order_paid` settles the row — never from the client.
 */
export async function sendShopOrderPaidEmail(o: PaidOrderEmailData): Promise<void> {
  const shopEmail = env('SHOP_NOTIFICATION_EMAIL')
  if (!shopEmail) throw new Error('Missing SHOP_NOTIFICATION_EMAIL')

  const lines = [
    `Нова платена поръчка WC-${o.orderNumber}`,
    ``,
    `Продукт: ${o.productName}`,
    o.printName ? `Име за печат: ${o.printName}` : null,
    o.customization ? `Персонализация: ${o.customization}` : null,
    ``,
    `Клиент: ${o.contactName}`,
    `Телефон: ${o.contactPhone}`,
    `Имейл: ${o.contactEmail}`,
    ``,
    `Доставка: ${deliveryLine(o)}`,
    o.floor ? `Етаж: ${o.floor}` : null,
    o.apt ? `Апартамент: ${o.apt}` : null,
    o.deliveryNote ? `Бележка: ${o.deliveryNote}` : null,
    ``,
    `Продукт: ${o.totalEur - o.shippingEur} €`,
    `Доставка: ${o.shippingEur} €`,
    `Общо платено: ${o.totalEur} €`,
    o.message ? `` : null,
    o.message ? `Съобщение от клиента: ${o.message}` : null,
  ].filter((l): l is string => l !== null)

  await getResend().emails.send({
    from: fromAddress(),
    to: shopEmail,
    subject: `Платена поръчка WC-${o.orderNumber} — ${o.contactName}`,
    text: lines.join('\n'),
  })
}

/** Confirm to the customer that their payment went through. */
export async function sendCustomerOrderPaidEmail(
  o: PaidOrderEmailData,
): Promise<void> {
  const lines = [
    `Здравейте, ${o.contactName}!`,
    ``,
    `Плащането за поръчка WC-${o.orderNumber} е успешно.`,
    `Продукт: ${o.productName}`,
    `Общо платено: ${o.totalEur} €`,
    ``,
    `Ще се свържем с вас на ${o.contactPhone}, за да потвърдим доставката.`,
    ``,
    `Благодарим ви, че избрахте WonderCraft!`,
  ]

  await getResend().emails.send({
    from: fromAddress(),
    to: o.contactEmail,
    subject: `Поръчка WC-${o.orderNumber} — плащането е успешно`,
    text: lines.join('\n'),
  })
}
