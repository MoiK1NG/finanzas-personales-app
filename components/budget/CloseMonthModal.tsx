'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { closeMonth, isNextMonthClosedError } from '@/lib/monthClose'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import Money from '@/components/ui/Money'
import { formatPeriodLabel, getPeriodDate, shiftPeriod } from '@/lib/utils'
import type { BudgetPeriod, CloseMonthResult, PeriodSummary } from '@/types/database'

/** A category line as the month close sees it. */
export interface CloseCategory {
  id: string
  name: string
  color: string
  /** Budgeted + carry-over − executed expenses: > 0 rolls over, < 0 is overspending. */
  available: number
  /** Projected (not confirmed) expenses of the category. */
  pending: number
}

interface CloseMonthModalProps {
  period: BudgetPeriod
  categories: CloseCategory[]
  summary: PeriodSummary | null
  /** The month is already closed: running it again recalculates. */
  recalculate: boolean
  onClose: () => void
  onClosed: (result: CloseMonthResult) => void
}

function Month({ date }: { date: string }) {
  return <span className="capitalize">{formatPeriodLabel(date)}</span>
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{children}</h3>
}

function CategoryLine({ category, children }: { category: CloseCategory; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
        <span className="truncate text-fg">{category.name}</span>
      </span>
      <span className="shrink-0 font-semibold">{children}</span>
    </li>
  )
}

/** Summary of what closing the month does, and the action that does it. */
export default function CloseMonthModal({
  period, categories, summary, recalculate, onClose, onClosed,
}: CloseMonthModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ReactNode>(null)

  const nextDate = shiftPeriod(period.period_date, 1)
  const leftovers = categories.filter(c => c.available > 0)
  const overspent = categories.filter(c => c.available < 0)
  const carriedTotal = leftovers.reduce((a, c) => a + c.available, 0)
  const overspentTotal = overspent.reduce((a, c) => a - c.available, 0)

  // Projected movements are not part of the close: available only counts executed expenses.
  const pendingExpenses = summary?.pending_expenses ?? categories.reduce((a, c) => a + c.pending, 0)
  const pendingIncome = summary?.pending_income ?? 0
  const isCurrentMonth = period.period_date === getPeriodDate()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const { data, error: err } = await closeMonth(createClient(), period.id)
    setSubmitting(false)
    if (err || !data) {
      setError(
        isNextMonthClosedError(err) ? (
          <>
            <Month date={nextDate} /> ya está cerrado. Primero reabre <Month date={nextDate} /> y vuelve a intentarlo.
          </>
        ) : (
          'No se pudo cerrar el mes. Intenta de nuevo.'
        )
      )
      return
    }
    onClosed(data)
  }

  return (
    <Modal
      title={recalculate ? 'Recalcular cierre' : 'Cerrar mes'}
      description={<Month date={period.period_date} />}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} className="flex-1 sm:flex-none">
            {recalculate ? 'Recalcular' : 'Cerrar mes'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {summary && (
          <dl className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-fg-muted">Ingresos recibidos</dt>
              <dd className="font-semibold"><Money value={summary.real_income_received} variant="income" /></dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-fg-muted">Gastos ejecutados</dt>
              <dd className="font-semibold"><Money value={summary.real_expenses_paid} variant="expense" /></dd>
            </div>
          </dl>
        )}

        <section className="space-y-1">
          <SectionTitle>
            Pasan a <Month date={nextDate} />
          </SectionTitle>
          {leftovers.length === 0 ? (
            <p className="text-fg-subtle">Ninguna categoría tiene sobrante.</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {leftovers.map(c => (
                  <CategoryLine key={c.id} category={c}>
                    <Money value={c.available} variant="income" />
                  </CategoryLine>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2 font-semibold">
                <span className="text-fg-muted">Total</span>
                <Money value={carriedTotal} variant="income" />
              </div>
            </>
          )}
        </section>

        {overspent.length > 0 && (
          <section className="space-y-1">
            <SectionTitle>Sobregasto</SectionTitle>
            <ul className="divide-y divide-border">
              {overspent.map(c => (
                <CategoryLine key={c.id} category={c}>
                  <Money value={c.available} variant="expense" />
                </CategoryLine>
              ))}
            </ul>
            <p className="border-t border-border pt-2 text-fg-muted">
              <Money value={overspentTotal} variant="expense" className="font-semibold" /> se descuenta de lo
              disponible para asignar en <Month date={nextDate} />.
            </p>
          </section>
        )}

        {(pendingExpenses > 0 || pendingIncome > 0) && (
          <Alert tone="info">
            Tienes{' '}
            {pendingExpenses > 0 && <><Money value={pendingExpenses} /> en gastos</>}
            {pendingExpenses > 0 && pendingIncome > 0 && ' y '}
            {pendingIncome > 0 && <><Money value={pendingIncome} /> en ingresos</>}
            {' '}proyectados sin confirmar; no cuentan en el cierre.
          </Alert>
        )}

        {isCurrentMonth && (
          <Alert tone="warning">
            Este mes todavía no termina. Lo que gastes después del cierre no cambia lo que pasa a{' '}
            <Month date={nextDate} />; puedes recalcular el cierre cuando termine.
          </Alert>
        )}

        <p className="flex gap-2 text-xs text-fg-subtle">
          <Info className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
          <span>
            También fijamos el saldo de apertura de <Month date={nextDate} />. Se fija con el saldo de tus cuentas, sin
            contar movimientos de meses siguientes.
          </span>
        </p>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
