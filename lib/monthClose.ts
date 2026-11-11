import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloseMonthResult, PeriodReconciliation } from '@/types/database'

/** The only place that knows the month-close RPC names and parameters (migration 005). */

/**
 * Closes a month: copies the budget to the next one, carries each category's leftover,
 * subtracts the overspending from next month's unassigned money and stores next month's
 * opening balance. Running it again recalculates.
 */
export async function closeMonth(supabase: SupabaseClient, periodId: string) {
  const { data, error } = await supabase.rpc('close_month', { p_budget_period_id: periodId })
  return { data: (data ?? null) as CloseMonthResult | null, error }
}

/** Undoes a close. Fails with 'next_month_closed' when the next month is closed too. */
export function reopenMonth(supabase: SupabaseClient, periodId: string) {
  return supabase.rpc('reopen_month', { p_budget_period_id: periodId })
}

export function isNextMonthClosedError(error: { message?: string } | null): boolean {
  return !!error?.message?.includes('next_month_closed')
}

/** Sets the month's opening balance: today's balances minus the movements of this and later months. */
export function setOpeningBalance(supabase: SupabaseClient, periodId: string) {
  return supabase.rpc('set_opening_balance', { p_budget_period_id: periodId })
}

/** Figures for the Discrepancia card (see migration 005, period_reconciliation). */
export async function getReconciliation(supabase: SupabaseClient, periodId: string) {
  const { data, error } = await supabase.rpc('period_reconciliation', { p_budget_period_id: periodId })
  return { data: (data ?? null) as PeriodReconciliation | null, error }
}
