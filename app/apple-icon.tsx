import { renderAppIcon } from '@/lib/pwaIcon'

// iOS ignores the manifest icons and uses this one for "Añadir a pantalla de inicio".
// iOS rounds the corners itself, so the tile is drawn square.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return renderAppIcon(180, { maskable: true })
}
