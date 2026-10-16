'use client'

import { type ReactNode } from 'react'
import { cn, focusRing } from '@/lib/utils'

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Color of the label when selected. */
  tone?: 'neutral' | 'income' | 'expense'
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group, e.g. "Tipo de movimiento". */
  label: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
}

/** Pill toggle for 2–4 mutually exclusive options (filters, income/expense). */
export default function SegmentedControl<T extends string>({
  options, value, onChange, label, size = 'md', fullWidth, className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('gap-1 rounded-lg bg-muted p-1', fullWidth ? 'flex w-full' : 'inline-flex', className)}
    >
      {options.map(opt => {
        const active = opt.value === value
        const tone = opt.tone ?? 'neutral'
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors',
              focusRing,
              fullWidth && 'flex-1',
              {
                'h-8 px-3 text-xs sm:text-sm': size === 'sm',
                'h-9 px-3.5 text-sm': size === 'md',
                'h-11 px-4 text-sm font-semibold': size === 'lg',
              },
              active
                ? cn('bg-surface shadow-sm', {
                    'text-fg': tone === 'neutral',
                    'text-income': tone === 'income',
                    'text-expense': tone === 'expense',
                  })
                : 'text-fg-subtle hover:text-fg'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
