import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Onest } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700'],
  variable: '--font-onest',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wondercraft — Картонена къщичка за игра | 60 лв.',
  description:
    'Къщичка за игра от 100% рециклиран картон. Сглобява се за 15 минути без инструменти и се прибира плоско. От 60 лв.',
  generator: 'v0.app',
  metadataBase: new URL('https://wondercraft.example'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Wondercraft — Картонена къщичка за игра | 60 лв.',
    description:
      'Къщичка за игра от 100% рециклиран картон. Сглобява се за 15 минути без инструменти и се прибира плоско. От 60 лв.',
    type: 'website',
    locale: 'bg_BG',
    images: [
      {
        url: '/images/house-hero.png',
        width: 1200,
        height: 630,
        alt: 'Картонена къщичка за игра Wondercraft',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#faf8f5',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="bg" className={`${inter.variable} ${onest.variable}`}>
      <body className="antialiased">
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
