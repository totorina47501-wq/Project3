-- Réservation et remboursement liés à la même période UTC.
-- Les anciennes signatures restent disponibles pour le déploiement progressif.
begin;
create function public.reserve_usage_quota(p_user_id uuid,p_action text)
returns date language plpgsql security definer set search_path='' as $$
begin
 -- now() est stable pendant la transaction, y compris dans consume_usage_quota.
 if public.consume_usage_quota(p_user_id,p_action) then
  return date_trunc('month',timezone('UTC',now()))::date;
 end if;
 return null;
end $$;
create function public.refund_usage_quota(p_user_id uuid,p_action text,p_period_start date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_period_start is null or p_period_start<>date_trunc('month',p_period_start)::date
 or p_period_start>date_trunc('month',timezone('UTC',now()))::date then
  raise exception 'Période de quota invalide' using errcode='22023';
 end if;
 if p_action='check' then
  update public.usage_monthly set checks_used=greatest(0,checks_used-1)
   where user_id=p_user_id and period_start=p_period_start;
 elsif p_action='rewrite' then
  update public.usage_monthly set rewrites_used=greatest(0,rewrites_used-1)
   where user_id=p_user_id and period_start=p_period_start;
 elsif p_action='mia' then
  update public.usage_monthly set mia_messages_used=greatest(0,mia_messages_used-1)
   where user_id=p_user_id and period_start=p_period_start;
 else
  raise exception 'Action de quota inconnue' using errcode='22023';
 end if;
end $$;
revoke all on function public.reserve_usage_quota(uuid,text),public.refund_usage_quota(uuid,text,date) from public,anon,authenticated;
grant execute on function public.reserve_usage_quota(uuid,text),public.refund_usage_quota(uuid,text,date) to service_role;
commit;
