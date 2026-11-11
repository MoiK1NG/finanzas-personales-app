'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Landmark, Smartphone, Banknote, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Money from '@/components/ui/Money'
import { cn, focusRing } from '@/lib/utils'
import type { BankAccount } from '@/types/database'

const TYPE_ICON = {
  checking: Landmark,
  savings:  Landmark,
  digital:  Smartphone,
  cash:     Banknote,
}

const sectionLinkClass = cn(
  '-my-2 -mr-2 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-accent transition-colors hover:bg-primary-soft',
  focusRing
)

/** Tint derived from the account color so it reads on light and dark surfaces. */
function tintStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 16%, var(--surface))`,
    color: `color-mix(in oklch, ${color} 75%, var(--fg))`,
  }
}

interface AccountsWidgetProps {
  accounts: BankAccount[]
  totalBalance: number
}

export default function AccountsWidget({ accounts, totalBalance }: AccountsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis cuentas</CardTitle>
        <Link href="/cuentas" className={sectionLinkClass}>
          Ver todas <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardHeader>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin cuentas registradas"
          description="Registra tus cuentas para saber cuánto dinero tienes."
          className="py-4"
          action={
            <Link
              href="/cuentas"
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-lg bg-primary-soft px-3 text-sm font-medium text-accent transition-colors hover:bg-primary-soft/70',
                focusRing
              )}
            >
              Agregar cuenta
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-1">
            {accounts.map(acc => {
              const Icon = TYPE_ICON[acc.account_type] ?? Landmark
              return (
                <li key={acc.id} className="flex items-center justify-between gap-3 py-1.5 text-fg">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={tintStyle(acc.color)}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-medium">{acc.name}</span>
                  </div>
                  <Money value={acc.balance} variant="balance" className="shrink-0 text-sm font-semibold" />
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-fg">
            <span className="text-sm font-medium text-fg-muted">Saldo en cuentas</span>
            <Money value={totalBalance} variant="balance" className="text-base font-bold" />
          </div>
        </>
      )}
    </Card>
  )
}
