-- ============================================================
-- Checks for migration 006 (notification captures)
-- Ejecutar en: Supabase Dashboard > SQL Editor, DESPUÉS de aplicar 006.
-- Corre dentro de una transacción y termina en ROLLBACK: no deja ningún dato.
-- Si todo está bien NO aparece ningún error (en "Results" verás la fila de set_config).
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
  v_token text := 'test-token-0123456789abcdef0123456789abcdef';
  v_res   text;
  v_ok    boolean;
  n       int;
begin
  if v_uid is null then raise exception 'No user: auth.users is empty'; end if;

  delete from capture_tokens where user_id = v_uid;  -- undone by the final rollback
  insert into capture_tokens (user_id, token_hash)
  values (v_uid, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));

  -- The phone has no session: call as anon, with no user identity in the request.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  v_res := capture_notification(v_token, 'Nu', 'Enviaste $100,00', 'Le enviaste a alguien en su cuenta de Nequi S.A. CF.');
  if v_res <> 'ok' then raise exception '1 capture: expected ok, got %', v_res; end if;
  raise notice 'OK 1 a valid key stores the notification';

  v_res := capture_notification(v_token, 'Nu', 'Enviaste $100,00', 'Le enviaste a alguien en su cuenta de Nequi S.A. CF.');
  if v_res <> 'duplicate' then raise exception '2 duplicate: expected duplicate, got %', v_res; end if;
  raise notice 'OK 2 the same notification twice in a row is kept once';

  v_res := capture_notification(v_token, 'Nequi Colombia', 'Te enviaron plata por Bre-B', 'Te enviaron $100. Entra a tu app y revisa tu saldo.');
  if v_res <> 'ok' then raise exception '3 second app: expected ok, got %', v_res; end if;

  v_ok := false;
  begin
    perform capture_notification('wrong-token-0123456789abcdef0123456789abcdef', 'Nu', 'x', 'y');
  exception when others then v_ok := sqlerrm = 'invalid_token';
  end;
  if not v_ok then raise exception '4 a wrong key must be rejected with invalid_token'; end if;

  v_ok := false;
  begin
    perform capture_notification('short', 'Nu', 'x', 'y');
  exception when others then v_ok := sqlerrm = 'invalid_token';
  end;
  if not v_ok then raise exception '4 a short key must be rejected'; end if;
  raise notice 'OK 4 wrong keys are rejected';

  v_ok := false;
  begin
    perform capture_notification(v_token, 'Nu', '  ', null);
  exception when others then v_ok := sqlerrm = 'empty_notification';
  end;
  if not v_ok then raise exception '5 an empty notification must be rejected'; end if;
  raise notice 'OK 5 empty notifications are rejected';

  -- anon cannot read the inbox or the keys directly.
  select count(*) into n from captured_notifications;
  if n <> 0 then raise exception '6 anon can read % captured notifications', n; end if;
  select count(*) into n from capture_tokens;
  if n <> 0 then raise exception '6 anon can read capture keys'; end if;
  raise notice 'OK 6 without a session nothing can be read';

  -- Back as the user: sees the two captures, can resolve them.
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from captured_notifications where status = 'pending' and user_id = v_uid
     and source_app in ('Nu', 'Nequi Colombia') and received_at > now() - interval '1 minute';
  if n <> 2 then raise exception '7 expected 2 pending captures, got %', n; end if;
  update captured_notifications set status = 'registered', resolved_at = now()
   where user_id = v_uid and source_app = 'Nu' and received_at > now() - interval '1 minute';
  update captured_notifications set status = 'dismissed', resolved_at = now()
   where user_id = v_uid and source_app = 'Nequi Colombia' and received_at > now() - interval '1 minute';
  select count(*) into n from captured_notifications where status = 'pending' and user_id = v_uid
     and received_at > now() - interval '1 minute';
  if n <> 0 then raise exception '7 captures still pending after resolving'; end if;
  if (select last_used_at from capture_tokens where user_id = v_uid) is null then
    raise exception '7 last_used_at not updated';
  end if;
  raise notice 'OK 7 the user sees, registers and dismisses captures';

  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
