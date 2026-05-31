import { Card } from '@/components/ui/Card'
import { formatCOP, formatPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EnvelopeSummary } from '@/types/database'

interface EnvelopeProgressCardProps {
  envelope: EnvelopeSummary
}

export default function EnvelopeProgressCard({ envelope }: EnvelopeProgressCardProps) {
  const pct = Math.min(envelope.pct_executed, 100)
  const isOver = envelope.executed_amount > envelope.projected_amount

  return (
    <Card padding="sm" className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
            style={{ backgroundColor: envelope.color + '20', color: envelope.color }}
          >
            💰
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{envelope.envelope_name}</p>
            <p className="text-xs text-gray-500">
              {formatCOP(envelope.executed_amount)} de {formatCOP(envelope.projected_amount)}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'text-xs font-bold ml-2 flex-shrink-0',
            isOver ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-green-600'
          )}
        >
          {formatPercent(envelope.pct_executed)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isOver ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-gray-400">
          Disponible: <span className={cn('font-medium', envelope.available_amount < 0 ? 'text-red-600' : 'text-gray-700')}>
            {formatCOP(envelope.available_amount)}
          </span>
        </span>
        {envelope.is_savings && (
          <span className="text-xs text-indigo-500 font-medium">Ahorro</span>
        )}
      </div>
    </Card>
  )
}
