-- Uniquement PostgreSQL local jetable : aucun appel IA, aucune donnée distante.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('94000000-0000-4000-8000-000000000001','media-ai-a@example.test',now()),
 ('94000000-0000-4000-8000-000000000002','media-ai-b@example.test',now());
insert into public.verifications(id,user_id,platform,content_text,media_type,status,hash_sha256,ai_score,ai_risk_level) values
 ('94100000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','instagram','Publicité — Démonstration','video','completed',repeat('a',64),100,'low');
insert into public.media_processing_jobs(id,user_id,verification_id,fingerprint,kind,status,payload,caption_analysis,result,completed_at) values
 ('94200000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001',repeat('b',64),'video','completed','{}','{}','{}',now());
do $$
declare owner_id uuid:='94000000-0000-4000-8000-000000000001';
 job uuid:='94200000-0000-4000-8000-000000000001'; first_run jsonb; duplicate jsonb; payload jsonb;
begin
 if has_function_privilege('authenticated','public.media_ai_claim(uuid,uuid,boolean)','EXECUTE')
 or has_function_privilege('anon','public.media_ai_finish(uuid,uuid,jsonb,boolean)','EXECUTE')
 then raise exception 'RPC IA privilégiée exposée'; end if;
 begin
  perform public.media_ai_claim('94000000-0000-4000-8000-000000000002',job,false);
  raise exception 'Préparation tierce acceptée' using errcode='XX000';
 exception when insufficient_privilege then null; end;
 first_run:=public.media_ai_claim(owner_id,job,false);
 duplicate:=public.media_ai_claim(owner_id,job,false);
 if first_run->>'claimed'<>'true' or duplicate->>'claimed'<>'false'
 or first_run->>'id'<>duplicate->>'id' then raise exception 'Double analyse payante'; end if;
 if (select checks_used from public.usage_monthly where user_id=owner_id)<>1
 then raise exception 'Quota non atomique'; end if;
 payload:=jsonb_build_object('score',95,'riskLevel','low','violations','[]'::jsonb,'aiFlags','[]'::jsonb,
  'rewrite',null,'hashSha256',repeat('c',64),'verificationId',first_run->>'verification_id',
  'analysisMode','full','warnings','[]'::jsonb);
 if not public.media_ai_finish(owner_id,(first_run->>'id')::uuid,payload,false)
 or public.media_ai_finish(owner_id,(first_run->>'id')::uuid,null,false)
 then raise exception 'Finalisation non idempotente'; end if;
 if (select hash_sha256 from public.verifications where id='94100000-0000-4000-8000-000000000001')<>repeat('a',64)
 then raise exception 'Preuve technique écrasée'; end if;
 if (select ai_score from public.verifications where id=(first_run->>'verification_id')::uuid)<>95
 then raise exception 'Analyse non persistée'; end if;
 first_run:=public.media_ai_claim(owner_id,job,true);
 if public.media_ai_finish(owner_id,(first_run->>'id')::uuid,null,true)
 then raise exception 'Analyse active expirée trop tôt'; end if;
 update public.media_ai_runs set expires_at=now()-interval '1 second' where id=(first_run->>'id')::uuid;
 if not public.media_ai_finish(owner_id,(first_run->>'id')::uuid,null,true)
 or public.media_ai_finish(owner_id,(first_run->>'id')::uuid,null,true)
 then raise exception 'Expiration non idempotente'; end if;
 if (select checks_used from public.usage_monthly where user_id=owner_id)<>1
 then raise exception 'Remboursement incorrect'; end if;
 if (public.media_ai_claim(owner_id,job,true)->>'claimed')<>'false'
 then raise exception 'Reprise payante implicite après échec'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.media_ai_runs) then raise exception 'Fuite RLS analyses'; end if;
 begin
  insert into public.media_ai_runs(user_id,job_id,verification_id,include_audio,quota_period)
  values('94000000-0000-4000-8000-000000000002','94200000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001',false,current_date);
  raise exception 'Écriture client autorisée' using errcode='XX000';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
