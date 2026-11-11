-- ============================================================
-- Migration 004: Recurring movements (templates + projected occurrences)
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 003)
--
-- Una plantilla genera cada mes movimientos "Proyectados" (is_executed = false).
-- Nunca mueven saldo hasta que el usuario los confirma.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Templates
-- ------------------------------------------------------------
create table public.recurring_templates (
  id                 uuid          primary key default gen_random_uuid(),
  user_id            uuid          not null references public.profiles(id) on delete cascade,
  type               varchar(10)   not null check (type in ('income', 'expense', 'transfer')),
  amount             numeric(14,2) not null check (amount > 0),
  description        varchar(255)  not null,
  envelope_id        uuid          references public.envelopes(id) on delete set null,
  bank_account_id    uuid          references public.bank_accounts(id) on delete set null,  -- source account for transfers
  to_bank_account_id uuid          references public.bank_accounts(id) on delete set null,  -- transfers only
  frequency          varchar(10)   not null check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  day_of_month       smallint      check (day_of_month between 1 and 31),                  -- monthly; clamped to the month length
  start_date         date          not null,  -- anchor for weekly/biweekly; month + day for yearly
  end_date           date,
  is_active          boolean       not null default true,
  notes              text,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now(),
  constraint chk_recurring_transfer_shape check (
    (type = 'transfer' and envelope_id is null and bank_account_id is not null
       and to_bank_account_id is not null and bank_account_id <> to_bank_account_id)
    or (type <> 'transfer' and to_bank_account_id is null)
  ),
  constraint chk_recurring_monthly_day check (frequency <> 'monthly' or day_of_month is not null),
  constraint chk_recurring_dates check (end_date is null or end_date >= start_date)
);

create index idx_recurring_templates_user on public.recurring_templates(user_id) where is_active;

create trigger trg_recurring_templates_updated_at
  before update on public.recurring_templates
  for each row execute function public.handle_updated_at();

-- "Template X was already generated for period Y". Lets the user delete ("Omitir") one
-- occurrence without it coming back the next time the month is loaded.
create table public.recurring_generation_log (
  recurring_template_id uuid        not null references public.recurring_templates(id) on delete cascade,
  budget_period_id      uuid        not null references public.budget_periods(id) on delete cascade,
  generated_at          timestamptz not null default now(),
  primary key (recurring_template_id, budget_period_id)
);

alter table public.recurring_templates      enable row level security;
alter table public.recurring_generation_log enable row level security;

create policy "users_own_recurring_templates"
  on public.recurring_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_recurring_log"
  on public.recurring_generation_log for all
  using (exists (
    select 1 from public.recurring_templates t
    where t.id = recurring_generation_log.recurring_template_id and t.user_id = auth.uid()
  ));

-- ------------------------------------------------------------
-- 2. transactions: link to the template (the old recurrence columns were never written)
-- ------------------------------------------------------------
alter table public.transactions drop column recurring_parent_id;
alter table public.transactions drop column recurrence_end_date;
alter table public.transactions drop column recurrence_frequency;
alter table public.transactions drop column is_recurring;

alter table public.transactions
  add column recurring_template_id uuid references public.recurring_templates(id) on delete set null,
  add column recurrence_date       date;  -- the scheduled slot; transaction_date may change when confirmed

alter table public.transactions
  add column is_recurring boolean generated always as (recurring_template_id is not null) stored;

-- One occurrence per (template, slot, side). NULLS NOT DISTINCT so non-transfer rows
-- (direction NULL) still collide. Needs PostgreSQL 15+.
create unique index uq_transactions_recurrence
  on public.transactions (recurring_template_id, recurrence_date, transfer_direction) nulls not distinct
  where recurring_template_id is not null;

-- ------------------------------------------------------------
-- 3. Dates of a template inside one month
-- ------------------------------------------------------------
create or replace function public.recurrence_dates(
  p_frequency text, p_start_date date, p_day_of_month int, p_from date, p_to date
) returns setof date language plpgsql immutable as $$
declare
  v_last int := extract(day from p_to)::int;  -- p_to is the last day of the month
begin
  case p_frequency
    when 'monthly' then
      return query select make_date(extract(year from p_from)::int, extract(month from p_from)::int,
                                    least(p_day_of_month, v_last));
    when 'yearly' then
      if extract(month from p_start_date) = extract(month from p_from) then
        return query select make_date(extract(year from p_from)::int, extract(month from p_from)::int,
                                      least(extract(day from p_start_date)::int, v_last));
      end if;
    when 'weekly' then
      return query select d::date from generate_series(p_start_date::timestamp, p_to::timestamp, interval '7 days') d
                    where d::date >= p_from;
    when 'biweekly' then
      return query select d::date from generate_series(p_start_date::timestamp, p_to::timestamp, interval '14 days') d
                    where d::date >= p_from;
  end case;
end $$;

-- ------------------------------------------------------------
-- 4. Generate the month's projected occurrences (idempotent)
-- ------------------------------------------------------------
create or replace function public.generate_recurring_occurrences(p_budget_period_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_period budget_periods%rowtype;
  v_from   date;
  v_to     date;
  v_tpl    recurring_templates%rowtype;
  v_date   date;
  v_group  uuid;
  v_count  int := 0;
begin
  -- Locking the period serializes concurrent calls (Inicio and Movimientos load at the same time).
  select * into v_period from budget_periods
   where id = p_budget_period_id and user_id = auth.uid()
     for update;
  if not found then raise exception 'period not found'; end if;

  v_from := v_period.period_date;
  v_to   := (v_from + interval '1 month' - interval '1 day')::date;

  for v_tpl in
    select t.* from recurring_templates t
     where t.user_id = v_period.user_id
       and t.is_active
       and t.start_date <= v_to
       and (t.end_date is null or t.end_date >= v_from)
       and not exists (select 1 from recurring_generation_log l
                        where l.recurring_template_id = t.id and l.budget_period_id = p_budget_period_id)
     order by t.created_at
  loop
    for v_date in
      select d from recurrence_dates(v_tpl.frequency, v_tpl.start_date, v_tpl.day_of_month, v_from, v_to) d
       where d >= v_tpl.start_date and (v_tpl.end_date is null or d <= v_tpl.end_date)
    loop
      if v_tpl.type = 'transfer' then
        -- A transfer template whose account was removed can't produce a valid pair: skip it.
        continue when v_tpl.bank_account_id is null or v_tpl.to_bank_account_id is null;
        v_group := gen_random_uuid();
        insert into transactions
          (user_id, budget_period_id, bank_account_id, type, transfer_group_id, transfer_direction,
           amount, description, transaction_date, is_executed, recurring_template_id, recurrence_date, notes)
        values
          (v_tpl.user_id, p_budget_period_id, v_tpl.bank_account_id,    'transfer', v_group, 'out',
           v_tpl.amount, v_tpl.description, v_date, false, v_tpl.id, v_date, v_tpl.notes),
          (v_tpl.user_id, p_budget_period_id, v_tpl.to_bank_account_id, 'transfer', v_group, 'in',
           v_tpl.amount, v_tpl.description, v_date, false, v_tpl.id, v_date, v_tpl.notes)
        on conflict do nothing;
      else
        insert into transactions
          (user_id, budget_period_id, envelope_id, bank_account_id, type,
           amount, description, transaction_date, is_executed, recurring_template_id, recurrence_date, notes)
        values
          (v_tpl.user_id, p_budget_period_id, v_tpl.envelope_id, v_tpl.bank_account_id, v_tpl.type,
           v_tpl.amount, v_tpl.description, v_date, false, v_tpl.id, v_date, v_tpl.notes)
        on conflict do nothing;
      end if;
      v_count := v_count + 1;
    end loop;

    insert into recurring_generation_log (recurring_template_id, budget_period_id)
    values (v_tpl.id, p_budget_period_id)
    on conflict do nothing;
  end loop;

  return v_count;
end $$;

-- ------------------------------------------------------------
-- 5. Confirm a projected movement (the balance trigger moves the account)
-- ------------------------------------------------------------
create or replace function public.confirm_transaction(
  p_transaction_id uuid, p_executed_on date default null
) returns void language plpgsql security invoker set search_path = public as $$
declare v_rows int;
begin
  update transactions
     set is_executed      = true,
         transaction_date = coalesce(p_executed_on, transaction_date)
   where id = p_transaction_id and user_id = auth.uid() and not is_executed;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'transaction not found or already executed'; end if;
  -- For a transfer, trg_transactions_sync_transfer confirms the other side too.
end $$;

-- ------------------------------------------------------------
-- 6. Re-generate a template's pending occurrences from a month on
--    (after editing, pausing or resuming it). Confirmed movements never change.
-- ------------------------------------------------------------
create or replace function public.resync_recurring_template(p_template_id uuid, p_from_period_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare v_period record;
begin
  if not exists (select 1 from recurring_templates where id = p_template_id and user_id = auth.uid()) then
    raise exception 'template not found';
  end if;

  delete from transactions t
   using budget_periods bp
   where t.recurring_template_id = p_template_id
     and not t.is_executed
     and bp.id = t.budget_period_id
     and bp.period_date >= p_from_period_date;

  delete from recurring_generation_log l
   using budget_periods bp
   where l.recurring_template_id = p_template_id
     and bp.id = l.budget_period_id
     and bp.period_date >= p_from_period_date;

  for v_period in
    select id from budget_periods
     where user_id = auth.uid() and period_date >= p_from_period_date
     order by period_date
  loop
    perform generate_recurring_occurrences(v_period.id);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 7. Delete a template: pending occurrences go, confirmed history stays (link set to null)
-- ------------------------------------------------------------
create or replace function public.delete_recurring_template(p_template_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_rows int;
begin
  delete from transactions
   where recurring_template_id = p_template_id and not is_executed and user_id = auth.uid();
  delete from recurring_templates where id = p_template_id and user_id = auth.uid();
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'template not found'; end if;
end $$;

revoke all on function public.generate_recurring_occurrences(uuid)        from public, anon;
revoke all on function public.confirm_transaction(uuid, date)            from public, anon;
revoke all on function public.resync_recurring_template(uuid, date)      from public, anon;
revoke all on function public.delete_recurring_template(uuid)            from public, anon;
grant execute on function public.generate_recurring_occurrences(uuid)    to authenticated;
grant execute on function public.confirm_transaction(uuid, date)         to authenticated;
grant execute on function public.resync_recurring_template(uuid, date)   to authenticated;
grant execute on function public.delete_recurring_template(uuid)         to authenticated;
