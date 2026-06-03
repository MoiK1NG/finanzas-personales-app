'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { Envelope, BudgetPeriod } from '@/types/database'
import { X } from 'lucide-react'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

interface EnvelopeFormProps {
  envelope?: Envelope
  period: BudgetPeriod
  existingBudget?: number
  projectedIncome: number
  onSuccess: () => void
  onClose: () => void
}

export default function EnvelopeForm({
  envelope,
  period,
  existingBudget,
  projectedIncome,
  onSuccess,
  onClose,
}: EnvelopeFormProps) {
  const [name, setName] = useState(envelope?.name ?? '')
  const [color, setColor] = useState(envelope?.color ?? '#6366f1')
  const [isSavings, setIsSavings] = useState(envelope?.is_savings ?? false)
  const [projectedAmount, setProjectedAmount] = useState(existingBudget?.toString() ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pct = projectedIncome > 0 && projectedAmount
    ? ((parseFloat(projectedAmount) / projectedIncome) * 100).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('El nombre es obligatorio'); return }

    const amount = parseFloat(projectedAmount) || 0

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (envelope) {
      // Update envelope
      const { error: e1 } = await supabase
        .from('envelopes')
        .update({ name: name.trim(), color, is_savings: isSavings })
        .eq('id', envelope.id)

      if (e1) { setError('Error al actualizar'); setLoading(false); return }

      // Upsert budget
      const { error: e2 } = await supabase
        .from('envelope_budgets')
        .upsert(
          { envelope_id: envelope.id, budget_period_id: period.id, projected_amount: amount },
          { onConflict: 'envelope_id,budget_period_id' }
        )

      if (e2) { setError('Error al guardar presupuesto'); setLoading(false); return }
    } else {
      // Create envelope
      const { data: newEnv, error: e1 } = await supabase
        .from('envelopes')
        .insert({ user_id: user!.id, name: name.trim(), color, is_savings: isSavings })
        .select()
        .single()

      if (e1 || !newEnv) { setError('Error al crear bolsillo'); setLoading(false); return }

      // Create budget for current period
      await supabase.from('envelope_budgets').insert({
        envelope_id: newEnv.id,
        budget_period_id: period.id,
        projected_amount: amount,
      })
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
            {envelope ? 'Editar bolsillo' : 'Nuevo bolsillo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Nombre del bolsillo"
            placeholder="Ej: Casa, Ahorros, Mercado..."
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Color</label>
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

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Presupuesto del mes (COP)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                placeholder="0"
                value={projectedAmount}
                onChange={e => setProjectedAmount(e.target.value)}
                min="0"
                step="1"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {pct && (
              <p className="text-xs text-gray-500 mt-1">
                = {pct}% del ingreso proyectado
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSavings}
              onChange={e => setIsSavings(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Marcar como bolsillo de ahorro</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={loading} className="flex-1">
              {envelope ? 'Guardar cambios' : 'Crear bolsillo'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
