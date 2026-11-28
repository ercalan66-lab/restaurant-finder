-- Sign-in codes by SMS, sent through a Tanzanian SMS company (NextSMS or Beem).
--
-- Supabase Auth creates each 6-digit code itself. This "Send SMS hook" only hands the code to the
-- SMS company, using pg_net (already enabled for push notifications), so Auth never waits on it.
--
-- After running this file, set it up once (see README → "Sign-in by SMS"):
--   1. Store the SMS company's login. Run in the SQL editor with your own values:
--        NextSMS: select private.configure_sms('nextsms', 'NEXTSMS', 'your-username', 'your-password');
--        Beem:    select private.configure_sms('beem', 'INFO', 'your-api-key', 'your-secret-key');
--      The second value is the sender name shown on the SMS. Change it to 'KWETU' once the SMS
--      company has registered that name for you. The login is kept encrypted in Supabase Vault.
--   2. Dashboard → Authentication → Hooks → Send SMS hook → Postgres → public.send_sms_code.
--   3. Dashboard → Authentication → Sign In / Providers → Phone → enable.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sms_settings (
  id boolean primary key default true check (id),
  provider text not null check (provider in ('nextsms', 'beem')),
  sender_id text not null check (sender_id ~ '^[A-Za-z0-9 ]{1,11}$'),
  updated_at timestamptz not null default now()
);
revoke all on private.sms_settings from public, anon, authenticated;

-- Saves the SMS company, the sender name and the login (as an HTTP Basic token in Vault).
create or replace function private.configure_sms(p_provider text, p_sender_id text, p_login text, p_secret text)
returns void language plpgsql set search_path = '' as $$
declare
  v_secret_id uuid;
  v_basic text := translate(encode(convert_to(p_login || ':' || p_secret, 'UTF8'), 'base64'), E'\n\r', '');
begin
  insert into private.sms_settings (id, provider, sender_id)
  values (true, lower(trim(p_provider)), trim(p_sender_id))
  on conflict (id) do update set provider = excluded.provider, sender_id = excluded.sender_id, updated_at = now();

  select s.id into v_secret_id from vault.secrets s where s.name = 'kwetu_sms_basic_auth';
  if v_secret_id is null then
    perform vault.create_secret(v_basic, 'kwetu_sms_basic_auth', 'Login for the SMS company that sends Kwetu sign-in codes');
  else
    perform vault.update_secret(v_secret_id, v_basic);
  end if;
end;
$$;
revoke execute on function private.configure_sms(text, text, text, text) from public, anon, authenticated;

-- The hook. It runs as its owner (security definer) because it must read the login from Vault;
-- only Supabase Auth may call it, so the app cannot use it to send SMS to any number.
create or replace function public.send_sms_code(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_provider text;
  v_sender text;
  v_basic text;
  v_phone text := regexp_replace(coalesce(event #>> '{user,phone}', ''), '\D', '', 'g');
  v_code text := event #>> '{sms,otp}';
  v_text text;
  v_headers jsonb;
begin
  select s.provider, s.sender_id into v_provider, v_sender from private.sms_settings s where s.id;
  select d.decrypted_secret into v_basic from vault.decrypted_secrets d where d.name = 'kwetu_sms_basic_auth';
  if v_provider is null or v_basic is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'SMS sign-in is not set up yet.'));
  end if;
  if v_phone !~ '^[1-9][0-9]{7,14}$' or v_code is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Invalid phone number.'));
  end if;

  v_text := format('Kwetu: namba yako ya uthibitisho ni %s. Your Kwetu code is %s. Usimpe mtu yeyote.', v_code, v_code);
  v_headers := jsonb_build_object('Authorization', 'Basic ' || v_basic, 'Content-Type', 'application/json', 'Accept', 'application/json');

  if v_provider = 'nextsms' then
    perform net.http_post(
      url := 'https://messaging-service.co.tz/api/sms/v1/text/single',
      body := jsonb_build_object('from', v_sender, 'to', v_phone, 'text', v_text),
      headers := v_headers
    );
  else
    perform net.http_post(
      url := 'https://apisms.beem.africa/v1/send',
      body := jsonb_build_object(
        'source_addr', v_sender, 'schedule_time', '', 'encoding', 0, 'message', v_text,
        'recipients', jsonb_build_array(jsonb_build_object('recipient_id', 1, 'dest_addr', v_phone))
      ),
      headers := v_headers
    );
  end if;
  return '{}'::jsonb;
end;
$$;
revoke execute on function public.send_sms_code(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms_code(jsonb) to supabase_auth_admin;
