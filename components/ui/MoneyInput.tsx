'use client'

import { type InputHTMLAttributes, forwardRef, useId } from 'react'
import { cn, formatMoneyInput } from '@/lib/utils'
import { fieldClass, fieldErrorClass } from './Input'

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size' | 'prefix'> {
  label?: string
  error?: string
  hint?: string
  /** Formatted value as shown to the user ("1.250.000"); '' when empty. Parse with parseMoneyInput. */
  value: string
  onValueChange: (formatted: string) => void
  /** Allows a leading minus sign (e.g. account balances, credit cards). */
  allowNegative?: boolean
  /** lg = large bold amount, for the main field of a form. */
  size?: 'md' | 'lg'
}

/** COP amount field: numeric keyboard on phones, thousands separators while typing. */
const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ label, error, hint, value, onValueChange, allowNegative, size = 'md', id, className, placeholder = '0', ...props }, ref) => {
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
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-fg-subtle',
              size === 'lg' ? 'text-lg' : 'text-sm'
            )}
          >
            $
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode={allowNegative ? 'text' : 'numeric'}
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={e => onValueChange(formatMoneyInput(e.target.value, allowNegative))}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              fieldClass,
              'pl-7 tabular-nums',
              size === 'lg' && 'h-14 sm:h-14 text-2xl sm:text-2xl font-bold',
              error && fieldErrorClass,
              className
            )}
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
MoneyInput.displayName = 'MoneyInput'

export default MoneyInput
