'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { Envelope, Transaction } from '@/types/database'
import { X } from 'lucide-react'

interface EditTransactionModalProps {
  transaction: Transaction
  envelopes: Envelope[]
  onSuccess: () => void
  onClose: () => void
}

export default function EditTransactionModal({
  transaction,
  envelopes,
  onSuccess,
  onClose,
}: EditTransactionModalProps) {
  const [type, setType]               = useState<'income' | 'expense'>(
    transaction.type === 'transfer' ? 'expense' : transaction.type
  )
  const [amount, setAmount]           = useState(transaction.amount.toString())
  const [description, setDescription] = useState(transaction.description)
  const [envelopeId, setEnvelopeId]   = useState(transaction.envelope_id ?? '')
  const [date, setDate]               = useState(transaction.transaction_date)
  const [isExecuted, setIsExecuted]   = useState(transaction.is_executed)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Ingresa un monto válido'); return }
    if (!description.trim()) { setError('La descripción es obligatoria'); return }

    setLoading(true)
    const supabase = createClient()

    const { error: err } = await supabase
      .from('transactions')
      .update({
        type,
        amount: amt,
        description: description.trim(),
        envelope_id: envelopeId || null,
        transaction_date: date,
        is_executed: isExecuted,
      })
      .eq('id', transaction.id)

    setLoading(false)
    if (err) { setError('Error al guardar. Intenta de nuevo.'); return }

    onSuccess()
    onClose()
  }

  const content = (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-800">Editar movimiento</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t} type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                type === t
                  ? t === 'expense' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'expense' ? '↓ Gasto' : '↑ Ingreso'}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Monto (COP)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0"
              step="1"
              className="w-full pl-7 pr-3 py-3 text-xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Descripción del movimiento"
          />
        </div>

        {/* Category */}
        <Select
          label="Categoría"
          options={envelopeOptions}
          placeholder="Sin categoría"
          value={envelopeId}
          onChange={e => setEnvelopeId(e.target.value)}
        />

        {/* Date */}
        <Input
          label="Fecha"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        {/* Executed */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isExecuted}
            onChange={e => setIsExecuted(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Ya ejecutado (ya ocurrió)</span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} className="flex-1" size="lg">
            Guardar cambios
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} size="lg">
            Cancelar
          </Button>
        </div>
      </form>
    </>
  )

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div className="fixed inset-0 z-50 sm:hidden">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
          {content}
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div className="fixed inset-0 z-50 hidden sm:flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          {content}
        </div>
      </div>
    </>
  )
}
