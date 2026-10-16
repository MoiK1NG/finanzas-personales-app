'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import MoneyInput from '@/components/ui/MoneyInput'
import Alert from '@/components/ui/Alert'
import { cn, focusRing, formatMoneyInput, formatPeriodLabel, parseMoneyInput } from '@/lib/utils'
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
    period?.projected_income != null ? formatMoneyInput(period.projected_income) : ''
  )
  // Seed of the opening balance field, so an untouched field is not written back (rounding).
  const [initialOpening] = useState(
    period?.opening_balance != null ? formatMoneyInput(period.opening_balance, true) : ''
  )
  const [openingBalance, setOpeningBalance] = useState(initialOpening)
  const [notes, setNotes] = useState(period?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [incomeError, setIncomeError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIncomeError(null)
    const income = parseMoneyInput(projectedIncome)
    if (!income || income <= 0) { setIncomeError('Ingresa un ingreso proyectado válido'); return }

    setLoading(true)
    const supabase = createClient()

    if (period) {
      const update: { projected_income: number; notes: string | null; opening_balance?: number | null } = {
        projected_income: income,
        notes: notes || null,
      }
      if (openingBalance !== initialOpening) {
        // Empty (or a lone minus sign) leaves it unset.
        update.opening_balance = /\d/.test(openingBalance) ? parseMoneyInput(openingBalance) : null
      }
      const { error: err } = await supabase
        .from('budget_periods')
        .update(update)
        .eq('id', period.id)
      if (err) { setError('No se pudieron guardar los cambios. Intenta de nuevo.'); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('budget_periods').insert({
        user_id: userId,
        period_date: periodDate,
        projected_income: income,
        notes: notes || null,
      })
      if (err) { setError('No se pudo configurar el mes. Intenta de nuevo.'); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={period ? 'Editar mes' : 'Configurar mes'}
      description={<span className="capitalize">{formatPeriodLabel(periodDate)}</span>}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1 sm:flex-none">
            {period ? 'Guardar cambios' : 'Configurar mes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyInput
          label="Ingreso proyectado del mes"
          size="lg"
          value={projectedIncome}
          onValueChange={value => { setProjectedIncome(value); setIncomeError(null) }}
          hint="Lo que esperas recibir este mes (sueldo, freelance, etc.)"
          error={incomeError ?? undefined}
          autoFocus
        />

        {period && (
          <MoneyInput
            label="Saldo de apertura"
            value={openingBalance}
            onValueChange={setOpeningBalance}
            allowNegative
            placeholder="Sin fijar"
            hint="Lo que tenías en tus cuentas al empezar el mes."
          />
        )}

        <Input
          label="Notas (opcional)"
          placeholder="Mes especial, prima…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <p className="flex gap-2 text-xs text-fg-subtle">
          <Info className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
          <span>
            Tu saldo en cuentas es la suma de tus cuentas. Lo actualizas en{' '}
            <Link
              href="/cuentas"
              className={cn('rounded-sm font-medium text-accent underline underline-offset-2', focusRing)}
            >
              Cuentas
            </Link>
            .
          </span>
        </p>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
