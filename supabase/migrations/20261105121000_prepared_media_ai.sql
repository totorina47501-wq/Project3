-- Analyse IA explicite d'une préparation privée. Aucun appel fournisseur dans SQL.
begin;
create table public.media_ai_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 job_id uuid not null,
 verification_id uuid not null,
 include_audio boolean not null,
 status text not null default 'processing' check(status in ('processing','completed','failed')),
 quota_period date not null,
 result jsonb,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 completed_at timestamptz,
 foreign key(job_id,user_id) references public.media_processing_jobs(id,user_id) on delete cascade,
 foreign key(verification_id,user_id) references public.verifications(id,user_id) on delete cascade,
 unique(job_id,include_audio),
 check((status='processing' and completed_at is null) or (status<>'processing' and completed_at is not null)),
 check(status<>'completed' or result is not null)
);
create index media_ai_owner_recent_idx on public.media_ai_runs(user_id,created_at desc,id);
create index media_ai_job_owner_idx on public.media_ai_runs(job_id,user_id);
create index media_ai_verification_owner_idx on public.media_ai_runs(verification_id,user_id);
alter table public.media_ai_runs enable row level security;
revoke all on public.media_ai_runs from anon,authenticated;
grant select on public.media_ai_runs to authenticated;
grant all on public.media_ai_runs to service_role;
create policy media_ai_owner_read on public.media_ai_runs for select to authenticated
 using ((select auth.uid())=user_id);

-- Le verrou du job sérialise les doubles clics ; le quota et la preuve IA sont
-- créés dans la même transaction. Une erreur ne laisse aucune réservation isolée.
create function public.media_ai_claim(p_user uuid,p_job uuid,p_audio boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.media_processing_jobs; r public.media_ai_runs;
 v public.verifications; period date; new_verification uuid;
begin
 if p_user is null or p_job is null or p_audio is null then
  raise exception 'Demande invalide' using errcode='22023'; end if;
 select * into j from public.media_processing_jobs where id=p_job and user_id=p_user for update;
 if not found then raise exception 'Préparation inaccessible' using errcode='42501'; end if;
 if j.status<>'completed' then raise exception 'Préparation non terminée' using errcode='55000'; end if;
 if p_audio and j.kind<>'video' then raise exception 'Audio incompatible' using errcode='22023'; end if;
 select * into r from public.media_ai_runs where job_id=p_job and include_audio=p_audio;
 if found then return to_jsonb(r)||jsonb_build_object('claimed',false); end if;
 select * into strict v from public.verifications where id=j.verification_id and user_id=p_user;
 period:=public.reserve_usage_quota(p_user,'check');
 if period is null then raise exception 'Quota atteint' using errcode='54000'; end if;
 insert into public.verifications(user_id,platform,content_text,media_type,media_url,status,prompt_version)
 values(p_user,v.platform,v.content_text,j.kind,v.media_url,'processing','prepared-media-v1')
 returning id into new_verification;
 insert into public.media_ai_runs(user_id,job_id,verification_id,include_audio,quota_period)
 values(p_user,p_job,new_verification,p_audio,period) returning * into r;
 return to_jsonb(r)||jsonb_build_object('claimed',true);
end $$;

-- Un seul passage terminal : ni double remboursement, ni écrasement d'une preuve.
-- p_expired est réservé au nettoyage paresseux des requêtes interrompues.
create function public.media_ai_finish(p_user uuid,p_run uuid,p_result jsonb,p_expired boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.media_ai_runs;
begin
 select * into r from public.media_ai_runs where id=p_run and user_id=p_user for update;
 if not found or r.status<>'processing' then return false; end if;
 if p_expired and r.expires_at>now() then return false; end if;
 if p_result is not null then
  if p_expired or p_result->>'verificationId' is distinct from r.verification_id::text
   or jsonb_typeof(p_result->'score') is distinct from 'number'
   or (p_result->>'score')::integer not between 0 and 100
   or coalesce(p_result->>'riskLevel','') not in ('low','medium','high','critical')
   or coalesce(p_result->>'analysisMode','') not in ('full','partial','rules_only')
   or coalesce(p_result->>'hashSha256','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(p_result->'violations') is distinct from 'array'
   or jsonb_typeof(p_result->'aiFlags') is distinct from 'array'
   or jsonb_typeof(p_result->'warnings') is distinct from 'array'
  then raise exception 'Résultat invalide' using errcode='22023'; end if;
  update public.verifications set ai_score=(p_result->>'score')::integer,
   ai_risk_level=(p_result->>'riskLevel')::public.risk_level,
   ai_explanation=jsonb_build_object('violations',p_result->'violations','aiFlags',p_result->'aiFlags',
     'analysisMode',p_result->>'analysisMode','warnings',p_result->'warnings',
     'coverage',p_result->'coverage','scoringVersion','prepared-media-v1'),
   ai_rewrite_suggestion=p_result->'rewrite'->>'rewrittenCaption',
   hash_sha256=p_result->>'hashSha256',status='completed',completed_at=now()
   where id=r.verification_id and user_id=p_user;
  update public.media_ai_runs set status='completed',result=p_result,completed_at=now() where id=p_run;
  if p_result->>'analysisMode'='rules_only' then
   perform public.refund_usage_quota(p_user,'check',r.quota_period); end if;
 else
  update public.verifications set status='failed' where id=r.verification_id and user_id=p_user;
  update public.media_ai_runs set status='failed',completed_at=now() where id=p_run;
  perform public.refund_usage_quota(p_user,'check',r.quota_period);
 end if;
 return true;
end $$;
revoke all on function public.media_ai_claim(uuid,uuid,boolean),public.media_ai_finish(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.media_ai_claim(uuid,uuid,boolean),public.media_ai_finish(uuid,uuid,jsonb,boolean) to service_role;
commit;
