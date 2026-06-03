--- ============================================================
-- FinanzasApp — Schema completo para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 0. EXTENSIONES
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extiende auth.users de Supabase)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  currency    varchar(3)  not null default 'COP',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 2. BUDGET PERIODS
-- ============================================================
create table public.budget_periods (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  period_date       date        not null,
  projected_income  numeric(14,2) not null default 0,
  real_bank_balance numeric(14,2) not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(user_id, period_date)
);

-- ============================================================
-- 3. ENVELOPES / BOLSILLOS
-- ============================================================
create table public.envelopes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  name        varchar(100) not null,
  color       varchar(7)  not null default '#6366f1',
  icon        varchar(50) default 'wallet',
  is_savings  boolean     not null default false,
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 4. ENVELOPE BUDGETS
-- ============================================================
create table public.envelope_budgets (
  id                uuid        primary key default gen_random_uuid(),
  envelope_id       uuid        not null references public.envelopes(id) on delete cascade,
  budget_period_id  uuid        not null references public.budget_periods(id) on delete cascade,
  projected_amount  numeric(14,2) not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(envelope_id, budget_period_id)
);

-- ============================================================
-- 5. TRANSACTIONS
-- ============================================================
create table public.transactions (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  envelope_id           uuid        references public.envelopes(id) on delete set null,
  budget_period_id      uuid        not null references public.budget_periods(id) on delete cascade,
  type                  varchar(10) not null check (type in ('income', 'expense', 'transfer')),
  amount                numeric(14,2) not null check (amount > 0),
  description           varchar(255) not null,
  transaction_date      date        not null default current_date,
  is_executed           boolean     not null default true,
  is_recurring          boolean     not null default false,
  recurrence_frequency  varchar(20) check (recurrence_frequency in ('daily','weekly','biweekly','monthly','yearly')),
  recurrence_end_date   date,
  recurring_parent_id   uuid        references public.transactions(id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- 6. GOALS / WISHLIST
-- ============================================================
create table public.goals (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  envelope_id     uuid        references public.envelopes(id) on delete set null,
  name            varchar(200) not null,
  description     text,
  estimated_cost  numeric(14,2) not null check (estimated_cost > 0),
  saved_amount    numeric(14,2) not null default 0,
  target_date     date,
  priority        integer     not null default 3 check (priority between 1 and 5),
  status          varchar(20) not null default 'pending'
                    check (status in ('pending','in_progress','completed','cancelled')),
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 7. ÍNDICES
-- ============================================================
create index idx_budget_periods_user    on public.budget_periods(user_id, period_date desc);
create index idx_envelopes_user         on public.envelopes(user_id) where is_active = true;
create index idx_envelope_budgets_ep    on public.envelope_budgets(budget_period_id);
create index idx_transactions_period    on public.transactions(budget_period_id, transaction_date desc);
create index idx_transactions_envelope  on public.transactions(envelope_id, budget_period_id);
create index idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index idx_goals_user             on public.goals(user_id, status);

-- ============================================================
-- 8. TRIGGER: updated_at automático
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles for each row execute function public.handle_updated_at();
create trigger trg_budget_periods_updated_at
  before update on public.budget_periods for each row execute function public.handle_updated_at();
create trigger trg_envelopes_updated_at
  before update on public.envelopes for each row execute function public.handle_updated_at();
create trigger trg_envelope_budgets_updated_at
  before update on public.envelope_budgets for each row execute function public.handle_updated_at();
create trigger trg_transactions_updated_at
  before update on public.transactions for each row execute function public.handle_updated_at();
create trigger trg_goals_updated_at
  before update on public.goals for each row execute function public.handle_updated_at();

-- ============================================================
-- 9. TRIGGER: crear perfil automáticamente al registrar
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 10. VISTA: Resumen por bolsillo en un período
-- ============================================================
create or replace view public.v_envelope_summary as
select
  eb.id                                           as envelope_budget_id,
  eb.budget_period_id,
  e.id                                            as envelope_id,
  e.user_id,
  e.name                                          as envelope_name,
  e.color,
  e.icon,
  e.is_savings,
  eb.projected_amount,
  coalesce(sum(t.amount) filter (
    where t.is_executed = true and t.type = 'expense'
  ), 0)                                           as executed_amount,
  coalesce(sum(t.amount) filter (
    where t.is_executed = false and t.type = 'expense'
  ), 0)                                           as planned_pending_amount,
  eb.projected_amount - coalesce(sum(t.amount) filter (
    where t.is_executed = true and t.type = 'expense'
  ), 0)                                           as available_amount,
  case when eb.projected_amount > 0
    then round(
      coalesce(sum(t.amount) filter (
        where t.is_executed = true and t.type = 'expense'
      ), 0) / eb.projected_amount * 100, 1
    )
    else 0
  end                                             as pct_executed
from public.envelope_budgets eb
join public.envelopes e on e.id = eb.envelope_id
left join public.transactions t
  on t.envelope_id = e.id
  and t.budget_period_id = eb.budget_period_id
group by eb.id, e.id;

-- ============================================================
-- 11. VISTA: KPIs del período
-- ============================================================
create or replace view public.v_period_summary as
select
  bp.id                                           as budget_period_id,
  bp.user_id,
  bp.period_date,
  bp.projected_income,
  bp.real_bank_balance,
  coalesce(sum(eb.projected_amount), 0)           as total_budgeted,
  bp.projected_income - coalesce(sum(eb.projected_amount), 0) as unassigned_amount,
  bp.projected_income - coalesce(sum(eb.projected_amount), 0) as theoretical_balance,
  coalesce((
    select sum(t2.amount) from public.transactions t2
    where t2.budget_period_id = bp.id and t2.type = 'income' and t2.is_executed = true
  ), 0)                                           as real_income_received,
  coalesce((
    select sum(t3.amount) from public.transactions t3
    where t3.budget_period_id = bp.id and t3.type = 'expense' and t3.is_executed = true
  ), 0)                                           as real_expenses_paid
from public.budget_periods bp
left join public.envelope_budgets eb on eb.budget_period_id = bp.id
group by bp.id;

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles         enable row level security;
alter table public.budget_periods   enable row level security;
alter table public.envelopes        enable row level security;
alter table public.envelope_budgets enable row level security;
alter table public.transactions     enable row level security;
alter table public.goals            enable row level security;

create policy "users_own_profile"
  on public.profiles for all using (auth.uid() = id);

create policy "users_own_periods"
  on public.budget_periods for all using (auth.uid() = user_id);

create policy "users_own_envelopes"
  on public.envelopes for all using (auth.uid() = user_id);

create policy "users_own_envelope_budgets"
  on public.envelope_budgets for all
  using (
    exists (
      select 1 from public.envelopes e
      where e.id = envelope_budgets.envelope_id and e.user_id = auth.uid()
    )
  );

create policy "users_own_transactions"
  on public.transactions for all using (auth.uid() = user_id);

create policy "users_own_goals"
  on public.goals for all using (auth.uid() = user_id);
