import { cn, type SpendTone } from '@/lib/utils'

interface ProgressBarProps {
  /** Percentage 0–100+ (values above 100 fill the bar). */
  value: number
  /** Spend status from getSpendTone(), or 'primary' for neutral progress (e.g. goals). */
  tone?: SpendTone | 'primary'
  size?: 'sm' | 'md'
  /** Accessible description, e.g. "Mercado: 45% gastado". Omit if the value is shown as text next to it. */
  label?: string
  className?: string
}

export default function ProgressBar({ value, tone = 'primary', size = 'md', label, className }: ProgressBarProps) {
  const width = Math.max(0, Math.min(value, 100))
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-muted', size === 'sm' ? 'h-1.5' : 'h-2', className)}
      {...(label
        ? { role: 'progressbar', 'aria-label': label, 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': 100 }
        : { 'aria-hidden': true })}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', {
          'bg-income-solid': tone === 'ok',
          'bg-warning-solid': tone === 'warning',
          'bg-expense-solid': tone === 'over',
          'bg-primary': tone === 'primary',
        })}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
