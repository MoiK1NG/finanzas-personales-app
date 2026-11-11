import { Lock } from 'lucide-react'
import Alert from '@/components/ui/Alert'
import { formatPeriodLabel, shiftPeriod } from '@/lib/utils'

interface ClosedMonthAlertProps {
  /** The closed month ('YYYY-MM-01'). */
  periodDate: string
  /** Optional action, e.g. a "Reabrir mes" button. */
  action?: React.ReactNode
  className?: string
}

/**
 * Shown on a closed month (Presupuesto, Inicio, Movimientos). Closing never locks a month:
 * edits are allowed, but the carry-over already sent to the next month is a snapshot.
 */
export default function ClosedMonthAlert({ periodDate, action, className }: ClosedMonthAlertProps) {
  const next = formatPeriodLabel(shiftPeriod(periodDate, 1))
  return (
    <Alert tone="warning" icon={Lock} title="Mes cerrado" action={action} className={className}>
      Lo que cambies aquí no actualiza lo que pasó a <span className="capitalize">{next}</span>. Si necesitas
      recalcularlo, vuelve a cerrar el mes desde Presupuesto.
    </Alert>
  )
}
