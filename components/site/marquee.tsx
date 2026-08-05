import { cn } from '@/lib/utils'

// Scrolling claims strip, contained in a pill rather than run full-bleed.
//
// aria-hidden throughout: every claim here already appears as real text
// elsewhere on the page (hero badges, benefits), so to a screen reader this
// is duplicate noise. The track holds the list twice, which is what makes
// translating it by -50% loop seamlessly.
export function Marquee({
  items,
  className,
}: {
  items: string[]
  className?: string
}) {
  return (
    <div className={cn('px-5', className)} aria-hidden="true">
      <div className="marquee-mask mx-auto w-full max-w-[1120px] overflow-hidden rounded-full bg-charcoal py-3.5">
        <div className="marquee-track">
          {[...items, ...items].map((item, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-6 whitespace-nowrap px-6 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-cream"
            >
              {item}
              <span className="text-salmon-deep">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
