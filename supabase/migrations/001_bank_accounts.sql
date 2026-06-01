-- ============================================================
-- Migration 001: Bank Accounts
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

create table public.bank_accounts (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         not null references public.profiles(id) on delete cascade,
  name         varchar(100) not null,
  account_type varchar(30)  not null default 'digital'
                              check (account_type in ('checking','savings','digital','cash')),
  balance      numeric(14,2) not null default 0,
  color        varchar(7)   not null default '#6366f1',
  is_active    boolean      not null default true,
  sort_order   integer      not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

create index idx_bank_accounts_user on public.bank_accounts(user_id) where is_active = true;

create trigger trg_bank_accounts_updated_at
  before update on public.bank_accounts
  for each row execute function public.handle_updated_at();

alter table public.bank_accounts enable row level security;

create policy "users_own_bank_accounts"
  on public.bank_accounts for all using (auth.uid() = user_id);
