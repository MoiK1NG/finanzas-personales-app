-- ============================================================
-- Migration 003: Transfers between accounts + atomic account balances
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 002)
-- Requiere PostgreSQL 15+  (select version();)
--
-- IMPORTANTE: desde esta migración el saldo de las cuentas lo mueve la base de datos.
-- Despliega la versión nueva de la app inmediatamente después y no registres
-- movimientos con la versión vieja en el medio (los contaría dos veces).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Transfer columns
-- ------------------------------------------------------------
do $$ begin
  if exists (select 1 from public.transactions where type = 'transfer') then
    raise exception 'Hay movimientos con type=transfer creados antes de esta migración; conviértelos antes de aplicar 003';
  end if;
end $$;

alter table public.transactions
  add column transfer_group_id  uuid,
  add column transfer_direction varchar(3) check (transfer_direction in ('out', 'in'));

-- A transfer always has its group, direction and account, and never a category.
alter table public.transactions
  add constraint chk_transactions_transfer_shape check (
    (type = 'transfer'
       and transfer_group_id is not null and transfer_direction is not null
       and envelope_id is null and bank_account_id is not null)
    or
    (type <> 'transfer' and transfer_group_id is null and transfer_direction is null)
  );

-- Exactly one 'out' and one 'in' per transfer; also the lookup index for the pair.
create unique index uq_transactions_transfer_side
  on public.transactions (transfer_group_id, transfer_direction)
  where transfer_group_id is not null;

-- ------------------------------------------------------------
-- 2. Ownership of referenced rows (FK checks run as owner and ignore RLS)
-- ------------------------------------------------------------
create or replace function public.validate_transaction_refs()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'transactions.user_id must be the current user';
  end if;
  if not exists (select 1 from budget_periods where id = new.budget_period_id and user_id = new.user_id) then
    raise exception 'budget period not found or not owned';
  end if;
  if new.envelope_id is not null
     and not exists (select 1 from envelopes where id = new.envelope_id and user_id = new.user_id) then
    raise exception 'envelope not found or not owned';
  end if;
  if new.bank_account_id is not null
     and not exists (select 1 from bank_accounts where id = new.bank_account_id and user_id = new.user_id) then
    raise exception 'bank account not found or not owned';
  end if;
  return new;
end $$;

create trigger trg_transactions_validate_refs
  before insert or update of user_id, budget_period_id, envelope_id, bank_account_id
  on public.transactions
  for each row execute function public.validate_transaction_refs();

-- ------------------------------------------------------------
-- 3. Balance effect of a transaction (single source of truth)
--    income / transfer-in  → +amount
--    expense / transfer-out → −amount
--    projected (not executed) or without account → 0
-- ------------------------------------------------------------
create or replace function public.tx_balance_delta(
  p_type text, p_direction text, p_amount numeric, p_is_executed boolean, p_bank_account_id uuid
) returns numeric language sql immutable as $$
  select case
    when p_bank_account_id is null or not p_is_executed then 0
    when p_type = 'income'                          then  p_amount
    when p_type = 'transfer' and p_direction = 'in' then  p_amount
    else                                                 -p_amount
  end
$$;

create or replace function public.apply_transaction_balance()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_old  numeric := 0;
  v_new  numeric := 0;
  v_rows int;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := tx_balance_delta(old.type, old.transfer_direction, old.amount, old.is_executed, old.bank_account_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := tx_balance_delta(new.type, new.transfer_direction, new.amount, new.is_executed, new.bank_account_id);
  end if;

  -- Same account before and after: one net update.
  if tg_op = 'UPDATE' and old.bank_account_id is not distinct from new.bank_account_id then
    if v_new <> v_old then
      update bank_accounts set balance = balance + (v_new - v_old) where id = new.bank_account_id;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'bank account % not accessible', new.bank_account_id; end if;
    end if;
    return null;
  end if;

  -- Reverse the old effect (0 rows tolerated: the account may be going away via FK set null).
  if v_old <> 0 then
    update bank_accounts set balance = balance - v_old where id = old.bank_account_id;
  end if;

  -- Apply the new effect; it must hit an account the user owns.
  if v_new <> 0 then
    update bank_accounts set balance = balance + v_new where id = new.bank_account_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'bank account % not accessible', new.bank_account_id; end if;
  end if;

  return null;
end $$;

create trigger trg_transactions_balance
  after insert
     or update of amount, type, is_executed, bank_account_id, transfer_direction
     or delete
  on public.transactions
  for each row execute function public.apply_transaction_balance();

-- ------------------------------------------------------------
-- 4. Transfers behave as one unit
-- ------------------------------------------------------------
-- A row cannot be turned into a transfer or out of one (delete and create instead).
create or replace function public.guard_transfer_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if (old.type = 'transfer') <> (new.type = 'transfer')
     or old.transfer_group_id  is distinct from new.transfer_group_id
     or old.transfer_direction is distinct from new.transfer_direction then
    raise exception 'Una transferencia no se puede convertir en otro tipo de movimiento';
  end if;
  return new;
end $$;

create trigger trg_transactions_guard_transfer
  before update of type, transfer_group_id, transfer_direction
  on public.transactions
  for each row execute function public.guard_transfer_identity();

-- Shared fields follow whichever side was edited.
-- pg_trigger_depth() > 1 means "fired by the sibling update below": stop the ping-pong.
create or replace function public.sync_transfer_sibling()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.type <> 'transfer' or pg_trigger_depth() > 1 then return null; end if;
  update transactions t
     set amount           = new.amount,
         description      = new.description,
         transaction_date = new.transaction_date,
         is_executed      = new.is_executed,
         budget_period_id = new.budget_period_id,
         notes            = new.notes
   where t.transfer_group_id = new.transfer_group_id
     and t.id <> new.id
     and (t.amount, t.description, t.transaction_date, t.is_executed, t.budget_period_id, t.notes)
         is distinct from
         (new.amount, new.description, new.transaction_date, new.is_executed, new.budget_period_id, new.notes);
  return null;
end $$;

create trigger trg_transactions_sync_transfer
  after update of amount, description, transaction_date, is_executed, budget_period_id, notes
  on public.transactions
  for each row execute function public.sync_transfer_sibling();

-- Deleting one side deletes the other (its own balance trigger reverses its account).
create or replace function public.delete_transfer_sibling()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.type <> 'transfer' or pg_trigger_depth() > 1 then return null; end if;
  delete from transactions where transfer_group_id = old.transfer_group_id and id <> old.id;
  return null;
end $$;

create trigger trg_transactions_delete_transfer_sibling
  after delete on public.transactions
  for each row execute function public.delete_transfer_sibling();

-- ------------------------------------------------------------
-- 5. RPCs for transfers (dates always come from the client: Supabase runs in UTC)
-- ------------------------------------------------------------
create or replace function public.create_transfer(
  p_budget_period_id uuid,
  p_from_account_id  uuid,
  p_to_account_id    uuid,
  p_amount           numeric,
  p_description      text,
  p_transaction_date date,
  p_is_executed      boolean default true,
  p_notes            text    default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_group uuid := gen_random_uuid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'La cuenta de origen y la de destino deben ser distintas'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;

  insert into transactions
    (user_id, budget_period_id, bank_account_id, type, transfer_group_id, transfer_direction,
     amount, description, transaction_date, is_executed, notes)
  values
    (v_uid, p_budget_period_id, p_from_account_id, 'transfer', v_group, 'out',
     p_amount, p_description, p_transaction_date, p_is_executed, p_notes),
    (v_uid, p_budget_period_id, p_to_account_id,   'transfer', v_group, 'in',
     p_amount, p_description, p_transaction_date, p_is_executed, p_notes);

  return v_group;
end $$;

create or replace function public.update_transfer(
  p_transfer_group_id uuid,
  p_from_account_id   uuid,
  p_to_account_id     uuid,
  p_amount            numeric,
  p_description       text,
  p_transaction_date  date,
  p_is_executed       boolean,
  p_notes             text default null
) returns void language plpgsql security invoker set search_path = public as $$
declare v_rows int;
begin
  if p_from_account_id = p_to_account_id then raise exception 'La cuenta de origen y la de destino deben ser distintas'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;

  -- The 'out' side carries the shared fields; the sync trigger mirrors them to 'in'.
  update transactions
     set bank_account_id  = p_from_account_id,
         amount           = p_amount,
         description      = p_description,
         transaction_date = p_transaction_date,
         is_executed      = p_is_executed,
         notes            = p_notes
   where transfer_group_id = p_transfer_group_id and transfer_direction = 'out' and user_id = auth.uid();
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'transfer not found'; end if;

  update transactions
     set bank_account_id = p_to_account_id
   where transfer_group_id = p_transfer_group_id and transfer_direction = 'in' and user_id = auth.uid();
end $$;

create or replace function public.delete_transfer(p_transfer_group_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare v_rows int;
begin
  delete from transactions where transfer_group_id = p_transfer_group_id and user_id = auth.uid();
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'transfer not found'; end if;
  return v_rows;
end $$;

revoke all on function public.create_transfer(uuid, uuid, uuid, numeric, text, date, boolean, text) from public, anon;
revoke all on function public.update_transfer(uuid, uuid, uuid, numeric, text, date, boolean, text) from public, anon;
revoke all on function public.delete_transfer(uuid) from public, anon;
grant execute on function public.create_transfer(uuid, uuid, uuid, numeric, text, date, boolean, text) to authenticated;
grant execute on function public.update_transfer(uuid, uuid, uuid, numeric, text, date, boolean, text) to authenticated;
grant execute on function public.delete_transfer(uuid) to authenticated;
