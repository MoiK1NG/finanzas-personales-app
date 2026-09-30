'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Pencil } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Money from '@/components/ui/Money'
import { cn, focusRing, formatDate } from '@/lib/utils'
import type { Transaction, Envelope, BankAccount } from '@/types/database'
import EditTransactionModal from '@/components/transactions/EditTransactionModal'

const sectionLinkClass = cn(
  '-my-2 -mr-2 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors hover:bg-primary-soft',
  focusRing
)

interface RecentTransactionsProps {
  transactions: (Transaction & { envelope?: Envelope | null })[]
  envelopes: Envelope[]
  bankAccounts: BankAccount[]
  onRefresh: () => void
}

export default function RecentTransactions({ transactions, envelopes, bankAccounts, onRefresh }: RecentTransactionsProps) {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const accountNames = new Map(bankAccounts.map(a => [a.id, a.name]))

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
          <CardTitle>Últimos movimientos</CardTitle>
          <Link href="/transacciones" className={sectionLinkClass}>
            Ver todos <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </CardHeader>

        {transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Sin movimientos este mes"
            description="Los movimientos que registres aparecerán aquí."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map(tx => {
              const isIncome = tx.type === 'income'
              const accountName = tx.bank_account_id ? accountNames.get(tx.bank_account_id) : undefined
              const meta = [tx.envelope?.name ?? 'Sin categoría', accountName, formatDate(tx.transaction_date)]
                .filter(Boolean)
                .join(' · ')

              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => setEditingTx(tx)}
                    className={cn(
                      'group flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 sm:px-5',
                      focusRing,
                      'focus-visible:-outline-offset-2'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        isIncome ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'
                      )}
                    >
                      {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        <span className="sr-only">Editar: </span>
                        {tx.description}
                      </span>
                      {/* Wraps the badge to its own line when it would squeeze the meta to a few letters (360px) */}
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg-subtle">
                        <span className="min-w-0 max-w-full truncate">{meta}</span>
                        {!tx.is_executed && <Badge variant="blue">Proyectado</Badge>}
                      </span>
                    </span>

                    <Money
                      value={tx.amount}
                      variant={isIncome ? 'income' : 'expense'}
                      className="shrink-0 text-sm font-semibold"
                    />
                    <Pencil
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-accent"
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          onSuccess={() => { setEditingTx(null); onRefresh() }}
          onClose={() => setEditingTx(null)}
        />
      )}
    </>
  )
}
