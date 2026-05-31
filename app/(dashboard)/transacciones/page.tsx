'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPeriodDate, formatCOP, formatDate, formatPeriodLabel } from '@/lib/utils'
import Header from '@/components/layout/Header'
import QuickAddForm from '@/components/transactions/QuickAddForm'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Envelope, BudgetPeriod, Transaction } from '@/types/database'
import { ArrowUpRight, ArrowDownLeft, Repeat, Trash2, ArrowLeftRight } from 'lucide-react'

type TxWithEnvelope = Transaction & { envelope?: Envelope | null }

export default function TransaccionesPage() {
  const [periodDate, setPeriodDate] = useState(getPeriodDate())
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [transactions, setTransactions] = useState<TxWithEnvelope[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: per } = await supabase
      .from('budget_periods')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_date', periodDate)
      .single()
    setPeriod(per)

    const { data: envs } = await supabase
      .from('envelopes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')
    setEnvelopes(envs ?? [])

    if (per) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*, envelope:envelopes(*)')
        .eq('budget_period_id', per.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
      setTransactions(txs ?? [])
    }

    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    const supabase = createClient()
    await supabase.from('transactions').delete().eq('id', id)
    loadData()
  }

  const filtered = transactions.filter(tx =>
    filterType === 'all' || tx.type === filterType
  )

  const totalIncome = transactions.filter(t => t.type === 'income' && t.is_executed).reduce((a, t) => a + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.is_executed).reduce((a, t) => a + t.amount, 0)

  return (
    <>
      <Header periodDate={periodDate} onPeriodChange={setPeriodDate} />

      <main className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Movimientos</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{formatPeriodLabel(periodDate)}</p>
          </div>
          {period && (
            <QuickAddForm envelopes={envelopes} budgetPeriod={period} onSuccess={loadData} />
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card padding="sm" className="text-center">
            <p className="text-xs text-gray-500 mb-1">Ingresos</p>
            <p className="text-lg font-bold text-green-600">{formatCOP(totalIncome)}</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xs text-gray-500 mb-1">Gastos</p>
            <p className="text-lg font-bold text-red-600">{formatCOP(totalExpense)}</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xs text-gray-500 mb-1">Balance</p>
            <p className={cn('text-lg font-bold', (totalIncome - totalExpense) >= 0 ? 'text-gray-900' : 'text-red-600')}>
              {formatCOP(totalIncome - totalExpense)}
            </p>
          </Card>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filterType === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
            </button>
          ))}
        </div>

        {/* Transactions list */}
        <Card padding="none">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <ArrowLeftRight className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Sin movimientos en este período</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
                      tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    )}>
                      {tx.type === 'income'
                        ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                        : <ArrowDownLeft className="h-4 w-4 text-red-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                        {tx.is_recurring && (
                          <Repeat className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        )}
                        {!tx.is_executed && (
                          <Badge variant="yellow">proyectado</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tx.envelope?.name ?? 'Sin bolsillo'} · {formatDate(tx.transaction_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className={cn(
                      'text-sm font-semibold',
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {tx.type === 'income' ? '+' : '-'}{formatCOP(tx.amount)}
                    </span>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </>
  )
}
