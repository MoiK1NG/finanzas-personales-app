'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCOP, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft, Pencil } from 'lucide-react'
import type { Transaction, Envelope } from '@/types/database'
import NextLink from 'next/link'
import EditTransactionModal from '@/components/transactions/EditTransactionModal'

interface RecentTransactionsProps {
  transactions: (Transaction & { envelope?: Envelope | null })[]
  envelopes: Envelope[]
  onRefresh: () => void
}

export default function RecentTransactions({ transactions, envelopes, onRefresh }: RecentTransactionsProps) {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  return (
    <>
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
          <div className="space-y-0.5">
            {transactions.map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
                    tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  )}>
                    {tx.type === 'income'
                      ? <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                      : <ArrowDownLeft className="h-3.5 w-3.5 text-red-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{tx.description}</p>
                    <p className="text-[10px] text-gray-400">
                      {tx.envelope?.name ?? 'Sin categoría'} · {formatDate(tx.transaction_date)}
                      {!tx.is_executed && (
                        <span className="ml-1 text-yellow-600 font-medium">proyectado</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <span className={cn(
                    'text-xs font-semibold',
                    tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                  )}>
                    {tx.type === 'income' ? '+' : '-'}{formatCOP(tx.amount)}
                  </span>
                  <button
                    onClick={() => setEditingTx(tx)}
                    className="p-1 text-gray-300 hover:text-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          envelopes={envelopes}
          onSuccess={() => { setEditingTx(null); onRefresh() }}
          onClose={() => setEditingTx(null)}
        />
      )}
    </>
  )
}
