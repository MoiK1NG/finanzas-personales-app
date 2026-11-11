'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Target,
  Settings,
  TrendingUp,
  LogOut,
  Landmark,
} from 'lucide-react'
import { cn, focusRing } from '@/lib/utils'
import { useSignOut } from '@/hooks/useSignOut'
import Spinner from '@/components/ui/Spinner'

const navItems = [
  { href: '/',              label: 'Inicio',       icon: LayoutDashboard },
  { href: '/cuentas',       label: 'Cuentas',      icon: Landmark },
  { href: '/bolsillos',     label: 'Presupuesto',  icon: Wallet },
  { href: '/transacciones', label: 'Movimientos',  icon: ArrowLeftRight },
  { href: '/metas',         label: 'Metas',        icon: Target },
  { href: '/configuracion', label: 'Configuración',icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut, signingOut, signOutError } = useSignOut()

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-sidebar-border flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <Link href="/" className={cn('flex items-center gap-2 rounded-lg', focusRing)}>
          <TrendingUp className="h-6 w-6 text-indigo-400" aria-hidden="true" />
          <span className="text-sidebar-fg font-bold text-base tracking-tight">FinanzasApp</span>
        </Link>
      </div>

      {/* Nav */}
      <nav aria-label="Principal" className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          // Sub-pages (e.g. /transacciones/recurrentes) keep their section highlighted.
          const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                focusRing,
                active
                  ? 'bg-primary text-primary-fg'
                  : 'text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {signOutError && (
          <p role="alert" className="px-3 pb-2 text-xs text-red-300">{signOutError}</p>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg transition-colors w-full disabled:opacity-60',
            focusRing
          )}
        >
          {signingOut ? <Spinner size="sm" label="Cerrando sesión" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
