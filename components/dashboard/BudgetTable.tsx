'use client'

import { useRef, useState, type FocusEvent } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import BudgetStatusPill from '@/components/ui/BudgetStatusPill'
import IconButton from '@/components/ui/IconButton'
import Money from '@/components/ui/Money'
import MoneyInput from '@/components/ui/MoneyInput'
import ProgressBar from '@/components/ui/ProgressBar'
import {
  cn, focusRing, formatCOP, formatMoneyInput, formatPercent, getSpendTone, parseMoneyInput,
} from '@/lib/utils'
import type { EnvelopeSummary } from '@/types/database'

const TONE_TEXT = { ok: 'text-income', warning: 'text-warning', over: 'text-expense' } as const

const COLUMNS = ['Presupuestado', 'Gastado', 'Disponible', '% gastado', '% del ingreso']

const thClass = 'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle'

interface BudgetTableProps {
  summaries: EnvelopeSummary[]
  projectedIncome: number
  /** projected income − total budgeted − overspending carried from last month (v_period_summary). */
  unassigned: number
  budgetPeriodId: string
  onRefresh: () => void
}

export default function BudgetTable({
  summaries,
  projectedIncome,
  unassigned,
  onRefresh,
}: BudgetTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // True whenever a save must not run: while saving, and once the editor is closed, so a second
  // trigger (Enter then blur, or the blur fired when the field unmounts) never writes twice.
  const lockedRef = useRef(true)

  function startEdit(envelopeId: string, currentAmount: number) {
    lockedRef.current = false
    setEditingId(envelopeId)
    setEditValue(formatMoneyInput(currentAmount))
    setSaveError(null)
  }

  function cancelEdit() {
    lockedRef.current = true
    setEditingId(null)
    setEditValue('')
    setSaveError(null)
  }

  async function saveEdit(s: EnvelopeSummary) {
    if (lockedRef.current) return
    // An empty or unchanged field closes the editor without writing (it no longer turns into $0).
    if (editValue === '' || parseMoneyInput(editValue) === s.projected_amount) {
      cancelEdit()
      return
    }
    const amount = parseMoneyInput(editValue)
    lockedRef.current = true
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('envelope_budgets')
      .update({ projected_amount: amount })
      .eq('id', s.envelope_budget_id)
    setSaving(false)
    if (error) {
      lockedRef.current = false
      setSaveError(`No se pudo guardar el monto de ${s.envelope_name}. Intenta de nuevo.`)
      return
    }
    // Tapping another amount blurs (and saves) this one first; keep that new editor open.
    setEditingId(current => (current === s.envelope_id ? null : current))
    onRefresh()
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>, s: EnvelopeSummary) {
    // Moving focus to "Cancelar edición" must not save first.
    if (e.relatedTarget instanceof HTMLElement && e.relatedTarget.dataset.inlineCancel !== undefined) return
    saveEdit(s)
  }

  const totalBudgeted = summaries.reduce((a, s) => a + s.projected_amount, 0)
  const totalCarryover = summaries.reduce((a, s) => a + s.carryover_amount, 0)
  const totalExecuted = summaries.reduce((a, s) => a + s.executed_amount, 0)
  const totalAvailable = summaries.reduce((a, s) => a + s.available_amount, 0)

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm text-fg-muted">
          Ingreso proyectado{' '}
          <Money value={projectedIncome} className="font-semibold text-fg" />
        </p>
        <BudgetStatusPill unassigned={unassigned} />
      </div>

      {saveError && (
        <div className="px-4 pt-3">
          <Alert tone="danger">{saveError}</Alert>
        </div>
      )}

      {/* relative: contains the sr-only texts in the cells, which otherwise escape the scroller and widen the page */}
      <div className="relative overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <caption className="sr-only">Presupuesto por categoría</caption>
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th scope="col" className={cn(thClass, 'sticky left-0 z-10 bg-surface-2 px-4 text-left')}>
                Categoría
              </th>
              {COLUMNS.map(col => (
                <th key={col} scope="col" className={cn(thClass, 'text-right')}>{col}</th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {summaries.map(s => {
              // Against what can be spent: budgeted + carry-over from last month.
              const isOver = s.executed_amount > s.spendable_amount
              const spentWithoutBudget = s.spendable_amount <= 0 && s.executed_amount > 0
              const tone = getSpendTone(s.pct_executed, isOver)
              const isEditing = editingId === s.envelope_id

              return (
                <tr key={s.envelope_id} className="group transition-colors hover:bg-surface-2">
                  {/* Name */}
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal transition-colors group-hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `color-mix(in oklch, ${s.color} 85%, var(--fg))` }}
                      />
                      <span className="max-w-40 truncate font-medium text-fg">{s.envelope_name}</span>
                      {s.is_savings && <Badge variant="indigo">Ahorro</Badge>}
                    </div>
                  </th>

                  {/* Presupuestado — editable inline */}
                  <td className="px-3 py-2.5 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-36">
                          <MoneyInput
                            value={editValue}
                            onValueChange={setEditValue}
                            aria-label={`Presupuestado de ${s.envelope_name}`}
                            className="text-right"
                            readOnly={saving}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEdit(s) }
                              if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                            }}
                            onBlur={e => handleBlur(e, s)}
                          />
                        </div>
                        <IconButton
                          tone="primary"
                          label="Guardar monto"
                          disabled={saving}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => saveEdit(s)}
                        >
                          <Check className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Cancelar edición"
                          data-inline-cancel=""
                          onMouseDown={e => e.preventDefault()}
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </IconButton>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(s.envelope_id, s.projected_amount)}
                        aria-label={`Editar presupuestado de ${s.envelope_name}: ${formatCOP(s.projected_amount)}`}
                        className={cn(
                          '-my-2 -mr-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-fg transition-colors hover:bg-muted',
                          focusRing
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
                        <Money
                          value={s.projected_amount}
                          className="underline decoration-border-strong decoration-dashed underline-offset-4"
                        />
                      </button>
                    )}
                    {s.carryover_amount > 0 && (
                      <p className="mt-1 text-xs text-income tabular-nums">
                        +<Money value={s.carryover_amount} /> traslado
                      </p>
                    )}
                  </td>

                  {/* Gastado */}
                  <td className="px-3 py-2.5 text-right">
                    <Money value={s.executed_amount} className={cn('font-medium', isOver ? 'text-expense' : 'text-fg')} />
                  </td>

                  {/* Disponible */}
                  <td className="px-3 py-2.5 text-right text-fg">
                    <Money value={s.available_amount} variant="balance" className="font-semibold" />
                  </td>

                  {/* % gastado: bar and number measure the same thing */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <ProgressBar
                        value={spentWithoutBudget ? 100 : s.pct_executed}
                        tone={tone}
                        size="sm"
                        className="w-12"
                      />
                      <span className={cn('w-10 text-right text-xs font-medium tabular-nums', TONE_TEXT[tone])}>
                        {spentWithoutBudget ? (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Sin presupuesto</span>
                          </>
                        ) : (
                          formatPercent(s.pct_executed)
                        )}
                      </span>
                    </div>
                  </td>

                  {/* % del ingreso */}
                  <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">
                    {projectedIncome > 0
                      ? formatPercent((s.projected_amount / projectedIncome) * 100)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-2 font-semibold text-fg">
              <th scope="row" className="sticky left-0 z-10 bg-surface-2 px-4 py-3 text-left">Total</th>
              <td className="px-3 py-3 text-right">
                <Money value={totalBudgeted} />
                {totalCarryover > 0 && (
                  <p className="text-xs font-normal text-income tabular-nums">
                    +<Money value={totalCarryover} /> traslado
                  </p>
                )}
              </td>
              <td className="px-3 py-3 text-right"><Money value={totalExecuted} /></td>
              <td className="px-3 py-3 text-right">
                <Money value={totalAvailable} variant="balance" />
              </td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3 text-right font-normal text-fg-muted tabular-nums">
                {projectedIncome > 0 ? formatPercent((totalBudgeted / projectedIncome) * 100) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
