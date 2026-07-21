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

export default function Page() {
  return (
    <ModalProvider>
      <Header />
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
      <Footer />
      <BackToTop />
    </ModalProvider>
  )
}
