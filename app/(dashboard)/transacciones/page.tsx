'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn, focusRing, formatCOP, formatDate, formatPeriodLabel } from '@/lib/utils'
import { usePeriod } from '@/hooks/usePeriod'
import { useConfirm } from '@/hooks/useConfirm'
import Header from '@/components/layout/Header'
import QuickAddForm from '@/components/transactions/QuickAddForm'
import EditTransactionModal from '@/components/transactions/EditTransactionModal'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Money from '@/components/ui/Money'
import PageHeader from '@/components/ui/PageHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import EmptyState from '@/components/ui/EmptyState'
import Alert from '@/components/ui/Alert'
import Spinner, { LoadingState } from '@/components/ui/Spinner'
import type { Envelope, BudgetPeriod, Transaction, BankAccount } from '@/types/database'
import { ArrowUpRight, ArrowDownLeft, Repeat, Trash2, ArrowLeftRight, Plus, Pencil } from 'lucide-react'

type TxWithEnvelope = Transaction & { envelope?: Envelope | null }
type Filter = 'all' | 'income' | 'expense'

/** PostgREST code for `.single()` with no rows: the month simply has no budget period yet. */
const NO_ROWS = 'PGRST116'

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
]

const EMPTY_COPY: Record<Filter, { title: string; description: string }> = {
  all:     { title: 'No hay movimientos este mes', description: 'Registra tu primer ingreso o gasto del mes.' },
  income:  { title: 'No hay ingresos este mes',    description: 'Los ingresos que registres aparecerán aquí.' },
  expense: { title: 'No hay gastos este mes',      description: 'Los gastos que registres aparecerán aquí.' },
}

const linkButtonClass = cn(
  'inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-fg whitespace-nowrap transition-colors hover:bg-surface-2',
  focusRing
)

export default function TransaccionesPage() {
  const [periodDate, setPeriodDate]   = usePeriod()
  const [period, setPeriod]           = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes]     = useState<Envelope[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<TxWithEnvelope[]>([])
  const [loading, setLoading]         = useState(true)
  /** Month whose data is on screen: the full loader only shows on first load and month changes. */
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const [loadError, setLoadError]     = useState<'session' | 'network' | null>(null)
  const [filterType, setFilterType]   = useState<Filter>('all')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingTx, setEditingTx]     = useState<Transaction | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [notice, setNotice]           = useState<{ tone: 'danger' | 'warning'; message: string } | null>(null)
  const noticeRef                     = useRef<HTMLDivElement>(null)
  const { confirm, confirmDialog }    = useConfirm()

  // The notice renders above the list; bring it into view when a delete deep in the list fails.
  useEffect(() => {
    if (!notice) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [notice])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadError('session')
      setLoading(false)
      return
    }

    const [{ data: per, error: perErr }, { data: envs, error: envsErr }, { data: accts, error: acctsErr }] = await Promise.all([
      supabase.from('budget_periods').select('*').eq('user_id', user.id).eq('period_date', periodDate).single(),
      supabase.from('envelopes').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    ])
    setPeriod(per)
    setEnvelopes(envs ?? [])
    setBankAccounts(accts ?? [])
    let failed = Boolean((perErr && perErr.code !== NO_ROWS) || envsErr || acctsErr)

    if (per) {
      const { data: txs, error: txsErr } = await supabase
        .from('transactions')
        .select('*, envelope:envelopes(*)')
        .eq('budget_period_id', per.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
      setTransactions(txs ?? [])
      if (txsErr) failed = true
    } else {
      setTransactions([])
    }

    setLoadError(failed ? 'network' : null)
    setLoadedPeriod(periodDate)
    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])

  const accountName = (id: string | null) =>
    id ? bankAccounts.find(a => a.id === id)?.name : undefined

  async function handleDelete(id: string) {
    const tx = transactions.find(t => t.id === id)
    const affectsBalance = Boolean(tx?.is_executed && tx.bank_account_id)
    const acctLabel = accountName(tx?.bank_account_id ?? null) ?? 'la cuenta'
    const balanceLine = !tx || !affectsBalance
      ? ''
      : tx.type === 'income'
        ? ` Se restarán ${formatCOP(tx.amount)} del saldo de ${acctLabel}.`
        : ` Se devolverán ${formatCOP(tx.amount)} al saldo de ${acctLabel}.`

    const ok = await confirm({
      title: '¿Eliminar este movimiento?',
      description: tx
        ? `“${tx.description}” se eliminará.${balanceLine} Esta acción no se puede deshacer.`
        : 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return

    setNotice(null)
    setDeletingId(id)
    const supabase = createClient()
    let balanceAdjusted = false
    let balanceFailed = false
    if (tx?.is_executed && tx.bank_account_id) {
      const delta = tx.type === 'income' ? -tx.amount : tx.amount
      const { data: acct } = await supabase.from('bank_accounts').select('balance').eq('id', tx.bank_account_id).single()
      if (acct) {
        const { error: balanceErr } = await supabase.from('bank_accounts').update({ balance: acct.balance + delta }).eq('id', tx.bank_account_id)
        if (balanceErr) balanceFailed = true
        else balanceAdjusted = true
      } else {
        balanceFailed = true
      }
    }
    const { error: deleteErr } = await supabase.from('transactions').delete().eq('id', id)
    setDeletingId(null)

    const name = tx ? `“${tx.description}”` : 'el movimiento'
    if (deleteErr) {
      setNotice({
        tone: 'danger',
        message: balanceAdjusted
          ? `No se pudo eliminar ${name}, pero el saldo de ${acctLabel} ya se ajustó. Revisa ese saldo en Cuentas antes de intentar de nuevo.`
          : `No se pudo eliminar ${name}. Intenta de nuevo.`,
      })
    } else if (balanceFailed) {
      setNotice({
        tone: 'warning',
        message: `Se eliminó ${name}, pero no se pudo actualizar el saldo de ${acctLabel}. Revísalo en Cuentas.`,
      })
    }
    loadData()
  }

  const filtered = transactions.filter(tx =>
    filterType === 'all' || tx.type === filterType
  )

  const totalIncome  = transactions.filter(t => t.type === 'income'  && t.is_executed).reduce((a, t) => a + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.is_executed).reduce((a, t) => a + t.amount, 0)
  const balance      = totalIncome - totalExpense
  const projectedCount = transactions.filter(t => !t.is_executed).length

  const showLoader = loading && loadedPeriod !== periodDate
  const refreshing = loading && !showLoader
  const canAdd     = !showLoader && !loadError && period !== null
  // While a delete runs or the list reloads after a change, the rows on screen may be stale.
  // Edit and delete compute balance deltas from the row they were opened from, so they wait.
  const rowsLocked = refreshing || deletingId !== null

  function rowMeta(tx: TxWithEnvelope) {
    return [
      tx.envelope?.name ?? (tx.type === 'income' ? null : 'Sin categoría'),
      accountName(tx.bank_account_id),
      formatDate(tx.transaction_date),
    ].filter(Boolean).join(' · ')
  }

  const addButton = (className?: string) => (
    <Button className={className} onClick={() => setShowQuickAdd(true)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Nuevo movimiento
    </Button>
  )

  return (
    <>
      <Header periodDate={periodDate} onPeriodChange={setPeriodDate} />

      <main
        className={cn(
          'mx-auto w-full max-w-5xl space-y-5 px-4 pt-5 sm:space-y-6 sm:px-6 sm:pt-6',
          // Room for the FAB on phones and tablets, so it never covers the last row.
          canAdd ? 'pb-24 lg:pb-6' : 'pb-5 sm:pb-6'
        )}
      >
        <PageHeader
          title="Movimientos"
          subtitle={
            canAdd ? (
              <span className="inline-flex items-center gap-2">
                {transactions.length === 1 ? '1 movimiento' : `${transactions.length} movimientos`}
                {refreshing && <Spinner size="sm" label="Actualizando" className="text-fg-faint" />}
              </span>
            ) : undefined
          }
          actions={canAdd ? addButton('hidden lg:inline-flex') : undefined}
        />

        {notice && (
          // scroll-mt clears the sticky header when scrolled into view
          <div ref={noticeRef} className="scroll-mt-20">
            <Alert
              tone={notice.tone}
              action={
                <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                  Cerrar
                </Button>
              }
            >
              {notice.message}
            </Alert>
          </div>
        )}

        {showLoader ? (
          <Card padding="none">
            <LoadingState label="Cargando movimientos" />
          </Card>
        ) : loadError === 'session' ? (
          <Alert
            tone="danger"
            title="Tu sesión expiró"
            action={<Link href="/login" className={linkButtonClass}>Iniciar sesión</Link>}
          >
            Vuelve a iniciar sesión para ver tus movimientos.
          </Alert>
        ) : loadError ? (
          <Alert
            tone="danger"
            title="No se pudieron cargar los movimientos"
            action={
              <Button size="sm" variant="secondary" loading={loading} onClick={() => loadData()}>
                Reintentar
              </Button>
            }
          >
            Revisa tu conexión e intenta de nuevo.
          </Alert>
        ) : !period ? (
          <Alert
            tone="warning"
            title="Este mes aún no tiene presupuesto"
            action={<Link href="/" className={linkButtonClass}>Configurar en Inicio</Link>}
          >
            Para registrar movimientos de {formatPeriodLabel(periodDate)}, primero configura el mes en Inicio.
          </Alert>
        ) : (
          <>
            {/* Summary: Balance first and full width on phones */}
            <section aria-label="Resumen del mes" className="space-y-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                <Card padding="sm" className="min-w-0">
                  <p className="text-xs text-fg-subtle">Ingresos</p>
                  <Money value={totalIncome} className="mt-1 block text-base font-bold text-income sm:text-xl" />
                </Card>
                <Card padding="sm" className="min-w-0">
                  <p className="text-xs text-fg-subtle">Gastos</p>
                  <Money value={totalExpense} className="mt-1 block text-base font-bold text-fg sm:text-xl" />
                </Card>
                <Card padding="sm" className="order-first col-span-2 min-w-0 sm:order-none sm:col-span-1">
                  <p className="text-xs text-fg-subtle">Balance</p>
                  <Money
                    value={balance}
                    variant="balance"
                    className="mt-1 block text-2xl font-bold tracking-tight sm:text-xl"
                  />
                </Card>
              </div>
              {projectedCount > 0 && (
                <p className="text-xs text-fg-subtle">
                  Los totales solo suman movimientos ejecutados; no incluyen{' '}
                  {projectedCount === 1 ? '1 proyectado' : `${projectedCount} proyectados`}.
                </p>
              )}
            </section>

            <section aria-label="Lista de movimientos" className="space-y-3">
              <SegmentedControl
                label="Filtrar por tipo"
                options={FILTER_OPTIONS}
                value={filterType}
                onChange={setFilterType}
              />

              <Card padding="none">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={ArrowLeftRight}
                    title={EMPTY_COPY[filterType].title}
                    description={EMPTY_COPY[filterType].description}
                    action={addButton()}
                  />
                ) : (
                  <ul className="divide-y divide-border" aria-busy={rowsLocked || undefined}>
                    {filtered.map(tx => {
                      const isIncome = tx.type === 'income'
                      const deleting = deletingId === tx.id
                      return (
                        <li
                          key={tx.id}
                          className="group flex items-center gap-1 pr-2 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-surface-2 active:bg-surface-2 sm:pr-3"
                        >
                          {/* The whole row opens the edit form. aria-disabled (not disabled) keeps keyboard focus in place. */}
                          <button
                            type="button"
                            onClick={() => { if (!rowsLocked) setEditingTx(tx) }}
                            aria-disabled={rowsLocked || undefined}
                            className={cn(
                              'flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-3 pl-4 pr-2 text-left',
                              focusRing,
                              'focus-visible:-outline-offset-2'
                            )}
                          >
                            <span className="sr-only">Editar movimiento: </span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                isIncome ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'
                              )}
                            >
                              {isIncome
                                ? <ArrowUpRight className="h-4 w-4" />
                                : <ArrowDownLeft className="h-4 w-4" />}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-sm font-medium text-fg">{tx.description}</span>
                                {tx.is_recurring && (
                                  <span title="Recurrente" className="shrink-0 text-fg-subtle">
                                    <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="sr-only">, recurrente</span>
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                {!tx.is_executed && <Badge variant="blue" className="shrink-0">Proyectado</Badge>}
                                <span className="truncate text-xs text-fg-subtle">{rowMeta(tx)}</span>
                              </span>
                            </span>

                            <Money
                              value={tx.amount}
                              variant={isIncome ? 'income' : 'expense'}
                              className="shrink-0 text-sm font-semibold"
                            />
                            <Pencil className="hidden h-4 w-4 shrink-0 text-fg-faint sm:block" aria-hidden="true" />
                          </button>

                          <IconButton
                            size="sm"
                            tone="danger"
                            label={`Eliminar ${tx.description}`}
                            onClick={() => { if (!rowsLocked) handleDelete(tx.id) }}
                            disabled={deleting}
                            aria-disabled={(!deleting && rowsLocked) || undefined}
                            className="transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100"
                          >
                            {deleting
                              ? <Spinner size="sm" label="Eliminando" />
                              : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                          </IconButton>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            </section>
          </>
        )}
      </main>

      {/* Mobile / tablet FAB: opens the add form directly */}
      {canAdd && (
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          aria-label="Nuevo movimiento"
          title="Nuevo movimiento"
          className={cn(
            'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition-colors hover:bg-primary-hover lg:hidden',
            focusRing
          )}
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {period && (
        <QuickAddForm
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          budgetPeriod={period}
          onSuccess={loadData}
          open={showQuickAdd}
          onOpenChange={setShowQuickAdd}
        />
      )}

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          onSuccess={loadData}
          onClose={() => setEditingTx(null)}
          periodDate={period?.period_date}
        />
      )}

      {confirmDialog}
    </>
  )
}
