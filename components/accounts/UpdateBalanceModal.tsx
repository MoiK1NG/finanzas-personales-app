'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { formatCOP } from '@/lib/utils'
import type { BankAccount } from '@/types/database'
import { X } from 'lucide-react'

interface UpdateBalanceModalProps {
  account: BankAccount
  onSuccess: () => void
  onClose: () => void
}

export default function UpdateBalanceModal({ account, onSuccess, onClose }: UpdateBalanceModalProps) {
  const [balance, setBalance] = useState(account.balance.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const diff = parseFloat(balance || '0') - account.balance

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const bal = parseFloat(balance.replace(/\./g, '').replace(',', '.'))
    if (isNaN(bal)) { setError('Ingresa un valor válido'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('bank_accounts')
      .update({ balance: bal })
      .eq('id', account.id)

    setLoading(false)
    if (err) { setError('Error al actualizar'); return }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Actualizar saldo</h2>
            <p className="text-sm text-gray-500">{account.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm">
            <span className="text-gray-500">Saldo anterior</span>
            <span className="font-semibold text-gray-700">{formatCOP(account.balance)}</span>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Nuevo saldo (lo que ves en tu app del banco)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
              <input
                type="number"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                step="1"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </div>

          {balance && !isNaN(parseFloat(balance)) && (
            <div className={`text-sm text-center font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diff >= 0 ? '+' : ''}{formatCOP(diff)} respecto al saldo anterior
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" loading={loading} className="flex-1">Guardar</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
