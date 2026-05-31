'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatPeriodLabel, formatCOP } from '@/lib/utils'
import { X, DollarSign } from 'lucide-react'
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
  const [realBankBalance, setRealBankBalance] = useState(
    period?.real_bank_balance?.toString() ?? ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const income = parseFloat(projectedIncome.replace(/\./g, ''))
    const balance = parseFloat(realBankBalance.replace(/\./g, ''))

    if (!income || income <= 0) {
      setError('Ingresa un ingreso proyectado válido')
      return
    }

    setLoading(true)
    const supabase = createClient()

    if (period) {
      const { error: err } = await supabase
        .from('budget_periods')
        .update({
          projected_income: income,
          real_bank_balance: balance || 0,
        })
        .eq('id', period.id)

      if (err) { setError('Error al actualizar'); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('budget_periods').insert({
        user_id: userId,
        period_date: periodDate,
        projected_income: income,
        real_bank_balance: balance || 0,
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
            label="Ingreso proyectado del mes"
            prefix="$"
            type="number"
            placeholder="0"
            value={projectedIncome}
            onChange={e => setProjectedIncome(e.target.value)}
            min="0"
            step="1000"
          />

          <Input
            label="Saldo actual en tu banco"
            prefix="$"
            type="number"
            placeholder="0"
            value={realBankBalance}
            onChange={e => setRealBankBalance(e.target.value)}
            min="0"
            step="1000"
          />
          <p className="text-xs text-gray-500 -mt-2">
            Actualiza este campo cuando consultes tu saldo en el banco.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading} className="flex-1">
              {period ? 'Actualizar' : 'Crear período'}
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
