'use client'

import { useCallback, useRef, useState, type Ref } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MoneyInput from '@/components/ui/MoneyInput'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { cn, focusRing, formatPeriodLabel, getPeriodRange, parseMoneyInput } from '@/lib/utils'
import type { Envelope, BankAccount } from '@/types/database'

/** Values of the add/edit movement form, as the user sees them. */
export interface TransactionFormValues {
  type: 'income' | 'expense'
  /** Formatted amount as typed ("1.250.000"); '' when empty. Parse with parseMoneyInput. */
  amount: string
  description: string
  envelope_id: string
  bank_account_id: string
  transaction_date: string
  is_executed: boolean
}

export interface TransactionFormErrors {
  amount?: string
  description?: string
  transaction_date?: string
}

type ErrorField = keyof TransactionFormErrors
const ERROR_FIELDS: ErrorField[] = ['amount', 'description', 'transaction_date']

/** Same rules for add and edit. */
export function validateTransactionForm(values: TransactionFormValues): TransactionFormErrors {
  const errors: TransactionFormErrors = {}
  const amount = parseMoneyInput(values.amount)
  if (!amount || amount <= 0) errors.amount = 'Ingresa un monto válido'
  if (!values.description.trim()) errors.description = 'Agrega una descripción'
  if (!values.transaction_date) errors.transaction_date = 'Elige una fecha'
  return errors
}

/**
 * Form state shared by QuickAddForm and EditTransactionModal: values, per-field errors
 * (cleared as the user edits that field) and focus on the first invalid field.
 */
export function useTransactionForm(initial: () => TransactionFormValues) {
  const [values, setValues] = useState<TransactionFormValues>(initial)
  const [errors, setErrors] = useState<TransactionFormErrors>({})
  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const update = useCallback((patch: Partial<TransactionFormValues>) => {
    setValues(prev => ({ ...prev, ...patch }))
    setErrors(prev => {
      const touched = ERROR_FIELDS.filter(field => field in patch && prev[field])
      if (touched.length === 0) return prev
      const next = { ...prev }
      touched.forEach(field => { delete next[field] })
      return next
    })
  }, [])

  /** Returns true when the form can be saved; otherwise shows the errors and focuses the first one. */
  function validate(): boolean {
    const next = validateTransactionForm(values)
    setErrors(next)
    if (next.amount) amountRef.current?.focus()
    else if (next.description) descriptionRef.current?.focus()
    else if (next.transaction_date) dateRef.current?.focus()
    return !next.amount && !next.description && !next.transaction_date
  }

  return {
    values,
    validate,
    fieldProps: { values, errors, onChange: update, amountRef, descriptionRef, dateRef },
  }
}

interface TransactionFormFieldsProps {
  values: TransactionFormValues
  errors: TransactionFormErrors
  onChange: (patch: Partial<TransactionFormValues>) => void
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  /** Month the movement is filed under ('YYYY-MM-01'): the date picker stays inside it. */
  periodDate?: string
  autoFocusAmount?: boolean
  amountRef?: Ref<HTMLInputElement>
  descriptionRef?: Ref<HTMLInputElement>
  dateRef?: Ref<HTMLInputElement>
}

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
]

/** Fields of the add/edit movement form. Render inside a Modal with onSubmit. */
export default function TransactionFormFields({
  values, errors, onChange, envelopes, bankAccounts, periodDate, autoFocusAmount,
  amountRef, descriptionRef, dateRef,
}: TransactionFormFieldsProps) {
  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))
  const accountOptions = bankAccounts.map(a => ({ value: a.id, label: a.name }))
  const range = periodDate ? getPeriodRange(periodDate) : null

  // Mirrors the save logic: the balance only changes for an executed movement with an account.
  const accountName = bankAccounts.find(a => a.id === values.bank_account_id)?.name ?? 'la cuenta'
  const accountHint = !values.bank_account_id
    ? 'Sin cuenta, no cambia el saldo de ninguna cuenta.'
    : !values.is_executed
      ? `Mientras esté proyectado, no cambia el saldo de ${accountName}.`
      : values.type === 'income'
        ? `Se suma al saldo de ${accountName}.`
        : `Se descuenta del saldo de ${accountName}.`

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Tipo de movimiento"
        options={TYPE_OPTIONS}
        value={values.type}
        onChange={type => onChange({ type })}
        size="lg"
        fullWidth
      />

      <MoneyInput
        ref={amountRef}
        label="Monto"
        size="lg"
        value={values.amount}
        onValueChange={amount => onChange({ amount })}
        error={errors.amount}
        autoFocus={autoFocusAmount}
      />

      <Input
        ref={descriptionRef}
        label="Descripción"
        placeholder="Mercado, Netflix, Arriendo…"
        value={values.description}
        onChange={e => onChange({ description: e.target.value })}
        error={errors.description}
        maxLength={255}
      />

      <Select
        label="Categoría"
        options={envelopeOptions}
        placeholder="Sin categoría"
        value={values.envelope_id}
        onChange={e => onChange({ envelope_id: e.target.value })}
        hint={values.type === 'income' ? 'Opcional. El presupuesto por categoría solo cuenta gastos.' : undefined}
      />

      {/* A movement being edited can still point to an archived account: keep the select (and its hint) then. */}
      {bankAccounts.length === 0 && !values.bank_account_id ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg-muted">Cuenta</span>
          <p className="text-sm text-fg-subtle">
            Aún no tienes cuentas, así que este movimiento no cambia ningún saldo.{' '}
            <Link
              href="/cuentas"
              className={cn('rounded-sm font-medium text-accent underline-offset-4 hover:underline', focusRing)}
            >
              Agrega una cuenta
            </Link>
          </p>
        </div>
      ) : (
        <Select
          label="Cuenta"
          options={accountOptions}
          placeholder="Sin cuenta"
          value={values.bank_account_id}
          onChange={e => onChange({ bank_account_id: e.target.value })}
          hint={accountHint}
        />
      )}

      <Input
        ref={dateRef}
        label="Fecha"
        type="date"
        value={values.transaction_date}
        onChange={e => onChange({ transaction_date: e.target.value })}
        min={range?.start}
        max={range?.end}
        error={errors.transaction_date}
        hint={periodDate ? `Debe estar dentro de ${formatPeriodLabel(periodDate)}.` : undefined}
      />

      <label className="flex min-h-10 cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={values.is_executed}
          onChange={e => onChange({ is_executed: e.target.checked })}
          className={cn('mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-[var(--primary)]', focusRing)}
        />
        <span className="min-w-0">
          <span className="block text-sm text-fg">Ya ejecutado (ya ocurrió)</span>
          <span className="block text-xs text-fg-subtle">
            Desmárcalo si aún no ha pasado: quedará como Proyectado.
          </span>
        </span>
      </label>
    </div>
  )
}
