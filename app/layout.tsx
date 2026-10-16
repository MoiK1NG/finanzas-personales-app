import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinanzasApp — Control de presupuesto',
  description: 'Gestión financiera personal con Presupuesto Base Cero',
  applicationName: 'FinanzasApp',
  appleWebApp: {
    capable: true,
    title: 'FinanzasApp',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#151821' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} h-full bg-canvas text-fg antialiased`}>
        {children}
      </body>
    </html>
  )
}
