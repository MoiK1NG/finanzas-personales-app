'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, getPeriodDate } from '@/lib/utils'
import Header from '@/components/layout/Header'
import AccountCard from '@/components/accounts/AccountCard'
import AccountForm from '@/components/accounts/AccountForm'
import UpdateBalanceModal from '@/components/accounts/UpdateBalanceModal'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { BankAccount } from '@/types/database'
import { Plus, Landmark } from 'lucide-react'

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [updatingBalance, setUpdatingBalance] = useState<BankAccount | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    setAccounts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('¿Archivar esta cuenta?')) return
    const supabase = createClient()
    await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id)
    loadData()
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <>
      <Header periodDate={getPeriodDate()} onPeriodChange={() => {}} />

      <main className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis cuentas</h1>
            <p className="text-sm text-gray-500 mt-0.5">Davivienda, Nu, Nequi y más</p>
          </div>
          <Button onClick={() => { setEditingAccount(null); setShowForm(true) }}>
            <Plus className="h-4 w-4" /> Nueva cuenta
          </Button>
        </div>

        {/* Total balance */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-600 to-indigo-700 border-0 text-white">
          <p className="text-sm font-medium text-indigo-200 mb-1">Saldo total disponible</p>
          <p className="text-4xl font-bold tracking-tight">{formatCOP(totalBalance)}</p>
          <p className="text-sm text-indigo-300 mt-1">
            {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'} activas
          </p>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <Landmark className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin cuentas registradas</p>
            <p className="text-sm text-gray-400 mt-1">Agrega tu Davivienda, Nu, Nequi...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => (
              <AccountCard
                key={acc.id}
                account={acc}
                onEdit={() => { setEditingAccount(acc); setShowForm(true) }}
                onDelete={() => handleDelete(acc.id)}
                onUpdateBalance={() => setUpdatingBalance(acc)}
              />
            ))}
          </div>
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
    </>
  )
}
