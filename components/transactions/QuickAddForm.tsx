'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPeriodDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { Envelope, BudgetPeriod } from '@/types/database'
import { PlusCircle, X } from 'lucide-react'

interface QuickAddFormProps {
  envelopes: Envelope[]
  budgetPeriod: BudgetPeriod
  onSuccess: () => void
}

const INITIAL: {
  type: 'income' | 'expense'
  amount: string
  description: string
  envelope_id: string
  transaction_date: string
  is_executed: boolean
} = {
  type: 'expense',
  amount: '',
  description: '',
  envelope_id: '',
  transaction_date: new Date().toISOString().split('T')[0],
  is_executed: true,
}

export default function QuickAddForm({ envelopes, budgetPeriod, onSuccess }: QuickAddFormProps) {
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))
  const typeOptions = [
    { value: 'expense', label: 'Gasto' },
    { value: 'income', label: 'Ingreso' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = parseFloat(form.amount.replace(/\./g, '').replace(',', '.'))
    if (!amount || amount <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    if (!form.description.trim()) {
      setError('Agrega una descripción')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: err } = await supabase.from('transactions').insert({
      user_id: user!.id,
      budget_period_id: budgetPeriod.id,
      envelope_id: form.envelope_id || null,
      type: form.type,
      amount,
      description: form.description.trim(),
      transaction_date: form.transaction_date,
      is_executed: form.is_executed,
    })

    setLoading(false)

    if (err) {
      setError('Error al guardar. Intenta de nuevo.')
      return
    }

    setForm(INITIAL)
    setOpen(false)
    onSuccess()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        Nuevo movimiento
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Nuevo movimiento</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                form.type === t
                  ? t === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'expense' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        <Input
          label="Monto (COP)"
          prefix="$"
          type="number"
          placeholder="0"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          min="0"
          step="100"
        />

        <Input
          label="Descripción"
          placeholder="Ej: Mercado, Netflix, Arriendo..."
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />

        <Select
          label="Bolsillo"
          options={envelopeOptions}
          placeholder="Sin bolsillo"
          value={form.envelope_id}
          onChange={e => setForm(f => ({ ...f, envelope_id: e.target.value }))}
        />

        <Input
          label="Fecha"
          type="date"
          value={form.transaction_date}
          onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
        />

        {/* Executed toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_executed}
            onChange={e => setForm(f => ({ ...f, is_executed: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Movimiento ejecutado (ya ocurrió)</span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} className="flex-1">
            Guardar
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
