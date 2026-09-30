'use client'

import { useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import { getPeriodRange, parseMoneyInput } from '@/lib/utils'
import type { Envelope, BudgetPeriod, BankAccount } from '@/types/database'
import TransactionFormFields, { useTransactionForm, type TransactionFormValues } from './TransactionFormFields'

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
  const today = format(new Date(), 'yyyy-MM-dd')
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
    transaction_date: defaultDate(budgetPeriod.period_date),
    is_executed: true,
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
  /** Set when the movement was saved but its account balance could not be updated. */
  const [balanceNotice, setBalanceNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (balanceNotice) { onSaved(); return }
    setError(null)

    if (!validate()) return
    const amount = parseMoneyInput(values.amount)

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setError('Tu sesión expiró. Vuelve a iniciar sesión para guardar.')
      return
    }

    const { error: err } = await supabase.from('transactions').insert({
      user_id: user.id,
      budget_period_id: budgetPeriod.id,
      envelope_id: values.envelope_id || null,
      bank_account_id: values.bank_account_id || null,
      type: values.type,
      amount,
      description: values.description.trim(),
      transaction_date: values.transaction_date,
      is_executed: values.is_executed,
    })

    let balanceFailed = false
    if (!err && values.is_executed && values.bank_account_id) {
      const delta = values.type === 'income' ? amount : -amount
      const { data: acct } = await supabase.from('bank_accounts').select('balance').eq('id', values.bank_account_id).single()
      if (acct) {
        const { error: balanceErr } = await supabase.from('bank_accounts').update({ balance: acct.balance + delta }).eq('id', values.bank_account_id)
        if (balanceErr) balanceFailed = true
      } else {
        balanceFailed = true
      }
    }

    setLoading(false)
    if (err) { setError('No se pudo guardar el movimiento. Intenta de nuevo.'); return }

    if (balanceFailed) {
      const name = bankAccounts.find(a => a.id === values.bank_account_id)?.name ?? 'la cuenta'
      setBalanceNotice(`No se pudo actualizar el saldo de ${name}. Revísalo en Cuentas.`)
      return
    }

    onSaved()
  }

  return (
    <Modal
      title="Nuevo movimiento"
      onClose={balanceNotice ? onSaved : onClose}
      onSubmit={handleSubmit}
      footer={
        balanceNotice ? (
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
      {balanceNotice ? (
        <Alert tone="warning" title="El movimiento se guardó">{balanceNotice}</Alert>
      ) : (
        <div className="space-y-4">
          <TransactionFormFields
            {...fieldProps}
            envelopes={envelopes}
            bankAccounts={bankAccounts}
            periodDate={budgetPeriod.period_date}
            autoFocusAmount
          />
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  )
}
