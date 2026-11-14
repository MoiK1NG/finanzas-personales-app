import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { themeScript } from '@/lib/theme'
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

// The browser bar color (theme-color) is set by themeScript, because it depends on the theme
// the user picked, not only on the OS setting.
export const viewport: Viewport = {
  colorScheme: 'light dark',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by themeScript before hydration, so the server markup cannot match it.
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} h-full bg-canvas text-fg antialiased`}>
        {children}
      </body>
    </html>
  )
}
