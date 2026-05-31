import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCOP, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft, Link } from 'lucide-react'
import type { Transaction, Envelope } from '@/types/database'
import NextLink from 'next/link'

interface RecentTransactionsProps {
  transactions: (Transaction & { envelope?: Envelope | null })[]
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
        <NextLink href="/transacciones" className="text-xs text-indigo-600 hover:underline">
          Ver todos
        </NextLink>
      </CardHeader>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin movimientos este mes</p>
      ) : (
        <div className="space-y-1">
          {transactions.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                    tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  )}
                >
                  {tx.type === 'income'
                    ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                    : <ArrowDownLeft className="h-4 w-4 text-red-600" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                  <p className="text-xs text-gray-400">
                    {tx.envelope?.name ?? 'Sin bolsillo'} · {formatDate(tx.transaction_date)}
                    {!tx.is_executed && (
                      <span className="ml-1.5 text-yellow-600 font-medium">proyectado</span>
                    )}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'text-sm font-semibold flex-shrink-0 ml-4',
                  tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {tx.type === 'income' ? '+' : '-'}{formatCOP(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
