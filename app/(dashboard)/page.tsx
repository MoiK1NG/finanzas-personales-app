'use client'

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn, focusRing, formatPeriodLabel } from '@/lib/utils'
import { usePeriod } from '@/hooks/usePeriod'
import Header from '@/components/layout/Header'
import PageHeader from '@/components/ui/PageHeader'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import SegmentedControl from '@/components/ui/SegmentedControl'
import BudgetStatusPill from '@/components/ui/BudgetStatusPill'
import { LoadingState } from '@/components/ui/Spinner'
import KPICard from '@/components/dashboard/KPICard'
import EnvelopeProgressCard from '@/components/dashboard/EnvelopeProgressCard'
import RecentTransactions from '@/components/dashboard/RecentTransactions'
import BalanceDiscrepancy from '@/components/dashboard/BalanceDiscrepancy'
import PeriodSetupModal from '@/components/dashboard/PeriodSetupModal'
import AccountsWidget from '@/components/dashboard/AccountsWidget'
import BudgetTable from '@/components/dashboard/BudgetTable'
import QuickAddForm from '@/components/transactions/QuickAddForm'
import type {
  BudgetPeriod,
  Envelope,
  Transaction,
  EnvelopeSummary,
  PeriodSummary,
  Profile,
  BankAccount,
} from '@/types/database'
import { CalendarPlus, ChevronRight, Landmark, LayoutGrid, Pencil, Plus, Table2, Wallet } from 'lucide-react'

type View = 'cards' | 'table'

/** Categories shown on phones before "Ver las N categorías", so accounts and recent movements stay close. */
const PHONE_CATEGORY_LIMIT = 6

const VIEW_OPTIONS: { value: View; label: ReactNode }[] = [
  {
    value: 'cards',
    label: <><LayoutGrid className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Tarjetas</span></>,
  },
  {
    value: 'table',
    label: <><Table2 className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Tabla</span></>,
  },
]

const sectionLinkClass = cn(
  '-my-2 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors hover:bg-primary-soft',
  focusRing
)

export default function DashboardPage() {
  const [periodDate, setPeriodDate] = usePeriod()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [envelopeSummary, setEnvelopeSummary] = useState<EnvelopeSummary[]>([])
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [recentTx, setRecentTx] = useState<(Transaction & { envelope?: Envelope | null })[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  // Month whose data is on screen. The loader replaces the content only on the first load and
  // when the month changes; a refresh after saving keeps the current content visible.
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const [budgetView, setBudgetView] = useState<View>('cards')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  // Month asked for by the latest load. usePeriod restores the month from the session right after
  // the first render, so two loads can overlap; the older one must not overwrite the selected month.
  const latestPeriodRef = useRef(periodDate)

  const loadData = useCallback(async () => {
    latestPeriodRef.current = periodDate
    const isStale = () => latestPeriodRef.current !== periodDate
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Profile + accounts in parallel
    const [{ data: prof }, { data: accs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    ])
    setProfile(prof)
    setAccounts(accs ?? [])

    // Budget period
    const { data: per } = await supabase
      .from('budget_periods')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_date', periodDate)
      .single()
    if (isStale()) return
    setPeriod(per)

    if (!per) {
      setLoadedPeriod(periodDate)
      setLoading(false)
      return
    }

    // Envelopes, summaries, recent tx in parallel
    const [
      { data: envs },
      { data: envSum },
      { data: perSum },
      { data: txs },
    ] = await Promise.all([
      supabase.from('envelopes').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('v_envelope_summary').select('*').eq('budget_period_id', per.id).eq('user_id', user.id),
      supabase.from('v_period_summary').select('*').eq('budget_period_id', per.id).eq('user_id', user.id).single(),
      supabase.from('transactions').select('*, envelope:envelopes(*)').eq('budget_period_id', per.id)
        .order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(8),
    ])
    if (isStale()) return

    setEnvelopes(envs ?? [])
    setEnvelopeSummary(envSum ?? [])
    setPeriodSummary(perSum)
    setRecentTx(txs ?? [])
    setLoadedPeriod(periodDate)
    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])

  const ps = periodSummary
  const totalBankBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const totalBudgeted = ps?.total_budgeted ?? 0
  const projectedIncome = ps?.projected_income ?? period?.projected_income ?? 0
  // Right after configuring a month, loadData sets the new period before its figures arrive; until
  // then the summary on screen belongs to another month, so keep the loader instead of showing it.
  const periodDataPending = period !== null && ps?.budget_period_id !== period.id
  const showLoader = loading && (loadedPeriod !== periodDate || periodDataPending)
  const categoriesHiddenOnPhone = showAllCategories
    ? 0
    : Math.max(0, envelopeSummary.length - PHONE_CATEGORY_LIMIT)

  const balanceCard = (
    <KPICard
      variant="hero"
      title="Saldo en cuentas"
      amount={totalBankBalance}
      subtitle={`${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}`}
      icon={Landmark}
      className="col-span-2 lg:col-span-3"
    />
  )

  return (
    <>
      <Header
        periodDate={periodDate}
        onPeriodChange={setPeriodDate}
        userName={profile?.full_name}
      />

      <main
        aria-busy={loading || undefined}
        className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 pt-5 sm:space-y-6 sm:px-6 sm:pt-6 lg:pb-6"
      >
        <PageHeader
          title="Inicio"
          className="max-lg:sr-only"
          actions={period && !showLoader ? (
            <div className="hidden lg:block">
              <QuickAddForm
                envelopes={envelopes}
                bankAccounts={accounts}
                budgetPeriod={period}
                onSuccess={loadData}
              />
            </div>
          ) : undefined}
        />

        {showLoader ? (
          <LoadingState className="py-20" label="Cargando tu mes" />
        ) : !period ? (
          loadedPeriod !== null && (
            <>
              <section aria-label="Resumen del mes" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {balanceCard}
              </section>

              <Alert
                tone="info"
                icon={CalendarPlus}
                title="Este mes aún no tiene presupuesto"
                action={
                  <Button className="w-full sm:w-auto" onClick={() => setShowSetup(true)}>
                    Configurar mes
                  </Button>
                }
              >
                Define tu ingreso proyectado de{' '}
                <span className="capitalize">{formatPeriodLabel(periodDate)}</span> para repartirlo en categorías.
              </Alert>
            </>
          )
        ) : (
          <>
            {/* Summary: what I have, then how the month is going */}
            <section aria-labelledby="inicio-resumen" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <h2 id="inicio-resumen" className="sr-only">Resumen del mes</h2>
              {balanceCard}
              <KPICard
                title="Presupuestado"
                amount={totalBudgeted}
                subtitle={ps ? <BudgetStatusPill unassigned={ps.unassigned_amount} /> : undefined}
                className="col-span-2 lg:col-span-1"
              />
              <KPICard
                title="Gastado"
                amount={ps?.real_expenses_paid ?? 0}
                subtitle="Movimientos ejecutados"
              />
              <KPICard
                title="Ingreso proyectado"
                amount={projectedIncome}
                subtitle="Plan del mes"
                action={
                  <IconButton size="sm" tone="primary" label="Editar ingreso proyectado" onClick={() => setShowSetup(true)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                }
              />
            </section>

            {/* Main grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              {/* Left: budget by category (cards or table) */}
              <section aria-labelledby="inicio-presupuesto" className="min-w-0 space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="inicio-presupuesto" className="text-base font-semibold text-fg">
                    Presupuesto del mes
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Flush right when it is the last control (the view toggle is hidden on phones) */}
                    <Link
                      href="/bolsillos"
                      className={cn(sectionLinkClass, envelopeSummary.length > 0 ? 'max-sm:-mr-2' : '-mr-2')}
                    >
                      Ver presupuesto <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    {envelopeSummary.length > 0 && (
                      <SegmentedControl
                        label="Vista del presupuesto"
                        options={VIEW_OPTIONS}
                        value={budgetView}
                        onChange={setBudgetView}
                        className="hidden sm:inline-flex"
                      />
                    )}
                  </div>
                </div>

                {envelopeSummary.length === 0 ? (
                  <Card padding="none">
                    <EmptyState
                      icon={Wallet}
                      title="Este mes aún no tiene categorías"
                      description="Crea tus categorías o asígnales un monto en Presupuesto."
                      action={
                        <Link
                          href="/bolsillos"
                          className={cn(
                            'inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-sm transition-colors hover:bg-primary-hover',
                            focusRing
                          )}
                        >
                          Ir a Presupuesto
                        </Link>
                      }
                    />
                  </Card>
                ) : (
                  <>
                    {/* Cards: always on phones (the table needs more width), and on larger screens in card view */}
                    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', budgetView === 'table' && 'sm:hidden')}>
                      {envelopeSummary.map((env, i) => (
                        <EnvelopeProgressCard
                          key={env.envelope_id}
                          envelope={env}
                          className={cn(!showAllCategories && i >= PHONE_CATEGORY_LIMIT && 'max-sm:hidden')}
                        />
                      ))}
                    </div>
                    {categoriesHiddenOnPhone > 0 && (
                      <Button
                        variant="secondary"
                        className="w-full sm:hidden"
                        onClick={() => setShowAllCategories(true)}
                      >
                        Ver las {envelopeSummary.length} categorías
                      </Button>
                    )}
                    {budgetView === 'table' && (
                      <div className="hidden sm:block">
                        <BudgetTable
                          summaries={envelopeSummary}
                          projectedIncome={projectedIncome}
                          budgetPeriodId={period.id}
                          onRefresh={loadData}
                        />
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Right column */}
              <section aria-labelledby="inicio-cuentas" className="min-w-0 space-y-4 sm:space-y-5">
                <h2 id="inicio-cuentas" className="sr-only">Cuentas y movimientos</h2>
                <AccountsWidget accounts={accounts} totalBalance={totalBankBalance} />
                <RecentTransactions
                  transactions={recentTx}
                  envelopes={envelopes}
                  bankAccounts={accounts}
                  onRefresh={loadData}
                />
                {ps && (
                  <BalanceDiscrepancy
                    realBankBalance={totalBankBalance}
                    realIncomeReceived={ps.real_income_received}
                    realExpensesPaid={ps.real_expenses_paid}
                  />
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {/* Quick add on phones and tablets: floating button above the bottom nav */}
      {period && !showLoader && (
        <>
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Nuevo movimiento"
            title="Nuevo movimiento"
            className={cn(
              'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition-colors hover:bg-primary-hover lg:hidden',
              focusRing
            )}
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
          <QuickAddForm
            envelopes={envelopes}
            bankAccounts={accounts}
            budgetPeriod={period}
            onSuccess={loadData}
            open={quickAddOpen}
            onOpenChange={setQuickAddOpen}
          />
        </>
      )}

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
