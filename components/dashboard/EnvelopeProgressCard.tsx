import type { CSSProperties } from 'react'
import { PiggyBank, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Money from '@/components/ui/Money'
import ProgressBar from '@/components/ui/ProgressBar'
import { cn, formatCOP, formatPercent, getSpendTone } from '@/lib/utils'
import type { EnvelopeSummary } from '@/types/database'

const TONE_TEXT = { ok: 'text-income', warning: 'text-warning', over: 'text-expense' } as const

/** Tint derived from the user's color so it reads on light and dark surfaces. */
function tintStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 16%, var(--surface))`,
    color: `color-mix(in oklch, ${color} 75%, var(--fg))`,
  }
}

interface EnvelopeProgressCardProps {
  envelope: EnvelopeSummary
  className?: string
}

export default function EnvelopeProgressCard({ envelope, className }: EnvelopeProgressCardProps) {
  // Against what can be spent this month: budgeted + carry-over from last month.
  const isOver = envelope.executed_amount > envelope.spendable_amount
  // The view reports 0% when there is nothing to spend, so spending without a budget needs its own label.
  const spentWithoutBudget = envelope.spendable_amount <= 0 && envelope.executed_amount > 0
  const tone = getSpendTone(envelope.pct_executed, isOver)
  const Icon = envelope.is_savings ? PiggyBank : Wallet

  return (
    <Card padding="sm" className={className}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={tintStyle(envelope.color)}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-fg">{envelope.envelope_name}</p>
            {envelope.is_savings && <Badge variant="indigo">Ahorro</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <p className="text-xs text-fg-subtle tabular-nums">
              <span className="sr-only">Gastado </span>
              {formatCOP(envelope.executed_amount)} de {formatCOP(envelope.spendable_amount)}
            </p>
            {envelope.carryover_amount > 0 && (
              <Badge variant="green">
                +<Money value={envelope.carryover_amount} /> traslado
              </Badge>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <Money
            value={isOver ? Math.abs(envelope.available_amount) : envelope.available_amount}
            className={cn('block text-sm font-semibold sm:text-base', isOver ? 'text-expense' : 'text-fg')}
          />
          <p className={cn('text-xs', isOver ? 'font-medium text-expense' : 'text-fg-subtle')}>
            {isOver ? 'excedido' : 'disponible'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={spentWithoutBudget ? 100 : envelope.pct_executed} tone={tone} size="sm" className="flex-1" />
        <span className={cn('shrink-0 text-xs font-medium tabular-nums', TONE_TEXT[tone])}>
          {spentWithoutBudget ? 'Sin presupuesto' : `${formatPercent(envelope.pct_executed)} gastado`}
        </span>
      </div>
    </Card>
  )
}
