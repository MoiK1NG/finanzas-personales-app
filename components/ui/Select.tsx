import { cn } from '@/lib/utils'
import { type SelectHTMLAttributes, forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { fieldClass, fieldErrorClass } from './Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const autoId = useId()
    const selectId = id ?? autoId
    const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-fg-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(fieldClass, 'appearance-none pr-9 cursor-pointer', error && fieldErrorClass, className)}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
          />
        </div>
        {error ? (
          <p id={`${selectId}-error`} className="text-xs text-expense">{error}</p>
        ) : hint ? (
          <p id={`${selectId}-hint`} className="text-xs text-fg-subtle">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Select.displayName = 'Select'

export default Select
