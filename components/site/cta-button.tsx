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
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-6 py-3 font-display text-base font-semibold transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-100',
        variant === 'solid' &&
          'border-2 border-coral bg-coral text-cream hover:bg-coral',
        variant === 'outline' &&
          'border-2 border-charcoal bg-transparent text-charcoal',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
