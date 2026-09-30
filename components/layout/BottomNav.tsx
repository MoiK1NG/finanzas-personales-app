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
    <nav
      aria-label="Principal"
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex h-16 items-stretch">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                'outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                active ? 'text-accent' : 'text-fg-subtle hover:text-fg'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary-soft'
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="truncate max-w-full px-1">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
