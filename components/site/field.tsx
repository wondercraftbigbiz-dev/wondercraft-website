'use client'

import { useId } from 'react'

/**
 * A labelled form row with optional hint and error text.
 *
 * Renders a real <label> by default. Composites that own several controls (a
 * radio group, the office picker) must pass `as="group"` instead — wrapping
 * multiple inputs in one <label> makes the label ambiguous and screen readers
 * announce it against the wrong control.
 */
export function Field({
  label,
  error,
  hint,
  as = 'label',
  children,
}: {
  label: string
  error?: string
  hint?: string
  as?: 'label' | 'group'
  children: React.ReactNode | ((ids: FieldIds) => React.ReactNode)
}) {
  const base = useId()
  const hintId = hint ? `${base}-hint` : undefined
  const errorId = error ? `${base}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const heading = (
    <span className="mb-1.5 block font-sans text-sm font-semibold text-charcoal">
      {label}
    </span>
  )
  const body = (
    <>
      {typeof children === 'function'
        ? children({ describedBy, hintId, errorId, hasError: Boolean(error) })
        : children}
      {hint && (
        <span id={hintId} className="mt-1 block text-xs text-charcoal-soft">
          {hint}
        </span>
      )}
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-1 block text-sm font-medium text-error"
        >
          {error}
        </span>
      )}
    </>
  )

  if (as === 'group') {
    return (
      <div role="group" aria-describedby={describedBy}>
        {heading}
        {body}
      </div>
    )
  }

  return (
    <label className="block">
      {heading}
      {body}
    </label>
  )
}

export type FieldIds = {
  /** Pass to the control's aria-describedby so hint and error are announced. */
  describedBy: string | undefined
  hintId: string | undefined
  errorId: string | undefined
  hasError: boolean
}
