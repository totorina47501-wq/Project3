-- Aucune donnée réelle : PGlite seulement, rollback transactionnel.
begin;
insert into auth.users(id,email,email_confirmed_at)
 values('a3100000-0000-4000-8000-000000000001','promo-legacy@example.test',now());
do $$
declare
 actor uuid:='a3100000-0000-4000-8000-000000000001';
 n integer;
begin
 if public.reserve_usage_quota(actor,'check') is null then raise exception 'Le gratuit est inaccessible'; end if;
 insert into public.promotional_solo_access(user_id,starts_at,expires_at,reason)
 values(actor,now()-interval '1 day',now()+interval '29 days','test_legacy');
 for n in 2..30 loop
   if public.reserve_usage_quota(actor,'check') is null then raise exception 'Solo offert devrait permettre 30 contrôles'; end if;
 end loop;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'La promotion dépasse 30 contrôles'; end if;
 update public.promotional_solo_access
    set starts_at=now()-interval '30 days',expires_at=now()-interval '1 second'
    where user_id=actor;
 update public.usage_monthly set checks_used=3 where user_id=actor;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Une promotion expirée accorde Solo'; end if;
 update public.users set plan='studio' where id=actor;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'Escalade via users.plan'; end if;
 if has_table_privilege('anon','public.promotional_solo_access','select')
 or has_table_privilege('authenticated','public.promotional_solo_access','select')
 or has_table_privilege('authenticated','public.promotional_solo_access','insert')
 then raise exception 'Promotion accessible depuis un client'; end if;
end $$;
rollback;
