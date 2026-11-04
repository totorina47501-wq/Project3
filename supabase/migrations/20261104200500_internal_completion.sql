-- Livraison interne : équipes, paramètres, collaborations et confidentialité.
-- Migration préparée pour revue ; aucune application à une base distante.
begin;


-- Domaine : studio
-- Studio isolé : aucune modification des tables personnelles ni des abonnements.

create schema if not exists studio_private;
revoke all on schema studio_private from public, anon, authenticated;
grant usage on schema studio_private to authenticated;

create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references public.users(id) on delete restrict,
 name text not null check(length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now()
);
create table public.workspace_members (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','member')),
 joined_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create unique index workspace_one_owner on public.workspace_members(workspace_id) where role='owner';
create index workspace_members_user_idx on public.workspace_members(user_id,workspace_id);
create table public.workspace_invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 email text not null check(email=lower(trim(email)) and length(email) between 3 and 320),
 role text not null check(role in ('admin','member')),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_by uuid references public.users(id) on delete set null,
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 accepted_by uuid references public.users(id) on delete set null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index workspace_invitation_active_email_idx on public.workspace_invitations(workspace_id,email)
 where accepted_at is null and revoked_at is null;
create index workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id);
create table public.api_keys (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 created_by uuid references public.users(id) on delete set null,
 name text not null check(length(trim(name)) between 1 and 80),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 prefix text not null check(length(prefix) between 10 and 20),
 scopes text[] not null check(cardinality(scopes) between 1 and 2 and scopes <@ array['checks:read','checks:write']::text[]),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 days',
 revoked_at timestamptz
);
create index api_keys_workspace_idx on public.api_keys(workspace_id);
create table public.workspace_verifications (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 created_by uuid references public.users(id) on delete set null,
 platform public.social_platform not null,
 caption text not null check(length(trim(caption)) between 1 and 10000),
 result jsonb not null check(jsonb_typeof(result)='object' and coalesce(result->>'analysisMode'='rules_only',false)),
 created_at timestamptz not null default now()
);
create index workspace_verifications_recent_idx on public.workspace_verifications(workspace_id,created_at desc,id desc);

-- RLS de lecture seulement. Le helper privé contourne la récursion membership,
-- contrôle auth.uid() et le plan actuel du propriétaire dans public.users.
create function studio_private.is_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.workspace_members m
  join public.workspaces w on w.id=m.workspace_id
  join public.users u on u.id=w.owner_id
  where m.workspace_id=p_workspace and m.user_id=auth.uid() and u.plan='studio'
 )
$$;
revoke all on function studio_private.is_member(uuid) from public,anon,authenticated;
grant execute on function studio_private.is_member(uuid) to authenticated;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.api_keys enable row level security;
alter table public.workspace_verifications enable row level security;
revoke all on public.workspaces,public.workspace_members,public.workspace_invitations,public.api_keys,public.workspace_verifications from public,anon,authenticated;
grant select on public.workspaces,public.workspace_members,public.workspace_verifications to authenticated;
create policy studio_workspaces_read on public.workspaces for select to authenticated using(studio_private.is_member(id));
create policy studio_members_read on public.workspace_members for select to authenticated using(studio_private.is_member(workspace_id));
create policy studio_checks_read on public.workspace_verifications for select to authenticated using(studio_private.is_member(workspace_id));
-- Aucun SELECT direct sur invitations/clés : même leur empreinte reste serveur.
-- Le service utilise des projections explicites pour les métadonnées.
grant all on public.workspaces,public.workspace_members,public.workspace_invitations,public.api_keys,public.workspace_verifications to service_role;

create function public.studio_execute(p_actor uuid,p_workspace uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 w public.workspaces%rowtype;
 inv public.workspace_invitations%rowtype;
 k public.api_keys%rowtype;
 v public.workspace_verifications%rowtype;
 actor_role text;
 target_role text;
 target_id uuid;
 target_email text;
 owner_plan public.account_plan;
 slots integer;
 items jsonb;
begin
 if p_actor is null or not exists(select 1 from public.users where id=p_actor) then
  raise exception 'Studio accès refusé' using errcode='42501';
 end if;
 if p_action='create_workspace' then
  select plan into owner_plan from public.users where id=p_actor for update;
  if owner_plan<>'studio' then raise exception 'Studio requis' using errcode='42501'; end if;
  insert into public.workspaces(owner_id,name) values(p_actor,p_payload->>'name') returning * into w;
  insert into public.workspace_members(workspace_id,user_id,role) values(w.id,p_actor,'owner');
  return jsonb_build_object('workspace',to_jsonb(w));
 end if;
 if p_action='list_workspaces' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]') into items from (
   select w1.*,m.role from public.workspaces w1
   join public.workspace_members m on m.workspace_id=w1.id and m.user_id=p_actor
   join public.users u on u.id=w1.owner_id and u.plan='studio'
  ) t;
  return jsonb_build_object('workspaces',items);
 end if;
 if p_action='accept_invitation' then
  -- Chercher le workspace puis verrouiller dans l'ordre commun workspace/jeton.
  select workspace_id into p_workspace from public.workspace_invitations where token_hash=p_payload->>'token_hash';
 end if;
 select * into w from public.workspaces where id=p_workspace for update;
 if not found then raise exception 'Studio accès refusé' using errcode='42501'; end if;
 select plan into owner_plan from public.users where id=w.owner_id for share;
 if owner_plan<>'studio' then raise exception 'Studio requis' using errcode='42501'; end if;
 if p_action='accept_invitation' then
  select * into inv from public.workspace_invitations
   where workspace_id=w.id and token_hash=p_payload->>'token_hash' for update;
  select lower(email) into target_email from auth.users where id=p_actor and email_confirmed_at is not null;
  if not found or inv.id is null or inv.email is distinct from target_email
   or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=clock_timestamp()
   or not exists(select 1 from public.workspace_members issuer where issuer.workspace_id=w.id and issuer.user_id=inv.created_by
     and (issuer.role='owner' or (issuer.role='admin' and inv.role='member'))) then
   raise exception 'Invitation invalide ou expirée' using errcode='42501';
  end if;
  if (select count(*) from public.workspace_members where workspace_id=w.id)>=5 then
   raise exception 'Cinq sièges maximum' using errcode='23514';
  end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(w.id,p_actor,inv.role);
  update public.workspace_invitations set accepted_at=clock_timestamp(),accepted_by=p_actor where id=inv.id;
  return jsonb_build_object('workspace',to_jsonb(w));
 end if;
 select role into actor_role from public.workspace_members where workspace_id=w.id and user_id=p_actor;
 if actor_role is null then raise exception 'Studio accès refusé' using errcode='42501'; end if;
 if p_action='checks' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]') into items from (
   select * from public.workspace_verifications where workspace_id=w.id order by created_at desc,id desc limit 100
  ) t;
  return jsonb_build_object('items',items,'limit',100);
 end if;
 if p_action='save_check' then
  insert into public.workspace_verifications(workspace_id,created_by,platform,caption,result)
  values(w.id,p_actor,(p_payload->>'platform')::public.social_platform,p_payload->>'caption',p_payload->'result') returning * into v;
  return jsonb_build_object('verification',to_jsonb(v));
 end if;
 if p_action='overview' then
  return jsonb_build_object('workspace',to_jsonb(w),'role',actor_role,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'email',u.email,'joined_at',m.joined_at) order by m.joined_at,m.user_id),'[]')
     from public.workspace_members m join public.users u on u.id=m.user_id where m.workspace_id=w.id),
   'invitations',case when actor_role in ('owner','admin') then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at,'accepted_at',accepted_at,'revoked_at',revoked_at) order by created_at desc,id desc),'[]')
     from public.workspace_invitations where workspace_id=w.id and (actor_role='owner' or role='member')) else '[]'::jsonb end,
   'keys',case when actor_role in ('owner','admin') then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'prefix',prefix,'scopes',scopes,'created_at',created_at,'expires_at',expires_at,'revoked_at',revoked_at) order by created_at desc,id desc),'[]')
     from public.api_keys where workspace_id=w.id) else '[]'::jsonb end);
 end if;
 if actor_role not in ('owner','admin') then raise exception 'Gestionnaire requis' using errcode='42501'; end if;
 if p_action='invite' then
  if (p_payload->>'role') not in ('admin','member') or p_payload->>'role' is null
   or (actor_role='admin' and p_payload->>'role'<>'member') then
   raise exception 'Rôle interdit' using errcode='42501';
  end if;
  target_email:=lower(trim(p_payload->>'email'));
  if target_email is null or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
   raise exception 'Email invalide' using errcode='22023';
  end if;
  if exists(select 1 from public.workspace_members m join public.users u on u.id=m.user_id where m.workspace_id=w.id and lower(u.email)=target_email) then
   raise exception 'Déjà membre' using errcode='23505';
  end if;
  update public.workspace_invitations set revoked_at=clock_timestamp()
   where workspace_id=w.id and accepted_at is null and revoked_at is null and (
    expires_at<=clock_timestamp() or not exists(select 1 from public.workspace_members issuer
      where issuer.workspace_id=w.id and issuer.user_id=public.workspace_invitations.created_by
       and (issuer.role='owner' or (issuer.role='admin' and public.workspace_invitations.role='member'))));
  select (select count(*) from public.workspace_members where workspace_id=w.id)+
   (select count(*) from public.workspace_invitations where workspace_id=w.id and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) into slots;
  if slots>=5 then raise exception 'Cinq sièges maximum' using errcode='23514'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,token_hash,created_by)
   values(w.id,target_email,p_payload->>'role',p_payload->>'token_hash',p_actor) returning * into inv;
  return jsonb_build_object('invitation',jsonb_build_object('id',inv.id,'email',inv.email,'role',inv.role,'expires_at',inv.expires_at));
 elsif p_action='revoke_invitation' then
  select * into inv from public.workspace_invitations where workspace_id=w.id and id=(p_payload->>'id')::uuid for update;
  if not found or (actor_role='admin' and inv.role<>'member') then raise exception 'Invitation inaccessible' using errcode='42501'; end if;
  update public.workspace_invitations set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=inv.id and accepted_at is null;
 elsif p_action in ('remove_member','set_role') then
  target_id:=(p_payload->>'user_id')::uuid;
  select role into target_role from public.workspace_members where workspace_id=w.id and user_id=target_id;
  if target_role is null or target_role='owner' or (actor_role='admin' and (target_role<>'member' or p_action='set_role')) then
   raise exception 'Membre inaccessible' using errcode='42501';
  end if;
  if p_action='set_role' then
   if p_payload->>'role' not in ('admin','member') or p_payload->>'role' is null then raise exception 'Rôle interdit' using errcode='42501'; end if;
   update public.workspace_members set role=p_payload->>'role' where workspace_id=w.id and user_id=target_id;
  else
   delete from public.workspace_members where workspace_id=w.id and user_id=target_id;
  end if;
  -- Retrait/rétrogradation révoque les capacités encore en attente du membre.
  if p_action='remove_member' or p_payload->>'role'='member' then
   update public.workspace_invitations set revoked_at=coalesce(revoked_at,clock_timestamp())
    where workspace_id=w.id and created_by=target_id and accepted_at is null;
   update public.api_keys set revoked_at=coalesce(revoked_at,clock_timestamp()) where workspace_id=w.id and created_by=target_id;
  end if;
 elsif p_action='create_key' then
  if (select count(*) from public.api_keys where workspace_id=w.id and revoked_at is null and expires_at>clock_timestamp())>=20 then
   raise exception 'Vingt clés actives maximum' using errcode='23514';
  end if;
  insert into public.api_keys(workspace_id,created_by,name,token_hash,prefix,scopes)
   values(w.id,p_actor,p_payload->>'name',p_payload->>'token_hash',p_payload->>'prefix',array(select jsonb_array_elements_text(p_payload->'scopes'))) returning * into k;
  return jsonb_build_object('key',jsonb_build_object('id',k.id,'name',k.name,'prefix',k.prefix,'scopes',k.scopes,'expires_at',k.expires_at));
 elsif p_action='revoke_key' then
  update public.api_keys set revoked_at=coalesce(revoked_at,clock_timestamp()) where workspace_id=w.id and id=(p_payload->>'id')::uuid;
  if not found then raise exception 'Clé inaccessible' using errcode='42501'; end if;
 else
  raise exception 'Action inconnue' using errcode='22023';
 end if;
 return jsonb_build_object('ok',true);
end $$;

-- Les clés sont des capacités limitées à cette équipe et à deux actions.
-- Vérification + action sous le même verrou : révocation, downgrade et retrait
-- de membre ne peuvent pas laisser passer une écriture après leur validation.
create function public.studio_execute_api(p_hash text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.api_keys%rowtype; workspace uuid;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Clé invalide' using errcode='42501'; end if;
 select workspace_id into workspace from public.api_keys where token_hash=p_hash;
 perform 1 from public.workspaces where id=workspace for update;
 select * into k from public.api_keys where token_hash=p_hash and workspace_id=workspace for update;
 if not found or k.revoked_at is not null or k.expires_at<=clock_timestamp() or k.created_by is null
  or not exists(select 1 from public.workspace_members where workspace_id=k.workspace_id and user_id=k.created_by and role in ('owner','admin'))
  or not ((p_action='checks' and 'checks:read'=any(k.scopes)) or (p_action='save_check' and 'checks:write'=any(k.scopes))) then
  raise exception 'Clé invalide ou permission insuffisante' using errcode='42501';
 end if;
 return public.studio_execute(k.created_by,k.workspace_id,p_action,p_payload);
end $$;
revoke all on function public.studio_execute(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.studio_execute_api(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.studio_execute(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.studio_execute_api(text,text,jsonb) to service_role;


-- Domaine : settings
-- Proposition locale uniquement : le parent crée la migration et valide sur PostgreSQL isolé.

alter table public.social_accounts add column connection_kind text not null default 'unknown'
  check (connection_kind in ('manual','oauth','unknown'));
comment on column public.social_accounts.connection_kind is
  'manual = métadonnée déclarée ; unknown = historique non vérifié ; oauth réservé à une future intégration validée.';
grant select (connection_kind) on public.social_accounts to authenticated;

create table public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  rewrite_tone text not null default 'naturel' check (rewrite_tone in ('naturel','créatif','institutionnel')),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public,anon,authenticated;
grant select on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
grant insert(user_id,rewrite_tone),update(user_id,rewrite_tone) on public.user_preferences to authenticated;
create policy preferences_select_own on public.user_preferences for select to authenticated
  using ((select auth.uid())=user_id);
create policy preferences_insert_own on public.user_preferences for insert to authenticated
  with check ((select auth.uid())=user_id);
create policy preferences_update_own on public.user_preferences for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- Écriture RPC uniquement : aucun droit INSERT/UPDATE/DELETE direct ni accès Vault.
-- Verrouille le profil propriétaire pour sérialiser deux créations concurrentes.
create or replace function public.save_social_account(p_id uuid,p_platform public.social_platform,p_handle text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_plan public.account_plan; v_id uuid; v_kind text; v_handle text;
begin
  if v_user is null then raise exception 'Session requise' using errcode='42501'; end if;
  select plan into v_plan from public.users where id=v_user for update;
  if not found then raise exception 'Profil absent' using errcode='42501'; end if;
  v_handle:=lower(regexp_replace(btrim(p_handle),'^@',''));
  if p_platform is null or v_handle is null or length(v_handle) not between 1 and 200
    or v_handle !~ '^[[:alnum:]][[:alnum:]._-]*$' then
    raise exception 'Déclaration invalide' using errcode='22023';
  end if;
  if p_id is null then
    if v_plan='solo' and (select count(*) from public.social_accounts where user_id=v_user)>=3 then
      raise exception 'Quota Solo atteint' using errcode='P0001';
    end if;
    insert into public.social_accounts(user_id,platform,handle,connection_kind)
      values(v_user,p_platform,v_handle,'manual') returning id into v_id;
  else
    select connection_kind into v_kind from public.social_accounts where id=p_id and user_id=v_user for update;
    if not found then raise exception 'Compte absent' using errcode='P0002'; end if;
    if v_kind<>'manual' then raise exception 'Déclaration manuelle requise' using errcode='42501'; end if;
    update public.social_accounts set platform=p_platform,handle=v_handle where id=p_id and user_id=v_user returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_social_account(uuid,public.social_platform,text) from public,anon,authenticated;
grant execute on function public.save_social_account(uuid,public.social_platform,text) to authenticated;

create or replace function public.remove_social_account(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_kind text;
begin
  if v_user is null then raise exception 'Session requise' using errcode='42501'; end if;
  perform 1 from public.users where id=v_user for update;
  if not found then raise exception 'Profil absent' using errcode='42501'; end if;
  select connection_kind into v_kind from public.social_accounts where id=p_id and user_id=v_user for update;
  if not found then raise exception 'Compte absent' using errcode='P0002'; end if;
  if v_kind<>'manual' then raise exception 'Déclaration manuelle requise' using errcode='42501'; end if;
  delete from public.social_accounts where id=p_id and user_id=v_user;
end;
$$;
revoke all on function public.remove_social_account(uuid) from public,anon,authenticated;
grant execute on function public.remove_social_account(uuid) to authenticated;


-- Domaine : collaborations
-- Complément de 202611032001 et 202611032002 ; aucune donnée de démonstration.
-- À intégrer à une migration finale par le propriétaire du chantier.

alter table public.brand_deals add column archive_payload jsonb;
alter table public.brand_deals add constraint brand_deals_id_owner_unique unique(id,user_id);
alter table public.brand_deals add constraint brand_deals_payload_array check(archive_payload is null or jsonb_typeof(archive_payload)='array');

create table public.brand_deal_verifications (
  deal_id uuid not null,
  user_id uuid not null,
  verification_id uuid not null,
  primary key(deal_id,verification_id),
  foreign key(deal_id,user_id) references public.brand_deals(id,user_id) on delete cascade,
  foreign key(verification_id,user_id) references public.verifications(id,user_id) on delete restrict
);
create index brand_deal_verifications_owner_idx on public.brand_deal_verifications(user_id,verification_id);
alter table public.brand_deal_verifications enable row level security;
revoke all on public.brand_deal_verifications from public,anon,authenticated;
grant select on public.brand_deal_verifications to authenticated;
create policy brand_deal_verifications_select_own on public.brand_deal_verifications
  for select to authenticated using ((select auth.uid())=user_id);

-- Toutes les colonnes et tous les liens sont gelés après archivage.
create or replace function public.prevent_archived_deal_update()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.archived_at is not null and old is distinct from new then
    raise exception 'La collaboration archivée est immuable' using errcode='23514';
  end if;
  return new;
end;
$$;
create function public.prevent_archived_deal_link_write()
returns trigger language plpgsql set search_path='' as $$
declare target_id uuid; stamp timestamptz;
begin
  target_id:=case when tg_op='DELETE' then old.deal_id else new.deal_id end;
  select archived_at into stamp from public.brand_deals where id=target_id for update;
  if stamp is not null then raise exception 'Liens archivés immuables' using errcode='23514'; end if;
  if tg_op='UPDATE' then raise exception 'Remplacer les liens du brouillon uniquement' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger brand_deal_links_immutable before insert or update or delete on public.brand_deal_verifications
  for each row execute function public.prevent_archived_deal_link_write();
revoke all on function public.prevent_archived_deal_link_write() from public,anon,authenticated;

-- RPC publiques volontairement exposées : aucune écriture directe accordée.
-- Les identifiants propriétaire viennent exclusivement de auth.uid().
create function public.save_brand_deal(p_id uuid,p_brand_name text,p_start_date date,p_end_date date,p_contract_url text,p_verification_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result_id uuid; stamp timestamptz;
begin
  if actor is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  if p_brand_name is null or length(trim(p_brand_name)) not between 1 and 200
    or p_start_date is null or p_end_date<p_start_date
    or p_verification_ids is null or cardinality(p_verification_ids)>50
    or cardinality(p_verification_ids)<>(select count(distinct x) from unnest(p_verification_ids) x)
  then raise exception 'Brouillon invalide' using errcode='22023'; end if;
  if p_contract_url is not null and (
    length(p_contract_url)>500 or p_contract_url !~ ('^'||actor::text||'/[a-zA-Z0-9/_\-.]+$')
    or p_contract_url ~ '(^|/)\.\.?(/|$)' or p_contract_url like '%//%'
    or not exists(select 1 from storage.objects where bucket_id='deal-contracts' and name=p_contract_url)
  ) then raise exception 'Contrat privé introuvable' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_verification_ids) x where not exists(
    select 1 from public.verifications v where v.id=x and v.user_id=actor
  )) then raise exception 'Vérification introuvable' using errcode='22023'; end if;
  if p_id is null then
    insert into public.brand_deals(user_id,brand_name,start_date,end_date,contract_url)
      values(actor,trim(p_brand_name),p_start_date,p_end_date,p_contract_url) returning id into result_id;
  else
    select id,archived_at into result_id,stamp from public.brand_deals
      where id=p_id and user_id=actor for update;
    if not found then raise exception 'Collaboration introuvable' using errcode='P0002'; end if;
    if stamp is not null then raise exception 'Archive immuable' using errcode='23514'; end if;
    update public.brand_deals set brand_name=trim(p_brand_name),start_date=p_start_date,
      end_date=p_end_date,contract_url=p_contract_url where id=result_id and user_id=actor;
    delete from public.brand_deal_verifications where deal_id=result_id and user_id=actor;
  end if;
  insert into public.brand_deal_verifications(deal_id,user_id,verification_id)
    select result_id,actor,x from unnest(p_verification_ids) x;
  return result_id;
end;
$$;

create function public.delete_brand_deal_draft(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); stamp timestamptz;
begin
  if actor is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  select archived_at into stamp from public.brand_deals where id=p_id and user_id=actor for update;
  if not found then raise exception 'Collaboration introuvable' using errcode='P0002'; end if;
  if stamp is not null then raise exception 'Archive immuable' using errcode='23514'; end if;
  delete from public.brand_deals where id=p_id and user_id=actor;
end;
$$;

create function public.archive_brand_deal(p_id uuid)
returns public.brand_deals language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); deal public.brand_deals; stamp timestamptz; links jsonb; payload jsonb;
begin
  if actor is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  select * into deal from public.brand_deals where id=p_id and user_id=actor for update;
  if not found then raise exception 'Collaboration introuvable' using errcode='P0002'; end if;
  if deal.archived_at is not null then return deal; end if;
  -- Verrouiller les vérifications dans un ordre stable avant de les figer dans le snapshot.
  perform v.id from public.verifications v join public.brand_deal_verifications l on l.verification_id=v.id
    where l.deal_id=deal.id and l.user_id=actor and v.user_id=actor order by v.id for share of v;
  if exists(select 1 from public.brand_deal_verifications l join public.verifications v on v.id=l.verification_id
    where l.deal_id=deal.id and (v.user_id<>actor or v.status not in('completed','accepted','kept') or v.hash_sha256 is null))
  then raise exception 'Finaliser les vérifications liées avant archivage' using errcode='23514'; end if;
  select coalesce(jsonb_agg(jsonb_build_array(v.id::text,v.platform::text,v.status::text,v.content_text,
    v.accepted_caption,v.hash_sha256,v.prompt_version) order by v.id),'[]'::jsonb) into links
    from public.brand_deal_verifications l join public.verifications v on v.id=l.verification_id
    where l.deal_id=deal.id and l.user_id=actor and v.user_id=actor;
  stamp:=date_trunc('milliseconds',clock_timestamp());
  payload:=jsonb_build_array('mentioncheck-deal-v1',deal.id::text,actor::text,deal.brand_name,
    deal.start_date::text,deal.end_date::text,deal.contract_url,
    to_char(deal.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),links);
  update public.brand_deals set archived_at=stamp,archive_payload=payload,
    hash_sha256=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex')
    where id=deal.id and user_id=actor returning * into deal;
  return deal;
end;
$$;
revoke all on function public.save_brand_deal(uuid,text,date,date,text,uuid[]) from public,anon,authenticated;
revoke all on function public.delete_brand_deal_draft(uuid) from public,anon,authenticated;
revoke all on function public.archive_brand_deal(uuid) from public,anon,authenticated;
grant execute on function public.save_brand_deal(uuid,text,date,date,text,uuid[]) to authenticated;
grant execute on function public.delete_brand_deal_draft(uuid) to authenticated;
grant execute on function public.archive_brand_deal(uuid) to authenticated;


-- Domaine : privacy
-- Proposition locale uniquement ; ne pas appliquer à une instance distante dans ce lot.
-- Dépend des tables users / rewrite_feedback / privacy_erasure_requests existantes.

create schema if not exists privacy_internal;
revoke all on schema privacy_internal from public,anon,authenticated;

create table public.privacy_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  ai_training_opt_in boolean not null,
  source text not null check (source in ('migration_baseline','profile_change')),
  recorded_at timestamptz not null default now()
);
create index privacy_consent_events_owner_idx on public.privacy_consent_events(user_id,recorded_at);
alter table public.privacy_consent_events enable row level security;
revoke all on public.privacy_consent_events from public,anon,authenticated;
grant select on public.privacy_consent_events to authenticated,service_role;
create policy privacy_consent_events_select_own on public.privacy_consent_events
  for select to authenticated using ((select auth.uid())=user_id);
-- Ce relevé initial ne prétend pas connaître la date ou la preuve d'un consentement antérieur.
insert into public.privacy_consent_events(user_id,ai_training_opt_in,source)
  select id,ai_training_opt_in,'migration_baseline' from public.users;

-- Source actuelle ET snapshot requis. Un ancien snapshot n'est plus une autorisation autonome.
create function privacy_internal.enforce_feedback_consent()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_opt_in boolean;
begin
  select ai_training_opt_in into current_opt_in from public.users where id=new.user_id for share;
  if not found then raise exception 'Compte introuvable' using errcode='23503'; end if;
  new.training_consent_snapshot:=coalesce(new.training_consent_snapshot,false) and current_opt_in;
  return new;
end;
$$;
revoke all on function privacy_internal.enforce_feedback_consent() from public,anon,authenticated;
create trigger rewrite_feedback_current_consent before insert or update on public.rewrite_feedback
  for each row execute function privacy_internal.enforce_feedback_consent();

create function privacy_internal.audit_training_consent()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.ai_training_opt_in is distinct from old.ai_training_opt_in then
    insert into public.privacy_consent_events(user_id,ai_training_opt_in,source)
      values(new.id,new.ai_training_opt_in,'profile_change');
    if not new.ai_training_opt_in then
      update public.rewrite_feedback set training_consent_snapshot=false
        where user_id=new.id and training_consent_snapshot;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function privacy_internal.audit_training_consent() from public,anon,authenticated;
create trigger users_training_consent_audit after insert or update of ai_training_opt_in on public.users
  for each row execute function privacy_internal.audit_training_consent();
-- L'API dépend de cette RPC : aucune affirmation de retrait complet sur un ancien schéma.
create function public.set_training_consent(p_opt_in boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
declare result boolean;
begin
  if auth.uid() is null or p_opt_in is null then raise exception 'Consentement invalide' using errcode='42501'; end if;
  update public.users set ai_training_opt_in=p_opt_in where id=auth.uid()
    returning ai_training_opt_in into result;
  if not found then raise exception 'Compte introuvable' using errcode='P0002'; end if;
  return result;
end;
$$;
revoke all on function public.set_training_consent(boolean) from public,anon,authenticated;
grant execute on function public.set_training_consent(boolean) to authenticated;

-- Exclure aussi les feedbacks historiques dont le propriétaire a déjà retiré son accord.
update public.rewrite_feedback f set training_consent_snapshot=false
  from public.users u where f.user_id=u.id and not u.ai_training_opt_in and f.training_consent_snapshot;

create table public.privacy_erasure_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.privacy_erasure_requests(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  mode text not null default 'dry_run' check (mode='dry_run'),
  status text not null default 'prepared_disabled' check (status='prepared_disabled'),
  -- Uniquement compteurs et codes de blocage : ni chemins privés ni email/token/contenu.
  summary jsonb not null check (jsonb_typeof(summary)='object'),
  created_at timestamptz not null default now()
);
create index privacy_erasure_runs_owner_idx on public.privacy_erasure_runs(user_id,created_at);
alter table public.privacy_erasure_runs enable row level security;
revoke all on public.privacy_erasure_runs from public,anon,authenticated;
grant select on public.privacy_erasure_runs to authenticated;
grant select,insert on public.privacy_erasure_runs to service_role;
create policy privacy_erasure_runs_select_own on public.privacy_erasure_runs
  for select to authenticated using ((select auth.uid())=user_id);
comment on table public.privacy_erasure_runs is
  'Plans dry-run uniquement. Ne prouve aucune suppression. Durée de conservation opérateur à définir.';


commit;
