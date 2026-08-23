'use client'

import { useEffect, useRef, type Dispatch } from 'react'
import type { QuoteResponse } from '@/lib/econt/dto'
import type { Action, OrderState } from './order-reducer'
import { quoteKey, toOrderDraft } from './order-reducer'

/** Address mode is typed into, so wait for a pause; pickup is a discrete click. */
const TYPING_DEBOUNCE_MS = 400

/** Same window the server uses, so both sides agree on freshness. */
const CLIENT_CACHE_MS = 60_000
const cache = new Map<string, { at: number; response: QuoteResponse }>()

/**
 * Keeps the delivery price in step with the chosen destination.
 *
 * The effect is keyed on quoteKey(state) — a pure function of state that is null
 * until the selection is complete — which is what makes this correct without
 * extra bookkeeping: any change that could alter the price produces a new key,
 * and the reducer has already reset the quote to idle for that same change.
 */
export function useShippingQuote(
  state: OrderState,
  dispatch: Dispatch<Action>,
): void {
  const key = quoteKey(state)
  const latestKey = useRef<string | null>(null)
  latestKey.current = key

  // Read through a ref so the effect depends on the key alone. Including the
  // whole draft would re-fire the request on every keystroke in an unrelated
  // field, such as the customer's name.
  const draftRef = useRef(state)
  draftRef.current = state

  useEffect(() => {
    if (!key) return

    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CLIENT_CACHE_MS) {
      apply(dispatch, cached.response)
      return
    }

    const controller = new AbortController()
    // Selecting an office is a single click, so show its price immediately;
    // only typed input needs settling time.
    const debounce = state.delivery.type === 'address' ? TYPING_DEBOUNCE_MS : 0

    const timer = window.setTimeout(async () => {
      dispatch({ type: 'quoteStart' })
      const draft = toOrderDraft(draftRef.current)

      try {
        const res = await fetch('/api/econt/shipping-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          // Only the plan id and the destination. The server owns weight,
          // dimensions and price — see the note in the route.
          body: JSON.stringify({ planId: draft.planId, delivery: draft.delivery }),
        })

        const response = (await res.json()) as QuoteResponse
        if (controller.signal.aborted) return

        // Belt and braces: an abort that lands late must not overwrite a newer
        // selection's price.
        if (latestKey.current !== key) return

        if (response.ok) cache.set(key, { at: Date.now(), response })
        apply(dispatch, response)
      } catch (err) {
        if (controller.signal.aborted || isAbort(err)) return
        if (latestKey.current !== key) return
        dispatch({
          type: 'quoteError',
          message:
            'Не успяхме да изчислим доставката. Проверете връзката и опитайте отново.',
        })
      }
    }, debounce)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // state.delivery.type only picks the debounce and always changes the key too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dispatch])
}

function apply(dispatch: Dispatch<Action>, response: QuoteResponse): void {
  if (response.ok) {
    dispatch({
      type: 'quoteOk',
      product: response.product,
      shipping: response.shipping,
      total: response.total,
      quoteId: response.quoteId,
      // Forwarded, not dropped: the payment step refuses to open against a stale
      // quote, and it can only know that if this number survives the hop.
      expiresAt: response.expiresAt,
    })
    return
  }

  dispatch({ type: 'quoteError', message: response.message })
  // When the server can attribute the problem to a field, put the message next
  // to that input as well as in the price line.
  if (response.field) {
    dispatch({
      type: 'setErrors',
      errors: { [response.field]: response.message } as never,
    })
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
