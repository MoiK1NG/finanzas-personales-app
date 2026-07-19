'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { Envelope, BudgetPeriod, BankAccount } from '@/types/database'
import { PlusCircle, X } from 'lucide-react'

function fmtInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(parseInt(digits))
}

interface QuickAddFormProps {
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  budgetPeriod: BudgetPeriod
  onSuccess: () => void
}

const INITIAL: {
  type: 'income' | 'expense'
  amount: string
  description: string
  envelope_id: string
  bank_account_id: string
  transaction_date: string
  is_executed: boolean
} = {
  type: 'expense',
  amount: '',
  description: '',
  envelope_id: '',
  bank_account_id: '',
  transaction_date: new Date().toISOString().split('T')[0],
  is_executed: true,
}

export default function QuickAddForm({ envelopes, bankAccounts, budgetPeriod, onSuccess }: QuickAddFormProps) {
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))
  const accountOptions = bankAccounts.map(a => ({ value: a.id, label: a.name }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = parseFloat(form.amount.replace(/\./g, ''))
    if (!amount || amount <= 0) { setError('Ingresa un monto válido'); return }
    if (!form.description.trim()) { setError('Agrega una descripción'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: err } = await supabase.from('transactions').insert({
      user_id: user!.id,
      budget_period_id: budgetPeriod.id,
      envelope_id: form.envelope_id || null,
      bank_account_id: form.bank_account_id || null,
      type: form.type,
      amount,
      description: form.description.trim(),
      transaction_date: form.transaction_date,
      is_executed: form.is_executed,
    })

    if (!err && form.is_executed && form.bank_account_id) {
      const delta = form.type === 'income' ? amount : -amount
      const { data: acct } = await supabase.from('bank_accounts').select('balance').eq('id', form.bank_account_id).single()
      if (acct) {
        await supabase.from('bank_accounts').update({ balance: acct.balance + delta }).eq('id', form.bank_account_id)
      }
    }

    setLoading(false)
    if (err) { setError('Error al guardar. Intenta de nuevo.'); return }

    setForm(INITIAL)
    setOpen(false)
    onSuccess()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto justify-center"
      >
        <PlusCircle className="h-4 w-4" />
        Nuevo movimiento
      </button>
    )
  }

  return (
    <>
      {/* Mobile: full-screen bottom sheet */}
      <div className="fixed inset-0 z-50 sm:hidden">
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
          <FormContent
            form={form} setForm={setForm} loading={loading} error={error}
            envelopeOptions={envelopeOptions} accountOptions={accountOptions}
            onSubmit={handleSubmit} onClose={() => setOpen(false)}
          />
        </div>
      </div>

      {/* Desktop: inline card */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-lg p-5">
        <FormContent
          form={form} setForm={setForm} loading={loading} error={error}
          envelopeOptions={envelopeOptions} accountOptions={accountOptions}
          onSubmit={handleSubmit} onClose={() => setOpen(false)}
        />
      </div>
    </>
  )
}

// ── Shared form body ──────────────────────────────────────────────────────────
function FormContent({
  form, setForm, loading, error, envelopeOptions, accountOptions, onSubmit, onClose,
}: {
  form: typeof INITIAL
  setForm: React.Dispatch<React.SetStateAction<typeof INITIAL>>
  loading: boolean
  error: string | null
  envelopeOptions: { value: string; label: string }[]
  accountOptions: { value: string; label: string }[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">Nuevo movimiento</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                form.type === t
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
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: fmtInput(e.target.value) }))}
              className="w-full pl-7 pr-3 py-3 text-xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
          <input
            type="text"
            placeholder="Mercado, Netflix, Arriendo..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <Select
          label="Categoría"
          options={envelopeOptions}
          placeholder="Sin categoría"
          value={form.envelope_id}
          onChange={e => setForm(f => ({ ...f, envelope_id: e.target.value }))}
        />

        <Select
          label="Cuenta"
          options={accountOptions}
          placeholder="Sin cuenta"
          value={form.bank_account_id}
          onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}
        />

        <Input
          label="Fecha"
          type="date"
          value={form.transaction_date}
          onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_executed}
            onChange={e => setForm(f => ({ ...f, is_executed: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Ya ejecutado (ya ocurrió)</span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} className="flex-1" size="lg">
            Guardar
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} size="lg">
            Cancelar
          </Button>
        </div>
      </form>
    </>
  )
}
