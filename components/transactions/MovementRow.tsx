'use client'

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarX2, Check, Pencil, Repeat, Trash2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Money from '@/components/ui/Money'
import Spinner from '@/components/ui/Spinner'
import { cn, entryRow, focusRing, formatDate, transferLabel } from '@/lib/utils'
import type { MovementEntry } from '@/types/database'
import { DEFAULT_TRANSFER_DESCRIPTION } from './TransactionFormFields'

interface MovementRowProps {
  entry: MovementEntry
  /** Account id → name, for the meta line and the transfer title. */
  accountNames: Map<string, string>
  onEdit: () => void
  onDelete?: () => void
  /** Shown only while the movement is projected. */
  onConfirm?: () => void
  busy?: 'deleting' | 'confirming' | null
  /** Another change is running or the list is reloading: the row's actions wait. */
  locked?: boolean
  /** full — Movimientos list; compact — Inicio card (no delete). */
  variant?: 'full' | 'compact'
}

/** Description of an entry, as used in labels and confirmations. */
export function entryDescription(entry: MovementEntry, accountNames: Map<string, string>): string {
  if (entry.kind === 'transaction') return entry.tx.description
  const row = entryRow(entry)
  if (row.description && row.description !== DEFAULT_TRANSFER_DESCRIPTION) return row.description
  return transferTitle(entry, accountNames)
}

function transferTitle(entry: Extract<MovementEntry, { kind: 'transfer' }>, accountNames: Map<string, string>) {
  const name = (id: string | null | undefined) => (id ? accountNames.get(id) : undefined)
  return transferLabel(name(entry.out?.bank_account_id), name(entry.in?.bank_account_id))
}

/**
 * One line of a movement list, shared by Movimientos and Inicio. A transfer (both rows)
 * shows as a single line "Nequi → Davivienda". The row opens the edit form; confirm and
 * delete are separate controls next to it.
 */
export default function MovementRow({
  entry, accountNames, onEdit, onDelete, onConfirm, busy = null, locked = false, variant = 'full',
}: MovementRowProps) {
  const row = entryRow(entry)
  const transfer = entry.kind === 'transfer'
  const pending = !row.is_executed
  const description = entryDescription(entry, accountNames)
  const compact = variant === 'compact'
  const disabled = locked || busy !== null

  let title: string
  let meta: string
  if (entry.kind === 'transfer') {
    title = transferTitle(entry, accountNames)
    meta = [
      row.description && row.description !== DEFAULT_TRANSFER_DESCRIPTION ? row.description : null,
      formatDate(row.transaction_date),
    ].filter(Boolean).join(' · ')
  } else {
    const tx = entry.tx
    title = tx.description
    meta = [
      tx.envelope?.name ?? (tx.type === 'income' ? null : 'Sin categoría'),
      tx.bank_account_id ? accountNames.get(tx.bank_account_id) : null,
      formatDate(tx.transaction_date),
    ].filter(Boolean).join(' · ')
  }

  const isIncome = !transfer && row.type === 'income'
  const omit = pending && row.recurring_template_id !== null
  const deleteLabel = omit
    ? `Omitir ${description} este mes`
    : transfer
      ? 'Eliminar transferencia'
      : `Eliminar ${description}`

  return (
    <li
      className={cn(
        'group flex items-center gap-1 transition-colors hover:bg-surface-2 active:bg-surface-2',
        compact ? 'pr-2 sm:pr-3' : 'pr-2 first:rounded-t-xl last:rounded-b-xl sm:pr-3'
      )}
    >
      {/* The whole row opens the edit form. aria-disabled (not disabled) keeps keyboard focus in place. */}
      <button
        type="button"
        onClick={() => { if (!disabled) onEdit() }}
        aria-disabled={disabled || undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left',
          compact ? 'min-h-14 py-2.5 pl-4 pr-1 sm:pl-5' : 'min-h-16 py-3 pl-4 pr-2',
          focusRing,
          'focus-visible:-outline-offset-2'
        )}
      >
        <span className="sr-only">{transfer ? 'Editar transferencia: ' : 'Editar movimiento: '}</span>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            transfer ? 'bg-muted text-fg-muted' : isIncome ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'
          )}
        >
          {transfer
            ? <ArrowLeftRight className="h-4 w-4" />
            : isIncome
              ? <ArrowUpRight className="h-4 w-4" />
              : <ArrowDownLeft className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-fg">{title}</span>
            {row.is_recurring && (
              <span title="Recurrente" className="shrink-0 text-fg-subtle">
                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">, recurrente</span>
              </span>
            )}
          </span>
          {/* Wraps the badge to its own line when it would squeeze the meta to a few letters (360px) */}
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            {pending && <Badge variant="blue" className="shrink-0">Proyectado</Badge>}
            <span className="min-w-0 max-w-full truncate text-xs text-fg-subtle">{meta}</span>
          </span>
        </span>

        <Money
          value={row.amount}
          variant={transfer ? 'plain' : isIncome ? 'income' : 'expense'}
          className={cn('shrink-0 text-sm font-semibold', transfer && 'text-fg')}
        />
        <Pencil
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-accent',
            // Phones show the row's own actions instead; the whole row stays tappable.
            !compact && 'hidden sm:block'
          )}
        />
      </button>

      {pending && onConfirm && (
        <Button
          size="sm"
          variant="soft"
          aria-label={`Confirmar ${description}`}
          title="Confirmar: ya ocurrió"
          onClick={() => { if (!disabled) onConfirm() }}
          disabled={busy === 'confirming'}
          aria-disabled={(busy !== 'confirming' && disabled) || undefined}
          className="h-10 w-10 shrink-0 px-0 sm:h-9 sm:w-auto sm:px-3"
        >
          {busy === 'confirming'
            ? <Spinner size="sm" label="Confirmando" />
            : <Check className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">Confirmar</span>
        </Button>
      )}

      {onDelete && (
        <IconButton
          size="sm"
          tone="danger"
          label={deleteLabel}
          onClick={() => { if (!disabled) onDelete() }}
          disabled={busy === 'deleting'}
          aria-disabled={(busy !== 'deleting' && disabled) || undefined}
          className="transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100"
        >
          {busy === 'deleting'
            ? <Spinner size="sm" label={omit ? 'Omitiendo' : 'Eliminando'} />
            : omit
              ? <CalendarX2 className="h-4 w-4" aria-hidden="true" />
              : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
      )}
    </li>
  )
}
