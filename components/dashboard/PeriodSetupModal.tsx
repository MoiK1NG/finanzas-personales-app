'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatPeriodLabel } from '@/lib/utils'
import { X } from 'lucide-react'
import type { BudgetPeriod } from '@/types/database'

interface PeriodSetupModalProps {
  period: BudgetPeriod | null
  periodDate: string
  userId: string
  onSuccess: () => void
  onClose: () => void
}

export default function PeriodSetupModal({
  period,
  periodDate,
  userId,
  onSuccess,
  onClose,
}: PeriodSetupModalProps) {
  const [projectedIncome, setProjectedIncome] = useState(
    period?.projected_income?.toString() ?? ''
  )
  const [notes, setNotes] = useState(period?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const income = parseFloat(projectedIncome.replace(/\./g, '').replace(',', '.'))
    if (!income || income <= 0) { setError('Ingresa un ingreso proyectado válido'); return }

    setLoading(true)
    const supabase = createClient()

    if (period) {
      const { error: err } = await supabase
        .from('budget_periods')
        .update({ projected_income: income, notes: notes || null })
        .eq('id', period.id)
      if (err) { setError('Error al actualizar'); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('budget_periods').insert({
        user_id: userId,
        period_date: periodDate,
        projected_income: income,
        notes: notes || null,
      })
      if (err) { setError('Error al crear el período'); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {period ? 'Actualizar período' : 'Configurar período'}
            </h2>
            <p className="text-sm text-gray-500 capitalize">{formatPeriodLabel(periodDate)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Ingreso proyectado del mes (COP)"
            prefix="$"
            type="number"
            placeholder="0"
            value={projectedIncome}
            onChange={e => setProjectedIncome(e.target.value)}
            min="0"
            step="1"
          />
          <p className="text-xs text-gray-500 -mt-2">
            Lo que esperas recibir este mes (sueldo, freelance, etc.)
          </p>

          <Input
            label="Notas (opcional)"
            placeholder="Mes especial, aguinaldo..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 El saldo real ahora se calcula automáticamente sumando tus cuentas bancarias en <strong>Cuentas</strong>.
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={loading} className="flex-1">
              {period ? 'Actualizar' : 'Crear período'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
