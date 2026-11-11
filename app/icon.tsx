import { renderAppIcon } from '@/lib/pwaIcon'

// Served at /icon/<id>; app/manifest.ts points to these URLs.
export function generateImageMetadata() {
  return [
    { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
    { id: 'maskable', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ]
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = String(await id)
  if (iconId === 'maskable') return renderAppIcon(512, { maskable: true })
  return renderAppIcon(iconId === '512' ? 512 : 192)
}
