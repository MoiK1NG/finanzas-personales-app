'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import AccountCard from '@/components/accounts/AccountCard'
import AccountForm from '@/components/accounts/AccountForm'
import UpdateBalanceModal from '@/components/accounts/UpdateBalanceModal'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Money from '@/components/ui/Money'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { useConfirm } from '@/hooks/useConfirm'
import type { BankAccount } from '@/types/database'
import { Plus, Landmark } from 'lucide-react'

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  // Only true on the first load: refreshes after a change keep the list on screen.
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [updatingBalance, setUpdatingBalance] = useState<BankAccount | null>(null)
  const { confirm, confirmDialog } = useConfirm()

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    setLoadError(error ? 'No se pudieron cargar tus cuentas.' : null)
    setAccounts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function retryLoad() {
    setRetrying(true)
    await loadData()
    setRetrying(false)
  }

  function openCreate() {
    setEditingAccount(null)
    setShowForm(true)
  }

  async function handleDelete(account: BankAccount) {
    const ok = await confirm({
      title: `¿Archivar la cuenta “${account.name}”?`,
      description:
        'Dejará de aparecer en esta lista y en el saldo en cuentas. Sus movimientos se conservan. Por ahora no se puede restaurar desde la app.',
      confirmLabel: 'Archivar',
      tone: 'danger',
    })
    if (!ok) return
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.from('bank_accounts').update({ is_active: false }).eq('id', account.id)
    if (error) {
      setActionError(`No se pudo archivar la cuenta “${account.name}”. Intenta de nuevo.`)
      return
    }
    loadData()
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
        <PageHeader
          title="Cuentas"
          subtitle="Davivienda, Nu, Nequi y más"
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Nueva cuenta
            </Button>
          }
        />

        {actionError && (
          <Alert
            tone="danger"
            action={
              <Button variant="ghost" size="sm" onClick={() => setActionError(null)}>
                Cerrar
              </Button>
            }
          >
            {actionError}
          </Alert>
        )}

        {loadError && (
          <Alert
            tone="danger"
            title={loadError}
            action={
              <Button variant="secondary" size="sm" loading={retrying} onClick={retryLoad}>
                Reintentar
              </Button>
            }
          >
            Revisa tu conexión e intenta de nuevo.
          </Alert>
        )}

        {/* Total balance (brand hero) */}
        {!loadError && (
          <section className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 text-white shadow-sm sm:p-6 dark:from-indigo-700 dark:to-indigo-900">
            <h2 className="text-sm font-medium text-white/80">Saldo en cuentas</h2>
            {loading ? (
              <div aria-hidden="true">
                <div className="mt-2 h-9 w-48 max-w-full animate-pulse rounded-lg bg-white/15 sm:h-10" />
                <div className="mt-2 h-4 w-28 animate-pulse rounded bg-white/15" />
              </div>
            ) : (
              <>
                <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                  <Money value={totalBalance} />
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {accounts.length} {accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}
                </p>
              </>
            )}
          </section>
        )}

        {loading ? (
          <LoadingState label="Cargando cuentas" />
        ) : loadError ? null : accounts.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Landmark}
              title="Aún no tienes cuentas"
              description="Agrega tu Davivienda, Nu, Nequi o el efectivo para ver tu saldo en cuentas."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nueva cuenta
                </Button>
              }
            />
          </Card>
        ) : (
          <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {accounts.map(acc => (
              <li key={acc.id}>
                <AccountCard
                  account={acc}
                  onEdit={() => { setEditingAccount(acc); setShowForm(true) }}
                  onDelete={() => handleDelete(acc)}
                  onUpdateBalance={() => setUpdatingBalance(acc)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {showForm && (
        <AccountForm
          account={editingAccount ?? undefined}
          onSuccess={loadData}
          onClose={() => setShowForm(false)}
        />
      )}

      {updatingBalance && (
        <UpdateBalanceModal
          account={updatingBalance}
          onSuccess={loadData}
          onClose={() => setUpdatingBalance(null)}
        />
      )}

      {confirmDialog}
    </>
  )
}
