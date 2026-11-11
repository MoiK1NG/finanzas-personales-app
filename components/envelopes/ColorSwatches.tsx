'use client'

import { Check } from 'lucide-react'
import { cn, focusRing } from '@/lib/utils'

/** Palette offered for categories. */
export const CATEGORY_COLORS = [
  { value: '#6366f1', name: 'Índigo' },
  { value: '#8b5cf6', name: 'Violeta' },
  { value: '#ec4899', name: 'Rosa' },
  { value: '#ef4444', name: 'Rojo' },
  { value: '#f97316', name: 'Naranja' },
  { value: '#eab308', name: 'Amarillo' },
  { value: '#22c55e', name: 'Verde' },
  { value: '#14b8a6', name: 'Verde azulado' },
  { value: '#3b82f6', name: 'Azul' },
  { value: '#06b6d4', name: 'Cian' },
]

interface ColorSwatchesProps {
  value: string
  onChange: (color: string) => void
  /** Background the swatches sit on, so the selection ring's gap matches it. */
  surface?: 'surface' | 'surface-2'
  /** Group label shown above the swatches. */
  legend?: string
}

/** Color picker for a category: one real button per color, 36px, works on tap and keyboard. */
export default function ColorSwatches({ value, onChange, surface = 'surface', legend = 'Color' }: ColorSwatchesProps) {
  const current = value.toLowerCase()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-fg-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLORS.map(c => {
          const selected = current === c.value
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange(c.value)}
              aria-label={c.name}
              aria-pressed={selected}
              title={c.name}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-shadow',
                focusRing,
                selected && 'ring-2 ring-fg ring-offset-2',
                selected && (surface === 'surface-2' ? 'ring-offset-surface-2' : 'ring-offset-surface')
              )}
              style={{ backgroundColor: c.value }}
            >
              {selected && <Check className="h-4 w-4 drop-shadow-sm" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
