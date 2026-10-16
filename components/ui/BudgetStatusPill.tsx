import { CircleCheck } from 'lucide-react'
import { cn, getBudgetStatus } from '@/lib/utils'

interface BudgetStatusPillProps {
  /** projected income − total budgeted */
  unassigned: number
  /** 'surface' on cards (tinted pill), 'hero' on the indigo gradient cards (translucent white pill). */
  appearance?: 'surface' | 'hero'
  className?: string
}

/** "Base cero" / "$X sin asignar" / "$X excedido" — the zero-based budget status, same wording everywhere. */
export default function BudgetStatusPill({ unassigned, appearance = 'surface', className }: BudgetStatusPillProps) {
  const { tone, label } = getBudgetStatus(unassigned)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums whitespace-nowrap',
        appearance === 'surface'
          ? {
              'bg-income-soft text-income': tone === 'ok',
              'bg-warning-soft text-warning': tone === 'unassigned',
              'bg-expense-soft text-expense': tone === 'over',
            }
          : 'bg-white/15 text-white',
        className
      )}
    >
      {tone === 'ok' && <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  )
}
