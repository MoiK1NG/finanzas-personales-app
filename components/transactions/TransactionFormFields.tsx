'use client'

import { useCallback, useRef, useState, type Ref } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpDown, ArrowUpRight } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MoneyInput from '@/components/ui/MoneyInput'
import IconButton from '@/components/ui/IconButton'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { cn, focusRing, formatPeriodLabel, getPeriodRange, parseMoneyInput } from '@/lib/utils'
import type { Envelope, BankAccount, RecurrenceFrequency } from '@/types/database'
import RecurringFields from './RecurringFields'

/** Description stored for a transfer left without one (the column is NOT NULL). */
export const DEFAULT_TRANSFER_DESCRIPTION = 'Transferencia'

/** Values of the add/edit movement form, as the user sees them. */
export interface TransactionFormValues {
  type: 'income' | 'expense' | 'transfer'
  /** Formatted amount as typed ("1.250.000"); '' when empty. Parse with parseMoneyInput. */
  amount: string
  description: string
  envelope_id: string
  /** Account of an income/expense, or source account ("Desde cuenta") of a transfer. */
  bank_account_id: string
  /** Destination account ("Hacia cuenta"); transfers only. */
  to_bank_account_id: string
  transaction_date: string
  is_executed: boolean
  /** Add form only: also create a recurring template ("Hacer recurrente"). */
  recurring: boolean
  frequency: RecurrenceFrequency
  /** Optional last date of the recurrence ('' = no end). */
  end_date: string
}

export interface TransactionFormErrors {
  amount?: string
  description?: string
  bank_account_id?: string
  to_bank_account_id?: string
  transaction_date?: string
  end_date?: string
}

type ErrorField = keyof TransactionFormErrors

/** Order in which the first invalid field gets focus (same as on screen). */
const FOCUS_ORDER: ErrorField[] = [
  'amount', 'description', 'bank_account_id', 'to_bank_account_id', 'transaction_date', 'end_date',
]

/** Errors that go away when the user edits a field. */
const CLEARS: Partial<Record<keyof TransactionFormValues, ErrorField[]>> = {
  amount: ['amount'],
  description: ['description'],
  type: ['description', 'bank_account_id', 'to_bank_account_id'],
  bank_account_id: ['bank_account_id', 'to_bank_account_id'],
  to_bank_account_id: ['to_bank_account_id'],
  transaction_date: ['transaction_date', 'end_date'],
  recurring: ['end_date'],
  end_date: ['end_date'],
}

/** Same rules for add and edit. */
export function validateTransactionForm(values: TransactionFormValues): TransactionFormErrors {
  const errors: TransactionFormErrors = {}
  const amount = parseMoneyInput(values.amount)
  if (!amount || amount <= 0) errors.amount = 'Ingresa un monto válido'
  if (values.type === 'transfer') {
    if (!values.bank_account_id) errors.bank_account_id = 'Elige la cuenta de origen'
    if (!values.to_bank_account_id) errors.to_bank_account_id = 'Elige la cuenta de destino'
    else if (values.to_bank_account_id === values.bank_account_id) errors.to_bank_account_id = 'Elige dos cuentas distintas'
  } else if (!values.description.trim()) {
    errors.description = 'Agrega una descripción'
  }
  if (!values.transaction_date) errors.transaction_date = 'Elige una fecha'
  if (values.recurring && values.end_date && values.transaction_date && values.end_date < values.transaction_date) {
    errors.end_date = 'Debe ser igual o posterior a la fecha'
  }
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
  const fromAccountRef = useRef<HTMLSelectElement>(null)
  const toAccountRef = useRef<HTMLSelectElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)

  const update = useCallback((patch: Partial<TransactionFormValues>) => {
    setValues(prev => ({ ...prev, ...patch }))
    setErrors(prev => {
      const touched = (Object.keys(patch) as (keyof TransactionFormValues)[])
        .flatMap(key => CLEARS[key] ?? [])
        .filter(field => prev[field])
      if (touched.length === 0) return prev
      const next = { ...prev }
      touched.forEach(field => { delete next[field] })
      return next
    })
  }, [])

  /** Replaces every value (e.g. once data loaded after opening arrives) and clears the errors. */
  const reset = useCallback((next: TransactionFormValues) => {
    setValues(next)
    setErrors({})
  }, [])

  /** Returns true when the form can be saved; otherwise shows the errors and focuses the first one. */
  function validate(): boolean {
    const next = validateTransactionForm(values)
    setErrors(next)
    const refs: Record<ErrorField, { current: HTMLElement | null }> = {
      amount: amountRef,
      description: descriptionRef,
      bank_account_id: fromAccountRef,
      to_bank_account_id: toAccountRef,
      transaction_date: dateRef,
      end_date: endDateRef,
    }
    const first = FOCUS_ORDER.find(field => next[field])
    if (first) refs[first].current?.focus()
    return first === undefined
  }

  return {
    values,
    validate,
    reset,
    fieldProps: {
      values, errors, onChange: update,
      amountRef, descriptionRef, fromAccountRef, toAccountRef, dateRef, endDateRef,
    },
  }
}

/**
 * Account options for a select. A movement being edited can point to an archived account
 * that is no longer in the list: keep it as an option so the select shows the real value.
 */
export function accountOptions(bankAccounts: BankAccount[], keepId?: string, excludeId?: string) {
  const options = bankAccounts
    .filter(a => a.id !== excludeId)
    .map(a => ({ value: a.id, label: a.name }))
  if (keepId && keepId !== excludeId && !bankAccounts.some(a => a.id === keepId)) {
    options.push({ value: keepId, label: 'Cuenta archivada' })
  }
  return options
}

const linkClass = cn('rounded-sm font-medium text-accent underline-offset-4 hover:underline', focusRing)

interface TransferAccountsFieldsProps {
  fromId: string
  toId: string
  onChange: (patch: { bank_account_id?: string; to_bank_account_id?: string }) => void
  bankAccounts: BankAccount[]
  fromError?: string
  toError?: string
  fromRef?: Ref<HTMLSelectElement>
  toRef?: Ref<HTMLSelectElement>
  /** Hint under "Hacia cuenta". */
  hint?: string
}

/** "Desde cuenta" / "Hacia cuenta" with a swap button. Shared by the movement and recurring forms. */
export function TransferAccountsFields({
  fromId, toId, onChange, bankAccounts, fromError, toError, fromRef, toRef, hint,
}: TransferAccountsFieldsProps) {
  // An existing transfer keeps its selects even if one of its accounts was archived since.
  if (bankAccounts.length < 2 && !(fromId && toId)) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg-muted">Cuentas</span>
        <p className="text-sm text-fg-subtle">
          Necesitas al menos dos cuentas para registrar una transferencia.{' '}
          <Link href="/cuentas" className={linkClass}>
            Agrega una cuenta
          </Link>
        </p>
        {(fromError || toError) && (
          <p role="alert" className="text-xs text-expense">{fromError ?? toError}</p>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
      <Select
        ref={fromRef}
        label="Desde cuenta"
        options={accountOptions(bankAccounts, fromId)}
        placeholder="Elige una cuenta"
        value={fromId}
        // Choosing the destination as source clears the destination: it is not an option anymore.
        onChange={e => onChange(
          e.target.value && e.target.value === toId
            ? { bank_account_id: e.target.value, to_bank_account_id: '' }
            : { bank_account_id: e.target.value }
        )}
        error={fromError}
      />
      <div className="flex justify-end sm:pt-[1.625rem]">
        <IconButton
          label="Intercambiar cuentas"
          onClick={() => onChange({ bank_account_id: toId, to_bank_account_id: fromId })}
          disabled={!fromId && !toId}
        >
          <ArrowUpDown className="h-4 w-4 sm:rotate-90" aria-hidden="true" />
        </IconButton>
      </div>
      <Select
        ref={toRef}
        label="Hacia cuenta"
        options={accountOptions(bankAccounts, toId, fromId)}
        placeholder="Elige una cuenta"
        value={toId}
        onChange={e => onChange({ to_bank_account_id: e.target.value })}
        error={toError}
        hint={hint}
      />
    </div>
  )
}

interface TransactionFormFieldsProps {
  values: TransactionFormValues
  errors: TransactionFormErrors
  onChange: (patch: Partial<TransactionFormValues>) => void
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  /**
   * add  — Gasto / Ingreso / Transferencia, plus "Hacer recurrente".
   * edit — the type can't cross between transfer and income/expense (the database forbids it).
   */
  mode?: 'add' | 'edit'
  /** Month the movement is filed under ('YYYY-MM-01'): the date picker stays inside it. */
  periodDate?: string
  autoFocusAmount?: boolean
  amountRef?: Ref<HTMLInputElement>
  descriptionRef?: Ref<HTMLInputElement>
  fromAccountRef?: Ref<HTMLSelectElement>
  toAccountRef?: Ref<HTMLSelectElement>
  dateRef?: Ref<HTMLInputElement>
  endDateRef?: Ref<HTMLInputElement>
}

const EXPENSE_OPTION = {
  value: 'expense' as const,
  tone: 'expense' as const,
  label: <><ArrowDownLeft className="h-4 w-4" aria-hidden="true" />Gasto</>,
}
const INCOME_OPTION = {
  value: 'income' as const,
  tone: 'income' as const,
  label: <><ArrowUpRight className="h-4 w-4" aria-hidden="true" />Ingreso</>,
}
const TRANSFER_OPTION = {
  value: 'transfer' as const,
  tone: 'neutral' as const,
  label: (
    <>
      <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
      {/* "Transferencia" does not fit three segments on a 360px phone; screen readers get the full word */}
      <span aria-hidden="true" className="sm:hidden">Transf.</span>
      <span className="sr-only sm:not-sr-only">Transferencia</span>
    </>
  ),
}

const ADD_TYPE_OPTIONS = [EXPENSE_OPTION, INCOME_OPTION, TRANSFER_OPTION]
const EDIT_TYPE_OPTIONS = [EXPENSE_OPTION, INCOME_OPTION]

/** Fields of the add/edit movement form. Render inside a Modal with onSubmit. */
export default function TransactionFormFields({
  values, errors, onChange, envelopes, bankAccounts, mode = 'add', periodDate, autoFocusAmount,
  amountRef, descriptionRef, fromAccountRef, toAccountRef, dateRef, endDateRef,
}: TransactionFormFieldsProps) {
  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))
  const range = periodDate ? getPeriodRange(periodDate) : null
  const isTransferType = values.type === 'transfer'

  // Describes what the database balance trigger will do: it only moves the balance of an
  // executed movement with an account (projected movements move nothing).
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
      {mode === 'edit' && isTransferType ? (
        <p className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-muted text-sm font-semibold text-fg">
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          Transferencia
        </p>
      ) : (
        <SegmentedControl
          label="Tipo de movimiento"
          options={mode === 'edit' ? EDIT_TYPE_OPTIONS : ADD_TYPE_OPTIONS}
          value={values.type}
          onChange={type => onChange({ type })}
          size="lg"
          fullWidth
        />
      )}

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
        label={isTransferType ? 'Descripción (opcional)' : 'Descripción'}
        placeholder={isTransferType ? 'Ahorro del mes, pago de tarjeta…' : 'Mercado, Netflix, Arriendo…'}
        value={values.description}
        onChange={e => onChange({ description: e.target.value })}
        error={errors.description}
        maxLength={255}
      />

      {isTransferType ? (
        <TransferAccountsFields
          fromId={values.bank_account_id}
          toId={values.to_bank_account_id}
          onChange={onChange}
          bankAccounts={bankAccounts}
          fromError={errors.bank_account_id}
          toError={errors.to_bank_account_id}
          fromRef={fromAccountRef}
          toRef={toAccountRef}
        />
      ) : (
        <>
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
                <Link href="/cuentas" className={linkClass}>
                  Agrega una cuenta
                </Link>
              </p>
            </div>
          ) : (
            <Select
              label="Cuenta"
              options={accountOptions(bankAccounts, values.bank_account_id)}
              placeholder="Sin cuenta"
              value={values.bank_account_id}
              onChange={e => onChange({ bank_account_id: e.target.value })}
              hint={accountHint}
            />
          )}
        </>
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
            {isTransferType
              ? 'Desmárcalo si aún no ha pasado: quedará como Proyectado y no moverá ningún saldo.'
              : 'Desmárcalo si aún no ha pasado: quedará como Proyectado.'}
          </span>
        </span>
      </label>

      {mode === 'add' && (
        <RecurringFields
          recurring={values.recurring}
          frequency={values.frequency}
          endDate={values.end_date}
          minEndDate={values.transaction_date || undefined}
          onChange={onChange}
          endDateError={errors.end_date}
          endDateRef={endDateRef}
        />
      )}
    </div>
  )
}
