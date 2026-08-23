import Link from 'next/link'

/**
 * Where Stripe returns a customer whose issuer forced a full-page redirect.
 *
 * The common path never reaches here: the intent is created with
 * payment_method_types: ['card'] and confirmed with redirect: 'if_required', so
 * even a 3DS challenge stays inside the modal. Some issuers redirect anyway, and
 * without this page they would land on a 404 having just paid.
 *
 * Deliberately does not report success or failure. The webhook is what settles
 * an order, and reading a status from a query parameter the customer's browser
 * carried would be trusting the wrong source. This page's job is to tell them
 * their money is accounted for and that nothing further is required of them.
 */
export const metadata = {
  title: 'Плащане | WonderCraft',
  robots: { index: false, follow: false },
}

export default function PaymentReturnPage() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-charcoal">
        Благодарим ви!
      </h1>
      <p className="mt-4 text-pretty text-base leading-relaxed text-charcoal">
        Обработваме плащането ви. Ще се свържем с вас, за да потвърдим поръчката
        и доставката.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">
        Ако сте затворили прозореца по време на плащането, не плащайте повторно.
        Обадете ни се и ще проверим състоянието на поръчката.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 hover:bg-salmon-hover"
      >
        Обратно към сайта
      </Link>
    </main>
  )
}
