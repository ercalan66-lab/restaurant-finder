-- Sign-in codes by SMS, sent through a Tanzanian SMS company (NextSMS, API v2, or Beem).
--
-- Supabase Auth creates each 6-digit code itself. The "Send SMS hook" below only hands the code to
-- the SMS company, using pg_net (already enabled for push notifications), so Auth never waits on it.
-- private.send_sms is shared with the order texts (202611280003_order_sms.sql).
-- Safe to run more than once (it also replaces the first version of this file).
--
-- After running this file, set it up once (see README → "Sign-in by SMS"):
--   1. Store the SMS company's login. Run in the SQL editor with your own values:
--        NextSMS: select private.configure_nextsms('TAHARIFA', 'your-api-token');
--                 (token: NextSMS dashboard → Customer Profile → Customization → API Keys)
--        Beem:    select private.configure_beem('INFO', 'your-api-key', 'your-secret-key');
--      The first value is the sender name shown on the SMS, exactly as registered with the company.
--      Change it later with:  select private.set_sms_sender('KWETU');
--      The login is kept encrypted in Supabase Vault and never reaches the app.
--   2. Free check of the NextSMS login (nothing is delivered or charged):
--        select private.send_test_sms('0712345678');
--      then a few seconds later:
--        select status_code, content from net._http_response order by created desc limit 1;
--      200 means the token works; 401 means it is wrong.
--   3. Dashboard → Authentication → Hooks → Send SMS hook → Postgres → public.send_sms_code.
--   4. Dashboard → Authentication → Sign In / Providers → Phone → enable.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sms_settings (
  id boolean primary key default true check (id),
  provider text not null check (provider in ('nextsms', 'beem')),
  sender_id text not null check (sender_id ~ '^[A-Za-z0-9 ]{1,11}$'),
  updated_at timestamptz not null default now()
);
revoke all on private.sms_settings from public, anon, authenticated;

-- The first versions used a NextSMS v1 username/password login (NextSMS now uses API tokens) and a
-- two-argument send_sms; remove them so they cannot clash with the functions below.
drop function if exists private.configure_sms(text, text, text, text);
drop function if exists private.send_sms(text, text);

-- Saves the company, the sender name and the full Authorization header value (in Vault).
create or replace function private.save_sms_settings(p_provider text, p_sender_id text, p_authorization text)
returns void language plpgsql set search_path = '' as $$
declare
  v_secret_id uuid;
begin
  insert into private.sms_settings (id, provider, sender_id)
  values (true, p_provider, btrim(p_sender_id))
  on conflict (id) do update set provider = excluded.provider, sender_id = excluded.sender_id, updated_at = now();

  select s.id into v_secret_id from vault.secrets s where s.name = 'kwetu_sms_authorization';
  if v_secret_id is null then
    perform vault.create_secret(p_authorization, 'kwetu_sms_authorization', 'Login for the SMS company that sends Kwetu texts');
  else
    perform vault.update_secret(v_secret_id, p_authorization);
  end if;
end;
$$;
revoke execute on function private.save_sms_settings(text, text, text) from public, anon, authenticated;

-- NextSMS (API v2): the API token from the dashboard.
create or replace function private.configure_nextsms(p_sender_id text, p_api_token text)
returns void language plpgsql set search_path = '' as $$
begin
  if coalesce(btrim(p_api_token), '') = '' then
    raise exception 'Paste your NextSMS API token (Customer Profile → Customization → API Keys).';
  end if;
  perform private.save_sms_settings('nextsms', p_sender_id, 'Bearer ' || btrim(p_api_token));
end;
$$;
revoke execute on function private.configure_nextsms(text, text) from public, anon, authenticated;

-- Beem: the API key and secret key from the Beem dashboard (HTTP Basic).
create or replace function private.configure_beem(p_sender_id text, p_api_key text, p_secret_key text)
returns void language plpgsql set search_path = '' as $$
begin
  perform private.save_sms_settings('beem', p_sender_id,
    'Basic ' || translate(encode(convert_to(btrim(p_api_key) || ':' || btrim(p_secret_key), 'UTF8'), 'base64'), E'\n\r', ''));
end;
$$;
revoke execute on function private.configure_beem(text, text, text) from public, anon, authenticated;

-- Changes only the sender name, e.g. once KWETU is approved.
create or replace function private.set_sms_sender(p_sender_id text)
returns void language plpgsql set search_path = '' as $$
begin
  update private.sms_settings set sender_id = btrim(p_sender_id), updated_at = now() where id;
  if not found then
    raise exception 'Store the SMS login first (private.configure_nextsms).';
  end if;
end;
$$;
revoke execute on function private.set_sms_sender(text) from public, anon, authenticated;

-- 255712345678 from any Tanzanian way of writing a number (0712 345 678, +255 712…, 712345678),
-- or null when it is not a valid number.
create or replace function private.normalize_phone(p_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_phone like '0%' and length(v_phone) = 10 then v_phone := '255' || substr(v_phone, 2);
  elsif length(v_phone) = 9 then v_phone := '255' || v_phone;
  end if;
  return case when v_phone ~ '^[1-9][0-9]{7,14}$' then v_phone end;
end;
$$;

-- Sends one SMS. Returns false, without sending, when SMS is not set up or the number is not valid.
-- Never raises: a failed SMS must not stop a sign-in or an order. p_test uses NextSMS's test address,
-- which checks the request without delivering or charging it.
create or replace function private.send_sms(p_phone text, p_text text, p_test boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_provider text;
  v_sender text;
  v_authorization text;
  v_phone text := private.normalize_phone(p_phone);
  v_headers jsonb;
begin
  if v_phone is null or coalesce(btrim(p_text), '') = '' then
    return false;
  end if;
  select s.provider, s.sender_id into v_provider, v_sender from private.sms_settings s where s.id;
  select d.decrypted_secret into v_authorization from vault.decrypted_secrets d where d.name = 'kwetu_sms_authorization';
  if v_provider is null or v_authorization is null then
    return false;
  end if;

  v_headers := jsonb_build_object('Authorization', v_authorization, 'Content-Type', 'application/json', 'Accept', 'application/json');
  if v_provider = 'nextsms' then
    perform net.http_post(
      url := case when p_test then 'https://messaging-service.co.tz/api/sms/v2/test/text/single'
                  else 'https://messaging-service.co.tz/api/sms/v2/text/single' end,
      body := jsonb_build_object('from', v_sender, 'to', v_phone, 'text', p_text),
      headers := v_headers
    );
  elsif not p_test then
    perform net.http_post(
      url := 'https://apisms.beem.africa/v1/send',
      body := jsonb_build_object(
        'source_addr', v_sender, 'schedule_time', '', 'encoding', 0, 'message', p_text,
        'recipients', jsonb_build_array(jsonb_build_object('recipient_id', 1, 'dest_addr', v_phone))
      ),
      headers := v_headers
    );
  else
    return false; -- Beem has no free test address
  end if;
  return true;
exception when others then
  raise warning 'SMS not sent: %', sqlerrm;
  return false;
end;
$$;
revoke execute on function private.send_sms(text, text, boolean) from public, anon, authenticated;

-- Free check of the login (NextSMS only). Read the answer afterwards in net._http_response.
create or replace function private.send_test_sms(p_phone text)
returns text language plpgsql set search_path = '' as $$
begin
  if not private.send_sms(p_phone, 'Kwetu test message', true) then
    return 'Not sent: check the phone number, and that private.configure_nextsms has been run.';
  end if;
  return 'Test request sent. In a few seconds run: select status_code, content from net._http_response order by created desc limit 1;';
end;
$$;
revoke execute on function private.send_test_sms(text) from public, anon, authenticated;

-- The hook. It runs as its owner (security definer) because it must read the login from Vault;
-- only Supabase Auth may call it, so the app cannot use it to send SMS to any number.
create or replace function public.send_sms_code(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := event #>> '{sms,otp}';
begin
  if v_code is null or not private.send_sms(event #>> '{user,phone}',
       format('Kwetu: namba yako ya uthibitisho ni %s. Your Kwetu code is %s. Usimpe mtu yeyote.', v_code, v_code)) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'The SMS could not be sent. SMS sign-in may not be set up yet.'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke execute on function public.send_sms_code(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms_code(jsonb) to supabase_auth_admin;
