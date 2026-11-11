'use client'

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import IconButton from '@/components/ui/IconButton'
import Money from '@/components/ui/Money'
import Spinner from '@/components/ui/Spinner'
import { cn, formatDate, formatRecurrence, transferLabel } from '@/lib/utils'
import type { RecurringTemplate } from '@/types/database'

interface RecurringTemplateRowProps {
  template: RecurringTemplate
  /** Active account id → name. Accounts missing from it were archived. */
  accountNames: Map<string, string>
  envelopeNames: Map<string, string>
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
  busy?: 'toggling' | 'deleting' | null
  /** Another change is running: the row's actions wait. */
  locked?: boolean
}

/** One recurring template: what, how often, which account(s), with edit / pause / delete. */
export default function RecurringTemplateRow({
  template: t, accountNames, envelopeNames, onEdit, onToggleActive, onDelete, busy = null, locked = false,
}: RecurringTemplateRowProps) {
  const transfer = t.type === 'transfer'
  const isIncome = t.type === 'income'
  const disabled = locked || busy !== null
  const account = (id: string | null) => (id ? accountNames.get(id) ?? 'Cuenta archivada' : null)

  const meta = [
    formatRecurrence(t),
    transfer ? transferLabel(account(t.bank_account_id), account(t.to_bank_account_id)) : account(t.bank_account_id),
    !transfer && t.envelope_id ? envelopeNames.get(t.envelope_id) : null,
    t.end_date ? `hasta ${formatDate(t.end_date)} ${t.end_date.slice(0, 4)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:pr-3">
      <div className={cn('flex min-w-0 flex-1 items-center gap-3', !t.is_active && 'opacity-70')}>
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

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-medium text-fg">{t.description}</p>
            {!t.is_active && <Badge variant="gray" className="shrink-0">Pausada</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-fg-subtle">{meta}</p>
        </div>

        <Money
          value={t.amount}
          variant={transfer ? 'plain' : isIncome ? 'income' : 'expense'}
          className={cn('shrink-0 text-sm font-semibold', transfer && 'text-fg')}
        />
      </div>

      {/* On phones the actions get their own line, so the description keeps its width at 360px. */}
      <div className="-mr-2 flex justify-end gap-1 sm:mr-0">
        <IconButton
          size="sm"
          label={`Editar ${t.description}`}
          onClick={() => { if (!disabled) onEdit() }}
          aria-disabled={disabled || undefined}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={t.is_active ? `Pausar ${t.description}` : `Reanudar ${t.description}`}
          onClick={() => { if (!disabled) onToggleActive() }}
          disabled={busy === 'toggling'}
          aria-disabled={(busy !== 'toggling' && disabled) || undefined}
        >
          {busy === 'toggling'
            ? <Spinner size="sm" label={t.is_active ? 'Pausando' : 'Reanudando'} />
            : t.is_active
              ? <Pause className="h-4 w-4" aria-hidden="true" />
              : <Play className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
        <IconButton
          size="sm"
          tone="danger"
          label={`Eliminar ${t.description}`}
          onClick={() => { if (!disabled) onDelete() }}
          disabled={busy === 'deleting'}
          aria-disabled={(busy !== 'deleting' && disabled) || undefined}
        >
          {busy === 'deleting'
            ? <Spinner size="sm" label="Eliminando" />
            : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
      </div>
    </li>
  )
}
