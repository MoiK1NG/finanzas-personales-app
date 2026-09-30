import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Focus indicator for interactive elements: an outline with a transparent gap, so it works on any background. */
export const focusRing =
  'outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const GROUPED = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export function formatCOP(amount: number): string {
  return COP.format(amount)
}

/** Formats what the user types as COP with thousands separators: "1250000" → "1.250.000". */
export function formatMoneyInput(raw: string | number, allowNegative = false): string {
  const str = typeof raw === 'number' ? Math.round(raw).toString() : raw
  const negative = allowNegative && str.trim().startsWith('-')
  const digits = str.replace(/\D/g, '')
  if (!digits) return negative ? '-' : ''
  const formatted = GROUPED.format(Number(digits))
  return negative ? `-${formatted}` : formatted
}

/** Inverse of formatMoneyInput: "1.250.000" → 1250000. Empty input → 0. */
export function parseMoneyInput(formatted: string): number {
  const digits = formatted.replace(/\D/g, '')
  if (!digits) return 0
  return formatted.trim().startsWith('-') ? -Number(digits) : Number(digits)
}

/**
 * Rounds to whole percent without hiding the edges a zero-based budget cares about:
 * "100%" only when the value is exactly 100, "0%" only when it is exactly 0.
 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  if (value > 0 && value < 1) return '<1%'
  if (value > 99 && value < 100) return '99%'
  if (value > 100 && value < 101) return '101%'
  return `${Math.round(value)}%`
}

/** Spending status of a budget line: over budget, close to the limit (≥80%), or fine. */
export type SpendTone = 'ok' | 'warning' | 'over'

export function getSpendTone(pctSpent: number, isOver: boolean): SpendTone {
  if (isOver) return 'over'
  if (pctSpent >= 80) return 'warning'
  return 'ok'
}

/** Zero-based budget status from `projected income − total budgeted`. */
export type BudgetStatusTone = 'ok' | 'unassigned' | 'over'

export function getBudgetStatus(unassigned: number): { tone: BudgetStatusTone; label: string } {
  if (unassigned === 0) return { tone: 'ok', label: 'Base cero' }
  if (unassigned > 0) return { tone: 'unassigned', label: `${formatCOP(unassigned)} sin asignar` }
  return { tone: 'over', label: `${formatCOP(Math.abs(unassigned))} excedido` }
}

export function getPeriodDate(date: Date = new Date()): string {
  return format(startOfMonth(date), 'yyyy-MM-dd')
}

export function formatPeriodLabel(periodDate: string): string {
  return format(new Date(periodDate + 'T12:00:00'), 'MMMM yyyy', { locale: es })
}

export function formatDate(date: string): string {
  return format(new Date(date + 'T12:00:00'), "d 'de' MMM", { locale: es })
}

export function getPeriodRange(periodDate: string) {
  const date = new Date(periodDate + 'T12:00:00')
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}
