import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Caveat, Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

// Warm editorial serif for headlines — replaces the generic geometric-sans
// default to give the brand a distinct, boutique voice instead of a
// templated tech-startup one.
// The third voice. One short handwritten line under each headline is what
// keeps the display type from reading corporate. Cyrillic coverage is a
// hard requirement here — the site is lang="bg" and most script faces
// (Pacifico, Lobster, Dancing Script) are latin-only.
const caveat = Caveat({
  subsets: ['latin', 'cyrillic'],
  weight: ['700'],
  variable: '--font-caveat',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wondercraft — Картонена къщичка за игра | 30 €',
  description:
    'Къщичка за игра от 100% рециклиран картон. Сглобява се за 15 минути без инструменти и се прибира плоско. От 30 € (58,67 лв.).',
  generator: 'v0.app',
  metadataBase: new URL('https://wondercraft.example'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Wondercraft — Картонена къщичка за игра | 30 €',
    description:
      'Къщичка за игра от 100% рециклиран картон. Сглобява се за 15 минути без инструменти и се прибира плоско. От 30 € (58,67 лв.).',
    type: 'website',
    locale: 'bg_BG',
    images: [
      {
        url: '/images/assembly-2.png',
        width: 1024,
        height: 1024,
        alt: 'Картонена къщичка за игра Wondercraft',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#fdf9f4',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="bg"
      className={`${inter.variable} ${playfair.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  )
}
