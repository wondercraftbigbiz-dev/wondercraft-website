'use client'

import { useEffect, useRef, type Dispatch } from 'react'
import type { IntentResponse } from '@/lib/payments/dto'
import type { Action, OrderState } from './order-reducer'
import { intentKey, toOrderDraft } from './order-reducer'

/**
 * Opens a PaymentIntent once the customer reaches the payment step.
 *
 * Keyed on intentKey(state) — a pure function of state, the same discipline
 * quoteKey() established for the delivery quote. Any change that could move the
 * price produces a new key, and the reducer has already discarded the old intent
 * for that same change.
 *
 * Deliberately no cache, unlike use-shipping-quote. A client secret authorizes
 * confirming one specific payment for one specific amount; reusing one across a
 * key change is the exact bug the key exists to prevent.
 */
export function usePaymentIntent(
  state: OrderState,
  dispatch: Dispatch<Action>,
): void {
  const key = intentKey(state)
  const latestKey = useRef<string | null>(null)
  latestKey.current = key

  // Read the draft through a ref so the effect depends on the key alone.
  // Including it directly would re-open an intent on every keystroke.
  const draftRef = useRef(state)
  draftRef.current = state

  useEffect(() => {
    if (!key) return

    const controller = new AbortController()
    let cancelled = false

    async function open() {
      const snapshot = draftRef.current
      if (snapshot.quote.status !== 'ok' || !snapshot.attemptId) return

      dispatch({ type: 'intentStart' })

      try {
        const res = await fetch('/api/payment/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ...toOrderDraft(snapshot),
            attemptId: snapshot.attemptId,
            // Sent so the server can tell the customer is looking at a stale
            // number. It never decides what is charged — the server reprices
            // from the plan id and a fresh Econt quote regardless.
            expectedTotalCents: snapshot.quote.total.cents,
          }),
        })

        const body = (await res.json()) as IntentResponse
        if (cancelled || latestKey.current !== key) return

        if (body.ok) {
          dispatch({
            type: 'intentReady',
            clientSecret: body.clientSecret,
            orderRef: body.orderRef,
            total: body.total,
          })
          return
        }

        if (body.reason === 'invalid' && body.errors) {
          dispatch({ type: 'setErrors', errors: body.errors })
        }

        dispatch({
          type: 'intentError',
          message: body.message,
          // 'unavailable' means Stripe or Econt is not answering, which may pass.
          // 'invalid' means the form is wrong, which retrying will not fix.
          retryable: body.reason !== 'invalid',
        })
      } catch (err) {
        if (cancelled || controller.signal.aborted || isAbort(err)) return
        if (latestKey.current !== key) return
        dispatch({
          type: 'intentError',
          message:
            'Не успяхме да започнем плащането. Проверете връзката и опитайте отново.',
          retryable: true,
        })
      }
    }

    void open()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [key, dispatch])
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
