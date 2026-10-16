'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoneyInput, parseMoneyInput } from '@/lib/utils'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Money from '@/components/ui/Money'
import MoneyInput from '@/components/ui/MoneyInput'
import type { BankAccount } from '@/types/database'

interface UpdateBalanceModalProps {
  account: BankAccount
  onSuccess: () => void
  onClose: () => void
}

export default function UpdateBalanceModal({ account, onSuccess, onClose }: UpdateBalanceModalProps) {
  const [balance, setBalance] = useState(formatMoneyInput(account.balance, true))
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // One parser for both the preview and the value that is saved.
  const hasValue = /\d/.test(balance)
  const diff = hasValue ? parseMoneyInput(balance) - account.balance : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!hasValue) { setFieldError('Ingresa un valor válido'); return }
    const bal = parseMoneyInput(balance)

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('bank_accounts')
      .update({ balance: bal })
      .eq('id', account.id)

    setLoading(false)
    if (err) { setError('No se pudo actualizar el saldo. Intenta de nuevo.'); return }
    onSuccess()
    onClose()
  }

  return (
    <Modal
      size="sm"
      title="Actualizar saldo"
      description={account.name}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1 sm:flex-none">
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-fg">
          <span className="text-fg-subtle">Saldo anterior</span>
          <Money value={account.balance} variant="balance" className="font-semibold" />
        </div>

        <MoneyInput
          size="lg"
          label="Nuevo saldo"
          hint="El que ves en la app de tu banco."
          value={balance}
          onValueChange={v => { setBalance(v); setFieldError(null) }}
          allowNegative
          error={fieldError ?? undefined}
          autoFocus
        />

        {hasValue && diff !== 0 && (
          <p className="text-center text-sm font-medium text-fg-muted">
            <Money value={diff} variant={diff > 0 ? 'income' : 'expense'} className="font-semibold" />{' '}
            respecto al saldo anterior
          </p>
        )}

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
