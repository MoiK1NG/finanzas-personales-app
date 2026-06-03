'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, formatPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EnvelopeSummary } from '@/types/database'
import { Check, X, Pencil } from 'lucide-react'

interface BudgetTableProps {
  summaries: EnvelopeSummary[]
  projectedIncome: number
  budgetPeriodId: string
  onRefresh: () => void
}

export default function BudgetTable({
  summaries,
  projectedIncome,
  budgetPeriodId,
  onRefresh,
}: BudgetTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(envelopeId: string, currentAmount: number) {
    setEditingId(envelopeId)
    setEditValue(currentAmount.toString())
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function saveEdit(envelopeBudgetId: string) {
    const amount = parseFloat(editValue) || 0
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('envelope_budgets')
      .update({ projected_amount: amount })
      .eq('id', envelopeBudgetId)
    setSaving(false)
    setEditingId(null)
    onRefresh()
  }

  const totalBudgeted = summaries.reduce((a, s) => a + s.projected_amount, 0)
  const totalExecuted = summaries.reduce((a, s) => a + s.executed_amount, 0)
  const unassigned = projectedIncome - totalBudgeted

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Presupuesto del mes
        </h3>
        <span className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded-full',
          unassigned === 0 ? 'bg-green-100 text-green-700'
          : unassigned < 0 ? 'bg-red-100 text-red-700'
          : 'bg-yellow-100 text-yellow-700'
        )}>
          {unassigned === 0 ? '✓ Base Cero' : unassigned > 0 ? `${formatCOP(unassigned)} sin asignar` : `${formatCOP(Math.abs(unassigned))} excedido`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyectado</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ejecutado</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Disponible</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">% Ingreso</th>
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {summaries.map(s => (
              <tr key={s.envelope_id} className="hover:bg-gray-50 transition-colors group">
                {/* Name */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-medium text-gray-800">{s.envelope_name}</span>
                    {s.is_savings && (
                      <span className="text-xs text-indigo-500 font-medium">Ahorro</span>
                    )}
                  </div>
                </td>

                {/* Projected — editable inline */}
                <td className="px-4 py-3 text-right">
                  {editingId === s.envelope_id ? (
                    <div className="flex items-center justify-end gap-1">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-32 text-right pl-5 pr-2 py-1 border border-indigo-400 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                          step="1"
                          min="0"
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(s.envelope_budget_id)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                      </div>
                      <button
                        onClick={() => saveEdit(s.envelope_budget_id)}
                        disabled={saving}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-red-400 hover:bg-red-50 rounded">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-700">
                      {formatCOP(s.projected_amount)}
                    </span>
                  )}
                </td>

                {/* Executed */}
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    'font-medium',
                    s.executed_amount > s.projected_amount ? 'text-red-600' : 'text-gray-700'
                  )}>
                    {formatCOP(s.executed_amount)}
                  </span>
                </td>

                {/* Available */}
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    'font-semibold',
                    s.available_amount < 0 ? 'text-red-600' : 'text-green-600'
                  )}>
                    {formatCOP(s.available_amount)}
                  </span>
                </td>

                {/* % of income */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          s.pct_executed > 100 ? 'bg-red-500'
                          : s.pct_executed >= 80 ? 'bg-yellow-400'
                          : 'bg-green-500'
                        )}
                        style={{ width: `${Math.min(s.pct_executed, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {projectedIncome > 0
                        ? formatPercent((s.projected_amount / projectedIncome) * 100)
                        : '—'}
                    </span>
                  </div>
                </td>

                {/* Edit btn */}
                <td className="px-4 py-3">
                  {editingId !== s.envelope_id && (
                    <button
                      onClick={() => startEdit(s.envelope_id, s.projected_amount)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <td className="px-5 py-3 text-sm text-gray-700">Total</td>
              <td className="px-4 py-3 text-right text-sm text-gray-800">{formatCOP(totalBudgeted)}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-800">{formatCOP(totalExecuted)}</td>
              <td className="px-4 py-3 text-right text-sm">
                <span className={cn(totalBudgeted - totalExecuted < 0 ? 'text-red-600' : 'text-green-600')}>
                  {formatCOP(totalBudgeted - totalExecuted)}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-500">
                {projectedIncome > 0 ? formatPercent((totalBudgeted / projectedIncome) * 100) : '—'}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
