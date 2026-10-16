import { type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'info' | 'warning' | 'danger' | 'success'

interface AlertProps {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  /** Override the default icon, or pass false to hide it. */
  icon?: LucideIcon | false
  /** Optional button/link aligned right (stacks below on phones). */
  action?: ReactNode
  className?: string
}

const STYLES: Record<Tone, { box: string; accent: string; icon: LucideIcon }> = {
  info:    { box: 'bg-info-soft border-info/20',       accent: 'text-info',    icon: Info },
  warning: { box: 'bg-warning-soft border-warning/25', accent: 'text-warning', icon: TriangleAlert },
  danger:  { box: 'bg-expense-soft border-expense/20', accent: 'text-expense', icon: CircleAlert },
  success: { box: 'bg-income-soft border-income/20',   accent: 'text-income',  icon: CircleCheck },
}

/** Inline banner for errors, warnings and notices. Errors are announced to screen readers. */
export default function Alert({ tone = 'info', title, children, icon, action, className }: AlertProps) {
  const style = STYLES[tone]
  const Icon = icon === false ? null : (icon ?? style.icon)

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center',
        style.box,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon && <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.accent)} aria-hidden="true" />}
        <div className="min-w-0 text-sm">
          {title && <p className={cn('font-semibold', style.accent)}>{title}</p>}
          {children && <div className={cn('text-fg-muted', title && 'mt-0.5')}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-2">{action}</div>}
    </div>
  )
}
