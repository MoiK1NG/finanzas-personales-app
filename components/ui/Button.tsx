'use client'

import { cn, focusRing } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import Spinner from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/** Defaults to type="button"; pass type="submit" explicitly for form submits. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg border border-transparent font-medium whitespace-nowrap select-none transition-colors',
          focusRing,
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary text-primary-fg shadow-sm hover:bg-primary-hover': variant === 'primary',
            'bg-surface text-fg border-border-strong hover:bg-surface-2': variant === 'secondary',
            'text-fg-muted hover:bg-muted hover:text-fg': variant === 'ghost',
            'bg-danger text-danger-fg shadow-sm hover:bg-danger-hover': variant === 'danger',
            'bg-primary-soft text-accent hover:bg-primary-soft/70': variant === 'soft',
          },
          {
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 sm:h-10 px-4 text-sm': size === 'md',
            'h-12 px-5 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading && <Spinner size="sm" label="Procesando" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export default Button
