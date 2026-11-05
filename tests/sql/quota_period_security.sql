-- Uniquement sur PostgreSQL local jetable ; aucune mutation de production.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('b1000000-0000-4000-8000-000000000001','quota-period@example.test',now());
do $$
declare actor uuid := 'b1000000-0000-4000-8000-000000000001';
 period date := date_trunc('month',timezone('UTC',now()))::date;
 previous date := (period-interval '1 month')::date;
 reserved date;
begin
 reserved:=public.reserve_usage_quota(actor,'check');
 if reserved is distinct from period then raise exception 'Période de réservation absente'; end if;
 insert into public.usage_monthly(user_id,period_start,checks_used,rewrites_used,mia_messages_used)
 values(actor,previous,1,1,1);
 perform public.refund_usage_quota(actor,'check',previous);
 perform public.refund_usage_quota(actor,'rewrite',previous);
 perform public.refund_usage_quota(actor,'mia',previous);
 if exists(select 1 from public.usage_monthly where user_id=actor and period_start=previous
 and (checks_used<>0 or rewrites_used<>0 or mia_messages_used<>0)) then raise exception 'Ancienne période non remboursée'; end if;
 if (select checks_used from public.usage_monthly where user_id=actor and period_start=period)<>1
 then raise exception 'Mauvais mois remboursé'; end if;
 perform public.refund_usage_quota(actor,'check',previous);
 if (select checks_used from public.usage_monthly where user_id=actor and period_start=previous)<>0
 then raise exception 'Compteur négatif'; end if;
 update public.usage_monthly set checks_used=30 where user_id=actor and period_start=period;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Quota dépassé accepté'; end if;
 begin
  perform public.refund_usage_quota(actor,'check',period+1);
  raise exception 'Période invalide acceptée' using errcode='XX000';
 exception when invalid_parameter_value then null; end;
 if has_function_privilege('anon','public.reserve_usage_quota(uuid,text)','execute')
 or has_function_privilege('authenticated','public.reserve_usage_quota(uuid,text)','execute')
 or has_function_privilege('authenticated','public.refund_usage_quota(uuid,text,date)','execute')
 then raise exception 'Quota exposé au client'; end if;
 if not has_function_privilege('service_role','public.reserve_usage_quota(uuid,text)','execute')
 then raise exception 'Réservation serveur impossible'; end if;
end $$;
rollback;
