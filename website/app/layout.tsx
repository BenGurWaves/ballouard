import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Velocity. — Digital Ateliers for Heritage Maisons',
  description: 'Four commissions per quarter. Zero templates. Only bespoke digital rituals that match the physical craft of heritage luxury.',
  keywords: 'luxury digital agency, heritage maisons, bespoke web design, atelier, provenance',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Velocity. — Digital Ateliers for Heritage Maisons',
    description: 'Four commissions per quarter. Zero templates. Only bespoke digital rituals.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-atelier-black text-atelier-cream antialiased">
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
