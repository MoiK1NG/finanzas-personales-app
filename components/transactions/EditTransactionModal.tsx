'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import { formatMoneyInput, parseMoneyInput } from '@/lib/utils'
import type { Envelope, Transaction, BankAccount } from '@/types/database'
import TransactionFormFields, { useTransactionForm } from './TransactionFormFields'

interface EditTransactionModalProps {
  transaction: Transaction
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  onSuccess: () => void
  onClose: () => void
  /** Month the movement is filed under ('YYYY-MM-01'), when known: keeps the date picker inside it. */
  periodDate?: string
}

export default function EditTransactionModal({
  transaction,
  envelopes,
  bankAccounts,
  onSuccess,
  onClose,
  periodDate,
}: EditTransactionModalProps) {
  const { values, validate, fieldProps } = useTransactionForm(() => ({
    type: transaction.type === 'transfer' ? 'expense' : transaction.type,
    amount: formatMoneyInput(transaction.amount),
    description: transaction.description,
    envelope_id: transaction.envelope_id ?? '',
    bank_account_id: transaction.bank_account_id ?? '',
    transaction_date: transaction.transaction_date,
    is_executed: transaction.is_executed,
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  /** Set when the change was saved but an account balance could not be updated. */
  const [balanceNotice, setBalanceNotice] = useState<string | null>(null)

  const accountName = (id: string | null) => bankAccounts.find(a => a.id === id)?.name ?? 'la cuenta'

  function finish() {
    onSuccess()
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (balanceNotice) { finish(); return }
    setError(null)

    if (!validate()) return
    const {
      type,
      description,
      envelope_id: envelopeId,
      bank_account_id: bankAccountId,
      transaction_date: date,
      is_executed: isExecuted,
    } = values
    const amt = parseMoneyInput(values.amount)

    setLoading(true)
    const supabase = createClient()

    let reversed = false
    /** Accounts whose balance read or write failed (old and new account can both fail). */
    const failedAccountIds = new Set<string>()

    // Reverse old balance effect
    if (transaction.is_executed && transaction.bank_account_id) {
      const reverseDelta = transaction.type === 'income' ? -transaction.amount : transaction.amount
      const { data: acct } = await supabase.from('bank_accounts').select('balance').eq('id', transaction.bank_account_id).single()
      if (acct) {
        const { error: reverseErr } = await supabase.from('bank_accounts').update({ balance: acct.balance + reverseDelta }).eq('id', transaction.bank_account_id)
        if (reverseErr) failedAccountIds.add(transaction.bank_account_id)
        else reversed = true
      } else {
        failedAccountIds.add(transaction.bank_account_id)
      }
    }

    const { error: err } = await supabase
      .from('transactions')
      .update({
        type,
        amount: amt,
        description: description.trim(),
        envelope_id: envelopeId || null,
        bank_account_id: bankAccountId || null,
        transaction_date: date,
        is_executed: isExecuted,
      })
      .eq('id', transaction.id)

    // Apply new balance effect
    if (!err && isExecuted && bankAccountId) {
      const delta = type === 'income' ? amt : -amt
      const { data: acct } = await supabase.from('bank_accounts').select('balance').eq('id', bankAccountId).single()
      if (acct) {
        const { error: applyErr } = await supabase.from('bank_accounts').update({ balance: acct.balance + delta }).eq('id', bankAccountId)
        if (applyErr) failedAccountIds.add(bankAccountId)
      } else {
        failedAccountIds.add(bankAccountId)
      }
    }

    setLoading(false)
    if (err) {
      setError(
        reversed
          ? `No se pudo guardar el cambio, pero el saldo de ${accountName(transaction.bank_account_id)} ya se ajustó. Revisa ese saldo en Cuentas antes de intentar de nuevo.`
          : 'No se pudo guardar el cambio. Intenta de nuevo.'
      )
      return
    }

    if (failedAccountIds.size > 0) {
      const names = [...failedAccountIds].map(accountName)
      setBalanceNotice(
        names.length > 1
          ? `No se pudieron actualizar los saldos de ${names.join(' y ')}. Revísalos en Cuentas.`
          : `No se pudo actualizar el saldo de ${names[0]}. Revísalo en Cuentas.`
      )
      return
    }

    finish()
  }

  return (
    <Modal
      title="Editar movimiento"
      onClose={balanceNotice ? finish : onClose}
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
              Guardar cambios
            </Button>
          </>
        )
      }
    >
      {balanceNotice ? (
        <Alert tone="warning" title="El cambio se guardó">{balanceNotice}</Alert>
      ) : (
        <div className="space-y-4">
          <TransactionFormFields
            {...fieldProps}
            envelopes={envelopes}
            bankAccounts={bankAccounts}
            periodDate={periodDate}
          />
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  )
}
