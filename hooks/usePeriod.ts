'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { getPeriodDate } from '@/lib/utils'

const STORAGE_KEY = 'finanzas:period'
const listeners = new Set<() => void>()
let selected: string | null = null

function read(): string {
  if (selected === null) {
    try {
      selected = sessionStorage.getItem(STORAGE_KEY)
    } catch {
      selected = null
    }
  }
  return selected ?? getPeriodDate()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Selected budget month ('YYYY-MM-01'), shared by Inicio, Presupuesto and Movimientos,
 * so moving between tabs keeps the month you were looking at. Kept for the browser session.
 */
export function usePeriod(): [string, (periodDate: string) => void] {
  const periodDate = useSyncExternalStore(subscribe, read, getPeriodDate)

  const setPeriodDate = useCallback((next: string) => {
    selected = next
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode): the in-memory value still works for this visit.
    }
    listeners.forEach(listener => listener())
  }, [])

  return [periodDate, setPeriodDate]
}
