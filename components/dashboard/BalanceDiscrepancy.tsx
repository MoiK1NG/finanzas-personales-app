import Link from 'next/link'
import { ChevronRight, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import { cn, focusRing } from '@/lib/utils'
import type { PeriodReconciliation } from '@/types/database'

/** Differences below this are rounding, not a problem worth flagging. */
export const TOLERANCE_COP = 5000

interface BalanceDiscrepancyProps {
  /** From the period_reconciliation RPC; null while unavailable (the card is not shown). */
  reconciliation: PeriodReconciliation | null
  onSetOpeningBalance: () => void
  settingOpeningBalance: boolean
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg">{children}</dd>
    </div>
  )
}

/**
 * Checks the month's records against the accounts: opening balance + this month's movements
 * should equal what the accounts hold. A difference means a balance was changed by hand or a
 * movement is missing.
 */
export default function BalanceDiscrepancy({
  reconciliation,
  onSetOpeningBalance,
  settingOpeningBalance,
}: BalanceDiscrepancyProps) {
  if (!reconciliation) return null
  const r = reconciliation

  if (r.opening_balance === null || r.expected_end === null || r.difference === null) {
    return (
      <Card className="border-l-4 border-l-info">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">Falta el saldo de apertura</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Es lo que tenías en tus cuentas al empezar el mes. Lo calculamos con tu saldo de hoy, sin contar los
              movimientos ya registrados este mes.
            </p>
            <Button
              variant="soft"
              size="sm"
              className="mt-3"
              loading={settingOpeningBalance}
              onClick={onSetOpeningBalance}
            >
              Fijar saldo de apertura
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const isOk = Math.abs(r.difference) < TOLERANCE_COP
  const withoutAccount = r.income_without_account + r.expenses_without_account

  return (
    <Card className={cn('border-l-4', isOk ? 'border-l-income-solid' : 'border-l-warning-solid')}>
      <div className="flex items-start gap-3">
        {isOk
          ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-income" aria-hidden="true" />
          : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        }
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            {isOk ? 'Saldos cuadrados' : 'Revisa la diferencia'}
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {isOk
              ? 'Tu saldo de apertura más los movimientos del mes coincide con lo que hay en tus cuentas.'
              : 'Lo registrado no coincide con tus cuentas. Pasa cuando cambias un saldo a mano («Actualizar saldo») o cuando falta registrar algún movimiento.'}
          </p>

          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Saldo de apertura">
              <Money value={r.opening_balance} variant="balance" />
            </Row>
            <Row label="Movimientos del mes">
              <Money
                value={r.recorded_flow}
                variant={r.recorded_flow > 0 ? 'income' : r.recorded_flow < 0 ? 'expense' : 'plain'}
              />
            </Row>
            <Row label="= Saldo esperado" className="border-t border-border pt-2">
              <Money value={r.expected_end} variant="balance" />
            </Row>
            <Row label="Saldo en cuentas">
              <Money value={r.actual_end} variant="balance" />
            </Row>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <dt className="text-fg-muted">Diferencia</dt>
              <dd className={cn('font-semibold tabular-nums whitespace-nowrap', isOk ? 'text-income' : 'text-warning')}>
                {r.difference > 0 && '+'}
                <Money value={r.difference} />
              </dd>
            </div>
          </dl>

          {withoutAccount > 0 && (
            <p className="mt-3 flex gap-1.5 text-xs text-fg-subtle">
              <Info className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
              <span>
                Hay <Money value={withoutAccount} /> en movimientos sin cuenta: no cambian tus saldos.
              </span>
            </p>
          )}

          {!isOk && (
            <Link
              href="/transacciones"
              className={cn(
                '-mb-2 -ml-2 mt-2 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors hover:bg-primary-soft',
                focusRing
              )}
            >
              Revisar movimientos <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  )
}
