-- Seulement sur PostgreSQL jetable : fixtures et rollback, jamais production.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('80000000-0000-4000-8000-000000000001','media-a@example.test',now()),
 ('80000000-0000-4000-8000-000000000002','media-b@example.test',now());
insert into public.media_assets(id,user_id,kind,status,storage_path,mime_type,declared_bytes,actual_bytes,completed_at,expires_at,media_sha256) values
 ('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','video','ready','80000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001.mp4','video/mp4',10,10,now(),now()+interval '1 day',repeat('a',64)),
 ('81000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000002','video','ready','80000000-0000-4000-8000-000000000002/82000000-0000-4000-8000-000000000002.mp4','video/mp4',10,10,now(),now()+interval '1 day',repeat('b',64));
do $$
declare owner_id uuid := '80000000-0000-4000-8000-000000000001';
 asset uuid := '81000000-0000-4000-8000-000000000001';
 job uuid; duplicate uuid; leased record; old_token uuid; done boolean;
begin
 if has_function_privilege('authenticated','public.media_job_claim(uuid)','EXECUTE')
 or has_function_privilege('anon','public.media_job_enqueue(uuid,uuid[],text,public.social_platform,jsonb)','EXECUTE')
 then raise exception 'Worker/ingestion accessible aux utilisateurs'; end if;
 begin
  perform public.media_job_enqueue(owner_id,array['81000000-0000-4000-8000-000000000002'::uuid],'Interdit','instagram','{}');
  raise exception 'Média tiers accepté' using errcode='XX000';
 exception when insufficient_privilege then null; end;
 job := public.media_job_enqueue(owner_id,array[asset],'PUBLICITÉ — Test','instagram','{"score":100,"riskLevel":"low","violations":[]}');
 duplicate := public.media_job_enqueue(owner_id,array[asset],'PUBLICITÉ — Test','instagram','{"score":100,"riskLevel":"low","violations":[]}');
 if job<>duplicate then raise exception 'Enqueue non idempotent'; end if;
 select * into leased from public.media_job_claim(gen_random_uuid());
 if leased.id<>job or leased.payload->>'kind'<>'video' then raise exception 'Claim incorrect'; end if;
 if exists(select 1 from public.media_job_claim(gen_random_uuid())) then raise exception 'Double claim'; end if;
 if public.media_job_finish(job,gen_random_uuid(),'{}') then raise exception 'Mauvais bail accepté'; end if;
 old_token:=leased.lease_token;
 update public.media_processing_jobs set lease_until=now()-interval '1 second' where id=job;
 if public.media_job_fail(job,old_token,'PROCESS_FAILED') then raise exception 'Bail expiré accepté'; end if;
 select * into leased from public.media_job_claim(gen_random_uuid());
 if leased.lease_token=old_token then raise exception 'Ancien jeton réutilisé'; end if;
 if public.media_job_finish(job,old_token,'{}') then raise exception 'Callback ancien accepté'; end if;
 if public.media_job_cancel('80000000-0000-4000-8000-000000000002',job) then raise exception 'Annulation tiers acceptée'; end if;
 if not public.media_job_cancel(owner_id,job) then raise exception 'Annulation propriétaire refusée'; end if;
 if public.media_job_finish(job,leased.lease_token,'{}') then raise exception 'Succès après annulation'; end if;
 job := public.media_job_enqueue(owner_id,array[asset],'PUBLICITÉ — Reprise bornée','instagram','{"score":100,"riskLevel":"low","violations":[]}');
 for n in 1..3 loop
  select * into leased from public.media_job_claim(gen_random_uuid());
  if leased.id<>job then raise exception 'Mauvais job de reprise'; end if;
  if not public.media_job_fail(job,leased.lease_token,'PROCESS_FAILED') then raise exception 'Échec non enregistré'; end if;
  update public.media_processing_jobs set available_at=now() where id=job;
 end loop;
 if (select status from public.media_processing_jobs where id=job)<>'failed'
 or (select attempts from public.media_processing_jobs where id=job)<>3
 then raise exception 'Tentatives non bornées'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.media_processing_jobs) then raise exception 'Fuite RLS jobs'; end if;
end $$;
reset role;
rollback;
