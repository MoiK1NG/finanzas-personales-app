import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'indigo'
  className?: string
}

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        {
          'bg-income-soft text-income': variant === 'green',
          'bg-expense-soft text-expense': variant === 'red',
          'bg-warning-soft text-warning': variant === 'yellow',
          'bg-info-soft text-info': variant === 'blue',
          'bg-muted text-fg-muted': variant === 'gray',
          'bg-primary-soft text-accent': variant === 'indigo',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
