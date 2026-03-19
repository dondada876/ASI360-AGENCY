import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: '500 Grand Live — Book Your Spot',
  description:
    'Reserve premium lakeside umbrellas, canopy tents, and VIP lounges at Lake Merritt. Golden hour views, food delivery, and all-day vibes.',
  keywords: [
    'Lake Merritt',
    'Oakland',
    'umbrella rental',
    'canopy tent',
    'lakeside booking',
    'picnic',
    '500 Grand Live',
  ],
  openGraph: {
    title: '500 Grand Live Social Club',
    description: 'Book your lakeside experience at Lake Merritt, Oakland',
    siteName: '500 Grand Live',
    type: 'website',
    url: 'https://bookit.500grandlive.com',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
