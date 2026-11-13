'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, Inbox, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import { cn, focusRing, formatMoneyInput, formatPeriodLabel, getPeriodRange } from '@/lib/utils'
import { guessAccountId, isLikelyMovement, isLikelySameMovement, parseCapture, type ParsedCapture } from '@/lib/captures'
import type { BankAccount, CapturedNotification } from '@/types/database'
import type { TransactionFormValues } from '@/components/transactions/TransactionFormFields'

interface CaptureInboxProps {
  captures: CapturedNotification[]
  bankAccounts: BankAccount[]
  /** Month on screen ('YYYY-MM-01'): a registered capture is filed under it. */
  periodDate: string
  /** Capture being dismissed or registered right now ('many' while dismissing a whole group). */
  busyId?: string | null
  locked?: boolean
  /** Opens the movement form prefilled with what could be read from the notification. */
  onRegister: (capture: CapturedNotification, initial: Partial<TransactionFormValues>) => void
  onDismiss: (capture: CapturedNotification) => void
  /** Dismisses the whole "Otras notificaciones" group. */
  onDismissMany?: (captures: CapturedNotification[]) => void
}

function localDate(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd')
}

/**
 * "Por clasificar": notifications forwarded by the phone. Nothing here is a movement yet: the user
 * registers each one (choosing category and account) or dismisses it. What looks like a payment is
 * listed first; promotions and other notices from the same apps wait folded underneath, never deleted.
 */
export default function CaptureInbox({
  captures, bankAccounts, periodDate, busyId, locked, onRegister, onDismiss, onDismissMany,
}: CaptureInboxProps) {
  if (captures.length === 0) return null

  const { start, end } = getPeriodRange(periodDate)
  const parsed = new Map<string, ParsedCapture>(captures.map(c => [c.id, parseCapture(c)]))
  const movements = captures.filter(c => isLikelyMovement(c))
  const others = captures.filter(c => !isLikelyMovement(c))
  const busyMany = busyId === 'many'

  function renderCapture(capture: CapturedNotification) {
    const info = parsed.get(capture.id) as ParsedCapture
    const date = localDate(capture.received_at)
    const outsideMonth = date < start || date > end
    const accountId = guessAccountId(capture.source_app, bankAccounts)
    const destinationId = guessAccountId(info.destinationBank, bankAccounts)
    const repeated = movements.some(other =>
      other.id !== capture.id &&
      isLikelySameMovement(
        { amount: info.amount, receivedAt: capture.received_at },
        { amount: (parsed.get(other.id) as ParsedCapture).amount, receivedAt: other.received_at }
      )
    )
    const ownTransfer = info.direction === 'out' && destinationId !== null && destinationId !== accountId
    const busy = busyId === capture.id || busyMany

    const initial: Partial<TransactionFormValues> = {
      type: info.direction === 'in' ? 'income' : 'expense',
      amount: info.amount !== null ? formatMoneyInput(info.amount) : '',
      description: info.suggestedDescription,
      bank_account_id: accountId ?? '',
      to_bank_account_id: ownTransfer ? destinationId : '',
      // The movement is filed under the month on screen, so the date stays inside it.
      transaction_date: date < start ? start : date > end ? end : date,
    }

    return (
      <li key={capture.id} className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-fg-subtle">
              <span className="font-medium text-fg-muted">{capture.source_app}</span>
              {' · '}
              {format(new Date(capture.received_at), "d 'de' MMM, h:mm a", { locale: es })}
            </p>
            {capture.title && <p className="mt-0.5 text-sm font-semibold text-fg break-words">{capture.title}</p>}
            {capture.body && <p className="mt-0.5 line-clamp-3 text-sm text-fg-muted break-words">{capture.body}</p>}
          </div>
          <div className="shrink-0 text-right">
            {info.amount !== null ? (
              <Money
                value={info.amount}
                variant={info.direction === 'in' ? 'income' : info.direction === 'out' ? 'expense' : 'plain'}
                className="text-sm font-semibold"
              />
            ) : (
              <span className="text-xs text-fg-subtle">Sin monto</span>
            )}
          </div>
        </div>

        {(repeated || ownTransfer || outsideMonth || info.amount === null) && (
          <ul className="mt-2 space-y-0.5 text-xs text-fg-subtle">
            {info.amount === null && <li>La notificación no trae el monto: escríbelo al registrar.</li>}
            {repeated && <li>Hay otra captura por el mismo monto casi a la misma hora: puede ser el mismo pago.</li>}
            {ownTransfer && <li>Si fue entre tus cuentas, regístralo como Transferencia.</li>}
            {outsideMonth && (
              <li>
                Es de otro mes: al registrarlo aquí quedará en {formatPeriodLabel(periodDate)}.
              </li>
            )}
          </ul>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <Button size="sm" variant="soft" disabled={locked || busy} onClick={() => onRegister(capture, initial)}>
            Registrar
          </Button>
          <Button size="sm" variant="ghost" loading={busyId === capture.id} disabled={locked || busyMany} onClick={() => onDismiss(capture)}>
            {busyId !== capture.id && <X className="h-4 w-4" aria-hidden="true" />}
            Descartar
          </Button>
        </div>
      </li>
    )
  }

  return (
    <Card padding="none" role="region" aria-label="Pagos por clasificar">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-accent">
          <Inbox className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            Por clasificar
            {movements.length > 0 && <Badge variant="indigo">{movements.length}</Badge>}
          </h2>
          <p className="text-xs text-fg-subtle">
            Pagos detectados en las notificaciones de tu teléfono. Nada se registra hasta que tú lo decidas.
          </p>
        </div>
      </div>

      {movements.length > 0 ? (
        <ul className="divide-y divide-border">{movements.map(renderCapture)}</ul>
      ) : (
        <p className="px-4 py-3 text-sm text-fg-muted">No hay pagos nuevos.</p>
      )}

      {others.length > 0 && (
        <details className="group border-t border-border">
          <summary
            className={cn(
              'flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden',
              focusRing
            )}
          >
            <span>
              Otras notificaciones ({others.length})
              <span className="block text-xs text-fg-subtle">Promociones y avisos que no parecen un pago.</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          {onDismissMany && (
            <div className="px-4 pb-2">
              <Button size="sm" variant="ghost" loading={busyMany} disabled={locked} onClick={() => onDismissMany(others)}>
                {!busyMany && <X className="h-4 w-4" aria-hidden="true" />}
                Descartar todas
              </Button>
            </div>
          )}
          <ul className="divide-y divide-border border-t border-border">{others.map(renderCapture)}</ul>
        </details>
      )}
    </Card>
  )
}
