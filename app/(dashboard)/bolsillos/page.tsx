'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPeriodDate, formatCOP, formatPeriodLabel, formatPercent } from '@/lib/utils'
import Header from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import type { Envelope, BudgetPeriod, EnvelopeSummary } from '@/types/database'
import {
  Plus, Pencil, Trash2, Check, X, AlertCircle,
  TrendingUp, TrendingDown, Minus, PiggyBank,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RowState {
  envelopeId: string
  envelopeBudgetId: string
  name: string
  color: string
  isSavings: boolean
  projected: number
  executed: number
  available: number
  pct: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#06b6d4',
]

function statusColor(pct: number, over: boolean) {
  if (over)    return 'text-red-600'
  if (pct >= 80) return 'text-yellow-600'
  return 'text-green-600'
}

function barColor(pct: number, over: boolean) {
  if (over)     return 'bg-red-500'
  if (pct >= 80) return 'bg-yellow-400'
  return 'bg-green-500'
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function BolsillosPage() {
  const [periodDate, setPeriodDate] = useState(getPeriodDate())
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)

  // Inline-edit projected amount
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  // Inline-edit income
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeValue, setIncomeValue] = useState('')

  // New category row
  const [addingRow, setAddingRow] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [newIsSavings, setNewIsSavings] = useState(false)
  const [savingNew, setSavingNew] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
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
    setIncomeValue(per?.projected_income?.toString() ?? '')

    if (per) {
      const { data: sums } = await supabase
        .from('v_envelope_summary')
        .select('*')
        .eq('budget_period_id', per.id)
        .eq('user_id', user.id)

      setRows(
        (sums ?? []).map(s => ({
          envelopeId:       s.envelope_id,
          envelopeBudgetId: s.envelope_budget_id,
          name:             s.envelope_name,
          color:            s.color,
          isSavings:        s.is_savings,
          projected:        s.projected_amount,
          executed:         s.executed_amount,
          available:        s.available_amount,
          pct:              s.pct_executed,
        }))
      )
    } else {
      setRows([])
    }
    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (editingRow && editRef.current) editRef.current.focus() }, [editingRow])

  // ── Save income ────────────────────────────────────────────────────────────
  async function saveIncome() {
    const income = parseFloat(incomeValue.replace(/\./g, ''))
    if (!income || !period) { setEditingIncome(false); return }
    const supabase = createClient()
    await supabase.from('budget_periods').update({ projected_income: income }).eq('id', period.id)
    setEditingIncome(false)
    loadData()
  }

  // ── Save projected amount ──────────────────────────────────────────────────
  async function saveProjected(envelopeBudgetId: string) {
    const amount = parseFloat(editValue) || 0
    const supabase = createClient()
    await supabase.from('envelope_budgets').update({ projected_amount: amount }).eq('id', envelopeBudgetId)
    setEditingRow(null)
    loadData()
  }

  // ── Archive category ───────────────────────────────────────────────────────
  async function archiveEnvelope(envelopeId: string, name: string) {
    if (!confirm(`¿Archivar "${name}"? Los movimientos existentes se conservan.`)) return
    const supabase = createClient()
    await supabase.from('envelopes').update({ is_active: false }).eq('id', envelopeId)
    loadData()
  }

  // ── Add new category inline ────────────────────────────────────────────────
  async function saveNewCategory() {
    if (!newName.trim() || !period) return
    setSavingNew(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: env } = await supabase
      .from('envelopes')
      .insert({ user_id: user!.id, name: newName.trim(), color: newColor, is_savings: newIsSavings })
      .select().single()

    if (env) {
      await supabase.from('envelope_budgets').insert({
        envelope_id: env.id,
        budget_period_id: period.id,
        projected_amount: parseFloat(newAmount) || 0,
      })
    }

    setNewName(''); setNewAmount(''); setNewColor(COLORS[0]); setNewIsSavings(false)
    setAddingRow(false)
    setSavingNew(false)
    loadData()
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const income        = period?.projected_income ?? 0
  const totalBudgeted = rows.reduce((a, r) => a + r.projected, 0)
  const totalExecuted = rows.reduce((a, r) => a + r.executed, 0)
  const unassigned    = income - totalBudgeted
  const overallPct    = income > 0 ? (totalExecuted / income) * 100 : 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Header periodDate={periodDate} onPeriodChange={setPeriodDate} />

      <main className="p-4 sm:p-6 max-w-4xl space-y-4 sm:space-y-6">

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Presupuesto mensual</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{formatPeriodLabel(periodDate)}</p>
        </div>

        {/* ── No period warning ─────────────────────────────────────────────── */}
        {!loading && !period && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              No hay período configurado.{' '}
              <a href="/" className="underline font-medium">Ve al Dashboard</a> para crearlo.
            </p>
          </div>
        )}

        {period && (
          <>
            {/* ── Income card ───────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-5 text-white">
              <p className="text-sm font-medium text-indigo-200 mb-1">Ingreso proyectado del mes</p>

              {editingIncome ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">$</span>
                  <input
                    type="number"
                    value={incomeValue}
                    onChange={e => setIncomeValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveIncome(); if (e.key === 'Escape') setEditingIncome(false) }}
                    className="bg-white/20 border border-white/40 rounded-lg px-3 py-1 text-2xl font-bold w-52 focus:outline-none focus:bg-white/30"
                    autoFocus
                    step="1"
                  />
                  <button onClick={saveIncome} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingIncome(false)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-bold tracking-tight">{formatCOP(income)}</p>
                  <button
                    onClick={() => { setIncomeValue(income.toString()); setEditingIncome(true) }}
                    className="mb-1 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    title="Editar ingreso"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Distribution bar */}
              <div className="mt-4">
                <div className="h-3 bg-white/20 rounded-full overflow-hidden flex gap-px">
                  {rows.map(r => (
                    <div
                      key={r.envelopeId}
                      title={`${r.name}: ${formatCOP(r.projected)}`}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                      style={{
                        width: income > 0 ? `${(r.projected / income) * 100}%` : '0%',
                        backgroundColor: r.color,
                      }}
                    />
                  ))}
                  {unassigned > 0 && (
                    <div
                      className="h-full bg-white/30 flex-1"
                      title={`Sin asignar: ${formatCOP(unassigned)}`}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-indigo-200">
                  <span>
                    {formatCOP(totalBudgeted)} asignado
                    {' · '}{income > 0 ? formatPercent((totalBudgeted / income) * 100) : '0%'}
                  </span>
                  <span className={cn(
                    'font-semibold',
                    unassigned === 0 ? 'text-green-300' : unassigned < 0 ? 'text-red-300' : 'text-yellow-300'
                  )}>
                    {unassigned === 0 ? '✓ Base Cero' : unassigned > 0 ? `${formatCOP(unassigned)} sin asignar` : `${formatCOP(Math.abs(unassigned))} excedido`}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Budget table ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table header — hidden on mobile, shown on sm+ */}
              <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_1fr_1.4fr_auto] gap-0 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                {['Categoría','Presupuestado','% Ingreso','Gastado','Cumplimiento',''].map((h, i) => (
                  <div key={i} className={cn('text-xs font-semibold text-gray-500 uppercase tracking-wide', i > 0 && 'text-right')}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12">
                  <PiggyBank className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Agrega tu primera categoría abajo</p>
                </div>
              ) : (
                rows.map(row => {
                  const isOver  = row.executed > row.projected
                  const isEditing = editingRow === row.envelopeId

                  return (
                    <div key={row.envelopeId} className="border-b border-gray-50 last:border-0">
                      {/* ── Mobile card view ── */}
                      <div className="sm:hidden px-4 py-3 hover:bg-gray-50 group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                            <span className="text-sm font-semibold text-gray-800 truncate">{row.name}</span>
                            {row.isSavings && <span className="text-xs text-indigo-500 font-medium">Ahorro</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs font-bold', statusColor(row.pct, isOver))}>
                              {formatPercent(row.pct)}
                            </span>
                            <button onClick={() => archiveEnvelope(row.envelopeId, row.name)}
                              className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Presupuestado</span>
                            <button onClick={() => { setEditingRow(row.envelopeId); setEditValue(row.projected.toString()) }}
                              className="font-semibold text-gray-700 hover:text-indigo-600">
                              {isEditing ? (
                                <input ref={editRef} type="number" inputMode="numeric" value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => saveProjected(row.envelopeBudgetId)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveProjected(row.envelopeBudgetId) }}
                                  className="w-24 text-right border border-indigo-400 rounded px-1 py-0.5 focus:outline-none"
                                  step="1" min="0" />
                              ) : formatCOP(row.projected)}
                            </button>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Gastado</span>
                            <span className={cn('font-semibold', isOver ? 'text-red-600' : 'text-gray-700')}>
                              {formatCOP(row.executed)}
                            </span>
                          </div>
                          <div className="flex justify-between col-span-2">
                            <span className="text-gray-400">Disponible</span>
                            <span className={cn('font-semibold', row.available < 0 ? 'text-red-600' : 'text-green-600')}>
                              {formatCOP(row.available)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', barColor(row.pct, isOver))}
                            style={{ width: `${Math.min(row.pct, 100)}%` }} />
                        </div>
                      </div>

                      {/* ── Desktop table row ── */}
                      <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_1fr_1.4fr_auto] gap-0 px-4 py-3 hover:bg-gray-50 transition-colors group items-center">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="text-sm font-medium text-gray-800 truncate">{row.name}</span>
                          {row.isSavings && <span className="text-xs text-indigo-500 font-medium flex-shrink-0">Ahorro</span>}
                        </div>
                        <div className="text-right">
                          {isEditing ? (
                            <input ref={editRef} type="number" value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveProjected(row.envelopeBudgetId); if (e.key === 'Escape') setEditingRow(null) }}
                              onBlur={() => saveProjected(row.envelopeBudgetId)}
                              className="w-28 text-right px-2 py-1 border border-indigo-400 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              step="1" min="0" />
                          ) : (
                            <button onClick={() => { setEditingRow(row.envelopeId); setEditValue(row.projected.toString()) }}
                              className="text-sm font-semibold text-gray-700 hover:text-indigo-600 hover:underline">
                              {formatCOP(row.projected)}
                            </button>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {income > 0 && row.projected > 0 ? formatPercent((row.projected / income) * 100) : '—'}
                        </div>
                        <div className={cn('text-right text-sm font-semibold', isOver ? 'text-red-600' : 'text-gray-700')}>
                          {formatCOP(row.executed)}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                            <div className={cn('h-full rounded-full transition-all duration-500', barColor(row.pct, isOver))}
                              style={{ width: `${Math.min(row.pct, 100)}%` }} />
                          </div>
                          <span className={cn('text-xs font-bold w-10 text-right flex-shrink-0', statusColor(row.pct, isOver))}>
                            {formatPercent(row.pct)}
                          </span>
                          {isOver ? <TrendingUp className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                            : row.pct >= 80 ? <Minus className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                            : <TrendingDown className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                        </div>
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => archiveEnvelope(row.envelopeId, row.name)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* ── Add new category row ──────────────────────────────────── */}
              {addingRow ? (
                <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.4fr_auto] gap-0 px-4 py-3 border-b border-indigo-100 bg-indigo-50/50 items-center">
                  {/* Name + color */}
                  <div className="flex items-center gap-2">
                    {/* Color dot picker */}
                    <div className="relative group/color">
                      <button type="button" className="h-5 w-5 rounded-full flex-shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: newColor }} />
                      <div className="absolute left-0 top-7 bg-white border border-gray-200 rounded-lg p-2 shadow-lg z-10 hidden group-hover/color:flex flex-wrap gap-1.5 w-36">
                        {COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setNewColor(c)}
                            className={cn('h-5 w-5 rounded-full', newColor === c && 'ring-2 ring-offset-1 ring-gray-400')}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Nombre de la categoría"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNewCategory(); if (e.key === 'Escape') setAddingRow(false) }}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                      autoFocus
                    />
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-end">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={newAmount}
                        onChange={e => setNewAmount(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNewCategory() }}
                        className="w-28 text-right pl-5 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        step="1"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* % preview */}
                  <div className="text-right text-xs text-gray-400">
                    {income > 0 && newAmount
                      ? formatPercent((parseFloat(newAmount) / income) * 100)
                      : '—'}
                  </div>

                  {/* Savings toggle */}
                  <div className="flex items-center justify-end gap-1">
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={newIsSavings} onChange={e => setNewIsSavings(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                      />
                      Ahorro
                    </label>
                  </div>

                  {/* Empty compliance cell */}
                  <div />

                  {/* Confirm / cancel */}
                  <div className="flex gap-1">
                    <button onClick={saveNewCategory} disabled={savingNew || !newName.trim()}
                      className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setAddingRow(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingRow(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border-b border-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  Agregar categoría
                </button>
              )}

              {/* ── Totals footer ─────────────────────────────────────────── */}
              {rows.length > 0 && (
                <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_1fr_1.4fr_auto] gap-0 px-4 py-3 bg-gray-50 font-semibold text-sm border-t border-gray-200">
                  <div className="text-gray-600">Total</div>
                  <div className="text-right text-gray-800">{formatCOP(totalBudgeted)}</div>
                  <div className="text-right text-gray-500">
                    {income > 0 ? formatPercent((totalBudgeted / income) * 100) : '—'}
                  </div>
                  <div className={cn('text-right', totalExecuted > totalBudgeted ? 'text-red-600' : 'text-gray-800')}>
                    {formatCOP(totalExecuted)}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor(overallPct, totalExecuted > totalBudgeted))}
                        style={{ width: `${Math.min(overallPct, 100)}%` }}
                      />
                    </div>
                    <span className={cn('text-xs font-bold w-10 text-right', statusColor(overallPct, totalExecuted > totalBudgeted))}>
                      {formatPercent(overallPct)}
                    </span>
                  </div>
                  <div />
                </div>
              )}
            </div>

            {/* ── Quick legend ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Bajo control (&lt;80% gastado)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
                Atención (80–100% gastado)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Excedido (&gt;100%)
              </span>
              <span className="ml-auto text-gray-400">
                Haz clic en el monto presupuestado para editarlo
              </span>
            </div>
          </>
        )}
      </main>
    </>
  )
}
