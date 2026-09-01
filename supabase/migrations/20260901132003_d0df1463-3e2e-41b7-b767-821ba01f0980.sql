create table if not exists public.email_template_overrides (
  template_key text primary key,
  subject text,
  heading text,
  body text,
  updated_at timestamptz not null default now()
);

grant all on public.email_template_overrides to service_role;
alter table public.email_template_overrides enable row level security;

drop policy if exists "service role manages template overrides" on public.email_template_overrides;
create policy "service role manages template overrides"
  on public.email_template_overrides for all to service_role using (true) with check (true);

create or replace function public.admin_get_templates(p_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_admin(p_password);
  select coalesce(jsonb_object_agg(t.template_key, jsonb_build_object(
    'subject', t.subject, 'heading', t.heading, 'body', t.body, 'updated_at', t.updated_at
  )), '{}'::jsonb)
  into result
  from public.email_template_overrides t;
  return result;
end;
$$;

create or replace function public.admin_save_template(
  p_password text,
  p_key text,
  p_subject text,
  p_heading text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_password);
  insert into public.email_template_overrides (template_key, subject, heading, body, updated_at)
  values (p_key, nullif(btrim(p_subject), ''), nullif(btrim(p_heading), ''), nullif(btrim(p_body), ''), now())
  on conflict (template_key) do update
    set subject = excluded.subject,
        heading = excluded.heading,
        body = excluded.body,
        updated_at = now();
end;
$$;

create or replace function public.admin_reset_template(p_password text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_password);
  delete from public.email_template_overrides where template_key = p_key;
end;
$$;

revoke all on function public.admin_get_templates(text) from public;
revoke all on function public.admin_save_template(text, text, text, text, text) from public;
revoke all on function public.admin_reset_template(text, text) from public;
grant execute on function public.admin_get_templates(text) to anon, authenticated, service_role;
grant execute on function public.admin_save_template(text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.admin_reset_template(text, text) to anon, authenticated, service_role;