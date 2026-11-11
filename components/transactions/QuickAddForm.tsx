'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createTransfer } from '@/lib/transfers'
import { confirmTransaction, createTemplate, ensureRecurringOccurrences, resyncTemplate } from '@/lib/recurring'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import { getPeriodRange, parseMoneyInput, todayISO } from '@/lib/utils'
import type { Envelope, BudgetPeriod, BankAccount } from '@/types/database'
import TransactionFormFields, {
  DEFAULT_TRANSFER_DESCRIPTION, useTransactionForm, type TransactionFormValues,
} from './TransactionFormFields'

interface QuickAddFormProps {
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  budgetPeriod: BudgetPeriod
  onSuccess: () => void
  /**
   * Controlled mode: when defined, no trigger is rendered and the form shows while `open`
   * is true. Leave undefined to render the built-in "Nuevo movimiento" button.
   */
  open?: boolean
  /** Called with false when the form closes (also after a successful save, after onSuccess). */
  onOpenChange?: (open: boolean) => void
  /** Classes for the built-in trigger button (uncontrolled mode), e.g. "w-full". */
  triggerClassName?: string
}

/** Today's local date, kept inside the month being viewed (the movement is filed under it). */
function defaultDate(periodDate: string): string {
  const today = todayISO()
  const { start, end } = getPeriodRange(periodDate)
  if (today < start) return start
  if (today > end) return end
  return today
}

function initialValues(budgetPeriod: BudgetPeriod): TransactionFormValues {
  return {
    type: 'expense',
    amount: '',
    description: '',
    envelope_id: '',
    bank_account_id: '',
    to_bank_account_id: '',
    transaction_date: defaultDate(budgetPeriod.period_date),
    is_executed: true,
    recurring: false,
    frequency: 'monthly',
    end_date: '',
  }
}

export default function QuickAddForm({
  envelopes, bankAccounts, budgetPeriod, onSuccess, open: openProp, onOpenChange, triggerClassName,
}: QuickAddFormProps) {
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? openProp : internalOpen

  function setOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <>
      {!isControlled && (
        <Button className={triggerClassName} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo movimiento
        </Button>
      )}

      {/* Mounted only while open: every opening starts from a fresh form and today's date. */}
      {open && (
        <QuickAddDialog
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          budgetPeriod={budgetPeriod}
          onSaved={() => { onSuccess(); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function QuickAddDialog({
  envelopes, bankAccounts, budgetPeriod, onSaved, onClose,
}: {
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  budgetPeriod: BudgetPeriod
  onSaved: () => void
  onClose: () => void
}) {
  const { values, validate, fieldProps } = useTransactionForm(() => initialValues(budgetPeriod))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Set when a recurrence was created but this month's occurrence could not be marked as
   * executed. Saving again would create a second recurrence, so the form only offers to close.
   */
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (savedNotice) { onSaved(); return }
    setError(null)

    if (!validate()) return
    const amount = parseMoneyInput(values.amount)
    const isTransferType = values.type === 'transfer'
    const description = values.description.trim() || (isTransferType ? DEFAULT_TRANSFER_DESCRIPTION : '')

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setError('Tu sesión expiró. Vuelve a iniciar sesión para guardar.')
      return
    }

    // Recurring: the template generates this month's occurrence as Proyectado. Inserting the
    // movement here too would duplicate it, so "Ya ejecutado" confirms that occurrence instead.
    if (values.recurring) {
      const { data: template, error: templateErr } = await createTemplate(supabase, user.id, {
        type: values.type,
        amount,
        description,
        envelopeId: values.envelope_id || null,
        bankAccountId: values.bank_account_id || null,
        toBankAccountId: isTransferType ? values.to_bank_account_id : null,
        frequency: values.frequency,
        startDate: values.transaction_date,
        endDate: values.end_date || null,
      })
      if (templateErr || !template) {
        setLoading(false)
        setError('No se pudo crear la recurrencia. Intenta de nuevo.')
        return
      }

      // Generates this month and later existing months. If it fails, generating just this
      // month is enough: later months generate their occurrences when they are opened.
      const { error: syncErr } = await resyncTemplate(supabase, template.id, budgetPeriod.period_date)
      if (syncErr) await ensureRecurringOccurrences(supabase, budgetPeriod.id)

      if (values.is_executed) {
        let query = supabase
          .from('transactions')
          .select('id')
          .eq('recurring_template_id', template.id)
          .eq('budget_period_id', budgetPeriod.id)
          .eq('recurrence_date', values.transaction_date)
        if (isTransferType) query = query.eq('transfer_direction', 'out')
        const { data: occurrence } = await query.maybeSingle<{ id: string }>()
        const confirmed = occurrence ? !(await confirmTransaction(supabase, occurrence.id)).error : false
        if (!confirmed) {
          setLoading(false)
          setSavedNotice(
            'No se pudo marcar como ejecutado el movimiento de este mes, así que quedó como Proyectado. ' +
            'Confírmalo desde Movimientos.'
          )
          return
        }
      }

      setLoading(false)
      onSaved()
      return
    }

    const { error: err } = isTransferType
      ? await createTransfer(supabase, budgetPeriod.id, {
          fromAccountId: values.bank_account_id,
          toAccountId: values.to_bank_account_id,
          amount,
          description,
          date: values.transaction_date,
          isExecuted: values.is_executed,
        })
      : await supabase.from('transactions').insert({
          user_id: user.id,
          budget_period_id: budgetPeriod.id,
          envelope_id: values.envelope_id || null,
          bank_account_id: values.bank_account_id || null,
          type: values.type,
          amount,
          description,
          transaction_date: values.transaction_date,
          is_executed: values.is_executed,
        })

    setLoading(false)
    if (err) {
      setError(isTransferType
        ? 'No se pudo guardar la transferencia. Intenta de nuevo.'
        : 'No se pudo guardar el movimiento. Intenta de nuevo.')
      return
    }

    onSaved()
  }

  return (
    <Modal
      title={values.type === 'transfer' ? 'Nueva transferencia' : 'Nuevo movimiento'}
      onClose={savedNotice ? onSaved : onClose}
      onSubmit={handleSubmit}
      footer={
        savedNotice ? (
          <Button type="submit" className="flex-1 sm:flex-none" autoFocus>
            Entendido
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} className="flex-1 sm:flex-none">
              Guardar
            </Button>
          </>
        )
      }
    >
      {savedNotice ? (
        <Alert tone="warning" title="La recurrencia se guardó">{savedNotice}</Alert>
      ) : (
        <div className="space-y-4">
          <TransactionFormFields
            {...fieldProps}
            envelopes={envelopes}
            bankAccounts={bankAccounts}
            periodDate={budgetPeriod.period_date}
            mode="add"
            autoFocusAmount
          />
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  )
}
