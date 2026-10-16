export type Currency = 'COP'
export type AccountType = 'checking' | 'savings' | 'digital' | 'cash'

export type TransactionType = 'income' | 'expense' | 'transfer'
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'
export type TransferDirection = 'out' | 'in'
export type GoalStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  full_name: string | null
  currency: Currency
  created_at: string
  updated_at: string
}

export interface BudgetPeriod {
  id: string
  user_id: string
  period_date: string        // 'YYYY-MM-DD', always first of month
  projected_income: number
  /** Sum of account balances when the month started; null until set or until the previous month is closed. */
  opening_balance: number | null
  /** Overspending carried from the closed previous month; subtracted from what is left to assign. */
  overspent_carryover: number
  closed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Envelope {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  is_savings: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface EnvelopeBudget {
  id: string
  envelope_id: string
  budget_period_id: string
  projected_amount: number
  /** Leftover received from the closed previous month. */
  carryover_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  envelope_id: string | null
  bank_account_id: string | null
  budget_period_id: string
  type: TransactionType
  amount: number
  description: string
  transaction_date: string
  is_executed: boolean
  /** Shared by the two rows of a transfer (type = 'transfer'). */
  transfer_group_id: string | null
  /** 'out' leaves the account, 'in' enters it. Only for transfers. */
  transfer_direction: TransferDirection | null
  recurring_template_id: string | null
  /** Scheduled date of a recurring occurrence (transaction_date may change when confirmed). */
  recurrence_date: string | null
  /** Generated column: recurring_template_id is not null. */
  is_recurring: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RecurringTemplate {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  envelope_id: string | null
  /** Account of income/expense, or source account of a transfer. */
  bank_account_id: string | null
  /** Destination account; transfers only. */
  to_bank_account_id: string | null
  frequency: RecurrenceFrequency
  /** Monthly only; days past the end of a short month fall on its last day. */
  day_of_month: number | null
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  envelope_id: string | null
  name: string
  description: string | null
  estimated_cost: number
  saved_amount: number
  target_date: string | null
  priority: number
  status: GoalStatus
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  user_id: string
  name: string
  account_type: AccountType
  balance: number
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// View types
export interface EnvelopeSummary {
  envelope_budget_id: string
  budget_period_id: string
  envelope_id: string
  user_id: string
  envelope_name: string
  color: string
  icon: string
  is_savings: boolean
  sort_order: number
  projected_amount: number
  carryover_amount: number
  /** projected_amount + carryover_amount: what can be spent this month. */
  spendable_amount: number
  executed_amount: number
  planned_pending_amount: number
  available_amount: number
  pct_executed: number
}

export interface PeriodSummary {
  budget_period_id: string
  user_id: string
  period_date: string
  projected_income: number
  opening_balance: number | null
  overspent_carryover: number
  closed_at: string | null
  total_budgeted: number
  total_carryover: number
  /** projected_income − total_budgeted − overspent_carryover */
  unassigned_amount: number
  real_income_received: number
  real_expenses_paid: number
  pending_income: number
  pending_expenses: number
}

/** Result of the period_reconciliation RPC (Discrepancia card). */
export interface PeriodReconciliation {
  opening_balance: number | null
  /** Balance effect of this month's executed movements that have an account. */
  recorded_flow: number
  /** opening_balance + recorded_flow; null when the opening balance is unknown. */
  expected_end: number | null
  /** Active account balances minus the effect of movements recorded in later months. */
  actual_end: number
  /** actual_end − expected_end: money that moved outside the app (manual balance updates). */
  difference: number | null
  income_without_account: number
  expenses_without_account: number
}

/** Result of the close_month RPC. */
export interface CloseMonthResult {
  next_period_id: string
  next_period_date: string
  opening_balance: number
  carried_total: number
  overspent: number
}

type WithEnvelope = Transaction & { envelope?: Envelope | null }

/** A list entry: a regular movement, or both rows of a transfer shown as one line. */
export type MovementEntry =
  | { kind: 'transaction'; id: string; tx: WithEnvelope }
  | { kind: 'transfer'; id: string; out: Transaction | null; in: Transaction | null }
