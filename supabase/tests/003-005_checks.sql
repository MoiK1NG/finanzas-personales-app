-- ============================================================
-- Checks for migrations 003–005
-- Ejecutar en: Supabase Dashboard > SQL Editor, DESPUÉS de aplicar 003, 004 y 005.
-- Corre como tu usuario (el primero de auth.users) dentro de una transacción
-- y termina en ROLLBACK: no deja ningún dato. Usa meses del año 2098–2099
-- para no mezclarse con tus datos reales.
-- Si todo está bien verás una serie de NOTICE "OK …" y al final "ALL CHECKS PASSED".
-- ============================================================
begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users order by created_at limit 1), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_uid   uuid := auth.uid();
  a       uuid;  -- account A
  b       uuid;  -- account B
  p       uuid;  -- period 2099-01
  e       uuid;  -- envelope
  t1      uuid;
  g       uuid;
  tpl     uuid;
  tpl2    uuid;
  n       int;
  bal_a   numeric;
  bal_b   numeric;
  r       uuid;  -- period 2098-01 (month close)
  e2      uuid;
  e3      uuid;
  res     jsonb;
  rec     jsonb;
  nxt     uuid;
  v_num   numeric;
  v_ok    boolean;
begin
  if v_uid is null then raise exception 'No user: auth.users is empty'; end if;

  -- ---------- setup ----------
  insert into bank_accounts (user_id, name, account_type, balance) values (v_uid, '__test A', 'digital', 1000000) returning id into a;
  insert into bank_accounts (user_id, name, account_type, balance) values (v_uid, '__test B', 'digital', 0)       returning id into b;
  insert into budget_periods (user_id, period_date, projected_income) values (v_uid, '2099-01-01', 2000000) returning id into p;
  insert into envelopes (user_id, name) values (v_uid, '__test Mercado') returning id into e;
  insert into envelope_budgets (envelope_id, budget_period_id, projected_amount) values (e, p, 300000);

  -- ---------- 003: balances follow movements ----------
  insert into transactions (user_id, budget_period_id, envelope_id, bank_account_id, type, amount, description, transaction_date, is_executed)
  values (v_uid, p, e, a, 'expense', 50000, 'gasto', '2099-01-05', true) returning id into t1;
  select balance into bal_a from bank_accounts where id = a;
  if bal_a <> 950000 then raise exception '1 insert expense: A expected 950000, got %', bal_a; end if;
  raise notice 'OK 1 executed expense lowers the account';

  update transactions set amount = 80000 where id = t1;
  select balance into bal_a from bank_accounts where id = a;
  if bal_a <> 920000 then raise exception '2 edit amount: A expected 920000, got %', bal_a; end if;
  raise notice 'OK 2 editing the amount applies only the difference';

  update transactions set bank_account_id = b where id = t1;
  select balance into bal_a from bank_accounts where id = a;
  select balance into bal_b from bank_accounts where id = b;
  if bal_a <> 1000000 or bal_b <> -80000 then raise exception '3 change account: A %, B %', bal_a, bal_b; end if;
  raise notice 'OK 3 moving to another account reverses the old one';

  update transactions set is_executed = false where id = t1;
  select balance into bal_b from bank_accounts where id = b;
  if bal_b <> 0 then raise exception '4 unexecute: B expected 0, got %', bal_b; end if;
  update transactions set is_executed = true where id = t1;
  select balance into bal_b from bank_accounts where id = b;
  if bal_b <> -80000 then raise exception '4 re-execute: B expected -80000, got %', bal_b; end if;
  raise notice 'OK 4 projected movements do not touch balances';

  update transactions set type = 'income', envelope_id = null where id = t1;
  select balance into bal_b from bank_accounts where id = b;
  if bal_b <> 80000 then raise exception '5 expense->income: B expected 80000, got %', bal_b; end if;
  raise notice 'OK 5 switching expense to income flips the sign';

  delete from transactions where id = t1;
  select balance into bal_b from bank_accounts where id = b;
  if bal_b <> 0 then raise exception '6 delete: B expected 0, got %', bal_b; end if;
  raise notice 'OK 6 deleting reverses the effect';

  -- ---------- 003: transfers ----------
  g := create_transfer(p, a, b, 200000, 'Ahorro', '2099-01-10', true, null);
  select balance into bal_a from bank_accounts where id = a;
  select balance into bal_b from bank_accounts where id = b;
  select count(*) into n from transactions where transfer_group_id = g;
  if n <> 2 or bal_a <> 800000 or bal_b <> 200000 then raise exception '7 create_transfer: rows %, A %, B %', n, bal_a, bal_b; end if;
  select real_income_received + real_expenses_paid into v_num from v_period_summary where budget_period_id = p;
  if v_num <> 0 then raise exception '7 transfer counted in v_period_summary: %', v_num; end if;
  raise notice 'OK 7 a transfer creates two linked rows and is not income/expense';

  perform update_transfer(g, b, a, 150000, 'Ahorro', '2099-01-10', true, null);
  select balance into bal_a from bank_accounts where id = a;
  select balance into bal_b from bank_accounts where id = b;
  if bal_a <> 1150000 or bal_b <> -150000 then raise exception '8 update_transfer swap: A %, B %', bal_a, bal_b; end if;
  raise notice 'OK 8 editing a transfer (amount and direction) moves both accounts';

  update transactions set amount = 100000 where transfer_group_id = g and transfer_direction = 'in';
  select balance into bal_a from bank_accounts where id = a;
  select balance into bal_b from bank_accounts where id = b;
  select count(distinct amount) into n from transactions where transfer_group_id = g;
  if n <> 1 or bal_a <> 1100000 or bal_b <> -100000 then raise exception '9 edit one side: amounts %, A %, B %', n, bal_a, bal_b; end if;
  raise notice 'OK 9 editing one side mirrors the other';

  begin
    update transactions set type = 'expense' where transfer_group_id = g and transfer_direction = 'out';
    raise exception '10 converting a transfer should fail';
  exception when others then
    if sqlerrm like '10 %' then raise; end if;
  end;
  raise notice 'OK 10 a transfer cannot be turned into another type';

  delete from transactions where transfer_group_id = g and transfer_direction = 'out';
  select count(*) into n from transactions where transfer_group_id = g;
  select balance into bal_a from bank_accounts where id = a;
  select balance into bal_b from bank_accounts where id = b;
  if n <> 0 or bal_a <> 1000000 or bal_b <> 0 then raise exception '11 delete one side: rows %, A %, B %', n, bal_a, bal_b; end if;
  raise notice 'OK 11 deleting one side deletes the pair and restores both accounts';

  begin
    perform create_transfer(p, a, a, 1000, 'x', '2099-01-10', true, null);
    raise exception '12 same-account transfer should fail';
  exception when others then
    if sqlerrm like '12 %' then raise; end if;
  end;
  raise notice 'OK 12 same source and destination is rejected';

  -- ---------- 004: recurring ----------
  insert into recurring_templates (user_id, type, amount, description, envelope_id, bank_account_id, frequency, day_of_month, start_date)
  values (v_uid, 'expense', 100000, 'Arriendo', e, a, 'monthly', 31, '2099-01-01') returning id into tpl;

  perform generate_recurring_occurrences(p);
  perform generate_recurring_occurrences(p);
  select count(*) into n from transactions where recurring_template_id = tpl;
  if n <> 1 then raise exception '13 idempotent generation: expected 1 row, got %', n; end if;
  select count(*) into n from transactions where recurring_template_id = tpl and transaction_date = '2099-01-31' and not is_executed and is_recurring;
  if n <> 1 then raise exception '13 occurrence date/projected/is_recurring wrong'; end if;
  select balance into bal_a from bank_accounts where id = a;
  if bal_a <> 1000000 then raise exception '13 projected occurrence moved the balance: %', bal_a; end if;
  raise notice 'OK 13 monthly occurrence generated once, projected, on the 31st';

  delete from transactions where recurring_template_id = tpl;
  perform generate_recurring_occurrences(p);
  select count(*) into n from transactions where recurring_template_id = tpl;
  if n <> 0 then raise exception '14 skipped occurrence came back'; end if;
  raise notice 'OK 14 an omitted occurrence does not come back';

  perform resync_recurring_template(tpl, '2099-01-01');
  select id into t1 from transactions where recurring_template_id = tpl;
  if t1 is null then raise exception '15 resync did not regenerate'; end if;
  perform confirm_transaction(t1, '2099-01-30');
  select balance into bal_a from bank_accounts where id = a;
  if bal_a <> 900000 then raise exception '15 confirm: A expected 900000, got %', bal_a; end if;
  if (select transaction_date from transactions where id = t1) <> '2099-01-30' then raise exception '15 confirm date not applied'; end if;
  raise notice 'OK 15 confirming a projected movement moves the balance';

  update recurring_templates set amount = 120000 where id = tpl;
  perform resync_recurring_template(tpl, '2099-01-01');
  select count(*) into n from transactions where recurring_template_id = tpl;
  if n <> 1 or (select amount from transactions where id = t1) <> 100000 then
    raise exception '16 resync touched a confirmed movement';
  end if;
  raise notice 'OK 16 editing a template never changes confirmed movements';

  insert into recurring_templates (user_id, type, amount, description, bank_account_id, frequency, start_date)
  values (v_uid, 'expense', 10000, 'Semanal', a, 'weekly', '2099-01-03') returning id into tpl2;
  perform generate_recurring_occurrences(p);
  select count(*) into n from transactions where recurring_template_id = tpl2;
  if n <> 5 then raise exception '17 weekly: expected 5 occurrences in Jan 2099, got %', n; end if;
  raise notice 'OK 17 weekly template expands to every week of the month';

  insert into recurring_templates (user_id, type, amount, description, bank_account_id, to_bank_account_id, frequency, day_of_month, start_date)
  values (v_uid, 'transfer', 50000, 'Ahorro mensual', a, b, 'monthly', 15, '2099-01-01') returning id into tpl2;
  perform generate_recurring_occurrences(p);
  select count(*) into n from transactions where recurring_template_id = tpl2 and type = 'transfer';
  if n <> 2 then raise exception '18 recurring transfer: expected 2 rows, got %', n; end if;
  select id into t1 from transactions where recurring_template_id = tpl2 and transfer_direction = 'out';
  perform confirm_transaction(t1, null);
  select count(*) into n from transactions where recurring_template_id = tpl2 and is_executed;
  select balance into bal_b from bank_accounts where id = b;
  if n <> 2 or bal_b <> 50000 then raise exception '18 confirm transfer: executed rows %, B %', n, bal_b; end if;
  raise notice 'OK 18 recurring transfer generates a pair and confirms both sides';

  perform delete_recurring_template(tpl);
  select count(*) into n from transactions where description = 'Arriendo' and recurring_template_id is null and is_executed;
  if n <> 1 then raise exception '19 delete template lost the confirmed history'; end if;
  raise notice 'OK 19 deleting a template keeps confirmed history';

  -- ---------- 005: month close ----------
  insert into budget_periods (user_id, period_date, projected_income) values (v_uid, '2098-01-01', 1000000) returning id into r;
  insert into envelopes (user_id, name) values (v_uid, '__test Sobra') returning id into e2;
  insert into envelopes (user_id, name) values (v_uid, '__test Pasa') returning id into e3;
  insert into envelope_budgets (envelope_id, budget_period_id, projected_amount) values (e2, r, 300000), (e3, r, 50000);
  insert into transactions (user_id, budget_period_id, envelope_id, bank_account_id, type, amount, description, transaction_date)
  values (v_uid, r, e2, a, 'expense', 100000, 'gasto sobra', '2098-01-10'),
         (v_uid, r, e3, a, 'expense',  80000, 'gasto pasa',  '2098-01-11'),
         (v_uid, r, null, a, 'income', 500000, 'salario',    '2098-01-01');
  perform create_transfer(r, a, b, 30000, 'traslado', '2098-01-12', true, null);

  perform set_opening_balance(r);
  rec := period_reconciliation(r);
  if (rec->>'difference')::numeric <> 0 then raise exception '20 reconciliation after opening: %', rec; end if;
  raise notice 'OK 20 opening balance makes the month reconcile';

  res := close_month(r);
  nxt := (res->>'next_period_id')::uuid;
  if (res->>'carried_total')::numeric <> 200000 or (res->>'overspent')::numeric <> 30000 then
    raise exception '21 close totals: %', res;
  end if;
  if (select carryover_amount from envelope_budgets where envelope_id = e2 and budget_period_id = nxt) <> 200000
     or (select carryover_amount from envelope_budgets where envelope_id = e3 and budget_period_id = nxt) <> 0
     or (select projected_amount from envelope_budgets where envelope_id = e2 and budget_period_id = nxt) <> 300000 then
    raise exception '21 carry-over rows wrong';
  end if;
  if (select available_amount from v_envelope_summary where envelope_id = e2 and budget_period_id = nxt) <> 500000 then
    raise exception '21 next month available should be 300000 + 200000';
  end if;
  if (select unassigned_amount from v_period_summary where budget_period_id = nxt) <> 1000000 - 350000 - 30000 then
    raise exception '21 next month unassigned should subtract the overspend: %',
      (select unassigned_amount from v_period_summary where budget_period_id = nxt);
  end if;
  if (select opening_balance from budget_periods where id = nxt) <> (rec->>'expected_end')::numeric then
    raise exception '21 next opening (%) <> expected end of month (%)', (select opening_balance from budget_periods where id = nxt), rec->>'expected_end';
  end if;
  if (select closed_at from budget_periods where id = r) is null then raise exception '21 closed_at not set'; end if;
  raise notice 'OK 21 close carries leftovers, subtracts overspend and sets the opening balance';

  res := close_month(r);
  if (select count(*) from envelope_budgets where budget_period_id = nxt) <> 2 then raise exception '22 re-close duplicated budgets'; end if;
  raise notice 'OK 22 closing again recalculates without duplicating';

  update bank_accounts set balance = balance + 5000 where id = a;  -- manual "Actualizar saldo"
  rec := period_reconciliation(nxt);
  if (rec->>'difference')::numeric <> 5000 then raise exception '23 manual adjustment not detected: %', rec; end if;
  raise notice 'OK 23 a manual balance change shows up as a difference';

  perform close_month(nxt);
  v_ok := false;
  begin
    perform reopen_month(r);
  exception when others then
    v_ok := sqlerrm = 'next_month_closed';
  end;
  if not v_ok then raise exception '24 reopen with a closed next month should fail with next_month_closed'; end if;
  raise notice 'OK 24 cannot reopen when the next month is closed';

  perform reopen_month(nxt);
  perform reopen_month(r);
  if (select carryover_amount from envelope_budgets where envelope_id = e2 and budget_period_id = nxt) <> 0
     or (select overspent_carryover from budget_periods where id = nxt) <> 0
     or (select opening_balance from budget_periods where id = nxt) is not null
     or (select closed_at from budget_periods where id = r) is not null then
    raise exception '25 reopen did not clear the carry-over';
  end if;
  raise notice 'OK 25 reopening clears what the next month received';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
