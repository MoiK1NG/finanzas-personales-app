import { Card } from '@/components/ui/Card'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface BalanceDiscrepancyProps {
  projectedIncome: number
  totalBudgeted: number
  realBankBalance: number      // suma de todas las cuentas
  realIncomeReceived: number
  realExpensesPaid: number
}

export default function BalanceDiscrepancy({
  projectedIncome,
  totalBudgeted,
  realBankBalance,
  realIncomeReceived,
  realExpensesPaid,
}: BalanceDiscrepancyProps) {
  const theoreticalBalance = projectedIncome - totalBudgeted
  const cashFlow = realIncomeReceived - realExpensesPaid
  const discrepancy = realBankBalance - cashFlow
  const isOk = Math.abs(discrepancy) < 5000

  return (
    <Card className={cn('border-l-4', isOk ? 'border-l-green-500' : 'border-l-yellow-500')}>
      <div className="flex items-start gap-3">
        {isOk
          ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          : <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            {isOk ? 'Saldos cuadrados ✓' : 'Revisar discrepancia'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Saldo Teórico</p>
              <p className={cn('font-semibold', theoreticalBalance < 0 ? 'text-red-600' : 'text-gray-800')}>
                {formatCOP(theoreticalBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo Real (cuentas)</p>
              <p className={cn('font-semibold', realBankBalance < 0 ? 'text-red-600' : 'text-gray-800')}>
                {formatCOP(realBankBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Flujo real</p>
              <p className={cn('font-semibold', cashFlow >= 0 ? 'text-green-600' : 'text-red-600')}>
                {formatCOP(cashFlow)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Diferencia</p>
              <p className={cn('font-semibold', isOk ? 'text-green-600' : 'text-yellow-600')}>
                {discrepancy >= 0 ? '+' : ''}{formatCOP(discrepancy)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
