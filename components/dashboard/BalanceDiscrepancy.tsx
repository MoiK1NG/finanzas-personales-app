import Link from 'next/link'
import { ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Money from '@/components/ui/Money'
import { cn, focusRing } from '@/lib/utils'

interface BalanceDiscrepancyProps {
  realBankBalance: number      // suma de todas las cuentas
  realIncomeReceived: number
  realExpensesPaid: number
}

export default function BalanceDiscrepancy({
  realBankBalance,
  realIncomeReceived,
  realExpensesPaid,
}: BalanceDiscrepancyProps) {
  const cashFlow = realIncomeReceived - realExpensesPaid
  const discrepancy = realBankBalance - cashFlow
  const isOk = Math.abs(discrepancy) < 5000

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
            Compara tu saldo en cuentas con el flujo del mes (ingresos menos gastos ejecutados).
          </p>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-fg-muted">Saldo en cuentas</dt>
              <dd className="font-semibold text-fg">
                <Money value={realBankBalance} variant="balance" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-fg-muted">Flujo del mes</dt>
              <dd className="font-semibold">
                <Money value={cashFlow} variant={cashFlow >= 0 ? 'income' : 'expense'} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <dt className="text-fg-muted">Diferencia</dt>
              <dd className={cn('font-semibold tabular-nums whitespace-nowrap', isOk ? 'text-income' : 'text-warning')}>
                {discrepancy >= 0 && '+'}
                <Money value={discrepancy} />
              </dd>
            </div>
          </dl>

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
