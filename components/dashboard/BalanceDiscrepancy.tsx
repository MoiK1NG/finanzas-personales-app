import { Card } from '@/components/ui/Card'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface BalanceDiscrepancyProps {
  theoretical: number
  realBankBalance: number
  realIncomeReceived: number
  realExpensesPaid: number
}

export default function BalanceDiscrepancy({
  theoretical,
  realBankBalance,
  realIncomeReceived,
  realExpensesPaid,
}: BalanceDiscrepancyProps) {
  const cashFlow = realIncomeReceived - realExpensesPaid
  const discrepancy = realBankBalance - cashFlow
  const isOk = Math.abs(discrepancy) < 1000

  return (
    <Card className={cn(
      'border-l-4',
      isOk ? 'border-l-green-500' : 'border-l-yellow-500'
    )}>
      <div className="flex items-start gap-3">
        {isOk
          ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          : <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            {isOk ? 'Saldos cuadrados' : 'Revisar discrepancia'}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">Saldo Teórico</p>
              <p className="font-semibold text-gray-800">{formatCOP(theoretical)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo Real (banco)</p>
              <p className="font-semibold text-gray-800">{formatCOP(realBankBalance)}</p>
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
