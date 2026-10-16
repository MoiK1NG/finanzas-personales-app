import { cn, formatCOP } from '@/lib/utils'

interface MoneyProps {
  value: number
  /**
   * plain   — formatted amount, inherits color
   * income  — "+$ 1.000" in the income color (value is taken as absolute)
   * expense — "-$ 1.000" in the expense color (value is taken as absolute)
   * balance — formatted amount, expense color when negative
   */
  variant?: 'plain' | 'income' | 'expense' | 'balance'
  className?: string
}

/** Money amount with tabular digits, so columns of amounts line up. */
export default function Money({ value, variant = 'plain', className }: MoneyProps) {
  const abs = Math.abs(value)
  const text =
    variant === 'income' ? `+${formatCOP(abs)}` :
    variant === 'expense' ? `-${formatCOP(abs)}` :
    formatCOP(value)

  return (
    <span
      className={cn(
        'tabular-nums whitespace-nowrap',
        {
          'text-income': variant === 'income',
          'text-expense': variant === 'expense' || (variant === 'balance' && value < 0),
        },
        className
      )}
    >
      {text}
    </span>
  )
}
