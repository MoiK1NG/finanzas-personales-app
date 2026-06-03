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
import { ArrowUpRight, ArrowDownLeft, Repeat, Trash2, ArrowLeftRight, Plus } from 'lucide-react'

type TxWithEnvelope = Transaction & { envelope?: Envelope | null }

export default function TransaccionesPage() {
  const [periodDate, setPeriodDate] = useState(getPeriodDate())
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [transactions, setTransactions] = useState<TxWithEnvelope[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showQuickAdd, setShowQuickAdd] = useState(false)

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

  const totalIncome  = transactions.filter(t => t.type === 'income'  && t.is_executed).reduce((a, t) => a + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.is_executed).reduce((a, t) => a + t.amount, 0)

  return (
    <>
      <Header periodDate={periodDate} onPeriodChange={setPeriodDate} />

      <main className="p-4 sm:p-6 max-w-5xl space-y-4">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Movimientos</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 capitalize">{formatPeriodLabel(periodDate)}</p>
          </div>
          {/* Desktop: inline form button */}
          {period && (
            <div className="hidden sm:block">
              <QuickAddForm envelopes={envelopes} budgetPeriod={period} onSuccess={loadData} />
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: 'Ingresos',   val: totalIncome,              cls: 'text-green-600' },
            { label: 'Gastos',     val: totalExpense,             cls: 'text-red-600'   },
            { label: 'Balance',    val: totalIncome - totalExpense,
              cls: (totalIncome - totalExpense) >= 0 ? 'text-gray-900' : 'text-red-600' },
          ].map(({ label, val, cls }) => (
            <Card key={label} padding="sm" className="text-center">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">{label}</p>
              <p className={cn('text-sm sm:text-lg font-bold', cls)}>{formatCOP(val)}</p>
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={cn(
                'px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
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
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <ArrowLeftRight className="h-9 w-9 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Sin movimientos en este período</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                      tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    )}>
                      {tx.type === 'income'
                        ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                        : <ArrowDownLeft className="h-4 w-4 text-red-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                        {tx.is_recurring && <Repeat className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                        {!tx.is_executed && <Badge variant="yellow">proyectado</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {tx.envelope?.name ?? 'Sin categoría'} · {formatDate(tx.transaction_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
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

      {/* Mobile FAB */}
      {period && (
        <button
          onClick={() => setShowQuickAdd(true)}
          className="fixed bottom-20 right-4 sm:hidden h-14 w-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors z-40"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Mobile quick-add sheet */}
      {showQuickAdd && period && (
        <div className="sm:hidden">
          <QuickAddForm
            envelopes={envelopes}
            budgetPeriod={period}
            onSuccess={() => { setShowQuickAdd(false); loadData() }}
          />
        </div>
      )}
    </>
  )
}
