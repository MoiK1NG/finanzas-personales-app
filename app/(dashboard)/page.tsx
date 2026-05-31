'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPeriodDate, formatCOP, formatPeriodLabel } from '@/lib/utils'
import Header from '@/components/layout/Header'
import KPICard from '@/components/dashboard/KPICard'
import EnvelopeProgressCard from '@/components/dashboard/EnvelopeProgressCard'
import RecentTransactions from '@/components/dashboard/RecentTransactions'
import BalanceDiscrepancy from '@/components/dashboard/BalanceDiscrepancy'
import PeriodSetupModal from '@/components/dashboard/PeriodSetupModal'
import QuickAddForm from '@/components/transactions/QuickAddForm'
import type {
  BudgetPeriod,
  Envelope,
  Transaction,
  EnvelopeSummary,
  PeriodSummary,
  Profile,
} from '@/types/database'
import { Settings2 } from 'lucide-react'

export default function DashboardPage() {
  const [periodDate, setPeriodDate] = useState(getPeriodDate())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [envelopeSummary, setEnvelopeSummary] = useState<EnvelopeSummary[]>([])
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null)
  const [recentTx, setRecentTx] = useState<(Transaction & { envelope?: Envelope | null })[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(prof)

    // Budget period
    const { data: per } = await supabase
      .from('budget_periods')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_date', periodDate)
      .single()
    setPeriod(per)

    if (!per) {
      setLoading(false)
      setShowSetup(true)
      return
    }

    // Envelopes
    const { data: envs } = await supabase
      .from('envelopes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')
    setEnvelopes(envs ?? [])

    // Envelope summary view
    const { data: envSum } = await supabase
      .from('v_envelope_summary')
      .select('*')
      .eq('budget_period_id', per.id)
      .eq('user_id', user.id)
    setEnvelopeSummary(envSum ?? [])

    // Period summary view
    const { data: perSum } = await supabase
      .from('v_period_summary')
      .select('*')
      .eq('budget_period_id', per.id)
      .eq('user_id', user.id)
      .single()
    setPeriodSummary(perSum)

    // Recent transactions (last 8)
    const { data: txs } = await supabase
      .from('transactions')
      .select('*, envelope:envelopes(*)')
      .eq('budget_period_id', per.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8)
    setRecentTx(txs ?? [])

    setLoading(false)
  }, [periodDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const ps = periodSummary

  return (
    <>
      <Header
        periodDate={periodDate}
        onPeriodChange={setPeriodDate}
        userName={profile?.full_name}
      />

      <main className="p-6 space-y-6 max-w-7xl">
        {/* Period setup banner */}
        {!period && !loading && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-800">
                Configura el período de {formatPeriodLabel(periodDate)}
              </p>
              <p className="text-xs text-indigo-600 mt-0.5">
                Define tu ingreso proyectado y saldo bancario para comenzar.
              </p>
            </div>
            <button
              onClick={() => setShowSetup(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Configurar
            </button>
          </div>
        )}

        {period && (
          <>
            {/* KPIs row */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Resumen del mes
                </h2>
                <button
                  onClick={() => setShowSetup(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Editar período
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Ingreso proyectado"
                  amount={ps?.projected_income ?? period.projected_income}
                  subtitle="Este mes"
                  highlight
                />
                <KPICard
                  title="Total presupuestado"
                  amount={ps?.total_budgeted ?? 0}
                  subtitle={
                    ps
                      ? `${formatCOP(ps.unassigned_amount)} sin asignar`
                      : undefined
                  }
                  trend={ps && ps.unassigned_amount === 0 ? 'up' : 'neutral'}
                />
                <KPICard
                  title="Gastos ejecutados"
                  amount={ps?.real_expenses_paid ?? 0}
                  subtitle="Movimientos reales"
                  trend="down"
                  amountClassName="text-red-600"
                />
                <KPICard
                  title="Saldo banco"
                  amount={period.real_bank_balance}
                  subtitle="Actualizado manual"
                  trend={period.real_bank_balance >= 0 ? 'up' : 'down'}
                />
              </div>
            </section>

            {/* Discrepancy alert */}
            {ps && (
              <BalanceDiscrepancy
                theoretical={ps.theoretical_balance}
                realBankBalance={period.real_bank_balance}
                realIncomeReceived={ps.real_income_received}
                realExpensesPaid={ps.real_expenses_paid}
              />
            )}

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bolsillos */}
              <section className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Bolsillos
                  </h2>
                  <a href="/bolsillos" className="text-xs text-indigo-600 hover:underline">
                    Administrar
                  </a>
                </div>
                {envelopeSummary.length === 0 ? (
                  <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <p className="text-sm text-gray-400">No hay bolsillos configurados</p>
                    <a href="/bolsillos" className="text-xs text-indigo-600 hover:underline mt-1 block">
                      Crear bolsillos →
                    </a>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {envelopeSummary.map(env => (
                      <EnvelopeProgressCard key={env.envelope_id} envelope={env} />
                    ))}
                  </div>
                )}
              </section>

              {/* Right column */}
              <section className="space-y-4">
                {/* Quick add */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Nuevo movimiento
                  </h2>
                  <QuickAddForm
                    envelopes={envelopes}
                    budgetPeriod={period}
                    onSuccess={loadData}
                  />
                </div>

                {/* Recent transactions */}
                <RecentTransactions transactions={recentTx} />
              </section>
            </div>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        )}
      </main>

      {showSetup && (
        <PeriodSetupModal
          period={period}
          periodDate={periodDate}
          userId={profile?.id ?? ''}
          onSuccess={loadData}
          onClose={() => setShowSetup(false)}
        />
      )}
    </>
  )
}
