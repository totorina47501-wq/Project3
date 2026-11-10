-- Free != Solo payant. Conserver public.account_plan (solo/pro/studio) pour compatibilité.
-- Aucun utilisateur sans souscription Stripe active et à jour ne reçoit des quotas payants.
-- Appliquer d'abord sur Supabase staging uniquement ; aucune opération live.
begin;
create or replace function public.consume_usage_quota(p_user_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  paid_plan public.account_plan;
  period date := date_trunc('month', timezone('UTC',now()))::date;
  allowance integer;
  consumed boolean;
begin
  if p_action not in ('check','rewrite','mia') then
    raise exception 'Action de quota inconnue' using errcode='22023';
  end if;
  -- Sérialise la réservation avec la synchronisation Stripe, qui verrouille users.
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'Compte introuvable' using errcode='22023'; end if;
  select s.plan into paid_plan from public.subscriptions s
    where s.user_id=p_user_id
      and s.stripe_subscription_id is not null
      and s.status in ('active','trialing')
      and s.current_period_end > now();
  -- Sans abonnement actif : 3/1/3. Une colonne users.plan='solo' n'est PAS une preuve de paiement.
  allowance := case p_action
    when 'check' then case paid_plan when 'solo' then 30 when 'pro' then 500 when 'studio' then 2000 else 3 end
    when 'rewrite' then case paid_plan when 'solo' then 5 when 'pro' then 500 when 'studio' then 2000 else 1 end
    else case paid_plan when 'solo' then 20 when 'pro' then 300 when 'studio' then 1500 else 3 end
  end;
  insert into public.usage_monthly(user_id,period_start)
    values(p_user_id,period) on conflict(user_id,period_start) do nothing;
  if p_action='check' then
    update public.usage_monthly set checks_used=checks_used+1
      where user_id=p_user_id and period_start=period and checks_used<allowance
      returning true into consumed;
  elsif p_action='rewrite' then
    update public.usage_monthly set rewrites_used=rewrites_used+1
      where user_id=p_user_id and period_start=period and rewrites_used<allowance
      returning true into consumed;
  else
    update public.usage_monthly set mia_messages_used=mia_messages_used+1
      where user_id=p_user_id and period_start=period and mia_messages_used<allowance
      returning true into consumed;
  end if;
  return coalesce(consumed,false);
end $$;
revoke all on function public.consume_usage_quota(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_usage_quota(uuid,text) to service_role;
commit;
