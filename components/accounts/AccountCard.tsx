'use client'

import type { CSSProperties } from 'react'
import type { BankAccount } from '@/types/database'
import { Archive, Banknote, Landmark, Pencil, RefreshCw, Smartphone, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Money from '@/components/ui/Money'

const TYPE_ICON = {
  checking: Landmark,
  savings:  Landmark,
  digital:  Smartphone,
  cash:     Banknote,
}

// Same wording as the account type selector in AccountForm.
const TYPE_LABEL = {
  checking: 'Cuenta corriente',
  savings:  'Cuenta de ahorros',
  digital:  'Billetera digital',
  cash:     'Efectivo',
}

interface AccountCardProps {
  account: BankAccount
  onEdit: () => void
  /** Archives the account (it leaves the list; its movements stay). */
  onDelete: () => void
  onUpdateBalance: () => void
}

/**
 * Tint for the icon tile, built from the user-chosen color.
 * color-mix against the surface/text tokens keeps the hue in both themes:
 * a soft tile on white in light mode, a dark tinted tile in dark mode, and an
 * icon nudged toward the text color so it stays visible on its own tint.
 */
function tileStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklab, ${color} 16%, var(--surface))`,
    color: `color-mix(in oklab, ${color} 78%, var(--fg))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
  }
}

export default function AccountCard({ account, onEdit, onDelete, onUpdateBalance }: AccountCardProps) {
  const Icon = TYPE_ICON[account.account_type] ?? Wallet
  const color = account.color || '#6366f1'

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={tileStyle(color)}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate font-semibold text-fg">{account.name}</h3>
          <p className="text-xs text-fg-subtle">{TYPE_LABEL[account.account_type] ?? 'Cuenta'}</p>
        </div>
        <div className="-mr-2 -mt-1.5 flex shrink-0 items-center gap-2">
          <IconButton label={`Editar ${account.name}`} tone="primary" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton label={`Archivar ${account.name}`} tone="danger" onClick={onDelete}>
            <Archive className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-tight text-fg">
        <span className="sr-only">Saldo: </span>
        <Money value={account.balance} variant="balance" />
      </p>

      <div className="mt-auto pt-4">
        <Button
          variant="secondary"
          className="w-full"
          onClick={onUpdateBalance}
          aria-label={`Actualizar saldo de ${account.name}`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar saldo
        </Button>
      </div>
    </Card>
  )
}
