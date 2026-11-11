-- ============================================================
-- Migration 006: Capture payment notifications from the phone
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 005)
--
-- Una app de automatización en el teléfono reenvía cada notificación de pago a la app.
-- Aquí solo se guarda el texto tal cual, en una bandeja "Por clasificar": no crea
-- movimientos ni toca saldos. El usuario decide después qué registrar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Personal capture key (one per user). Only its SHA-256 hash is stored.
-- ------------------------------------------------------------
create table public.capture_tokens (
  user_id      uuid        primary key references public.profiles(id) on delete cascade,
  token_hash   text        not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.capture_tokens enable row level security;

create policy "users_own_capture_token"
  on public.capture_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Inbox of captured notifications
-- ------------------------------------------------------------
create table public.captured_notifications (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         not null references public.profiles(id) on delete cascade,
  source_app   varchar(100) not null,
  title        text,
  body         text,
  received_at  timestamptz  not null default now(),
  status       varchar(12)  not null default 'pending'
                 check (status in ('pending', 'registered', 'dismissed')),
  resolved_at  timestamptz
);

create index idx_captured_notifications_inbox
  on public.captured_notifications (user_id, received_at desc)
  where status = 'pending';

alter table public.captured_notifications enable row level security;

create policy "users_own_captured_notifications"
  on public.captured_notifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Entry point for the phone. It has no session, so it identifies the user by the
--    capture key. SECURITY DEFINER, but it can only append a row to that user's inbox.
--    Returns 'ok', 'duplicate' (same notification again within 90 s) or 'full'.
-- ------------------------------------------------------------
create or replace function public.capture_notification(
  p_token text, p_app text, p_title text, p_text text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid;
  v_app   text := left(coalesce(nullif(btrim(p_app), ''), 'Desconocida'), 100);
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 300), '');
  v_body  text := nullif(left(btrim(coalesce(p_text, '')), 2000), '');
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'invalid_token';
  end if;

  update capture_tokens
     set last_used_at = now()
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
   returning user_id into v_user;
  if v_user is null then
    raise exception 'invalid_token';
  end if;

  if v_title is null and v_body is null then
    raise exception 'empty_notification';
  end if;

  -- Apps update the same notification several times (grouping, progress): keep one copy.
  if exists (
    select 1 from captured_notifications
     where user_id = v_user and source_app = v_app
       and title is not distinct from v_title and body is not distinct from v_body
       and received_at > now() - interval '90 seconds'
  ) then
    return 'duplicate';
  end if;

  -- A leaked key must not be able to fill the table.
  if (select count(*) from captured_notifications where user_id = v_user and status = 'pending') >= 300 then
    return 'full';
  end if;

  insert into captured_notifications (user_id, source_app, title, body)
  values (v_user, v_app, v_title, v_body);
  return 'ok';
end $$;

revoke all on function public.capture_notification(text, text, text, text) from public;
grant execute on function public.capture_notification(text, text, text, text) to anon, authenticated;
