'use client'

import { Suspense, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  cn, entryRow, focusRing, formatCOP, formatPeriodLabel, groupTransfers, isPending, transferLabel,
} from '@/lib/utils'
import { deleteTransfer } from '@/lib/transfers'
import { confirmTransaction, ensureRecurringOccurrences } from '@/lib/recurring'
import { usePeriod } from '@/hooks/usePeriod'
import { useConfirm } from '@/hooks/useConfirm'
import Header from '@/components/layout/Header'
import QuickAddForm from '@/components/transactions/QuickAddForm'
import EditTransactionModal from '@/components/transactions/EditTransactionModal'
import MovementRow, { entryDescription } from '@/components/transactions/MovementRow'
import CategorySummary from '@/components/transactions/CategorySummary'
import type { TransactionFormValues } from '@/components/transactions/TransactionFormFields'
import CaptureInbox from '@/components/captures/CaptureInbox'
import ClosedMonthAlert from '@/components/budget/ClosedMonthAlert'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import PageHeader from '@/components/ui/PageHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import Alert from '@/components/ui/Alert'
import Spinner, { LoadingState } from '@/components/ui/Spinner'
import type {
  Envelope, BudgetPeriod, Transaction, BankAccount, MovementEntry, EnvelopeSummary, CapturedNotification,
} from '@/types/database'
import { ArrowLeftRight, Plus, Repeat } from 'lucide-react'

type TxWithEnvelope = Transaction & { envelope?: Envelope | null }
type Filter = 'all' | 'income' | 'expense' | 'transfer'

/** PostgREST code for `.single()` with no rows: the month simply has no budget period yet. */
const NO_ROWS = 'PGRST116'

const FILTER_OPTIONS: { value: Filter; label: ReactNode }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  {
    value: 'transfer',
    label: (
      <>
        <span aria-hidden="true" className="sm:hidden">Transf.</span>
        <span className="sr-only sm:not-sr-only">Transferencias</span>
      </>
    ),
  },
]

const EMPTY_COPY: Record<Filter, { title: string; description: string }> = {
  all:      { title: 'No hay movimientos este mes',     description: 'Registra tu primer ingreso o gasto del mes.' },
  income:   { title: 'No hay ingresos este mes',        description: 'Los ingresos que registres aparecerán aquí.' },
  expense:  { title: 'No hay gastos este mes',          description: 'Los gastos que registres aparecerán aquí.' },
  transfer: { title: 'No hay transferencias este mes',  description: 'Lo que muevas entre tus cuentas aparecerá aquí.' },
}

const linkButtonClass = cn(
  'inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-fg whitespace-nowrap transition-colors hover:bg-surface-2',
  focusRing
)

function matchesFilter(entry: MovementEntry, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'transfer') return entry.kind === 'transfer'
  return entry.kind === 'transaction' && entry.tx.type === filter
}

/** URL value of the category filter for expenses that have no category yet. */
const NO_CATEGORY = 'none'

/** category: '' = all, an envelope id, or NO_CATEGORY. Transfers never have a category. */
function matchesCategory(entry: MovementEntry, category: string): boolean {
  if (!category) return true
  if (entry.kind !== 'transaction') return false
  if (category === NO_CATEGORY) return entry.tx.type === 'expense' && entry.tx.envelope_id === null
  return entry.tx.envelope_id === category
}

// useSearchParams needs a Suspense boundary on a prerendered page (Next docs: use-search-params).
export default function TransaccionesPage() {
  return (
    <Suspense fallback={null}>
      <TransaccionesContent />
    </Suspense>
  )
}

function TransaccionesContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [periodDate, setPeriodDate]   = usePeriod()
  const [period, setPeriod]           = useState<BudgetPeriod | null>(null)
  const [envelopes, setEnvelopes]     = useState<Envelope[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<TxWithEnvelope[]>([])
  const [envelopeSummaries, setEnvelopeSummaries] = useState<EnvelopeSummary[]>([])
  /** Payment notifications forwarded by the phone, waiting to be registered or dismissed. */
  const [captures, setCaptures]       = useState<CapturedNotification[]>([])
  /** Capture being registered: the add form opens prefilled with what was read from it. */
  const [registering, setRegistering] = useState<{ capture: CapturedNotification; initial: Partial<TransactionFormValues> } | null>(null)
  const [captureBusyId, setCaptureBusyId] = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  /** Month whose data is on screen: the full loader only shows on first load and month changes. */
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const [loadError, setLoadError]     = useState<'session' | 'network' | null>(null)
  const [filterType, setFilterType]   = useState<Filter>('all')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editing, setEditing]         = useState<{ tx: Transaction; counterpart?: Transaction } | null>(null)
  /** Entry whose delete/confirm is running; every row waits meanwhile. */
  const [busy, setBusy]               = useState<{ id: string; kind: 'deleting' | 'confirming' } | null>(null)
  const [notice, setNotice]           = useState<string | null>(null)
  const noticeRef                     = useRef<HTMLDivElement>(null)
  const { confirm, confirmDialog }    = useConfirm()

  // The notice renders above the list; bring it into view when an action deep in the list fails.
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

    const [
      { data: per, error: perErr }, { data: envs, error: envsErr }, { data: accts, error: acctsErr }, { data: caps },
    ] = await Promise.all([
      supabase.from('budget_periods').select('*').eq('user_id', user.id).eq('period_date', periodDate).single(),
      supabase.from('envelopes').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      // Optional feature: an error here (e.g. capture not set up in the database) just means no inbox.
      supabase.from('captured_notifications').select('*').eq('user_id', user.id).eq('status', 'pending')
        .order('received_at', { ascending: false }).limit(50),
    ])
    setPeriod(per)
    setEnvelopes(envs ?? [])
    setBankAccounts(accts ?? [])
    setCaptures(caps ?? [])
    let failed = Boolean((perErr && perErr.code !== NO_ROWS) || envsErr || acctsErr)

    if (per) {
      // Creates this month's projected recurring movements (idempotent; a failure doesn't block the list).
      await ensureRecurringOccurrences(supabase, per.id)
      const [{ data: txs, error: txsErr }, { data: sums }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, envelope:envelopes(*)')
          .eq('budget_period_id', per.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false }),
        // Budget of each category this month, for the summary shown when filtering by category.
        // Optional: if it fails the list still works, just without the budget figures.
        supabase.from('v_envelope_summary').select('*').eq('budget_period_id', per.id).eq('user_id', user.id),
      ])
      setTransactions(txs ?? [])
      setEnvelopeSummaries(sums ?? [])
      if (txsErr) failed = true
    } else {
      setTransactions([])
      setEnvelopeSummaries([])
    }

    setLoadError(failed ? 'network' : null)
    setLoadedPeriod(periodDate)
    setLoading(false)
  }, [periodDate])

  useEffect(() => { loadData() }, [loadData])

  const accountNames = new Map(bankAccounts.map(a => [a.id, a.name]))
  const entries = groupTransfers(transactions)

  // The category filter lives in the URL (?categoria=<id>|none) so Presupuesto and Inicio can link to it.
  const categoryParam = searchParams.get('categoria') ?? ''
  const selectedEnvelope = envelopes.find(e => e.id === categoryParam)
  const categoryFilter = categoryParam === NO_CATEGORY || selectedEnvelope ? categoryParam : ''

  function setCategory(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('categoria', value)
    else params.delete('categoria')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function openEdit(entry: MovementEntry) {
    if (entry.kind === 'transaction') {
      setEditing({ tx: entry.tx })
      return
    }
    const tx = (entry.out ?? entry.in) as Transaction
    // Only pass the other row when both are here; otherwise the modal fetches it.
    const counterpart = entry.out && entry.in ? entry.in : undefined
    setEditing({ tx, counterpart })
  }

  async function handleConfirm(entry: MovementEntry) {
    // For a transfer, confirming one row confirms the other too (database trigger).
    const row = entry.kind === 'transfer' ? (entry.out ?? entry.in) as Transaction : entry.tx
    setNotice(null)
    setBusy({ id: entry.id, kind: 'confirming' })
    const { error } = await confirmTransaction(createClient(), row.id)
    setBusy(null)
    if (error) setNotice(`No se pudo confirmar «${entryDescription(entry, accountNames)}». Intenta de nuevo.`)
    loadData()
  }

  async function handleDelete(entry: MovementEntry) {
    const row = entryRow(entry)
    const description = entryDescription(entry, accountNames)
    const omit = !row.is_executed && row.recurring_template_id !== null

    const ok = await confirm(
      omit
        ? {
            title: `¿Omitir «${description}» este mes?`,
            description: 'Se quitará solo esta vez. La recurrencia sigue activa.',
            confirmLabel: 'Omitir',
            tone: 'primary',
          }
        : entry.kind === 'transfer'
          ? {
              title: '¿Eliminar esta transferencia?',
              description: `${transferLabel(
                entry.out?.bank_account_id ? accountNames.get(entry.out.bank_account_id) : undefined,
                entry.in?.bank_account_id ? accountNames.get(entry.in.bank_account_id) : undefined
              )} por ${formatCOP(row.amount)} se eliminará. Esta acción no se puede deshacer.`,
              confirmLabel: 'Eliminar',
              tone: 'danger',
            }
          : {
              title: '¿Eliminar este movimiento?',
              description: `«${description}» se eliminará. Esta acción no se puede deshacer.`,
              confirmLabel: 'Eliminar',
              tone: 'danger',
            }
    )
    if (!ok) return

    setNotice(null)
    setBusy({ id: entry.id, kind: 'deleting' })
    const supabase = createClient()
    // Balances are adjusted by the database; deleting a transfer removes both rows.
    const { error } = entry.kind === 'transfer'
      ? await deleteTransfer(supabase, entry.id)
      : await supabase.from('transactions').delete().eq('id', entry.id)
    setBusy(null)

    if (error) {
      setNotice(omit
        ? `No se pudo omitir «${description}». Intenta de nuevo.`
        : `No se pudo eliminar «${description}». Intenta de nuevo.`)
    }
    loadData()
  }

  /** Marks a capture as handled so it leaves the inbox (the notification text stays stored). */
  async function resolveCapture(capture: CapturedNotification, status: 'registered' | 'dismissed') {
    const { error } = await createClient()
      .from('captured_notifications')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', capture.id)
    if (error) {
      setNotice(status === 'dismissed'
        ? 'No se pudo descartar la captura. Intenta de nuevo.'
        : 'El movimiento se guardó, pero la captura sigue en «Por clasificar». Descártala para que no se repita.')
      return
    }
    setCaptures(current => current.filter(c => c.id !== capture.id))
  }

  async function handleDismissCapture(capture: CapturedNotification) {
    setNotice(null)
    setCaptureBusyId(capture.id)
    await resolveCapture(capture, 'dismissed')
    setCaptureBusyId(null)
  }

  /** Dismisses every capture in the list at once (the "Otras notificaciones" group). */
  async function handleDismissCaptures(list: CapturedNotification[]) {
    setNotice(null)
    setCaptureBusyId('many')
    const ids = list.map(c => c.id)
    const { error } = await createClient()
      .from('captured_notifications')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
      .in('id', ids)
    if (error) setNotice('No se pudieron descartar las notificaciones. Intenta de nuevo.')
    else setCaptures(current => current.filter(c => !ids.includes(c.id)))
    setCaptureBusyId(null)
  }

  /** Runs after the add form saved a movement. */
  async function handleAdded() {
    if (registering) await resolveCapture(registering.capture, 'registered')
    loadData()
  }

  // ?nuevo=1 (the "Nuevo gasto" shortcut of the installed app) opens the add form directly.
  const wantsNew = searchParams.get('nuevo') === '1'

  function handleAddOpenChange(open: boolean) {
    setShowQuickAdd(open)
    if (open) return
    setRegistering(null)
    if (wantsNew) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('nuevo')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }

  const pendingCount = entries.filter(isPending).length
  // The chip hides at 0, so the filter can't stay on with no way to turn it off.
  const showPendingOnly = pendingOnly && pendingCount > 0
  const inCategory = entries.filter(entry => matchesCategory(entry, categoryFilter))
  const filtered = inCategory.filter(entry =>
    matchesFilter(entry, filterType) && (!showPendingOnly || isPending(entry))
  )
  // Executed expenses of the selected category (same rule as the "Gastado" column in Presupuesto).
  const categorySpent = inCategory.reduce(
    (sum, entry) =>
      entry.kind === 'transaction' && entry.tx.type === 'expense' && entry.tx.is_executed ? sum + entry.tx.amount : sum,
    0
  )
  const uncategorizedCount = entries.filter(entry => matchesCategory(entry, NO_CATEGORY)).length
  const categoryOptions = [
    ...envelopes.map(e => ({ value: e.id, label: e.name })),
    // Always offered while selected; otherwise only when there is something to classify.
    ...(uncategorizedCount > 0 || categoryFilter === NO_CATEGORY
      ? [{ value: NO_CATEGORY, label: `Gastos sin categoría (${uncategorizedCount})` }]
      : []),
  ]

  // Transfers move money between accounts: they are neither income nor expense.
  const totalIncome  = transactions.filter(t => t.type === 'income'  && t.is_executed).reduce((a, t) => a + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.is_executed).reduce((a, t) => a + t.amount, 0)
  const balance      = totalIncome - totalExpense
  const projectedCount = transactions.filter(t => t.type !== 'transfer' && !t.is_executed).length

  const showLoader = loading && loadedPeriod !== periodDate
  const refreshing = loading && !showLoader
  const canAdd     = !showLoader && !loadError && period !== null
  // While a delete/confirm runs or the list reloads after a change, the rows on screen may be stale.
  const rowsLocked = refreshing || busy !== null

  const addButton = (className?: string) => (
    <Button className={className} onClick={() => setShowQuickAdd(true)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Nuevo movimiento
    </Button>
  )

  const recurringLink = (className?: string) => (
    <Link
      href="/transacciones/recurrentes"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
        focusRing,
        className
      )}
    >
      <Repeat className="h-4 w-4" aria-hidden="true" />
      Recurrentes
    </Link>
  )

  const emptyCopy = showPendingOnly
    ? { title: 'Nada por confirmar con este filtro', description: 'Prueba con otro tipo o quita el filtro «por confirmar».' }
    : categoryFilter === NO_CATEGORY
      ? { title: 'No hay gastos sin categoría', description: 'Todos tus gastos de este mes ya tienen categoría.' }
      : selectedEnvelope
        ? {
            title: `No hay movimientos en «${selectedEnvelope.name}»`,
            description: filterType === 'all'
              ? 'Los gastos que registres en esta categoría aparecerán aquí.'
              : 'Prueba con otro tipo de movimiento.',
          }
        : EMPTY_COPY[filterType]

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
                {entries.length === 1 ? '1 movimiento' : `${entries.length} movimientos`}
                {refreshing && <Spinner size="sm" label="Actualizando" className="text-fg-faint" />}
              </span>
            ) : undefined
          }
          actions={
            <>
              {recurringLink('hidden h-10 border border-border-strong bg-surface px-4 text-fg hover:bg-surface-2 lg:inline-flex')}
              {canAdd && addButton('hidden lg:inline-flex')}
            </>
          }
        />

        {notice && (
          // scroll-mt clears the sticky header when scrolled into view
          <div ref={noticeRef} className="scroll-mt-20">
            <Alert
              tone="danger"
              action={
                <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                  Cerrar
                </Button>
              }
            >
              {notice}
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
            {period.closed_at && <ClosedMonthAlert periodDate={periodDate} />}

            <CaptureInbox
              captures={captures}
              bankAccounts={bankAccounts}
              periodDate={periodDate}
              busyId={captureBusyId}
              locked={rowsLocked}
              onRegister={(capture, initial) => setRegistering({ capture, initial })}
              onDismiss={handleDismissCapture}
              onDismissMany={handleDismissCaptures}
            />

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
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  label="Filtrar por tipo"
                  options={FILTER_OPTIONS}
                  value={filterType}
                  onChange={setFilterType}
                />
                {pendingCount > 0 && (
                  <button
                    type="button"
                    aria-pressed={showPendingOnly}
                    onClick={() => setPendingOnly(!showPendingOnly)}
                    className={cn(
                      'inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                      focusRing,
                      showPendingOnly
                        ? 'border-info/30 bg-info-soft text-info'
                        : 'border-border-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg'
                    )}
                  >
                    {pendingCount} por confirmar
                  </button>
                )}
                {recurringLink('ml-auto h-10 px-2 text-accent hover:bg-primary-soft lg:hidden')}
                <div className="w-full sm:order-first sm:w-56">
                  <Select
                    aria-label="Filtrar por categoría"
                    placeholder="Todas las categorías"
                    options={categoryOptions}
                    value={categoryFilter}
                    onChange={e => setCategory(e.target.value)}
                  />
                </div>
              </div>

              {categoryFilter === NO_CATEGORY ? (
                <CategorySummary
                  name="Gastos sin categoría"
                  spent={categorySpent}
                  count={inCategory.length}
                  hint="toca un gasto para asignarle una categoría"
                  onClear={() => setCategory('')}
                />
              ) : selectedEnvelope ? (
                <CategorySummary
                  name={selectedEnvelope.name}
                  color={selectedEnvelope.color}
                  isSavings={selectedEnvelope.is_savings}
                  spent={categorySpent}
                  count={inCategory.length}
                  budget={envelopeSummaries.find(s => s.envelope_id === selectedEnvelope.id)}
                  onClear={() => setCategory('')}
                />
              ) : null}

              <Card padding="none">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={ArrowLeftRight}
                    title={emptyCopy.title}
                    description={emptyCopy.description}
                    action={
                      showPendingOnly ? (
                        <Button variant="secondary" onClick={() => setPendingOnly(false)}>
                          Ver todos
                        </Button>
                      ) : categoryFilter === NO_CATEGORY ? (
                        <Button variant="secondary" onClick={() => setCategory('')}>
                          Ver todos los movimientos
                        </Button>
                      ) : (
                        addButton()
                      )
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border" aria-busy={rowsLocked || undefined}>
                    {filtered.map(entry => (
                      <MovementRow
                        key={entry.id}
                        entry={entry}
                        accountNames={accountNames}
                        onEdit={() => openEdit(entry)}
                        onDelete={() => handleDelete(entry)}
                        onConfirm={() => handleConfirm(entry)}
                        busy={busy?.id === entry.id ? busy.kind : null}
                        locked={rowsLocked}
                      />
                    ))}
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
          onSuccess={handleAdded}
          open={showQuickAdd || registering !== null || (wantsNew && canAdd)}
          onOpenChange={handleAddOpenChange}
          initial={registering?.initial}
        />
      )}

      {editing && (
        <EditTransactionModal
          transaction={editing.tx}
          counterpart={editing.counterpart}
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          onSuccess={loadData}
          onClose={() => setEditing(null)}
          periodDate={period?.period_date}
        />
      )}

      {confirmDialog}
    </>
  )
}
