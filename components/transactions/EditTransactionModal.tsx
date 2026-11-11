'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateTransfer } from '@/lib/transfers'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import { LoadingState } from '@/components/ui/Spinner'
import { formatMoneyInput, isTransfer, parseMoneyInput } from '@/lib/utils'
import type { Envelope, Transaction, BankAccount } from '@/types/database'
import TransactionFormFields, {
  DEFAULT_TRANSFER_DESCRIPTION, useTransactionForm, type TransactionFormValues,
} from './TransactionFormFields'
import { RecurringOccurrenceNote } from './RecurringFields'

interface EditTransactionModalProps {
  transaction: Transaction
  /**
   * The other row of a transfer, when the caller already has it. If the edited row is a
   * transfer and this is missing, the modal fetches it.
   */
  counterpart?: Transaction
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  onSuccess: () => void
  onClose: () => void
  /** Month the movement is filed under ('YYYY-MM-01'), when known: keeps the date picker inside it. */
  periodDate?: string
}

function initialValues(transaction: Transaction, counterpart: Transaction | null): TransactionFormValues {
  const base = {
    amount: formatMoneyInput(transaction.amount),
    description: transaction.description,
    transaction_date: transaction.transaction_date,
    is_executed: transaction.is_executed,
    recurring: false,
    frequency: 'monthly' as const,
    end_date: '',
  }

  if (transaction.type === 'transfer') {
    const out = transaction.transfer_direction === 'out' ? transaction : counterpart
    const into = transaction.transfer_direction === 'in' ? transaction : counterpart
    return {
      ...base,
      type: 'transfer',
      // The default description is not shown, so the optional field starts empty.
      description: transaction.description === DEFAULT_TRANSFER_DESCRIPTION ? '' : transaction.description,
      envelope_id: '',
      bank_account_id: out?.bank_account_id ?? '',
      to_bank_account_id: into?.bank_account_id ?? '',
    }
  }

  return {
    ...base,
    type: transaction.type,
    envelope_id: transaction.envelope_id ?? '',
    bank_account_id: transaction.bank_account_id ?? '',
    to_bank_account_id: '',
  }
}

type CounterpartState =
  | { status: 'ready'; tx: Transaction | null }
  | { status: 'loading' }
  | { status: 'error' }

export default function EditTransactionModal({
  transaction,
  counterpart,
  envelopes,
  bankAccounts,
  onSuccess,
  onClose,
  periodDate,
}: EditTransactionModalProps) {
  const transfer = isTransfer(transaction)
  const needsCounterpart = transfer && !counterpart
  const [sibling, setSibling] = useState<CounterpartState>(() =>
    needsCounterpart ? { status: 'loading' } : { status: 'ready', tx: counterpart ?? null }
  )

  const { values, validate, reset, fieldProps } = useTransactionForm(() =>
    initialValues(transaction, counterpart ?? null)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // A transfer opened without its other row (e.g. only one side was in the list): fetch it
  // before showing the form, since the accounts come from both rows.
  useEffect(() => {
    if (!needsCounterpart) return
    let cancelled = false
    createClient()
      .from('transactions')
      .select('*')
      .eq('transfer_group_id', transaction.transfer_group_id)
      .neq('id', transaction.id)
      .single<Transaction>()
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return
        if (fetchErr || !data) {
          setSibling({ status: 'error' })
          return
        }
        reset(initialValues(transaction, data))
        setSibling({ status: 'ready', tx: data })
      })
    return () => { cancelled = true }
  }, [needsCounterpart, transaction, reset])

  function finish() {
    onSuccess()
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sibling.status !== 'ready') return
    setError(null)

    if (!validate()) return
    const amount = parseMoneyInput(values.amount)

    setLoading(true)
    const supabase = createClient()

    // The database moves the account balances (trigger); a transfer's other row follows.
    const { error: err } = transfer
      ? await updateTransfer(supabase, transaction.transfer_group_id as string, {
          fromAccountId: values.bank_account_id,
          toAccountId: values.to_bank_account_id,
          amount,
          description: values.description.trim() || DEFAULT_TRANSFER_DESCRIPTION,
          date: values.transaction_date,
          isExecuted: values.is_executed,
        })
      : await supabase
          .from('transactions')
          .update({
            type: values.type,
            amount,
            description: values.description.trim(),
            envelope_id: values.envelope_id || null,
            bank_account_id: values.bank_account_id || null,
            transaction_date: values.transaction_date,
            is_executed: values.is_executed,
          })
          .eq('id', transaction.id)

    setLoading(false)
    if (err) {
      setError('No se pudo guardar el cambio. Intenta de nuevo.')
      return
    }

    finish()
  }

  return (
    <Modal
      title={transfer ? 'Editar transferencia' : 'Editar movimiento'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={sibling.status !== 'ready'}
            className="flex-1 sm:flex-none"
          >
            Guardar cambios
          </Button>
        </>
      }
    >
      {sibling.status === 'loading' ? (
        <LoadingState label="Cargando transferencia" />
      ) : sibling.status === 'error' ? (
        <Alert tone="danger" title="No se pudo cargar la transferencia">
          Cierra y vuelve a intentarlo.
        </Alert>
      ) : (
        <div className="space-y-4">
          <TransactionFormFields
            {...fieldProps}
            envelopes={envelopes}
            bankAccounts={bankAccounts}
            periodDate={periodDate}
            mode="edit"
          />
          {transaction.recurring_template_id && (
            <RecurringOccurrenceNote templateId={transaction.recurring_template_id} />
          )}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  )
}
