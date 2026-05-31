'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPeriodDate, formatCOP, formatPeriodLabel, formatPercent } from '@/lib/utils'
import Header from '@/components/layout/Header'
import EnvelopeForm from '@/components/envelopes/EnvelopeForm'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Envelope, BudgetPeriod, EnvelopeSummary } from '@/types/database'
import { Plus, Pencil, Trash2, PiggyBank, AlertCircle } from 'lucide-react'

export default function BolsillosPage() {
  const [periodDate, setPeriodDate] = useState(getPeriodDate())
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [summaries, setSummaries] = useState<EnvelopeSummary[]>([])
  const [projectedIncome, setProjectedIncome] = useState(0)
  const [totalBudgeted, setTotalBudgeted] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: per } = await supabase
      .from('budget_periods')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_date', periodDate)
      .single()
    setPeriod(per)
    setProjectedIncome(per?.projected_income ?? 0)

    const { data: envs } = await supabase
      .from('envelopes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')
    setEnvelopes(envs ?? [])

    if (per) {
      const { data: sums } = await supabase
        .from('v_envelope_summary')
        .select('*')
        .eq('budget_period_id', per.id)
        .eq('user_id', user.id)
      setSummaries(sums ?? [])
      setTotalBudgeted((sums ?? []).reduce((a, s) => a + s.projected_amount, 0))
    }

    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(envelopeId: string) {
    if (!confirm('¿Archivar este bolsillo? Las transacciones existentes se conservarán.')) return
    const supabase = createClient()
    await supabase.from('envelopes').update({ is_active: false }).eq('id', envelopeId)
    loadData()
  }

  const unassigned = projectedIncome - totalBudgeted

  return (
    <>
      <Header periodDate={periodDate} onPeriodChange={setPeriodDate} />

      <main className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bolsillos</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">
              {formatPeriodLabel(periodDate)}
            </p>
          </div>
          <Button onClick={() => { setEditingEnvelope(null); setShowForm(true) }}>
            <Plus className="h-4 w-4" /> Nuevo bolsillo
          </Button>
        </div>

        {/* Budget allocation summary */}
        {period && (
          <Card className="mb-6">
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <div className="pr-6">
                <p className="text-xs text-gray-500 mb-1">Ingreso proyectado</p>
                <p className="text-xl font-bold text-gray-900">{formatCOP(projectedIncome)}</p>
              </div>
              <div className="px-6">
                <p className="text-xs text-gray-500 mb-1">Total presupuestado</p>
                <p className="text-xl font-bold text-indigo-600">{formatCOP(totalBudgeted)}</p>
              </div>
              <div className="pl-6">
                <p className="text-xs text-gray-500 mb-1">Sin asignar</p>
                <p className={cn('text-xl font-bold', unassigned < 0 ? 'text-red-600' : unassigned === 0 ? 'text-green-600' : 'text-yellow-600')}>
                  {formatCOP(unassigned)}
                </p>
              </div>
            </div>

            {/* Global progress bar */}
            <div className="mt-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                {summaries.map(s => (
                  <div
                    key={s.envelope_id}
                    title={`${s.envelope_name}: ${formatCOP(s.projected_amount)}`}
                    className="h-full transition-all duration-500"
                    style={{
                      width: projectedIncome > 0 ? `${(s.projected_amount / projectedIncome) * 100}%` : '0%',
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {projectedIncome > 0
                  ? `${formatPercent((totalBudgeted / projectedIncome) * 100)} del ingreso asignado`
                  : 'Configura tu ingreso proyectado en el dashboard'
                }
              </p>
            </div>
          </Card>
        )}

        {!period && !loading && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              No hay período configurado para este mes. Ve al{' '}
              <a href="/" className="underline font-medium">Dashboard</a> para crearlo.
            </p>
          </div>
        )}

        {/* Envelope grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : envelopes.length === 0 ? (
          <div className="text-center py-16">
            <PiggyBank className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin bolsillos creados</p>
            <p className="text-sm text-gray-400 mt-1">Crea bolsillos para organizar tu presupuesto</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {envelopes.map(env => {
              const summary = summaries.find(s => s.envelope_id === env.id)
              return (
                <Card key={env.id} className="hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: env.color + '20', color: env.color }}
                      >
                        {env.is_savings ? '🐷' : '💰'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{env.name}</p>
                        {env.is_savings && (
                          <span className="text-xs text-indigo-600 font-medium">Ahorro</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingEnvelope(env); setShowForm(true) }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(env.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Amounts */}
                  {summary ? (
                    <>
                      <div className="space-y-1.5 mb-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Presupuestado</span>
                          <span className="font-semibold">{formatCOP(summary.projected_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ejecutado</span>
                          <span className={cn('font-semibold', summary.executed_amount > summary.projected_amount ? 'text-red-600' : 'text-gray-800')}>
                            {formatCOP(summary.executed_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-gray-100 pt-1.5">
                          <span className="text-gray-500">Disponible</span>
                          <span className={cn('font-bold', summary.available_amount < 0 ? 'text-red-600' : 'text-green-600')}>
                            {formatCOP(summary.available_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            summary.pct_executed > 100 ? 'bg-red-500'
                              : summary.pct_executed >= 80 ? 'bg-yellow-400'
                              : 'bg-green-500'
                          )}
                          style={{ width: `${Math.min(summary.pct_executed, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 text-right">
                        {formatPercent(summary.pct_executed)} ejecutado
                        {projectedIncome > 0 && summary.projected_amount > 0 && (
                          <span className="ml-2 text-gray-300">·</span>
                        )}
                        {projectedIncome > 0 && (
                          <span className="ml-2">
                            {formatPercent((summary.projected_amount / projectedIncome) * 100)} del ingreso
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3">
                      Sin presupuesto este mes
                    </p>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {showForm && period && (
        <EnvelopeForm
          envelope={editingEnvelope ?? undefined}
          period={period}
          existingBudget={
            editingEnvelope
              ? summaries.find(s => s.envelope_id === editingEnvelope.id)?.projected_amount
              : undefined
          }
          projectedIncome={projectedIncome}
          onSuccess={loadData}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  )
}
