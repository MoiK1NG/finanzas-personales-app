'use client'

import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { BankAccount } from '@/types/database'
import { Pencil, Trash2, Landmark, Wallet, Banknote, Smartphone } from 'lucide-react'

const TYPE_ICON = {
  checking: Landmark,
  savings:  Landmark,
  digital:  Smartphone,
  cash:     Banknote,
}

const TYPE_LABEL = {
  checking: 'Cta. corriente',
  savings:  'Cta. ahorros',
  digital:  'Billetera digital',
  cash:     'Efectivo',
}

interface AccountCardProps {
  account: BankAccount
  onEdit: () => void
  onDelete: () => void
  onUpdateBalance: () => void
}

export default function AccountCard({ account, onEdit, onDelete, onUpdateBalance }: AccountCardProps) {
  const Icon = TYPE_ICON[account.account_type] ?? Wallet

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: account.color + '20' }}
          >
            <Icon className="h-5 w-5" style={{ color: account.color }} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">{account.name}</p>
            <p className="text-xs text-gray-500">{TYPE_LABEL[account.account_type]}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className={cn(
        'text-2xl font-bold tracking-tight mb-3',
        account.balance < 0 ? 'text-red-600' : 'text-gray-900'
      )}>
        {formatCOP(account.balance)}
      </p>

      <button
        onClick={onUpdateBalance}
        className="w-full text-xs font-medium text-center py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        Actualizar saldo
      </button>
    </div>
  )
}
