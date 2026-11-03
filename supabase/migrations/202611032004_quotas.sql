-- Chemin : supabase/migrations/202611032004_quotas.sql
-- Quotas mensuels transactionnels, utilisables uniquement par le backend.
begin;

create or replace function public.consume_usage_quota(p_user_id uuid, p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_plan public.account_plan;
  period date := date_trunc('month', timezone('UTC', now()))::date;
  allowed_count integer;
  consumed boolean;
begin
  if p_action not in ('check', 'rewrite') then
    raise exception 'Action de quota inconnue';
  end if;
  -- Verrouiller le profil : évite les surconsommations concurrentes.
  select plan into selected_plan
  from public.users where id = p_user_id for update;
  if not found then
    raise exception 'Compte introuvable';
  end if;
  allowed_count := case
    when p_action = 'check' then
      case selected_plan when 'solo' then 30 when 'pro' then 500 else 2000 end
    else
      case selected_plan when 'solo' then 5 when 'pro' then 500 else 2000 end
  end;

  insert into public.usage_monthly(user_id, period_start)
  values (p_user_id, period)
  on conflict (user_id, period_start) do nothing;

  if p_action = 'check' then
    update public.usage_monthly
      set checks_used = checks_used + 1
      where user_id = p_user_id and period_start = period
        and checks_used < allowed_count
      returning true into consumed;
  else
    update public.usage_monthly
      set rewrites_used = rewrites_used + 1
      where user_id = p_user_id and period_start = period
        and rewrites_used < allowed_count
      returning true into consumed;
  end if;
  return coalesce(consumed, false);
end;
$$;

create or replace function public.refund_usage_quota(p_user_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  period date := date_trunc('month', timezone('UTC', now()))::date;
begin
  if p_action = 'check' then
    update public.usage_monthly
      set checks_used = greatest(0, checks_used - 1)
      where user_id = p_user_id and period_start = period;
  elsif p_action = 'rewrite' then
    update public.usage_monthly
      set rewrites_used = greatest(0, rewrites_used - 1)
      where user_id = p_user_id and period_start = period;
  else
    raise exception 'Action de quota inconnue';
  end if;
end;
$$;

revoke all on function public.consume_usage_quota(uuid,text) from public, anon, authenticated;
revoke all on function public.refund_usage_quota(uuid,text) from public, anon, authenticated;
grant execute on function public.consume_usage_quota(uuid,text) to service_role;
grant execute on function public.refund_usage_quota(uuid,text) to service_role;
commit;
