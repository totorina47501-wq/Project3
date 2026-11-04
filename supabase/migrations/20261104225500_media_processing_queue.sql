-- File technique inactive tant que l’application et un exécuteur isolé ne sont pas activés.
-- Migration additive ; aucune suppression, aucun cron et aucun appel fournisseur.
begin;
create table public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  verification_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('video','carousel')),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  caption_analysis jsonb not null check (jsonb_typeof(caption_analysis)='object'),
  result jsonb,
  failure_code text check (failure_code in ('JOB_INVALID','INPUT_INVALID','OUTPUT_INVALID','JOB_CONFLICT','JOB_LOCKED','TIMEOUT','CANCELLED','PROCESS_FAILED','LEASE_EXPIRED')),
  worker_id uuid,
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (verification_id,user_id) references public.verifications(id,user_id) on delete cascade,
  unique (user_id,fingerprint),
  unique (id,user_id),
  check ((status='processing' and lease_token is not null and lease_until is not null and worker_id is not null)
    or (status<>'processing' and lease_token is null and lease_until is null and worker_id is null)),
  check ((status='completed' and result is not null and completed_at is not null) or status<>'completed')
);
create index media_jobs_owner_recent_idx on public.media_processing_jobs(user_id,created_at desc,id desc);
create index media_jobs_claim_idx on public.media_processing_jobs(available_at,created_at,id) where status in ('queued','processing');
create table public.media_processing_inputs (
  job_id uuid not null,
  user_id uuid not null,
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  position integer not null check (position between 1 and 5),
  primary key(job_id,position),
  unique(job_id,asset_id),
  foreign key(job_id,user_id) references public.media_processing_jobs(id,user_id) on delete cascade
);
create index media_inputs_asset_idx on public.media_processing_inputs(asset_id);
create index media_inputs_owner_idx on public.media_processing_inputs(user_id);
alter table public.media_processing_jobs enable row level security;
alter table public.media_processing_inputs enable row level security;
revoke all on public.media_processing_jobs,public.media_processing_inputs from public,anon,authenticated;
grant select(id,user_id,verification_id,kind,status,attempts,failure_code,result,created_at,updated_at,completed_at)
  on public.media_processing_jobs to authenticated;
grant select on public.media_processing_inputs to authenticated;
grant all on public.media_processing_jobs,public.media_processing_inputs to service_role;
create policy media_jobs_owner_select on public.media_processing_jobs for select to authenticated using ((select auth.uid())=user_id);
create policy media_inputs_owner_select on public.media_processing_inputs for select to authenticated using ((select auth.uid())=user_id);

-- L’identité provient exclusivement du serveur après auth.getUser ; RPC service_role.
create function public.media_job_enqueue(p_user uuid,p_assets uuid[],p_caption text,p_platform public.social_platform,p_analysis jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare asset public.media_assets; job uuid; verification uuid; items jsonb := '[]';
  media_kind text; signature text; i integer; first_path text; current_group uuid;
begin
 if p_user is null or p_assets is null or cardinality(p_assets) not between 1 and 5
 or p_caption is null or length(p_caption) not between 1 and 10000 or p_platform is null
 then raise exception 'Entrée média invalide' using errcode='22023'; end if;
 if (select count(distinct x) from unnest(p_assets) x)<>cardinality(p_assets)
 then raise exception 'Sources dupliquées' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,271));
 for i in 1..cardinality(p_assets) loop
  select * into asset from public.media_assets where id=p_assets[i] and user_id=p_user for update;
  if not found then raise exception 'Source non possédée' using errcode='42501'; end if;
  if asset.status<>'ready' or asset.expires_at<=now() or asset.media_sha256 is null
  or asset.storage_path !~ ('^'||p_user::text||'/[a-f0-9-]{36}\.(mp4|mov|jpg|png|webp)$')
  or asset.actual_bytes is null
  then raise exception 'Source non confirmée ou expirée' using errcode='22023'; end if;
  if i=1 then
    first_path:=asset.storage_path;
    media_kind:=case when cardinality(p_assets)=1 then 'video' else 'carousel' end;
    current_group:=asset.group_id;
  end if;
  if (media_kind='video' and (asset.kind<>'video' or asset.mime_type not in ('video/mp4','video/quicktime')))
  or (media_kind='carousel' and (asset.kind<>'image' or asset.actual_bytes>8388608 or current_group is null or asset.group_id is distinct from current_group))
  then raise exception 'Sources incompatibles' using errcode='22023'; end if;
  items:=items||jsonb_build_array(jsonb_build_object('path',asset.storage_path,'sha256',asset.media_sha256));
 end loop;
 signature:=encode(extensions.digest(convert_to(jsonb_build_object('sources',items,'caption',p_caption,'platform',p_platform,'version','media-rules-v1')::text,'UTF8'),'sha256'),'hex');
 select id into job from public.media_processing_jobs where user_id=p_user and fingerprint=signature;
 if found then return job; end if;
 if (select count(*) from public.media_processing_jobs where user_id=p_user and status in ('queued','processing'))>=8
 then raise exception 'Trop de préparations actives' using errcode='54000'; end if;
 if jsonb_typeof(p_analysis->'score') is distinct from 'number'
 or (p_analysis->>'score')::integer not between 0 and 100
 or coalesce(p_analysis->>'riskLevel','') not in ('low','medium','high','critical')
 or jsonb_typeof(p_analysis->'violations') is distinct from 'array'
 then raise exception 'Analyse textuelle invalide' using errcode='22023'; end if;
 insert into public.verifications(user_id,platform,content_text,media_type,media_url,status,prompt_version)
 values(p_user,p_platform,p_caption,media_kind,first_path,'queued','media-rules-v1') returning id into verification;
 job:=gen_random_uuid();
 insert into public.media_processing_jobs(id,user_id,verification_id,fingerprint,kind,payload,caption_analysis)
 values(job,p_user,verification,signature,media_kind,jsonb_build_object('schemaVersion',1,'id',job,'kind',media_kind,'inputs',items,'timeoutMs',120000),p_analysis);
 for i in 1..cardinality(p_assets) loop
  insert into public.media_processing_inputs(job_id,user_id,asset_id,position) values(job,p_user,p_assets[i],i);
 end loop;
 return job;
end $$;

-- SKIP LOCKED évite le double traitement ; le jeton change à chaque tentative.
create function public.media_job_claim(p_worker uuid)
returns table(id uuid,lease_token uuid,payload jsonb) language plpgsql security definer set search_path='' as $$
declare picked public.media_processing_jobs;
begin
 if p_worker is null then raise exception 'Worker requis' using errcode='22023'; end if;
 -- Les dernières tentatives expirées sont clôturées avant sélection.
 with exhausted as (
  update public.media_processing_jobs j set status='failed',failure_code='LEASE_EXPIRED',lease_token=null,lease_until=null,worker_id=null,updated_at=now()
  where j.status='processing' and j.lease_until<=now() and j.attempts>=3 returning j.verification_id
 ) update public.verifications v set status='failed' where v.id in(select verification_id from exhausted);
 select j.* into picked from public.media_processing_jobs j
 where j.attempts<3 and ((j.status='queued' and j.available_at<=now()) or (j.status='processing' and j.lease_until<=now()))
 order by j.available_at,j.created_at,j.id for update skip locked limit 1;
 if not found then return; end if;
 -- Les sources doivent toujours exister avec la même empreinte au claim.
 if exists(select 1 from public.media_processing_inputs i join public.media_assets a on a.id=i.asset_id
   where i.job_id=picked.id and (a.user_id<>picked.user_id or a.status<>'ready' or a.expires_at<=now()
     or a.media_sha256 is distinct from picked.payload->'inputs'->(i.position-1)->>'sha256')) then
  update public.media_processing_jobs j set status='failed',failure_code='INPUT_INVALID',lease_token=null,lease_until=null,worker_id=null,updated_at=now() where j.id=picked.id;
  update public.verifications set status='failed' where public.verifications.id=picked.verification_id;
  return;
 end if;
 update public.media_processing_jobs j set status='processing',attempts=j.attempts+1,worker_id=p_worker,
  lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',failure_code=null,updated_at=now()
 where j.id=picked.id returning j.* into picked;
 update public.verifications set status='processing' where public.verifications.id=picked.verification_id;
 return query select picked.id,picked.lease_token,picked.payload;
end $$;

create function public.media_job_finish(p_job uuid,p_token uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.media_processing_jobs; source jsonb; artifact jsonb; proof text;
begin
 select * into j from public.media_processing_jobs where id=p_job for update;
 if not found or j.status<>'processing' or j.lease_token is distinct from p_token or j.lease_until<=now() then return false; end if;
 if p_result is null or octet_length(p_result::text)>65536
 or p_result->>'id' is distinct from j.id::text or p_result->>'kind' is distinct from j.kind
 or p_result->>'state' is distinct from 'completed' or p_result->>'aiCalls' is distinct from '0'
 or p_result->>'processor' is distinct from 'mentioncheck-local-media-v1'
 or jsonb_typeof(p_result->'inputs') is distinct from 'array'
 or jsonb_array_length(p_result->'inputs')<>jsonb_array_length(j.payload->'inputs')
 or jsonb_typeof(p_result->'artifacts') is distinct from 'array'
 or jsonb_array_length(p_result->'artifacts') not between 3 and 7
 then raise exception 'Résultat technique invalide' using errcode='22023'; end if;
 for source in select value from jsonb_array_elements(j.payload->'inputs') loop
  if not exists(select 1 from jsonb_array_elements(p_result->'inputs') x where x->>'path'=source->>'path' and x->>'sha256'=source->>'sha256')
  then raise exception 'Sources du résultat altérées' using errcode='22023'; end if;
 end loop;
 for artifact in select value from jsonb_array_elements(p_result->'artifacts') loop
  if coalesce(artifact->>'name','') !~ '^(frame-0[1-3]\.jpg|slide-0[1-5]\.webp|audio-mono\.wav|manifest\.json)$'
  or coalesce(artifact->>'sha256','') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(artifact->'bytes') is distinct from 'number'
  or (artifact->>'bytes')::integer not between 1 and 8388608
  then raise exception 'Artefact invalide' using errcode='22023'; end if;
 end loop;
 if (select count(distinct x->>'name') from jsonb_array_elements(p_result->'artifacts') x)<>jsonb_array_length(p_result->'artifacts')
 or not exists(select 1 from jsonb_array_elements(p_result->'artifacts') x where x->>'name'='manifest.json')
 or (j.kind='video' and (select count(*) from jsonb_array_elements(p_result->'artifacts') x where x->>'name' ~ '^frame-0[1-3]\.jpg$')<>3)
 or (j.kind='carousel' and (select count(*) from jsonb_array_elements(p_result->'artifacts') x where x->>'name' ~ '^slide-0[1-5]\.webp$')<>jsonb_array_length(j.payload->'inputs'))
 then raise exception 'Bundle technique incomplet' using errcode='22023'; end if;
 if (j.kind='video' and (jsonb_array_length(p_result->'artifacts') not between 4 and 5
    or exists(select 1 from jsonb_array_elements(p_result->'artifacts') x where x->>'name' like 'slide-%')))
 or (j.kind='carousel' and (jsonb_array_length(p_result->'artifacts')<>jsonb_array_length(j.payload->'inputs')+1
    or exists(select 1 from generate_series(1,jsonb_array_length(j.payload->'inputs')) n
      where not exists(select 1 from jsonb_array_elements(p_result->'artifacts') x where x->>'name'='slide-'||lpad(n::text,2,'0')||'.webp'))))
 then raise exception 'Artefacts incompatibles avec le média' using errcode='22023'; end if;
 proof:=encode(extensions.digest(convert_to(jsonb_build_object('version','media-evidence-v1','job',j.fingerprint,'result',p_result)::text,'UTF8'),'sha256'),'hex');
 update public.media_processing_jobs set status='completed',result=p_result,lease_token=null,lease_until=null,worker_id=null,completed_at=now(),updated_at=now() where id=p_job;
 update public.verifications set status='completed',completed_at=now(),ai_score=(j.caption_analysis->>'score')::integer,
  ai_risk_level=(j.caption_analysis->>'riskLevel')::public.risk_level,hash_sha256=proof,
  ai_explanation=jsonb_build_object('violations',j.caption_analysis->'violations','aiFlags','[]'::jsonb,'analysisMode','rules_only',
   'scoringVersion','rules-v1','mediaPreparation','completed','mediaJobId',j.id,
   'warnings',jsonb_build_array('Seule la légende a été contrôlée par les règles automatiques.',
    'Images et audio préparés techniquement, sans analyse visuelle IA ni transcription.','Score provisoire sans certification juridique.'))
 where id=j.verification_id and user_id=j.user_id;
 return true;
end $$;

create function public.media_job_fail(p_job uuid,p_token uuid,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.media_processing_jobs; final boolean;
begin
 select * into j from public.media_processing_jobs where id=p_job for update;
 if not found or j.status<>'processing' or j.lease_token is distinct from p_token or j.lease_until<=now() then return false; end if;
 if p_code is null or p_code not in ('JOB_INVALID','INPUT_INVALID','OUTPUT_INVALID','JOB_CONFLICT','JOB_LOCKED','TIMEOUT','CANCELLED','PROCESS_FAILED') then p_code:='PROCESS_FAILED'; end if;
 final:=j.attempts>=3 or p_code in ('JOB_INVALID','INPUT_INVALID','OUTPUT_INVALID','JOB_CONFLICT','CANCELLED');
 update public.media_processing_jobs set status=case when p_code='CANCELLED' then 'cancelled' when final then 'failed' else 'queued' end,
  failure_code=p_code,lease_token=null,lease_until=null,worker_id=null,updated_at=now(),available_at=now()+j.attempts*interval '30 seconds' where id=p_job;
 update public.verifications set status=case when final then 'failed'::public.verification_status else 'queued'::public.verification_status end where id=j.verification_id;
 return true;
end $$;

create function public.media_job_cancel(p_user uuid,p_job uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare verification uuid;
begin
 update public.media_processing_jobs set status='cancelled',lease_token=null,lease_until=null,worker_id=null,updated_at=now()
 where id=p_job and user_id=p_user and status in ('queued','processing') returning verification_id into verification;
 if not found then return false; end if;
 update public.verifications set status='failed' where id=verification and user_id=p_user;
 return true;
end $$;
revoke all on function public.media_job_enqueue(uuid,uuid[],text,public.social_platform,jsonb),public.media_job_claim(uuid),public.media_job_finish(uuid,uuid,jsonb),public.media_job_fail(uuid,uuid,text),public.media_job_cancel(uuid,uuid) from public,anon,authenticated;
grant execute on function public.media_job_enqueue(uuid,uuid[],text,public.social_platform,jsonb),public.media_job_claim(uuid),public.media_job_finish(uuid,uuid,jsonb),public.media_job_fail(uuid,uuid,text),public.media_job_cancel(uuid,uuid) to service_role;
commit;
