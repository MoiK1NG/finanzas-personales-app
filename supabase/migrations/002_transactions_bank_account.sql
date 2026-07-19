-- ============================================================
-- Migration 002: Link transactions to bank accounts
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.transactions
  add column bank_account_id uuid references public.bank_accounts(id) on delete set null;

create index idx_transactions_bank_account
  on public.transactions(bank_account_id)
  where bank_account_id is not null;
