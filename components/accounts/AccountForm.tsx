'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, focusRing, formatMoneyInput, parseMoneyInput } from '@/lib/utils'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import Select from '@/components/ui/Select'
import type { BankAccount, AccountType } from '@/types/database'

const COLORS = [
  { value: '#e53e3e', name: 'Rojo' },          // Davivienda
  { value: '#6366f1', name: 'Índigo' },
  { value: '#8b5cf6', name: 'Morado' },        // Nu
  { value: '#22c55e', name: 'Verde' },         // Nequi
  { value: '#3b82f6', name: 'Azul' },
  { value: '#f97316', name: 'Naranja' },
  { value: '#14b8a6', name: 'Verde azulado' },
  { value: '#eab308', name: 'Amarillo' },      // Bancolombia
  { value: '#ec4899', name: 'Rosado' },
  { value: '#64748b', name: 'Gris' },          // Efectivo
]

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'digital',  label: 'Billetera digital (Nequi, Nu...)' },
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings',  label: 'Cuenta de ahorros' },
  { value: 'cash',     label: 'Efectivo' },
]

const PRESET_ACCOUNTS = [
  { name: 'Davivienda', color: '#e53e3e', account_type: 'checking' },
  { name: 'Nu',         color: '#8b5cf6', account_type: 'digital' },
  { name: 'Nequi',      color: '#22c55e', account_type: 'digital' },
  { name: 'Bancolombia',color: '#eab308', account_type: 'savings' },
  { name: 'Efectivo',   color: '#64748b', account_type: 'cash' },
]

interface AccountFormProps {
  account?: BankAccount
  onSuccess: () => void
  onClose: () => void
}

export default function AccountForm({ account, onSuccess, onClose }: AccountFormProps) {
  const [name, setName] = useState(account?.name ?? '')
  const [accountType, setAccountType] = useState<AccountType>(account?.account_type ?? 'digital')
  const [balance, setBalance] = useState(account ? formatMoneyInput(account.balance, true) : '')
  const [color, setColor] = useState(account?.color ?? '#6366f1')
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function applyPreset(preset: typeof PRESET_ACCOUNTS[0]) {
    setName(preset.name)
    setNameError(null)
    setColor(preset.color)
    setAccountType(preset.account_type as AccountType)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setNameError('El nombre es obligatorio'); return }

    // Empty balance keeps the previous behaviour: it is saved as 0.
    const bal = parseMoneyInput(balance)
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (account) {
      const { error: err } = await supabase
        .from('bank_accounts')
        .update({ name: name.trim(), account_type: accountType, balance: bal, color })
        .eq('id', account.id)
      if (err) { setError('No se pudo guardar la cuenta. Intenta de nuevo.'); setLoading(false); return }
    } else {
      const { error: err } = await supabase
        .from('bank_accounts')
        .insert({ user_id: user!.id, name: name.trim(), account_type: accountType, balance: bal, color })
      if (err) { setError('No se pudo crear la cuenta. Intenta de nuevo.'); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1 sm:flex-none">
            {account ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Presets (only on create) */}
        {!account && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg-muted">Acceso rápido</legend>
            <div className="flex flex-wrap gap-2">
              {PRESET_ACCOUNTS.map(p => {
                const selected = name === p.name
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    aria-pressed={selected}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                      focusRing,
                      selected
                        ? 'border-accent bg-primary-soft text-accent'
                        : 'border-border-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                      aria-hidden="true"
                    />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <Input
          label="Nombre de la cuenta"
          placeholder="Ej: Davivienda, Nu, Nequi..."
          value={name}
          onChange={e => { setName(e.target.value); setNameError(null) }}
          error={nameError ?? undefined}
          autoComplete="off"
        />

        <Select
          label="Tipo de cuenta"
          options={ACCOUNT_TYPE_OPTIONS}
          value={accountType}
          onChange={e => setAccountType(e.target.value as AccountType)}
        />

        <MoneyInput
          label={account ? 'Saldo actual' : 'Saldo inicial'}
          value={balance}
          onValueChange={setBalance}
          allowNegative
          hint="Si la cuenta está en negativo, escribe el signo menos (-)."
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-muted">Color</legend>
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map(c => {
              const selected = color === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={`Color ${c.name}`}
                  aria-pressed={selected}
                  title={c.name}
                  className={cn(
                    'h-9 w-9 rounded-full transition-shadow',
                    focusRing,
                    selected && 'ring-2 ring-fg ring-offset-2 ring-offset-surface'
                  )}
                  style={{ backgroundColor: c.value }}
                />
              )
            })}
          </div>
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
