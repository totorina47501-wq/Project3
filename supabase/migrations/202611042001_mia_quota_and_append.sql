-- Chemin: supabase/migrations/202611042001_mia_quota_and_append.sql
-- Quotas Mia atomiques et append sécurisé des conversations.
begin;

create or replace function public.consume_usage_quota(p_user_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  selected_plan public.account_plan;
  period date := date_trunc('month', timezone('UTC', now()))::date;
  allowance integer;
  consumed boolean;
begin
  if p_action not in ('check', 'rewrite', 'mia') then
    raise exception 'Action de quota inconnue';
  end if;
  select plan into selected_plan from public.users
  where id = p_user_id for update;
  if not found then raise exception 'Compte introuvable'; end if;
  allowance := case p_action
    when 'check' then case selected_plan when 'solo' then 30 when 'pro' then 500 else 2000 end
    when 'rewrite' then case selected_plan when 'solo' then 5 when 'pro' then 500 else 2000 end
    else case selected_plan when 'solo' then 20 when 'pro' then 300 else 1500 end
  end;
  insert into public.usage_monthly (user_id, period_start)
  values (p_user_id, period) on conflict (user_id, period_start) do nothing;

  if p_action = 'check' then
    update public.usage_monthly set checks_used = checks_used + 1
    where user_id = p_user_id and period_start = period and checks_used < allowance
    returning true into consumed;
  elsif p_action = 'rewrite' then
    update public.usage_monthly set rewrites_used = rewrites_used + 1
    where user_id = p_user_id and period_start = period and rewrites_used < allowance
    returning true into consumed;
  else
    update public.usage_monthly set mia_messages_used = mia_messages_used + 1
    where user_id = p_user_id and period_start = period and mia_messages_used < allowance
    returning true into consumed;
  end if;
  return coalesce(consumed, false);
end;
$$;

create or replace function public.refund_usage_quota(p_user_id uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare period date := date_trunc('month', timezone('UTC', now()))::date;
begin
  if p_action = 'check' then
    update public.usage_monthly set checks_used = greatest(0, checks_used - 1)
    where user_id = p_user_id and period_start = period;
  elsif p_action = 'rewrite' then
    update public.usage_monthly set rewrites_used = greatest(0, rewrites_used - 1)
    where user_id = p_user_id and period_start = period;
  elsif p_action = 'mia' then
    update public.usage_monthly set mia_messages_used = greatest(0, mia_messages_used - 1)
    where user_id = p_user_id and period_start = period;
  else
    raise exception 'Action de quota inconnue';
  end if;
end;
$$;

-- Une transaction atomique empêche que deux messages simultanés écrasent l'historique.
create or replace function public.append_mia_exchange(
  p_user_id uuid, p_conversation_id uuid, p_exchange jsonb
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare appended boolean;
begin
  if jsonb_typeof(p_exchange) is distinct from 'array'
      or jsonb_array_length(p_exchange) <> 2 then
    raise exception 'Échange invalide';
  end if;
  update public.assistant_conversations
     set messages = messages || p_exchange,
         updated_at = now()
   where id = p_conversation_id and user_id = p_user_id
     and jsonb_array_length(messages) <= 38
   returning true into appended;
  return coalesce(appended, false);
end;
$$;

revoke all on function public.consume_usage_quota(uuid,text) from public,anon,authenticated;
revoke all on function public.refund_usage_quota(uuid,text) from public,anon,authenticated;
revoke all on function public.append_mia_exchange(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.consume_usage_quota(uuid,text) to service_role;
grant execute on function public.refund_usage_quota(uuid,text) to service_role;
grant execute on function public.append_mia_exchange(uuid,uuid,jsonb) to service_role;
commit;
