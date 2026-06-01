'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { BankAccount, AccountType } from '@/types/database'
import { X } from 'lucide-react'

const COLORS = [
  '#e53e3e', // Davivienda red
  '#6366f1', // Indigo
  '#8b5cf6', // Purple / Nu
  '#22c55e', // Nequi green
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#ec4899', // Pink
  '#64748b', // Slate
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
  const [balance, setBalance] = useState(account?.balance?.toString() ?? '')
  const [color, setColor] = useState(account?.color ?? '#6366f1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyPreset(preset: typeof PRESET_ACCOUNTS[0]) {
    setName(preset.name)
    setColor(preset.color)
    setAccountType(preset.account_type as AccountType)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('El nombre es obligatorio'); return }

    const bal = parseFloat(balance.replace(/\./g, '').replace(',', '.')) || 0
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (account) {
      const { error: err } = await supabase
        .from('bank_accounts')
        .update({ name: name.trim(), account_type: accountType, balance: bal, color })
        .eq('id', account.id)
      if (err) { setError('Error al actualizar'); setLoading(false); return }
    } else {
      const { error: err } = await supabase
        .from('bank_accounts')
        .insert({ user_id: user!.id, name: name.trim(), account_type: accountType, balance: bal, color })
      if (err) { setError('Error al crear cuenta'); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            {account ? 'Editar cuenta' : 'Nueva cuenta'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Presets (only on create) */}
          {!account && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Acceso rápido</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_ACCOUNTS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 hover:border-gray-400 transition-colors"
                    style={{ borderColor: name === p.name ? p.color : undefined, color: name === p.name ? p.color : undefined }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Nombre de la cuenta"
            placeholder="Ej: Davivienda, Nu, Nequi..."
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <Select
            label="Tipo de cuenta"
            options={ACCOUNT_TYPE_OPTIONS}
            value={accountType}
            onChange={e => setAccountType(e.target.value as AccountType)}
          />

          <Input
            label={account ? 'Saldo actual (COP)' : 'Saldo inicial (COP)'}
            prefix="$"
            type="number"
            placeholder="0"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            min="0"
            step="1000"
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={loading} className="flex-1">
              {account ? 'Guardar cambios' : 'Crear cuenta'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
