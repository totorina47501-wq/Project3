-- Local PGlite uniquement, sans données réelles ; rollback intégral.
begin;
insert into auth.users(id,email,email_confirmed_at)
  values('a3000000-0000-4000-8000-000000000001','free-paid-tier@example.test',now());
do $$
declare
 actor uuid:='a3000000-0000-4000-8000-000000000001';
 period date:=date_trunc('month',timezone('UTC',now()))::date;
 n integer;
begin
 if (select plan from public.users where id=actor)<>'solo' then raise exception 'Profil défaut inattendu'; end if;
 for n in 1..3 loop
   if public.reserve_usage_quota(actor,'check') is null then raise exception 'Quota gratuit trop restrictif'; end if;
 end loop;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Gratuit a obtenu Solo payant'; end if;
 if public.reserve_usage_quota(actor,'rewrite') is null or public.reserve_usage_quota(actor,'rewrite') is not null
   then raise exception 'Quota réécritures gratuit incorrect'; end if;
 for n in 1..3 loop
   if public.reserve_usage_quota(actor,'mia') is null then raise exception 'Quota Mia gratuit incorrect'; end if;
 end loop;
 if public.reserve_usage_quota(actor,'mia') is not null then raise exception 'Quota Mia gratuit dépassé'; end if;
 -- Profil écrit comme Pro sans souscription : aucun quota Pro ne doit être acquis.
 update public.users set plan='pro',stripe_customer_id='cus_free_paid_test' where id=actor;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Escalade par users.plan'; end if;
 -- Le plan Solo à 9 € doit avoir des droits distincts du compte gratuit.
 if not public.sync_stripe_subscription('cus_free_paid_test','sub_solo_paid',now()-interval '1 day',
   now(),'solo','active',now()+interval '30 days') then raise exception 'Souscription refusée'; end if;
 for n in 4..30 loop
   if public.reserve_usage_quota(actor,'check') is null then raise exception 'Quota Solo payant insuffisant'; end if;
 end loop;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Solo payant dépasse 30'; end if;
 -- Expiration de période révoque le quota, même si un webhook est en retard.
 update public.subscriptions set current_period_end=now()-interval '1 second' where user_id=actor;
 update public.usage_monthly set checks_used=3 where user_id=actor and period_start=period;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Période expirée a encore des droits'; end if;
 update public.subscriptions set current_period_end=now()+interval '30 days',status='past_due' where user_id=actor;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Impayé a encore des droits'; end if;
 if has_function_privilege('anon','public.consume_usage_quota(uuid,text)','execute')
   or has_function_privilege('authenticated','public.consume_usage_quota(uuid,text)','execute')
   then raise exception 'Quota serveur exposé'; end if;
end $$;
rollback;
