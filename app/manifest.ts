import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinanzasApp — Presupuesto base cero',
    short_name: 'FinanzasApp',
    description: 'Gestión financiera personal con Presupuesto Base Cero',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Same values as the light-mode canvas token and viewport themeColor in app/layout.tsx.
    background_color: '#f4f5f7',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
