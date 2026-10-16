import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecurrenceFrequency, TransactionType } from '@/types/database'
import { getPeriodDate } from '@/lib/utils'

/** The only place that knows the recurring RPC names and parameters (migration 004). */

/**
 * Creates the month's projected occurrences of every active template. Idempotent and safe
 * to call on every load. Never throws: a failure must not stop the page from loading.
 */
export async function ensureRecurringOccurrences(supabase: SupabaseClient, periodId: string): Promise<boolean> {
  const { error } = await supabase.rpc('generate_recurring_occurrences', { p_budget_period_id: periodId })
  if (error) console.warn('generate_recurring_occurrences failed:', error.message)
  return !error
}

/** Marks a projected movement as executed; the database then moves the account balance. */
export function confirmTransaction(supabase: SupabaseClient, transactionId: string, executedOn?: string) {
  return supabase.rpc('confirm_transaction', {
    p_transaction_id: transactionId,
    p_executed_on: executedOn ?? null,
  })
}

export interface TemplateInput {
  type: TransactionType
  amount: number
  description: string
  envelopeId: string | null
  /** Account of an income/expense, or source account of a transfer. */
  bankAccountId: string | null
  /** Destination account; transfers only. */
  toBankAccountId: string | null
  frequency: RecurrenceFrequency
  /** 'YYYY-MM-DD'. For monthly templates its day becomes day_of_month. */
  startDate: string
  endDate: string | null
  isActive?: boolean
}

function templateRow(input: TemplateInput) {
  return {
    type: input.type,
    amount: input.amount,
    description: input.description,
    envelope_id: input.type === 'transfer' ? null : input.envelopeId,
    bank_account_id: input.bankAccountId,
    to_bank_account_id: input.type === 'transfer' ? input.toBankAccountId : null,
    frequency: input.frequency,
    day_of_month: input.frequency === 'monthly' ? Number(input.startDate.slice(8, 10)) : null,
    start_date: input.startDate,
    end_date: input.endDate,
    ...(input.isActive === undefined ? {} : { is_active: input.isActive }),
  }
}

export function createTemplate(supabase: SupabaseClient, userId: string, input: TemplateInput) {
  return supabase
    .from('recurring_templates')
    .insert({ user_id: userId, ...templateRow(input) })
    .select('id')
    .single<{ id: string }>()
}

/** Regenerates a template's pending occurrences from a month on. Confirmed movements never change. */
export function resyncTemplate(supabase: SupabaseClient, templateId: string, fromPeriodDate = getPeriodDate()) {
  return supabase.rpc('resync_recurring_template', {
    p_template_id: templateId,
    p_from_period_date: fromPeriodDate,
  })
}

/** Saves the template and regenerates its pending occurrences from the current month on. */
export async function updateTemplate(supabase: SupabaseClient, templateId: string, input: TemplateInput) {
  const { error } = await supabase.from('recurring_templates').update(templateRow(input)).eq('id', templateId)
  if (error) return { error }
  return resyncTemplate(supabase, templateId)
}

/** Pause / resume. Pausing removes pending occurrences from this month on; resuming brings them back. */
export async function setTemplateActive(supabase: SupabaseClient, templateId: string, isActive: boolean) {
  const { error } = await supabase.from('recurring_templates').update({ is_active: isActive }).eq('id', templateId)
  if (error) return { error }
  return resyncTemplate(supabase, templateId)
}

/** Deletes the template and its pending occurrences; confirmed history stays. */
export function deleteTemplate(supabase: SupabaseClient, templateId: string) {
  return supabase.rpc('delete_recurring_template', { p_template_id: templateId })
}
