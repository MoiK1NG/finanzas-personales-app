import type { SupabaseClient } from '@supabase/supabase-js'

/** The only place that knows the transfer RPC names and parameters (migration 003). */

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  description: string
  /** 'YYYY-MM-DD' in local time. */
  date: string
  isExecuted: boolean
}

export function createTransfer(supabase: SupabaseClient, periodId: string, input: TransferInput) {
  return supabase.rpc('create_transfer', {
    p_budget_period_id: periodId,
    p_from_account_id: input.fromAccountId,
    p_to_account_id: input.toAccountId,
    p_amount: input.amount,
    p_description: input.description,
    p_transaction_date: input.date,
    p_is_executed: input.isExecuted,
  })
}

export function updateTransfer(supabase: SupabaseClient, transferGroupId: string, input: TransferInput) {
  return supabase.rpc('update_transfer', {
    p_transfer_group_id: transferGroupId,
    p_from_account_id: input.fromAccountId,
    p_to_account_id: input.toAccountId,
    p_amount: input.amount,
    p_description: input.description,
    p_transaction_date: input.date,
    p_is_executed: input.isExecuted,
  })
}

export function deleteTransfer(supabase: SupabaseClient, transferGroupId: string) {
  return supabase.rpc('delete_transfer', { p_transfer_group_id: transferGroupId })
}
