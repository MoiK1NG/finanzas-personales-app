'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Settings, TrendingUp } from 'lucide-react'
import { cn, focusRing, formatPeriodLabel, getPeriodDate } from '@/lib/utils'
import { addMonths, subMonths, format } from 'date-fns'
import IconButton from '@/components/ui/IconButton'

interface HeaderProps {
  /** Month shown by the period navigator. Omit on screens that are not month-based. */
  periodDate?: string
  onPeriodChange?: (date: string) => void
  userName?: string | null
}

export default function Header({ periodDate, onPeriodChange, userName }: HeaderProps) {
  const hasPeriod = periodDate !== undefined && onPeriodChange !== undefined
  const currentPeriod = getPeriodDate()

  function navigate(direction: 'prev' | 'next') {
    if (!hasPeriod) return
    const current = new Date(periodDate + 'T12:00:00')
    const next = direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1)
    onPeriodChange(format(next, 'yyyy-MM-01'))
  }

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-border px-2 sm:px-6 h-14 flex items-center justify-between gap-2">
      {hasPeriod ? (
        /* Period navigator */
        <div className="flex items-center gap-1">
          <IconButton label="Mes anterior" onClick={() => navigate('prev')}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <p
            aria-live="polite"
            className="text-sm sm:text-base font-semibold text-fg capitalize min-w-28 sm:min-w-36 text-center tabular-nums"
          >
            {formatPeriodLabel(periodDate)}
          </p>
          <IconButton label="Mes siguiente" onClick={() => navigate('next')}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
          {periodDate !== currentPeriod && (
            <button
              type="button"
              onClick={() => onPeriodChange(currentPeriod)}
              className={cn(
                'ml-1 h-8 rounded-full bg-primary-soft px-3 text-xs font-semibold text-accent transition-colors hover:bg-primary-soft/70',
                focusRing
              )}
            >
              Hoy
            </button>
          )}
        </div>
      ) : (
        /* Brand on phones (the desktop sidebar already shows it) */
        <Link href="/" className={cn('lg:invisible flex items-center gap-2 rounded-lg px-2', focusRing)}>
          <TrendingUp className="h-5 w-5 text-accent" aria-hidden="true" />
          <span className="text-base font-bold tracking-tight text-fg">FinanzasApp</span>
        </Link>
      )}

      <div className="flex items-center gap-2">
        {/* User avatar */}
        {userName && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <span className="text-primary-fg text-xs font-bold uppercase">
                {userName.charAt(0)}
              </span>
            </div>
            <span className="text-sm text-fg-muted truncate max-w-28">{userName}</span>
          </div>
        )}

        {/* Settings — the bottom nav has no room for it on phones */}
        <Link
          href="/configuracion"
          aria-label="Configuración"
          title="Configuración"
          className={cn(
            'lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-muted hover:text-fg',
            focusRing
          )}
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
