-- ============================================================
-- Migration 005: Month close (carry-over), opening balance, reconciliation, safer views
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 004)
--
-- Cierre de mes estilo Actual Budget:
--  · lo que sobró en una categoría pasa a esa categoría el mes siguiente (carryover_amount)
--  · lo sobregastado se descuenta de lo disponible para asignar el mes siguiente (overspent_carryover)
--  · el saldo de apertura del mes siguiente queda guardado (opening_balance)
-- ============================================================

-- Views depend on budget_periods.real_bank_balance: drop them first, recreate below.
drop view if exists public.v_period_summary;
drop view if exists public.v_envelope_summary;

-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
alter table public.budget_periods
  drop column real_bank_balance,                                     -- always 0, never read
  add column opening_balance     numeric(14,2),                      -- NULL = not set yet
  add column overspent_carryover numeric(14,2) not null default 0 check (overspent_carryover >= 0),
  add column closed_at           timestamptz,
  add constraint chk_budget_periods_first_of_month
    check (period_date = date_trunc('month', period_date)::date);

alter table public.envelope_budgets
  add column carryover_amount numeric(14,2) not null default 0 check (carryover_amount >= 0);

-- ------------------------------------------------------------
-- 2. Balance of the user's active accounts at the start of a month
--    = today's balances minus the effect of every executed movement from that month on.
--    (Balances are derived from movements by trigger 003; manual "Actualizar saldo"
--     adjustments are the only thing this cannot attribute to a month.)
-- ------------------------------------------------------------
create or replace function public.balance_at_period_start(p_period_date date)
returns numeric language sql stable security invoker set search_path = public as $$
  select
    coalesce((select sum(balance) from bank_accounts where user_id = auth.uid() and is_active), 0)
    - coalesce((
        select sum(tx_balance_delta(t.type, t.transfer_direction, t.amount, t.is_executed, t.bank_account_id))
          from transactions t
          join budget_periods bp on bp.id = t.budget_period_id
          join bank_accounts  a  on a.id  = t.bank_account_id and a.is_active
         where t.user_id = auth.uid()
           and bp.period_date >= p_period_date
      ), 0)
$$;

-- "Fijar saldo de apertura" for a month that was never closed.
create or replace function public.set_opening_balance(p_budget_period_id uuid)
returns numeric language plpgsql security invoker set search_path = public as $$
declare
  v_date    date;
  v_balance numeric;
begin
  select period_date into v_date from budget_periods where id = p_budget_period_id and user_id = auth.uid();
  if not found then raise exception 'period not found'; end if;
  v_balance := balance_at_period_start(v_date);
  update budget_periods set opening_balance = v_balance where id = p_budget_period_id;
  return v_balance;
end $$;

-- ------------------------------------------------------------
-- 3. Close a month (re-running it recalculates; it never locks the month)
-- ------------------------------------------------------------
-- available = budgeted + carry-over − executed expenses (transfers never count).
create or replace function public.period_envelope_available(p_budget_period_id uuid)
returns table (envelope_id uuid, projected_amount numeric, available numeric)
language sql stable security invoker set search_path = public as $$
  select eb.envelope_id,
         eb.projected_amount,
         eb.projected_amount + eb.carryover_amount
           - coalesce((select sum(t.amount) from transactions t
                        where t.envelope_id = eb.envelope_id
                          and t.budget_period_id = eb.budget_period_id
                          and t.type = 'expense' and t.is_executed), 0)
    from envelope_budgets eb
    join envelopes e on e.id = eb.envelope_id and e.user_id = auth.uid()
   where eb.budget_period_id = p_budget_period_id
$$;

create or replace function public.close_month(p_budget_period_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_period    budget_periods%rowtype;
  v_next_date date;
  v_next      budget_periods%rowtype;
  v_carried   numeric;
  v_overspent numeric;
  v_opening   numeric;
begin
  select * into v_period from budget_periods where id = p_budget_period_id and user_id = v_uid for update;
  if not found then raise exception 'period not found'; end if;
  v_next_date := (v_period.period_date + interval '1 month')::date;

  select * into v_next from budget_periods where user_id = v_uid and period_date = v_next_date for update;
  if found and v_next.closed_at is not null then
    raise exception 'next_month_closed';
  end if;

  -- 1. Next month: create it, or reuse the one already configured (its income is kept).
  if not found then
    insert into budget_periods (user_id, period_date, projected_income)
    values (v_uid, v_next_date, v_period.projected_income)
    returning * into v_next;
  end if;

  -- 2. Per-category leftover rolls into the same category; an already planned amount
  --    next month is not overwritten.
  insert into envelope_budgets (envelope_id, budget_period_id, projected_amount, carryover_amount)
  select envelope_id, v_next.id, projected_amount, greatest(available, 0)
    from period_envelope_available(p_budget_period_id)
  on conflict (envelope_id, budget_period_id)
  do update set carryover_amount = excluded.carryover_amount;

  select coalesce(sum(greatest(available, 0)), 0),
         coalesce(sum(greatest(-available, 0)), 0)
    into v_carried, v_overspent
    from period_envelope_available(p_budget_period_id);

  -- 3. Opening balance of next month (excludes movements already recorded in later months).
  v_opening := balance_at_period_start(v_next_date);

  update budget_periods
     set overspent_carryover = v_overspent,
         opening_balance     = v_opening
   where id = v_next.id;

  update budget_periods set closed_at = now() where id = p_budget_period_id;

  -- 4. Projected recurring movements for the new month.
  perform generate_recurring_occurrences(v_next.id);

  return jsonb_build_object(
    'next_period_id',   v_next.id,
    'next_period_date', v_next_date,
    'opening_balance',  v_opening,
    'carried_total',    v_carried,
    'overspent',        v_overspent
  );
end $$;

-- Undo a close: the next month loses what it received from this one.
create or replace function public.reopen_month(p_budget_period_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_period budget_periods%rowtype;
  v_next   budget_periods%rowtype;
begin
  select * into v_period from budget_periods where id = p_budget_period_id and user_id = auth.uid() for update;
  if not found then raise exception 'period not found'; end if;

  select * into v_next from budget_periods
   where user_id = auth.uid() and period_date = (v_period.period_date + interval '1 month')::date
     for update;
  if found then
    if v_next.closed_at is not null then raise exception 'next_month_closed'; end if;
    update budget_periods set overspent_carryover = 0, opening_balance = null where id = v_next.id;
    update envelope_budgets set carryover_amount = 0 where budget_period_id = v_next.id;
  end if;

  update budget_periods set closed_at = null where id = p_budget_period_id;
end $$;

-- ------------------------------------------------------------
-- 4. Reconciliation for the "Discrepancia" card
--    expected_end = opening + this month's balance effect of executed movements with an account
--    actual_end   = active balances minus the effect of movements in later months
--    difference   = money that moved outside the app (manual "Actualizar saldo")
-- ------------------------------------------------------------
create or replace function public.period_reconciliation(p_budget_period_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_period    budget_periods%rowtype;
  v_flow      numeric;
  v_actual    numeric;
  v_no_acct_in  numeric;
  v_no_acct_out numeric;
begin
  select * into v_period from budget_periods where id = p_budget_period_id and user_id = auth.uid();
  if not found then raise exception 'period not found'; end if;

  select coalesce(sum(tx_balance_delta(t.type, t.transfer_direction, t.amount, t.is_executed, t.bank_account_id)), 0)
    into v_flow
    from transactions t
    join bank_accounts a on a.id = t.bank_account_id and a.is_active
   where t.budget_period_id = p_budget_period_id;

  v_actual := balance_at_period_start((v_period.period_date + interval '1 month')::date);

  select coalesce(sum(amount) filter (where type = 'income'),  0),
         coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_no_acct_in, v_no_acct_out
    from transactions
   where budget_period_id = p_budget_period_id and is_executed and bank_account_id is null;

  return jsonb_build_object(
    'opening_balance',             v_period.opening_balance,
    'recorded_flow',               v_flow,
    'expected_end',                v_period.opening_balance + v_flow,   -- null when opening is unknown
    'actual_end',                  v_actual,
    'difference',                  v_actual - (v_period.opening_balance + v_flow),
    'income_without_account',      v_no_acct_in,
    'expenses_without_account',    v_no_acct_out
  );
end $$;

revoke all on function public.period_envelope_available(uuid) from public, anon;
grant execute on function public.period_envelope_available(uuid) to authenticated;
revoke all on function public.balance_at_period_start(date)  from public, anon;
revoke all on function public.set_opening_balance(uuid)      from public, anon;
revoke all on function public.close_month(uuid)              from public, anon;
revoke all on function public.reopen_month(uuid)             from public, anon;
revoke all on function public.period_reconciliation(uuid)    from public, anon;
grant execute on function public.balance_at_period_start(date) to authenticated;
grant execute on function public.set_opening_balance(uuid)     to authenticated;
grant execute on function public.close_month(uuid)             to authenticated;
grant execute on function public.reopen_month(uuid)            to authenticated;
grant execute on function public.period_reconciliation(uuid)   to authenticated;

-- ------------------------------------------------------------
-- 5. Views — security_invoker so RLS applies; transfers never count
-- ------------------------------------------------------------
create view public.v_envelope_summary with (security_invoker = true) as
select
  eb.id                                                         as envelope_budget_id,
  eb.budget_period_id,
  e.id                                                          as envelope_id,
  e.user_id,
  e.name                                                        as envelope_name,
  e.color,
  e.icon,
  e.is_savings,
  e.sort_order,
  eb.projected_amount,
  eb.carryover_amount,
  eb.projected_amount + eb.carryover_amount                     as spendable_amount,
  coalesce(sum(t.amount) filter (where t.is_executed), 0)       as executed_amount,
  coalesce(sum(t.amount) filter (where not t.is_executed), 0)   as planned_pending_amount,
  eb.projected_amount + eb.carryover_amount
    - coalesce(sum(t.amount) filter (where t.is_executed), 0)   as available_amount,
  case when eb.projected_amount + eb.carryover_amount > 0
       then round(coalesce(sum(t.amount) filter (where t.is_executed), 0)
                  / (eb.projected_amount + eb.carryover_amount) * 100, 1)
       else 0
  end                                                           as pct_executed
from public.envelope_budgets eb
join public.envelopes e on e.id = eb.envelope_id
left join public.transactions t
  on t.envelope_id = e.id
 and t.budget_period_id = eb.budget_period_id
 and t.type = 'expense'
group by eb.id, e.id;

create view public.v_period_summary with (security_invoker = true) as
select
  bp.id                                                         as budget_period_id,
  bp.user_id,
  bp.period_date,
  bp.projected_income,
  bp.opening_balance,
  bp.overspent_carryover,
  bp.closed_at,
  coalesce(sum(eb.projected_amount), 0)                         as total_budgeted,
  coalesce(sum(eb.carryover_amount), 0)                         as total_carryover,
  bp.projected_income - coalesce(sum(eb.projected_amount), 0) - bp.overspent_carryover as unassigned_amount,
  tx.real_income_received,
  tx.real_expenses_paid,
  tx.pending_income,
  tx.pending_expenses
from public.budget_periods bp
left join public.envelope_budgets eb on eb.budget_period_id = bp.id
cross join lateral (
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'  and     t.is_executed), 0) as real_income_received,
    coalesce(sum(t.amount) filter (where t.type = 'expense' and     t.is_executed), 0) as real_expenses_paid,
    coalesce(sum(t.amount) filter (where t.type = 'income'  and not t.is_executed), 0) as pending_income,
    coalesce(sum(t.amount) filter (where t.type = 'expense' and not t.is_executed), 0) as pending_expenses
  from public.transactions t
  where t.budget_period_id = bp.id and t.type <> 'transfer'
) tx
group by bp.id, tx.real_income_received, tx.real_expenses_paid, tx.pending_income, tx.pending_expenses;

grant select on public.v_envelope_summary, public.v_period_summary to authenticated;
