'use client'

import { useEffect, useState } from 'react'
import type { ShippingQuote } from '@/lib/econt/types'

/**
 * Quotes delivery for the chosen office.
 *
 * A failed quote is not an error state in the UI — the order flow stays usable
 * and the summary falls back to "по тарифа на Еконт". Losing a price should
 * never block choosing an office.
 */
export function useShippingQuote(officeCode: string | null) {
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!officeCode) {
      setQuote(null)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch('/api/econt/shipping-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeCode }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ShippingQuote) => {
        if (!cancelled) setQuote(data)
      })
      .catch(() => {
        if (!cancelled) setQuote(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [officeCode])

  return { quote, loading }
}
