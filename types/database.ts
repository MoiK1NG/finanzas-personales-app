export type Currency = 'COP'
export type AccountType = 'checking' | 'savings' | 'digital' | 'cash'

export type TransactionType = 'income' | 'expense' | 'transfer'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
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
  real_bank_balance: number
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
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  envelope_id: string | null
  budget_period_id: string
  type: TransactionType
  amount: number
  description: string
  transaction_date: string
  is_executed: boolean
  is_recurring: boolean
  recurrence_frequency: RecurrenceFrequency | null
  recurrence_end_date: string | null
  recurring_parent_id: string | null
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
  projected_amount: number
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
  real_bank_balance: number
  total_budgeted: number
  unassigned_amount: number
  theoretical_balance: number
  real_income_received: number
  real_expenses_paid: number
}
