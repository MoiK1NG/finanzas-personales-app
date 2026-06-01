'use client'

import Link from 'next/link'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { BankAccount } from '@/types/database'
import { Landmark, Smartphone, Banknote, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

const TYPE_ICON = {
  checking: Landmark,
  savings:  Landmark,
  digital:  Smartphone,
  cash:     Banknote,
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
        <Link href="/cuentas" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
          Ver todas <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      {accounts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">Sin cuentas registradas</p>
          <Link href="/cuentas" className="text-xs text-indigo-600 hover:underline mt-1 block">
            Agregar cuenta →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {accounts.map(acc => {
              const Icon = TYPE_ICON[acc.account_type] ?? Landmark
              return (
                <div key={acc.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: acc.color + '20' }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: acc.color }} />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{acc.name}</span>
                  </div>
                  <span className={cn(
                    'text-sm font-semibold',
                    acc.balance < 0 ? 'text-red-600' : 'text-gray-800'
                  )}>
                    {formatCOP(acc.balance)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-600">Total disponible</span>
            <span className={cn(
              'text-base font-bold',
              totalBalance < 0 ? 'text-red-600' : 'text-gray-900'
            )}>
              {formatCOP(totalBalance)}
            </span>
          </div>
        </>
      )}
    </Card>
  )
}
