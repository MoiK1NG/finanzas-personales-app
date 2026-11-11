'use client'

import { cn, focusRing } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required because the button only shows an icon. */
  label: string
  tone?: 'neutral' | 'primary' | 'danger'
  size?: 'sm' | 'md'
}

/**
 * Icon-only button with a touch-friendly hit area (40px on mobile).
 * Always visible: never hide it behind hover, touch screens cannot hover.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tone = 'neutral', size = 'md', className, type = 'button', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors',
          focusRing,
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'h-10 w-10': size === 'md',
            'h-10 w-10 sm:h-8 sm:w-8': size === 'sm',
          },
          {
            'hover:bg-muted hover:text-fg': tone === 'neutral',
            'hover:bg-primary-soft hover:text-accent': tone === 'primary',
            'hover:bg-expense-soft hover:text-expense': tone === 'danger',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'

export default IconButton
