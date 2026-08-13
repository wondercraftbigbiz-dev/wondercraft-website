import { isMyposConfigured } from '@/lib/mypos/config'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { BackToTop } from './back-to-top'
import { Footer } from './footer'
import { Header } from './header'
import { ModalProvider } from './modal-context'

/**
 * The chrome shared by every page: modal provider, sticky header, footer and
 * back-to-top. Extracted from app/page.tsx so the order and legal pages get the
 * same shell without duplicating it, and without moving it into the root layout
 * (which would change the single-page DOM the landing page relies on).
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  // Card payment needs both a configured myPOS store and somewhere to record
  // the order. Without either, the modal falls back to the enquiry form, so the
  // site stays fully usable before credentials exist.
  const paymentsEnabled = isMyposConfigured() && isSupabaseConfigured()

  return (
    <ModalProvider paymentsEnabled={paymentsEnabled}>
      <Header />
      {children}
      <Footer />
      <BackToTop />
    </ModalProvider>
  )
}
