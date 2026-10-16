import { ImageResponse } from 'next/og'

/**
 * App icon: indigo gradient tile with the FinanzasApp "trending up" mark (same as the sidebar logo).
 * SVG shapes only, so no font has to be loaded at build time.
 * `maskable` drops the rounded corners and keeps the mark inside the central safe zone,
 * because Android crops maskable icons to its own shape.
 */
export function renderAppIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const mark = Math.round(size * (maskable ? 0.5 : 0.62))
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg
          width={mark}
          height={mark}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
