-- EXCLUSIVEMENT sur PostgreSQL/Supabase LOCAL JETABLE après migrations.
-- Crée des fixtures transactionnelles, ne supprime aucune donnée et annule tout.
begin;
do $$
declare
  actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); verification uuid:=gen_random_uuid();
  enabled boolean; events_count integer;
begin
  insert into auth.users(id,email) values
    (actor,'privacy-'||actor::text||'@example.invalid'),
    (outsider,'privacy-'||outsider::text||'@example.invalid');
  update public.users set ai_training_opt_in=true where id=actor;
  insert into public.verifications(id,user_id,platform,content_text)
    values(verification,actor,'instagram','Texte privé synthétique');
  insert into public.rewrite_feedback(user_id,verification_id,original_caption,accepted_caption,prompt_version,training_consent_snapshot)
    values(actor,verification,'Original synthétique','Accepté synthétique','local-test',true);
  if not (select training_consent_snapshot from public.rewrite_feedback where verification_id=verification) then
    raise exception 'Le feedback consenti devrait être éligible';
  end if;

  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  enabled:=public.set_training_consent(false);
  if enabled then raise exception 'Le retrait a échoué'; end if;
  select count(*) into events_count from public.privacy_consent_events where user_id=outsider;
  if events_count<>0 then raise exception 'Fuite du journal de consentement tiers'; end if;
  execute 'reset role';

  if (select training_consent_snapshot from public.rewrite_feedback where verification_id=verification) then
    raise exception 'Un feedback ancien reste autorisé après retrait';
  end if;
  -- Simule une écriture serveur avec une préférence lue avant le retrait.
  update public.rewrite_feedback set training_consent_snapshot=true where verification_id=verification;
  if (select training_consent_snapshot from public.rewrite_feedback where verification_id=verification) then
    raise exception 'Une écriture périmée contourne le consentement actuel';
  end if;
  update public.users set ai_training_opt_in=true where id=actor;
  if (select training_consent_snapshot from public.rewrite_feedback where verification_id=verification) then
    raise exception 'La réactivation réautorise abusivement un ancien feedback';
  end if;
  if not exists(select 1 from public.privacy_consent_events where user_id=actor and not ai_training_opt_in and source='profile_change') then
    raise exception 'Retrait absent du journal';
  end if;
  if has_function_privilege('anon','public.set_training_consent(boolean)','execute') then
    raise exception 'Consentement RPC accessible anonymement';
  end if;
  if has_table_privilege('authenticated','public.privacy_erasure_runs','insert') then
    raise exception 'Le journal peut être falsifié directement par le navigateur';
  end if;
  if not has_table_privilege('service_role','public.privacy_erasure_runs','insert') then
    raise exception 'Le serveur ne peut pas journaliser un plan';
  end if;
end;
$$;
rollback;
