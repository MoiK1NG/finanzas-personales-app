'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createTemplate, resyncTemplate, updateTemplate } from '@/lib/recurring'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Select from '@/components/ui/Select'
import { cn, focusRing, formatMoneyInput, FREQUENCY_OPTIONS, parseMoneyInput, todayISO } from '@/lib/utils'
import type { BankAccount, Envelope, RecurrenceFrequency, RecurringTemplate, TransactionType } from '@/types/database'
import {
  accountOptions, DEFAULT_TRANSFER_DESCRIPTION, TransferAccountsFields,
} from '@/components/transactions/TransactionFormFields'

interface RecurringTemplateFormProps {
  /** Template to edit; omit to create a new one. */
  template?: RecurringTemplate | null
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  onSaved: () => void
  onClose: () => void
}

interface Values {
  type: TransactionType
  amount: string
  description: string
  envelope_id: string
  bank_account_id: string
  to_bank_account_id: string
  frequency: RecurrenceFrequency
  start_date: string
  end_date: string
  is_active: boolean
}

type Errors = Partial<Record<'amount' | 'description' | 'bank_account_id' | 'to_bank_account_id' | 'start_date' | 'end_date', string>>

const TYPE_OPTIONS = [
  {
    value: 'expense' as const,
    tone: 'expense' as const,
    label: <><ArrowDownLeft className="h-4 w-4" aria-hidden="true" />Gasto</>,
  },
  {
    value: 'income' as const,
    tone: 'income' as const,
    label: <><ArrowUpRight className="h-4 w-4" aria-hidden="true" />Ingreso</>,
  },
  {
    value: 'transfer' as const,
    tone: 'neutral' as const,
    label: (
      <>
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
        <span aria-hidden="true" className="sm:hidden">Transf.</span>
        <span className="sr-only sm:not-sr-only">Transferencia</span>
      </>
    ),
  },
]

function initialValues(template?: RecurringTemplate | null): Values {
  if (!template) {
    return {
      type: 'expense', amount: '', description: '', envelope_id: '', bank_account_id: '',
      to_bank_account_id: '', frequency: 'monthly', start_date: todayISO(), end_date: '', is_active: true,
    }
  }
  return {
    type: template.type,
    amount: formatMoneyInput(template.amount),
    description: template.type === 'transfer' && template.description === DEFAULT_TRANSFER_DESCRIPTION
      ? ''
      : template.description,
    envelope_id: template.envelope_id ?? '',
    bank_account_id: template.bank_account_id ?? '',
    to_bank_account_id: template.to_bank_account_id ?? '',
    frequency: template.frequency,
    start_date: template.start_date,
    end_date: template.end_date ?? '',
    is_active: template.is_active,
  }
}

function validate(values: Values): Errors {
  const errors: Errors = {}
  const amount = parseMoneyInput(values.amount)
  if (!amount || amount <= 0) errors.amount = 'Ingresa un monto válido'
  if (values.type === 'transfer') {
    if (!values.bank_account_id) errors.bank_account_id = 'Elige la cuenta de origen'
    if (!values.to_bank_account_id) errors.to_bank_account_id = 'Elige la cuenta de destino'
    else if (values.to_bank_account_id === values.bank_account_id) errors.to_bank_account_id = 'Elige dos cuentas distintas'
  } else if (!values.description.trim()) {
    errors.description = 'Agrega una descripción'
  }
  if (!values.start_date) errors.start_date = 'Elige la primera fecha'
  if (values.end_date && values.start_date && values.end_date < values.start_date) {
    errors.end_date = 'Debe ser igual o posterior a la primera fecha'
  }
  return errors
}

/** Create / edit a recurring income, expense or transfer. */
export default function RecurringTemplateForm({
  template, envelopes, bankAccounts, onSaved, onClose,
}: RecurringTemplateFormProps) {
  const editing = Boolean(template)
  const [values, setValues] = useState<Values>(() => initialValues(template))
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const fromRef = useRef<HTMLSelectElement>(null)
  const toRef = useRef<HTMLSelectElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const isTransferType = values.type === 'transfer'

  function update(patch: Partial<Values>) {
    setValues(prev => ({ ...prev, ...patch }))
    // Editing a field clears its error (and the ones that depend on it).
    setErrors(prev => {
      const next = { ...prev }
      if ('amount' in patch) delete next.amount
      if ('description' in patch || 'type' in patch) delete next.description
      if ('bank_account_id' in patch || 'type' in patch) { delete next.bank_account_id; delete next.to_bank_account_id }
      if ('to_bank_account_id' in patch) delete next.to_bank_account_id
      if ('start_date' in patch) { delete next.start_date; delete next.end_date }
      if ('end_date' in patch) delete next.end_date
      return next
    })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const next = validate(values)
    setErrors(next)
    const firstRef =
      next.amount ? amountRef
      : next.description ? descriptionRef
      : next.bank_account_id ? fromRef
      : next.to_bank_account_id ? toRef
      : next.start_date ? startRef
      : next.end_date ? endRef
      : null
    if (firstRef) { firstRef.current?.focus(); return }

    const input = {
      type: values.type,
      amount: parseMoneyInput(values.amount),
      description: values.description.trim() || (isTransferType ? DEFAULT_TRANSFER_DESCRIPTION : ''),
      envelopeId: values.envelope_id || null,
      bankAccountId: values.bank_account_id || null,
      toBankAccountId: isTransferType ? values.to_bank_account_id : null,
      frequency: values.frequency,
      startDate: values.start_date,
      endDate: values.end_date || null,
      ...(editing ? { isActive: values.is_active } : {}),
    }

    setLoading(true)
    const supabase = createClient()

    if (template) {
      // Saves and regenerates the pending occurrences from this month on.
      const { error: err } = await updateTemplate(supabase, template.id, input)
      setLoading(false)
      if (err) { setError('No se pudieron guardar los cambios. Intenta de nuevo.'); return }
      onSaved()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setError('Tu sesión expiró. Vuelve a iniciar sesión para guardar.')
      return
    }
    const { data: created, error: err } = await createTemplate(supabase, user.id, input)
    if (err || !created) {
      setLoading(false)
      setError('No se pudo crear la recurrencia. Intenta de nuevo.')
      return
    }
    // Generates the occurrences from this month on. Not fatal: each month also generates
    // its own when Inicio or Movimientos open it.
    const { error: syncErr } = await resyncTemplate(supabase, created.id)
    if (syncErr) console.warn('resync_recurring_template failed:', syncErr.message)
    setLoading(false)
    onSaved()
  }

  const startDay = values.start_date ? Number(values.start_date.slice(8, 10)) : null
  const startHint = values.frequency === 'monthly' && startDay
    ? `Se repetirá el día ${startDay} de cada mes; si el mes es más corto, el último día.`
    : undefined

  return (
    <Modal
      title={editing ? 'Editar recurrencia' : 'Nueva recurrencia'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1 sm:flex-none">
            {editing ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {editing && (
          <p className="text-xs text-fg-subtle">
            Los cambios aplican a los movimientos pendientes de este mes en adelante. Los ya confirmados no cambian.
          </p>
        )}

        <SegmentedControl
          label="Tipo"
          options={TYPE_OPTIONS}
          value={values.type}
          onChange={type => update({ type })}
          size="lg"
          fullWidth
        />

        <MoneyInput
          ref={amountRef}
          label="Monto"
          size="lg"
          value={values.amount}
          onValueChange={amount => update({ amount })}
          error={errors.amount}
          autoFocus={!editing}
        />

        <Input
          ref={descriptionRef}
          label={isTransferType ? 'Descripción (opcional)' : 'Descripción'}
          placeholder={isTransferType ? 'Ahorro del mes, pago de tarjeta…' : 'Arriendo, Netflix, Salario…'}
          value={values.description}
          onChange={e => update({ description: e.target.value })}
          error={errors.description}
          maxLength={255}
        />

        {isTransferType ? (
          <TransferAccountsFields
            fromId={values.bank_account_id}
            toId={values.to_bank_account_id}
            onChange={update}
            bankAccounts={bankAccounts}
            fromError={errors.bank_account_id}
            toError={errors.to_bank_account_id}
            fromRef={fromRef}
            toRef={toRef}
          />
        ) : (
          <>
            <Select
              label="Categoría"
              options={envelopes.map(e => ({ value: e.id, label: e.name }))}
              placeholder="Sin categoría"
              value={values.envelope_id}
              onChange={e => update({ envelope_id: e.target.value })}
              hint={values.type === 'income' ? 'Opcional. El presupuesto por categoría solo cuenta gastos.' : undefined}
            />
            <Select
              label="Cuenta"
              options={accountOptions(bankAccounts, values.bank_account_id)}
              placeholder="Sin cuenta"
              value={values.bank_account_id}
              onChange={e => update({ bank_account_id: e.target.value })}
              hint={values.bank_account_id
                ? 'Cada movimiento cambia el saldo de esta cuenta cuando lo confirmas.'
                : 'Sin cuenta, confirmar no cambia el saldo de ninguna cuenta.'}
            />
          </>
        )}

        <Select
          label="Frecuencia"
          options={FREQUENCY_OPTIONS}
          value={values.frequency}
          onChange={e => update({ frequency: e.target.value as RecurrenceFrequency })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            ref={startRef}
            label="Primera fecha"
            type="date"
            value={values.start_date}
            onChange={e => update({ start_date: e.target.value })}
            error={errors.start_date}
            hint={startHint}
          />
          <Input
            ref={endRef}
            label="Hasta (opcional)"
            type="date"
            value={values.end_date}
            min={values.start_date || undefined}
            onChange={e => update({ end_date: e.target.value })}
            error={errors.end_date}
          />
        </div>

        {editing && (
          <label className="flex min-h-10 cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={e => update({ is_active: e.target.checked })}
              className={cn('mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-[var(--primary)]', focusRing)}
            />
            <span className="min-w-0">
              <span className="block text-sm text-fg">Activa</span>
              <span className="block text-xs text-fg-subtle">
                Desmárcala para pausarla: deja de generar movimientos proyectados.
              </span>
            </span>
          </label>
        )}

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
