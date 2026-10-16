'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  cn, focusRing, formatCOP, formatPercent, formatPeriodLabel, getPeriodDate, shiftPeriod,
  formatMoneyInput, parseMoneyInput, getSpendTone, type SpendTone,
} from '@/lib/utils'
import { usePeriod } from '@/hooks/usePeriod'
import { useConfirm } from '@/hooks/useConfirm'
import Header from '@/components/layout/Header'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Input from '@/components/ui/Input'
import MoneyInput from '@/components/ui/MoneyInput'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/Spinner'
import ProgressBar from '@/components/ui/ProgressBar'
import BudgetStatusPill from '@/components/ui/BudgetStatusPill'
import Money from '@/components/ui/Money'
import ClosedMonthAlert from '@/components/budget/ClosedMonthAlert'
import MonthCloseCard from '@/components/budget/MonthCloseCard'
import ColorSwatches, { CATEGORY_COLORS } from '@/components/envelopes/ColorSwatches'
import EditCategoryModal, { type EditableCategory } from '@/components/envelopes/EditCategoryModal'
import type { BudgetPeriod, EnvelopeSummary, PeriodSummary } from '@/types/database'
import {
  Plus, Trash2, Check, X, Pencil, PiggyBank, Copy, ArrowUpDown, ChevronUp, ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RowState {
  envelopeId: string
  envelopeBudgetId: string
  name: string
  color: string
  isSavings: boolean
  sortOrder: number
  projected: number
  /** Leftover received from the closed previous month. */
  carryover: number
  /** projected + carryover: what can be spent this month. */
  spendable: number
  executed: number
  /** Projected (not confirmed) expenses. */
  pending: number
  /** spendable − executed (from v_envelope_summary). */
  available: number
  /** executed ÷ spendable, in % (from v_envelope_summary). */
  pct: number
}

interface PrevPeriod {
  id: string
  closedAt: string | null
}

interface CopyResult {
  /** Month the result belongs to, so it disappears when you move to another month. */
  period: string
  tone: 'success' | 'info' | 'danger'
  text: string
  /** Closed with "Entendido": the month already has last month's categories, so stop offering the copy. */
  dismissed?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Seeds a money field from a stored amount; 0 shows as an empty field. */
function toInput(amount: number): string {
  return amount ? formatMoneyInput(amount) : ''
}

const COLORS = CATEGORY_COLORS

/** First palette color no category of this month uses yet. */
function nextColor(rows: RowState[]): string {
  const used = new Set(rows.map(r => r.color.toLowerCase()))
  return (COLORS.find(c => !used.has(c.value)) ?? COLORS[rows.length % COLORS.length]).value
}

function toRow(s: EnvelopeSummary): RowState {
  return {
    envelopeId:       s.envelope_id,
    envelopeBudgetId: s.envelope_budget_id,
    name:             s.envelope_name,
    color:            s.color,
    isSavings:        s.is_savings,
    sortOrder:        Number(s.sort_order ?? 0),
    projected:        Number(s.projected_amount),
    carryover:        Number(s.carryover_amount ?? 0),
    spendable:        Number(s.spendable_amount),
    executed:         Number(s.executed_amount),
    pending:          Number(s.planned_pending_amount ?? 0),
    available:        Number(s.available_amount),
    pct:              Number(s.pct_executed),
  }
}

/** The view does not order its rows: categories go by their saved order, then by name. */
function sortRows(rows: RowState[]): RowState[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
}

/** "+$ 150.000 traslado" under a Presupuestado figure, when the previous month sent a leftover. */
function CarryoverNote({ amount, className }: { amount: number; className?: string }) {
  if (amount <= 0) return null
  return (
    <p className={cn('text-xs text-income tabular-nums whitespace-nowrap', className)}>
      +<Money value={amount} /> traslado
    </p>
  )
}

const TONE_TEXT: Record<SpendTone, string> = {
  ok: 'text-income',
  warning: 'text-warning',
  over: 'text-expense',
}

/** Spend status of a budget line, against what can be spent (budgeted + carry-over). With nothing to spend but money spent, a % means nothing. */
function spendOf(spendable: number, executed: number, pct: number) {
  const isOver = executed > spendable
  const unbudgeted = spendable <= 0 && executed > 0
  return {
    isOver,
    tone: getSpendTone(pct, isOver),
    barValue: unbudgeted ? 100 : pct,
    pctLabel: unbudgeted ? null : formatPercent(pct),
  }
}

/** Translucent controls on the indigo hero card. */
const HERO_ICON_BUTTON = 'bg-white/15 text-white hover:bg-white/25 hover:text-white focus-visible:outline-white'

// ─── Main page ───────────────────────────────────────────────────────────────
export default function BolsillosPage() {
  const [periodDate, setPeriodDate] = usePeriod()
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null)
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const { confirm, confirmDialog } = useConfirm()

  // Inline-edit projected amount
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  // Mirrors editingRow synchronously, so the blur fired when the input unmounts
  // (after Enter or Escape) neither saves twice nor saves a cancelled edit.
  const editingRowRef = useRef<string | null>(null)

  // Inline-edit income
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeValue, setIncomeValue] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)

  // New category
  const [addingRow, setAddingRow] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0].value)
  const [newIsSavings, setNewIsSavings] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit a category (name, color, savings)
  const [editingCategory, setEditingCategory] = useState<EditableCategory | null>(null)

  // Order mode: up/down buttons, saved with "Listo"
  const [ordering, setOrdering] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  // Copy from previous month
  const [copyingPrev, setCopyingPrev] = useState(false)
  const [prevPeriod, setPrevPeriod] = useState<PrevPeriod | null>(null)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────
  // Month on screen. usePeriod restores the saved month right after the first render, and a save
  // that finishes after you change month refreshes with its old closure, so loads can overlap.
  // Only the latest load of the selected month may set state: otherwise `period` could belong to
  // another month than the header shows, and the next save would write to that other month.
  const selectedPeriodRef = useRef(periodDate)
  const loadSeqRef = useRef(0)
  useEffect(() => { selectedPeriodRef.current = periodDate }, [periodDate])
  // In order mode the list on screen holds unsaved moves; a refresh must not put the old order back.
  const orderingRef = useRef(false)
  useEffect(() => { orderingRef.current = ordering }, [ordering])

  // background: refresh after a change without replacing the content with the spinner.
  const loadData = useCallback(async (background = false) => {
    if (periodDate !== selectedPeriodRef.current) return
    const seq = ++loadSeqRef.current
    const isStale = () => seq !== loadSeqRef.current || periodDate !== selectedPeriodRef.current
    if (!background) setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (isStale()) return
    if (!user) { setLoading(false); return }

    // Current period, and the previous one (copy offer, and whether it is still open)
    const [{ data: per }, { data: prevPer }] = await Promise.all([
      supabase
        .from('budget_periods')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_date', periodDate)
        .maybeSingle(),
      supabase
        .from('budget_periods')
        .select('id, closed_at')
        .eq('user_id', user.id)
        .eq('period_date', shiftPeriod(periodDate, -1))
        .maybeSingle(),
    ])
    if (isStale()) return

    let nextRows: RowState[] = []
    let summary: PeriodSummary | null = null
    if (per) {
      const [{ data: sums }, { data: perSum }] = await Promise.all([
        supabase
          .from('v_envelope_summary')
          .select('*')
          .eq('budget_period_id', per.id)
          .eq('user_id', user.id),
        supabase
          .from('v_period_summary')
          .select('*')
          .eq('budget_period_id', per.id)
          .eq('user_id', user.id)
          .maybeSingle(),
      ])
      if (isStale()) return
      nextRows = sortRows((sums ?? []).map(toRow))
      summary = perSum
    }

    // The income field is seeded when you open it (startEditIncome), so a refresh that lands while
    // you are typing a new income doesn't overwrite it.
    setPeriod(per)
    setPrevPeriod(prevPer ? { id: prevPer.id, closedAt: prevPer.closed_at } : null)
    setRows(prev => (orderingRef.current ? prev : nextRows))
    setPeriodSummary(summary)
    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])

  // Month navigation: close any open editor so it doesn't carry over to the new month.
  function changePeriod(next: string) {
    editingRowRef.current = null
    setEditingRow(null)
    setEditingIncome(false)
    setAddingRow(false)
    setEditingCategory(null)
    setOrdering(false)
    setPageError(null)
    setPeriodDate(next)
  }

  // ── Copy budget from previous month ────────────────────────────────────────
  async function copyFromPreviousMonth() {
    if (!period || copyingPrev) return
    setCopyingPrev(true)
    const forPeriod = periodDate
    const finish = (tone: CopyResult['tone'], text: string) => {
      setCopyingPrev(false)
      setCopyResult({ period: forPeriod, tone, text })
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Find previous period
    const { data: prevPer } = await supabase
      .from('budget_periods')
      .select('id, projected_income')
      .eq('user_id', user!.id)
      .eq('period_date', shiftPeriod(periodDate, -1))
      .maybeSingle()

    if (!prevPer) { finish('info', 'No encontramos el presupuesto del mes anterior.'); return }

    // Get previous envelope_budgets
    const { data: prevBudgets } = await supabase
      .from('envelope_budgets')
      .select('envelope_id, projected_amount')
      .eq('budget_period_id', prevPer.id)

    if (!prevBudgets?.length) { finish('info', 'El mes anterior no tiene categorías con presupuesto.'); return }

    // Upsert into current period (skip envelopes already budgeted)
    const existingIds = rows.map(r => r.envelopeId)
    const toInsert = prevBudgets
      .filter(b => !existingIds.includes(b.envelope_id))
      .map(b => ({
        envelope_id: b.envelope_id,
        budget_period_id: period.id,
        projected_amount: b.projected_amount,
      }))

    if (toInsert.length) {
      const { error } = await supabase.from('envelope_budgets').insert(toInsert)
      if (error) {
        finish('danger', 'No se pudo copiar el presupuesto del mes anterior. Intenta de nuevo.')
      } else {
        const n = toInsert.length
        finish('success', `Copiamos ${n} ${n === 1 ? 'categoría' : 'categorías'} del mes anterior.`)
      }
    } else {
      finish('info', 'Ya tienes todas las categorías del mes anterior en este mes, así que no se copió nada.')
    }

    loadData(true)
  }

  // ── Save income ────────────────────────────────────────────────────────────
  function startEditIncome() {
    setIncomeValue(toInput(income))
    setEditingIncome(true)
  }

  async function saveIncome() {
    if (savingIncome) return
    const amount = parseMoneyInput(incomeValue)
    if (!amount || !period) { setEditingIncome(false); return }
    setSavingIncome(true)
    setPageError(null)
    const supabase = createClient()
    const { error } = await supabase.from('budget_periods').update({ projected_income: amount }).eq('id', period.id)
    setSavingIncome(false)
    if (error) {
      // Keep the editor open so the typed amount isn't lost.
      setPageError('No se pudo guardar el ingreso proyectado. Intenta de nuevo.')
      return
    }
    // Show the new amount right away; the refresh below brings the stored value.
    setPeriod(p => (p ? { ...p, projected_income: amount } : p))
    setEditingIncome(false)
    loadData(true)
  }

  // ── Save projected amount ──────────────────────────────────────────────────
  function startEditRow(row: RowState) {
    // Another row still open (a tap doesn't always blur the field on iOS): save it before switching.
    const open = editingRowRef.current
    if (open && open !== row.envelopeId) {
      const openRow = rows.find(r => r.envelopeId === open)
      if (openRow) saveProjected(openRow)
    }
    editingRowRef.current = row.envelopeId
    setEditingRow(row.envelopeId)
    setEditValue(toInput(row.projected))
  }

  function cancelEditRow() {
    editingRowRef.current = null
    setEditingRow(null)
  }

  async function saveProjected(row: RowState) {
    if (editingRowRef.current !== row.envelopeId) return
    editingRowRef.current = null
    const amount = parseMoneyInput(editValue)
    // Close only this row's editor: another row may already be open.
    setEditingRow(cur => (cur === row.envelopeId ? null : cur))
    // Show the new figures right away (same formulas as v_envelope_summary); the refresh replaces them.
    setRows(prev => prev.map(r => {
      if (r.envelopeId !== row.envelopeId) return r
      const spendable = amount + r.carryover
      return {
        ...r,
        projected: amount,
        spendable,
        available: spendable - r.executed,
        pct: spendable > 0 ? (r.executed / spendable) * 100 : 0,
      }
    }))
    setPageError(null)
    const supabase = createClient()
    const { error } = await supabase.from('envelope_budgets').update({ projected_amount: amount }).eq('id', row.envelopeBudgetId)
    if (error) setPageError(`No se pudo guardar el monto de «${row.name}». Intenta de nuevo.`)
    loadData(true)
  }

  // ── Delete category ────────────────────────────────────────────────────────
  async function deleteEnvelope(envelopeId: string, name: string) {
    const ok = await confirm({
      title: `¿Eliminar la categoría «${name}»?`,
      description:
        'Se borra para siempre y desaparece del presupuesto de todos los meses, también de los anteriores. ' +
        'Sus movimientos y metas vinculadas se conservan, pero quedan sin categoría.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setPageError(null)
    const supabase = createClient()
    const { error } = await supabase.from('envelopes').delete().eq('id', envelopeId)
    if (error) {
      setPageError(`No se pudo eliminar «${name}». Intenta de nuevo.`)
      return
    }
    setRows(prev => prev.filter(r => r.envelopeId !== envelopeId))
    loadData(true)
  }

  // ── Edit category ──────────────────────────────────────────────────────────
  function openEditCategory(row: RowState) {
    setEditingCategory({ id: row.envelopeId, name: row.name, color: row.color, isSavings: row.isSavings })
  }

  function handleCategorySaved(saved: EditableCategory) {
    setEditingCategory(null)
    setRows(prev => sortRows(prev.map(r => (
      r.envelopeId === saved.id ? { ...r, name: saved.name, color: saved.color, isSavings: saved.isSavings } : r
    ))))
    loadData(true)
  }

  // ── Order mode ─────────────────────────────────────────────────────────────
  function startOrdering() {
    // An amount still open (a tap doesn't always blur the field on iOS): save it first.
    const open = editingRowRef.current
    const openRow = open ? rows.find(r => r.envelopeId === open) : undefined
    if (openRow) saveProjected(openRow)
    setPageError(null)
    setOrdering(true)
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function finishOrdering() {
    if (savingOrder) return
    setSavingOrder(true)
    setPageError(null)
    const supabase = createClient()
    const results = await Promise.all(
      rows.map((r, i) => supabase.from('envelopes').update({ sort_order: i }).eq('id', r.envelopeId))
    )
    setSavingOrder(false)
    if (results.some(r => r.error)) {
      // Stay in order mode so "Listo" can be tapped again.
      setPageError('No se pudo guardar el orden de las categorías. Intenta de nuevo.')
      return
    }
    setRows(prev => prev.map((r, i) => ({ ...r, sortOrder: i })))
    setOrdering(false)
    loadData(true)
  }

  // ── Add new category inline ────────────────────────────────────────────────
  function openAddRow() {
    setNewColor(nextColor(rows))
    setAddError(null)
    setAddingRow(true)
  }

  function cancelAddRow() {
    setAddingRow(false)
    setAddError(null)
  }

  async function saveNewCategory() {
    if (savingNew || !newName.trim() || !period) return
    setSavingNew(true)
    setAddError(null)
    const name = newName.trim()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAddError('No se pudo crear la categoría. Intenta de nuevo.')
      setSavingNew(false)
      return
    }

    const { data: env, error: envError } = await supabase
      .from('envelopes')
      .insert({
        user_id: user.id,
        name,
        color: newColor,
        is_savings: newIsSavings,
        // New categories go to the end of the saved order.
        sort_order: rows.length ? Math.max(...rows.map(r => r.sortOrder)) + 1 : 0,
      })
      .select().single()

    if (envError || !env) {
      // Keep what the user typed so they can retry.
      setAddError('No se pudo crear la categoría. Intenta de nuevo.')
      setSavingNew(false)
      return
    }

    const { error: budgetError } = await supabase.from('envelope_budgets').insert({
      envelope_id: env.id,
      budget_period_id: period.id,
      projected_amount: parseMoneyInput(newAmount),
    })

    setNewName(''); setNewAmount(''); setNewIsSavings(false)
    setAddingRow(false)
    setSavingNew(false)
    if (budgetError) {
      setPageError(`La categoría «${name}» se creó, pero no se pudo agregar al presupuesto de este mes.`)
    }
    loadData(true)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const income          = period?.projected_income ?? 0
  const totalBudgeted   = rows.reduce((a, r) => a + r.projected, 0)
  const totalCarryover  = rows.reduce((a, r) => a + r.carryover, 0)
  const totalSpendable  = rows.reduce((a, r) => a + r.spendable, 0)
  const totalExecuted   = rows.reduce((a, r) => a + r.executed, 0)
  const totalAvailable  = rows.reduce((a, r) => a + r.available, 0)
  // Overspending of the closed previous month comes out of this month's income.
  const overspentCarry  = period?.overspent_carryover ?? 0
  const unassigned      = income - totalBudgeted - overspentCarry
  // Same denominator as each row's "% gastado": spent ÷ (budgeted + carry-over).
  const totalPct        = totalSpendable > 0 ? (totalExecuted / totalSpendable) * 100 : 0
  const totalSpend      = spendOf(totalSpendable, totalExecuted, totalPct)
  const budgetedShare   = income > 0 ? formatPercent((totalBudgeted / income) * 100) : '0%'
  const copyStatus      = copyResult?.period === periodDate ? copyResult : null
  const prevDate        = shiftPeriod(periodDate, -1)
  // A closed previous month already copied its budget (with the leftovers) into this one.
  const copyAvailable   = prevPeriod !== null && !prevPeriod.closedAt && !period?.closed_at
  // A past month that is still open: offer to go there and close it.
  const prevOpenAndPast = prevPeriod !== null && !prevPeriod.closedAt && prevDate < getPeriodDate()
  // Copying is still worth offering until a copy of this month went through (or found nothing to add).
  const canOfferCopy    = copyAvailable && (!copyStatus || copyStatus.tone === 'danger')

  /** "% del ingreso" of a budgeted amount, or null when it doesn't apply. */
  function incomeShare(amount: number): string | null {
    return income > 0 && amount > 0 ? formatPercent((amount / income) * 100) : null
  }

  /** Presupuestado figure: a button with an edit affordance, or the field while editing. */
  function renderProjected(row: RowState, layout: 'card' | 'table') {
    // Order mode: amounts are not editable.
    if (ordering) {
      return (
        <span className={cn('inline-flex items-center font-semibold text-fg', layout === 'card' ? 'min-h-10 text-sm' : 'min-h-9')}>
          <Money value={row.projected} />
        </span>
      )
    }
    if (editingRow === row.envelopeId) {
      return (
        <MoneyInput
          value={editValue}
          onValueChange={setEditValue}
          aria-label={`Presupuestado de ${row.name}`}
          autoFocus
          enterKeyHint="done"
          onFocus={e => e.currentTarget.select()}
          onBlur={() => saveProjected(row)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveProjected(row) }
            if (e.key === 'Escape') cancelEditRow()
          }}
          className={layout === 'table' ? 'h-9 sm:h-9 text-right' : 'h-10'}
        />
      )
    }
    const pencil = (
      <Pencil
        className="h-3.5 w-3.5 shrink-0 text-fg-subtle transition-colors group-hover/edit:text-accent"
        aria-hidden="true"
      />
    )
    return (
      <button
        type="button"
        onClick={() => startEditRow(row)}
        aria-label={`Editar presupuestado de ${row.name}: ${formatCOP(row.projected)}`}
        className={cn(
          'group/edit inline-flex items-center gap-1.5 rounded-md font-semibold text-fg transition-colors hover:text-accent',
          focusRing,
          layout === 'card' ? 'min-h-10 text-sm' : 'min-h-9'
        )}
      >
        {/* In the table the pencil goes first, so the digits stay right-aligned with the totals. */}
        {layout === 'table' && pencil}
        <Money value={row.projected} />
        {layout === 'card' && pencil}
      </button>
    )
  }

  /** Edit + delete, or up/down in order mode. Edges use aria-disabled so keyboard focus stays on the button. */
  function renderRowActions(row: RowState, index: number) {
    if (ordering) {
      const first = index === 0
      const last = index === rows.length - 1
      const edgeClass = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
      return (
        <>
          <IconButton
            size="sm"
            label={`Subir ${row.name}`}
            aria-disabled={first || undefined}
            onClick={() => { if (!first) moveRow(index, -1) }}
            className={edgeClass}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            size="sm"
            label={`Bajar ${row.name}`}
            aria-disabled={last || undefined}
            onClick={() => { if (!last) moveRow(index, 1) }}
            className={edgeClass}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </>
      )
    }
    return (
      <>
        <IconButton size="sm" tone="primary" label={`Editar ${row.name}`} onClick={() => openEditCategory(row)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          tone="danger"
          label={`Eliminar ${row.name}`}
          onClick={() => deleteEnvelope(row.envelopeId, row.name)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Header periodDate={periodDate} onPeriodChange={changePeriod} />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
        <PageHeader title="Presupuesto" subtitle="Reparte tu ingreso del mes entre tus categorías" />

        {pageError && (
          <Alert
            tone="danger"
            action={<Button variant="ghost" size="sm" onClick={() => setPageError(null)}>Cerrar</Button>}
          >
            {pageError}
          </Alert>
        )}

        {loading ? (
          <LoadingState label="Cargando presupuesto" />
        ) : !period ? (
          /* ── No period warning ─────────────────────────────────────────── */
          <Alert
            tone="warning"
            title="Este mes todavía no tiene presupuesto"
            action={
              <Link
                href="/"
                className={cn(
                  'inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg shadow-sm transition-colors hover:bg-primary-hover sm:w-auto',
                  focusRing
                )}
              >
                Configurar en Inicio
              </Link>
            }
          >
            Configura el ingreso proyectado del mes en Inicio y vuelve aquí para repartirlo entre tus categorías.
          </Alert>
        ) : (
          <>
            {period.closed_at && <ClosedMonthAlert periodDate={periodDate} />}

            {/* ── Income card ───────────────────────────────────────────────── */}
            <section
              aria-label="Ingreso del mes"
              className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 text-white shadow-sm sm:p-6 dark:from-indigo-700 dark:to-indigo-900"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white/80">Ingreso proyectado</p>
                {period.closed_at && <Badge variant="gray">Cerrado</Badge>}
              </div>

              {editingIncome ? (
                <form
                  onSubmit={e => { e.preventDefault(); saveIncome() }}
                  noValidate
                  className="mt-2 flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1 sm:max-w-72">
                    <MoneyInput
                      size="lg"
                      value={incomeValue}
                      onValueChange={setIncomeValue}
                      aria-label="Ingreso proyectado"
                      autoFocus
                      enterKeyHint="done"
                      onKeyDown={e => { if (e.key === 'Escape') setEditingIncome(false) }}
                    />
                  </div>
                  <IconButton type="submit" label="Guardar ingreso" disabled={savingIncome} className={HERO_ICON_BUTTON}>
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </IconButton>
                  <IconButton label="Cancelar" onClick={() => setEditingIncome(false)} className={HERO_ICON_BUTTON}>
                    <X className="h-5 w-5" aria-hidden="true" />
                  </IconButton>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={startEditIncome}
                  aria-label={`Editar ingreso proyectado: ${formatCOP(income)}`}
                  className={cn(
                    'group -ml-1 mt-1 inline-flex max-w-full items-center gap-3 rounded-lg px-1 text-left',
                    focusRing,
                    'focus-visible:outline-white'
                  )}
                >
                  <span className="text-3xl font-bold tracking-tight tabular-nums whitespace-nowrap sm:text-4xl">
                    {formatCOP(income)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 transition-colors group-hover:bg-white/25"
                  >
                    <Pencil className="h-4 w-4" />
                  </span>
                </button>
              )}

              {/* Distribution bar */}
              <div className="mt-5">
                <div
                  role="img"
                  aria-label={`Distribución del ingreso: ${budgetedShare} presupuestado`}
                  className="flex h-3 gap-px overflow-hidden rounded-full bg-white/20"
                >
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
                      className="h-full flex-1 bg-white/30"
                      title={`Sin asignar: ${formatCOP(unassigned)}`}
                    />
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="text-xs text-white/80 tabular-nums">
                    {formatCOP(totalBudgeted)} presupuestado · {budgetedShare} del ingreso
                  </p>
                  <BudgetStatusPill unassigned={unassigned} appearance="hero" />
                </div>
                {(totalCarryover > 0 || overspentCarry > 0) && (
                  <p className="mt-2 text-xs text-white/80">
                    {totalCarryover > 0 && (
                      <>
                        Traslado recibido{' '}
                        <span className="font-semibold whitespace-nowrap text-white">+<Money value={totalCarryover} /></span>
                      </>
                    )}
                    {totalCarryover > 0 && overspentCarry > 0 && ' · '}
                    {overspentCarry > 0 && (
                      <>
                        Sobregasto del mes anterior{' '}
                        <span className="font-semibold whitespace-nowrap text-white">−<Money value={overspentCarry} /></span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </section>

            {/* ── Copy from previous month ──────────────────────────────────── */}
            {copyAvailable && !copyStatus?.dismissed && (copyStatus ? (
              <Alert
                tone={copyStatus.tone}
                action={
                  copyStatus.tone === 'danger' ? (
                    <Button variant="secondary" size="sm" loading={copyingPrev} onClick={copyFromPreviousMonth} className="w-full sm:w-auto">
                      Reintentar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCopyResult(r => (r ? { ...r, dismissed: true } : r))}
                      className="w-full sm:w-auto"
                    >
                      Entendido
                    </Button>
                  )
                }
              >
                {copyStatus.text}
              </Alert>
            ) : (
              <Alert
                tone="info"
                icon={Copy}
                title={rows.length === 0 ? '¿Repetir el presupuesto del mes anterior?' : '¿Te faltan categorías del mes anterior?'}
                action={
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {prevOpenAndPast && (
                      <Button variant="ghost" size="sm" onClick={() => changePeriod(prevDate)} className="w-full sm:w-auto">
                        Ir a <span className="capitalize">{formatPeriodLabel(prevDate)}</span>
                      </Button>
                    )}
                    <Button variant="soft" size="sm" loading={copyingPrev} onClick={copyFromPreviousMonth} className="w-full sm:w-auto">
                      {copyingPrev ? 'Copiando…' : 'Copiar presupuesto'}
                    </Button>
                  </div>
                }
              >
                {rows.length === 0
                  ? 'Copia las categorías y montos del mes anterior. Los movimientos empiezan en cero.'
                  : 'Agrega las categorías del mes anterior que no tengas en este mes, con su monto. Las que ya tienes no cambian.'}
                {prevOpenAndPast && (
                  <>
                    {' '}<span className="capitalize">{formatPeriodLabel(prevDate)}</span> sigue abierto: ciérralo para que
                    sus sobrantes pasen a este mes.
                  </>
                )}
              </Alert>
            ))}

            {/* ── Categories ────────────────────────────────────────────────── */}
            <Card padding="none" className="overflow-hidden">
              <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2">
                <h2 className="text-sm font-semibold text-fg">Categorías</h2>
                {!addingRow && rows.length > 0 && (
                  <div className="flex items-center gap-1">
                    {rows.length > 1 && (ordering ? (
                      <Button size="sm" loading={savingOrder} onClick={finishOrdering}>
                        {!savingOrder && <Check className="h-4 w-4" aria-hidden="true" />}
                        Listo
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={startOrdering}>
                        <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                        Ordenar
                      </Button>
                    ))}
                    {!ordering && (
                      <Button variant="soft" size="sm" onClick={openAddRow}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar<span className="max-sm:sr-only"> categoría</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {ordering && (
                <p className="border-b border-border bg-surface-2 px-4 py-2 text-xs text-fg-subtle">
                  Usa las flechas para cambiar el orden y toca «Listo» para guardarlo.
                </p>
              )}

              {/* ── Add new category ────────────────────────────────────── */}
              {addingRow && (
                <form
                  aria-label="Nueva categoría"
                  noValidate
                  onSubmit={e => { e.preventDefault(); saveNewCategory() }}
                  onKeyDown={e => { if (e.key === 'Escape') cancelAddRow() }}
                  className="space-y-4 border-b border-border bg-surface-2 px-4 py-4"
                >
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
                    <Input
                      label="Nombre"
                      placeholder="Ej. Mercado"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      autoComplete="off"
                      autoFocus
                    />
                    <MoneyInput
                      label="Presupuestado"
                      value={newAmount}
                      onValueChange={setNewAmount}
                      enterKeyHint="done"
                      hint={newAmount && incomeShare(parseMoneyInput(newAmount))
                        ? `${incomeShare(parseMoneyInput(newAmount))} del ingreso`
                        : undefined}
                    />
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <ColorSwatches value={newColor} onChange={setNewColor} surface="surface-2" />

                    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg-muted">
                      <input
                        type="checkbox"
                        checked={newIsSavings}
                        onChange={e => setNewIsSavings(e.target.checked)}
                        className="h-4 w-4 rounded border-border-strong accent-[var(--primary)]"
                      />
                      Categoría de ahorro
                    </label>
                  </div>

                  {addError && <Alert tone="danger">{addError}</Alert>}

                  <div className="flex gap-2 sm:justify-end">
                    <Button variant="secondary" className="flex-1 sm:flex-none" onClick={cancelAddRow}>
                      Cancelar
                    </Button>
                    <Button type="submit" loading={savingNew} disabled={!newName.trim()} className="flex-1 sm:flex-none">
                      Agregar
                    </Button>
                  </div>
                </form>
              )}

              {rows.length === 0 ? (
                !addingRow && (
                  <EmptyState
                    icon={PiggyBank}
                    title="Aún no hay categorías en este mes"
                    description={canOfferCopy
                      ? 'Agrega una categoría o copia las del mes anterior.'
                      : 'Agrega una categoría y asígnale parte de tu ingreso.'}
                    action={
                      <Button onClick={openAddRow}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar categoría
                      </Button>
                    }
                  />
                )
              ) : (
                <>
                  {/* ── Phones: one card per category ── */}
                  <ul className="divide-y divide-border md:hidden">
                    {rows.map((row, index) => {
                      const spend = spendOf(row.spendable, row.executed, row.pct)
                      const share = incomeShare(row.projected)
                      return (
                        <li key={row.envelopeId} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{row.name}</p>
                            {row.isSavings && <Badge variant="indigo">Ahorro</Badge>}
                            <div className="-mr-2 flex shrink-0 items-center">
                              {renderRowActions(row, index)}
                            </div>
                          </div>

                          <div className="mt-1 grid grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-fg-subtle">Presupuestado</p>
                              {renderProjected(row, 'card')}
                              <CarryoverNote amount={row.carryover} />
                              {share && <p className="text-xs text-fg-subtle tabular-nums">{share} del ingreso</p>}
                            </div>
                            <div className="min-w-0 text-right">
                              <p className="text-xs text-fg-subtle">Disponible</p>
                              <p className="flex min-h-10 items-center justify-end text-base font-semibold text-fg">
                                <Money value={row.available} variant="balance" />
                              </p>
                            </div>
                          </div>

                          <ProgressBar className="mt-2" size="sm" value={spend.barValue} tone={spend.tone} />
                          <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                            <p className="text-fg-subtle">
                              Gastado{' '}
                              <Money value={row.executed} className={cn('font-semibold', spend.isOver ? 'text-expense' : 'text-fg-muted')} />
                            </p>
                            <p className={cn('font-semibold tabular-nums', TONE_TEXT[spend.tone])}>
                              {spend.pctLabel ? `${spend.pctLabel} gastado` : 'Sin presupuesto'}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {/* ── Phones: totals ── */}
                  <div className="border-t border-border bg-surface-2 px-4 py-3 md:hidden">
                    <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Total del mes</p>
                    <dl className="mt-2 space-y-1.5 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-fg-muted">Presupuestado</dt>
                        <dd className="text-right font-semibold text-fg">
                          <Money value={totalBudgeted} />
                          <CarryoverNote amount={totalCarryover} className="font-normal" />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-fg-muted">Gastado</dt>
                        <dd className={cn('font-semibold', totalSpend.isOver ? 'text-expense' : 'text-fg')}>
                          <Money value={totalExecuted} />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-fg-muted">Disponible</dt>
                        <dd className="font-semibold text-fg"><Money value={totalAvailable} variant="balance" /></dd>
                      </div>
                    </dl>
                    <ProgressBar className="mt-3" size="sm" value={totalSpend.barValue} tone={totalSpend.tone} />
                    <p className={cn('mt-1.5 text-right text-xs font-semibold tabular-nums', TONE_TEXT[totalSpend.tone])}>
                      {totalSpend.pctLabel ? `${totalSpend.pctLabel} gastado` : 'Sin presupuesto'}
                    </p>
                  </div>

                  {/* ── Tablet and desktop: table ── */}
                  <table className="hidden w-full text-sm md:table">
                    <thead className="bg-surface-2">
                      <tr className="border-b border-border text-xs text-fg-subtle whitespace-nowrap">
                        <th scope="col" className="w-full py-2.5 pl-4 pr-3 text-left font-medium">Categoría</th>
                        <th scope="col" className="w-36 px-3 py-2.5 text-right font-medium">Presupuestado</th>
                        <th scope="col" className="hidden px-3 py-2.5 text-right font-medium xl:table-cell">% del ingreso</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Gastado</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Disponible</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">% gastado</th>
                        <th scope="col" className="py-2.5 pl-1 pr-3"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row, index) => {
                        const spend = spendOf(row.spendable, row.executed, row.pct)
                        const share = incomeShare(row.projected)
                        return (
                          <tr key={row.envelopeId} className="group transition-colors hover:bg-surface-2">
                            <td className="max-w-0 py-2.5 pl-4 pr-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
                                <span className="truncate font-medium text-fg">{row.name}</span>
                                {row.isSavings && <Badge variant="indigo" className="shrink-0">Ahorro</Badge>}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {renderProjected(row, 'table')}
                              <CarryoverNote amount={row.carryover} />
                              {share && <p className="text-xs text-fg-subtle tabular-nums xl:hidden">{share} del ingreso</p>}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right text-fg-muted tabular-nums xl:table-cell">
                              {share ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Money value={row.executed} className={cn('font-semibold', spend.isOver ? 'text-expense' : 'text-fg')} />
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-fg">
                              <Money value={row.available} variant="balance" />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <ProgressBar value={spend.barValue} tone={spend.tone} className="w-14 shrink-0" />
                                <span className={cn('w-10 text-right text-xs font-semibold tabular-nums', TONE_TEXT[spend.tone])}>
                                  {spend.pctLabel ?? '—'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 pl-1 pr-3 text-right">
                              <div
                                className={cn(
                                  'flex items-center justify-end gap-0.5',
                                  // Edit/delete show on hover with a mouse; the order arrows are always visible.
                                  !ordering && 'transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100'
                                )}
                              >
                                {renderRowActions(row, index)}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t border-border bg-surface-2 font-semibold">
                      <tr>
                        <th scope="row" className="py-3 pl-4 pr-3 text-left font-semibold text-fg-muted">Total</th>
                        <td className="px-3 py-3 text-right text-fg">
                          <Money value={totalBudgeted} />
                          <CarryoverNote amount={totalCarryover} className="font-normal" />
                          {incomeShare(totalBudgeted) && (
                            <p className="text-xs font-normal text-fg-subtle tabular-nums xl:hidden">
                              {incomeShare(totalBudgeted)} del ingreso
                            </p>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 text-right text-fg-muted tabular-nums xl:table-cell">
                          {incomeShare(totalBudgeted) ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Money value={totalExecuted} className={totalSpend.isOver ? 'text-expense' : 'text-fg'} />
                        </td>
                        <td className="px-3 py-3 text-right text-fg">
                          <Money value={totalAvailable} variant="balance" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <ProgressBar value={totalSpend.barValue} tone={totalSpend.tone} className="w-14 shrink-0" />
                            <span className={cn('w-10 text-right text-xs font-semibold tabular-nums', TONE_TEXT[totalSpend.tone])}>
                              {totalSpend.pctLabel ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </Card>

            {/* ── Legend ────────────────────────────────────────────────────── */}
            {rows.length > 0 && (
              <ul aria-label="Colores de % gastado" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-subtle">
                <li className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-income-solid" aria-hidden="true" />
                  Bajo control (menos de 80% gastado)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-warning-solid" aria-hidden="true" />
                  Atención (80–100% gastado)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-expense-solid" aria-hidden="true" />
                  Sobre el presupuesto (más de 100% gastado)
                </li>
              </ul>
            )}

            {/* ── Month close ──────────────────────────────────────────────── */}
            <MonthCloseCard
              key={period.id}
              period={period}
              categories={rows.map(r => ({
                id: r.envelopeId,
                name: r.name,
                color: r.color,
                available: r.available,
                pending: r.pending,
              }))}
              summary={periodSummary}
              onChanged={() => loadData(true)}
              onGoToMonth={changePeriod}
            />
          </>
        )}
      </main>

      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={handleCategorySaved}
        />
      )}
      {confirmDialog}
    </>
  )
}
