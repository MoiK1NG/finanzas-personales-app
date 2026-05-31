import { Card } from '@/components/ui/Card'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  amount: number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  highlight?: boolean
  className?: string
  amountClassName?: string
}

export default function KPICard({
  title,
  amount,
  subtitle,
  trend,
  highlight,
  className,
  amountClassName,
}: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <Card
      className={cn(
        highlight && 'border-indigo-200 bg-indigo-50',
        className
      )}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <p
        className={cn(
          'text-2xl font-bold tracking-tight',
          amount >= 0 ? 'text-gray-900' : 'text-red-600',
          amountClassName
        )}
      >
        {formatCOP(amount)}
      </p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {trend && (
            <TrendIcon
              className={cn('h-3.5 w-3.5', {
                'text-green-500': trend === 'up',
                'text-red-500': trend === 'down',
                'text-gray-400': trend === 'neutral',
              })}
            />
          )}
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      )}
    </Card>
  )
}
