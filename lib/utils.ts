import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
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
