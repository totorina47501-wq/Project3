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
 -- La transition pré-GO garde Solo SANS déclencher les 30 jours.
 insert into public.promotional_solo_access(user_id,starts_at,expires_at,reason,activation_pending)
 values(actor,null,null,'legacy_launch_solo_30d',true);
 if (select count(*) from public.promotional_solo_access
      where user_id=actor and activation_pending
        and starts_at is null and expires_at is null)<>1
 then raise exception 'La phase pré-GO consomme déjà les 30 jours'; end if;
 for n in 2..30 loop
   if public.reserve_usage_quota(actor,'check') is null then raise exception 'Solo offert devrait permettre 30 contrôles'; end if;
 end loop;
 if public.reserve_usage_quota(actor,'check') is not null then raise exception 'La promotion pré-GO dépasse 30 contrôles'; end if;
 -- Le GO transforme la concession temporaire en 30 jours calendaires exacts,
 -- sans réinitialiser les quotas mensuels.
 update public.promotional_solo_access
    set activation_pending=false,starts_at=now(),expires_at=now()+interval '30 days'
    where user_id=actor and activation_pending;
 if (select count(*) from public.promotional_solo_access
      where user_id=actor and not activation_pending and starts_at<=now()
        and expires_at>now()+interval '29 days')<>1
 then raise exception 'La fenêtre 30 jours ne démarre pas au GO'; end if;
 if public.reserve_usage_quota(actor,'rewrite') is null then
   raise exception 'La promotion GO n accorde plus le quota Solo'; end if;
 -- Après expiration, aucun Solo hérité ou plan manuel ne doit accorder de droits.
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
