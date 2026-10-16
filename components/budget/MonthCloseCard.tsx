'use client'

import { useId, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isNextMonthClosedError, reopenMonth } from '@/lib/monthClose'
import { useConfirm } from '@/hooks/useConfirm'
import { Card } from '@/components/ui/Card'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatPeriodLabel, getPeriodDate, shiftPeriod } from '@/lib/utils'
import type { BudgetPeriod, CloseMonthResult, PeriodSummary } from '@/types/database'
import CloseMonthModal, { type CloseCategory } from './CloseMonthModal'

interface MonthCloseCardProps {
  period: BudgetPeriod
  categories: CloseCategory[]
  summary: PeriodSummary | null
  /** Reload the page data after closing, recalculating or reopening. */
  onChanged: () => void
  onGoToMonth: (periodDate: string) => void
}

/** "Octubre 2026" for plain-text places (dialog titles) where a capitalize span can't go. */
function monthTitle(periodDate: string): string {
  const label = formatPeriodLabel(periodDate)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function Month({ date }: { date: string }) {
  return <span className="capitalize">{formatPeriodLabel(date)}</span>
}

/**
 * Month close at the bottom of Presupuesto: close (or recalculate) the month, which carries
 * leftovers and overspending to the next one, or reopen it. Mount with key={period.id}.
 */
export default function MonthCloseCard({ period, categories, summary, onChanged, onGoToMonth }: MonthCloseCardProps) {
  const hintId = useId()
  const { confirm, confirmDialog } = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [closed, setClosed] = useState<CloseMonthResult | null>(null)
  const [reopening, setReopening] = useState(false)
  const [error, setError] = useState<{ text: ReactNode; goTo?: string } | null>(null)

  const nextDate = shiftPeriod(period.period_date, 1)
  const isClosed = period.closed_at !== null
  const isFuture = period.period_date > getPeriodDate()

  function handleClosed(result: CloseMonthResult) {
    setModalOpen(false)
    setError(null)
    setClosed(result)
    onChanged()
  }

  async function handleReopen() {
    const ok = await confirm({
      title: `¿Reabrir ${monthTitle(period.period_date)}?`,
      description:
        `${monthTitle(nextDate)} pierde lo que recibió de este mes (sobrantes, sobregasto y saldo de apertura). ` +
        'Puedes volver a cerrarlo cuando quieras.',
      confirmLabel: 'Reabrir',
    })
    if (!ok) return
    setReopening(true)
    setError(null)
    const { error: err } = await reopenMonth(createClient(), period.id)
    setReopening(false)
    if (err) {
      setError(
        isNextMonthClosedError(err)
          ? { text: <>Primero reabre <Month date={nextDate} />.</>, goTo: nextDate }
          : { text: 'No se pudo reabrir el mes. Intenta de nuevo.' }
      )
      return
    }
    setClosed(null)
    onChanged()
  }

  return (
    <>
      {closed && (
        <Alert
          tone="success"
          action={
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => onGoToMonth(closed.next_period_date ?? nextDate)}
            >
              Ir a <Month date={closed.next_period_date ?? nextDate} />
            </Button>
          }
        >
          Cerramos <Month date={period.period_date} />. <Month date={closed.next_period_date ?? nextDate} /> ya
          tiene tu presupuesto con los traslados.
        </Alert>
      )}

      {error && (
        <Alert
          tone="danger"
          action={error.goTo ? (
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => onGoToMonth(error.goTo!)}>
              Ir a <Month date={error.goTo} />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setError(null)}>
              Cerrar
            </Button>
          )}
        >
          {error.text}
        </Alert>
      )}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-accent"
            >
              <CalendarCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                Cierre del mes
                {isClosed && <Badge variant="gray">Cerrado</Badge>}
              </h2>
              <p className="mt-0.5 text-sm text-fg-subtle">
                {isClosed ? (
                  <>
                    Cerrado el {format(new Date(period.closed_at as string), "d 'de' MMMM", { locale: es })}. Sus
                    sobrantes ya pasaron a <Month date={nextDate} />.
                  </>
                ) : (
                  <>Pasa los sobrantes a <Month date={nextDate} /> y fija su saldo de apertura.</>
                )}
              </p>
              {!isClosed && isFuture && (
                <p id={hintId} className="mt-1 text-xs text-fg-subtle">
                  Solo puedes cerrar meses que ya empezaron
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {isClosed ? (
              <>
                <Button variant="ghost" className="flex-1 sm:flex-none" loading={reopening} onClick={handleReopen}>
                  Reabrir mes
                </Button>
                <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setModalOpen(true)}>
                  Recalcular cierre
                </Button>
              </>
            ) : (
              <Button
                className="w-full sm:w-auto"
                disabled={isFuture}
                aria-describedby={isFuture ? hintId : undefined}
                onClick={() => setModalOpen(true)}
              >
                Cerrar mes
              </Button>
            )}
          </div>
        </div>
      </Card>

      {modalOpen && (
        <CloseMonthModal
          period={period}
          categories={categories}
          summary={summary}
          recalculate={isClosed}
          onClose={() => setModalOpen(false)}
          onClosed={handleClosed}
        />
      )}
      {confirmDialog}
    </>
  )
}
