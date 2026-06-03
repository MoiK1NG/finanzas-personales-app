'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Target,
  Landmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',              label: 'Inicio',      icon: LayoutDashboard },
  { href: '/cuentas',       label: 'Cuentas',     icon: Landmark },
  { href: '/bolsillos',     label: 'Presupuesto', icon: Wallet },
  { href: '/transacciones', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/metas',         label: 'Metas',       icon: Target },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 lg:hidden">
      <div className="flex items-stretch">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-indigo-600')} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
