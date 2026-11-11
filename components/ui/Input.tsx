import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  prefix?: string
}

/** Shared field styles, also used by Select and MoneyInput. 16px text on mobile avoids iOS zoom on focus. */
export const fieldClass = cn(
  'w-full h-11 sm:h-10 rounded-lg border border-border-strong bg-surface px-3 text-base sm:text-sm text-fg',
  'placeholder:text-fg-faint transition-colors',
  'outline-hidden focus:ring-2 focus:ring-ring focus:border-transparent',
  'disabled:bg-surface-2 disabled:text-fg-subtle disabled:cursor-not-allowed'
)

export const fieldErrorClass = 'border-expense focus:ring-expense'

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefix, id, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-fg-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-fg-subtle">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(fieldClass, error && fieldErrorClass, prefix && 'pl-8', className)}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-expense">{error}</p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-fg-subtle">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'

export default Input
