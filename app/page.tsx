import { PageShell } from '@/components/site/page-shell'
import { Hero } from '@/components/site/hero'
import { Benefits } from '@/components/site/benefits'
import { Pricing } from '@/components/site/pricing'
import { Assembly } from '@/components/site/assembly'
import { Metrics } from '@/components/site/metrics'
import { Testimonials } from '@/components/site/testimonials'
import { Guarantee } from '@/components/site/guarantee'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/final-cta'

export default function Page() {
  return (
    <PageShell>
      <main>
        <Hero />
        <Benefits />
        <Pricing />
        <Assembly />
        <Metrics />
        <Testimonials />
        <Guarantee />
        <Faq />
        <FinalCta />
      </main>
    </PageShell>
  )
}
