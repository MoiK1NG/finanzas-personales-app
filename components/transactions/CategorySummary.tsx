import { X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import ProgressBar from '@/components/ui/ProgressBar'
import { cn, formatPercent, getSpendTone } from '@/lib/utils'
import type { EnvelopeSummary } from '@/types/database'

const TONE_TEXT = { ok: 'text-income', warning: 'text-warning', over: 'text-expense' } as const

interface CategorySummaryProps {
  name: string
  /** User-chosen category color; omit for "sin categoría". */
  color?: string
  isSavings?: boolean
  /** Executed expenses of the category in the month on screen. */
  spent: number
  /** Movements shown for the category (executed and projected). */
  count: number
  /** Budget line of the category this month; undefined when it has no budget (or for "sin categoría"). */
  budget?: Pick<EnvelopeSummary, 'spendable_amount' | 'carryover_amount' | 'available_amount'>
  /** Shown under the figures, e.g. how to classify uncategorized expenses. */
  hint?: string
  onClear: () => void
}

/** What was spent in one category this month, shown above its movements in Movimientos. */
export default function CategorySummary({
  name, color, isSavings, spent, count, budget, hint, onClear,
}: CategorySummaryProps) {
  const spendable = budget?.spendable_amount ?? 0
  const hasBudget = budget !== undefined && spendable > 0
  const isOver = hasBudget && spent > spendable
  const pct = hasBudget ? (spent / spendable) * 100 : 0
  const tone = getSpendTone(pct, isOver)

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {color && (
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          )}
          <h2 className="truncate text-sm font-semibold text-fg">{name}</h2>
          {isSavings && <Badge variant="indigo">Ahorro</Badge>}
        </div>
        <Button variant="ghost" size="sm" className="-mr-2 -mt-1 shrink-0" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden="true" />
          Quitar filtro
        </Button>
      </div>

      <div>
        <p className="text-xs text-fg-subtle">Gastado este mes</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <Money value={spent} className="text-2xl font-bold tracking-tight text-fg" />
          {hasBudget && (
            <span className="text-sm text-fg-subtle">
              de <Money value={spendable} />
            </span>
          )}
        </p>
      </div>

      {hasBudget ? (
        <div className="space-y-1.5">
          <ProgressBar value={pct} tone={tone} size="sm" />
          <p className="flex flex-wrap items-center justify-between gap-x-3 text-xs">
            <span className={cn('font-medium tabular-nums', TONE_TEXT[tone])}>{formatPercent(pct)} gastado</span>
            <span className={cn('tabular-nums', isOver ? 'font-medium text-expense' : 'text-fg-subtle')}>
              {isOver ? (
                <><Money value={spent - spendable} /> excedido</>
              ) : (
                <><Money value={spendable - spent} /> disponible</>
              )}
            </span>
          </p>
        </div>
      ) : color ? (
        <p className="text-xs text-fg-subtle">Esta categoría no tiene presupuesto este mes.</p>
      ) : null}

      <p className="text-xs text-fg-subtle">
        {count === 1 ? '1 movimiento' : `${count} movimientos`}
        {budget && budget.carryover_amount > 0 && (
          <> · incluye <Money value={budget.carryover_amount} /> de traslado</>
        )}
        {hint && <> · {hint}</>}
      </p>
    </Card>
  )
}
