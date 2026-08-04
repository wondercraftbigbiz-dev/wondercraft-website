'use client'

import type { Plan } from '@/lib/data/pricing'
import { cn } from '@/lib/utils'
import { useContactModal } from './modal-context'

type CtaButtonProps = {
  model?: Plan['id']
  variant?: 'solid' | 'outline'
  className?: string
  children?: React.ReactNode
  'aria-label'?: string
}

// Single CTA used everywhere. Label is always the same verb phrase.
export function CtaButton({
  model = 'standard',
  variant = 'solid',
  className,
  children = 'Поръчай сега',
  ...rest
}: CtaButtonProps) {
  const { open } = useContactModal()

  return (
    <button
      type="button"
      onClick={() => open(model)}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-6 py-3 font-display text-base font-semibold transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98]',
        variant === 'solid' &&
          'border border-border-soft bg-salmon text-charcoal shadow-soft hover:bg-salmon-hover hover:shadow-soft-lg',
        variant === 'outline' &&
          'border border-border-soft bg-transparent text-charcoal hover:bg-charcoal/5',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
