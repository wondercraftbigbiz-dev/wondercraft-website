import { ModalProvider } from '@/components/site/modal-context'
import { Header } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Benefits } from '@/components/site/benefits'
import { Pricing } from '@/components/site/pricing'
import { Assembly } from '@/components/site/assembly'
import { Metrics } from '@/components/site/metrics'
import { Testimonials } from '@/components/site/testimonials'
import { Guarantee } from '@/components/site/guarantee'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/final-cta'
import { Footer } from '@/components/site/footer'
import { BackToTop } from '@/components/site/back-to-top'
import { Marquee } from '@/components/site/marquee'

const claims = [
  '100% рециклиран картон',
  '15 минути сглобяване',
  'Без лепило и инструменти',
  'Прибира се плоско',
  '30 дни право на връщане',
]

export default function Page() {
  return (
    <ModalProvider>
      <Header />
      <main>
        <Hero />
        {/* Trust strip lives under the hero, never inside it. */}
        <Marquee items={claims} />
        <Benefits />
        <Pricing />
        <Assembly />
        <Metrics />
        <Testimonials />
        <Guarantee />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <BackToTop />
    </ModalProvider>
  )
}
