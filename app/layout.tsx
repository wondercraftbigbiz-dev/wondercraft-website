import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
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
const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

// title, icons, and openGraph.title below are the site's tab title/favicon —
// intentionally set to "Wondercraft Toy Factory" and the vertical logo jpeg.
// Do not revert these to old copy/placeholders when regenerating this file
// (e.g. via v0 or other AI-assisted edits) or when merging other branches.
export const metadata: Metadata = {
  title: 'Wondercraft Toy Factory',
  description:
    'Къщичка за игра от 100% рециклиран картон. Сглобява се за 15 минути без инструменти и се прибира плоско. От 30 € (58,67 лв.).',
  generator: 'v0.app',
  metadataBase: new URL('https://wondercraft.example'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/images/logo vertical with background - only icons.jpeg',
  },
  openGraph: {
    title: 'Wondercraft Toy Factory',
    description:
      'Къщичка за игра от 100% рециклиран картон. Сглобява се за 15 минути без инструменти и се прибира плоско. От 30 € (58,67 лв.).',
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
  themeColor: '#fdf9f4',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="bg" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
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
