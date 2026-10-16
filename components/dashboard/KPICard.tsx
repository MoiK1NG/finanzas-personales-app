import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Money from '@/components/ui/Money'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  amount: number
  /** Caption under the amount: a short text or a status pill. */
  subtitle?: ReactNode
  /** Small control aligned with the title, e.g. an edit IconButton. */
  action?: ReactNode
  /** hero = brand gradient card for the main figure of the page. */
  variant?: 'default' | 'hero'
  /** Decorative icon shown top-right when there is no action. */
  icon?: LucideIcon
  className?: string
}

export default function KPICard({
  title,
  amount,
  subtitle,
  action,
  variant = 'default',
  icon: Icon,
  className,
}: KPICardProps) {
  const hero = variant === 'hero'

  return (
    <Card
      padding={hero ? 'md' : 'sm'}
      className={cn(
        'min-w-0',
        hero &&
          'border-0 bg-linear-to-br from-indigo-600 to-indigo-800 text-white dark:from-indigo-700 dark:to-indigo-900',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'min-w-0 text-xs font-medium leading-tight sm:text-sm',
            hero ? 'text-white/80' : 'text-fg-muted'
          )}
        >
          {title}
        </p>
        {action ? (
          <div className="-my-2 -mr-2 shrink-0">{action}</div>
        ) : Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              '-my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              hero ? 'bg-white/15 text-white' : 'bg-muted text-fg-subtle'
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <p className={cn('mt-1.5 font-bold leading-none tracking-tight', hero ? 'text-white' : 'text-fg')}>
        <Money
          value={amount}
          variant={hero ? 'plain' : 'balance'}
          className={hero ? 'text-2xl sm:text-3xl' : 'text-base min-[380px]:text-lg sm:text-xl'}
        />
      </p>

      {subtitle && (
        <div className={cn('mt-2 text-xs', hero ? 'text-white/80' : 'text-fg-subtle')}>
          {subtitle}
        </div>
      )}
    </Card>
  )
}
