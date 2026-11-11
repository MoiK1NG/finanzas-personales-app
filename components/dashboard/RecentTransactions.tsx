'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { confirmTransaction } from '@/lib/recurring'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { cn, focusRing } from '@/lib/utils'
import type { Transaction, Envelope, BankAccount, MovementEntry } from '@/types/database'
import EditTransactionModal from '@/components/transactions/EditTransactionModal'
import MovementRow, { entryDescription } from '@/components/transactions/MovementRow'

const sectionLinkClass = cn(
  '-my-2 -mr-2 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors hover:bg-primary-soft',
  focusRing
)

interface RecentTransactionsProps {
  /** Latest movements, transfers already grouped (groupTransfers). */
  entries: MovementEntry[]
  /** Projected movements of the month waiting for confirmation (not only the ones listed). */
  pendingCount: number
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  onRefresh: () => void
}

export default function RecentTransactions({
  entries, pendingCount, envelopes, bankAccounts, onRefresh,
}: RecentTransactionsProps) {
  const [editing, setEditing] = useState<{ tx: Transaction; counterpart?: Transaction } | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const accountNames = new Map(bankAccounts.map(a => [a.id, a.name]))

  function openEdit(entry: MovementEntry) {
    if (entry.kind === 'transaction') {
      setEditing({ tx: entry.tx })
      return
    }
    // Pass the other row only when both are listed; otherwise the modal fetches it.
    setEditing({
      tx: (entry.out ?? entry.in) as Transaction,
      counterpart: entry.out && entry.in ? entry.in : undefined,
    })
  }

  async function handleConfirm(entry: MovementEntry) {
    // For a transfer, confirming the 'out' row confirms the other one too (database trigger).
    const row = entry.kind === 'transfer' ? (entry.out ?? entry.in) as Transaction : entry.tx
    setError(null)
    setConfirmingId(entry.id)
    const { error: err } = await confirmTransaction(createClient(), row.id)
    setConfirmingId(null)
    if (err) setError(`No se pudo confirmar «${entryDescription(entry, accountNames)}». Intenta de nuevo.`)
    onRefresh()
  }

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle>Últimos movimientos</CardTitle>
            {pendingCount > 0 && <Badge variant="blue">{pendingCount} por confirmar</Badge>}
          </div>
          <Link href="/transacciones" className={sectionLinkClass}>
            Ver todos <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </CardHeader>

        {error && <Alert tone="danger" className="mx-4 mb-2 sm:mx-5">{error}</Alert>}

        {entries.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Sin movimientos este mes"
            description="Los movimientos que registres aparecerán aquí."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border" aria-busy={confirmingId !== null || undefined}>
            {entries.map(entry => (
              <MovementRow
                key={entry.id}
                entry={entry}
                accountNames={accountNames}
                variant="compact"
                onEdit={() => openEdit(entry)}
                onConfirm={() => handleConfirm(entry)}
                busy={confirmingId === entry.id ? 'confirming' : null}
                locked={confirmingId !== null}
              />
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <EditTransactionModal
          transaction={editing.tx}
          counterpart={editing.counterpart}
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          onSuccess={() => { setEditing(null); onRefresh() }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
