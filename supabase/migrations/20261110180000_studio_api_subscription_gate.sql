-- API Studio liée à un abonnement réellement actif, pas seulement users.plan.
-- Migration staging d'abord : aucune transaction Stripe ni IA.
begin;
create function studio_private.has_active_studio_subscription(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists (
   select 1 from public.subscriptions s where s.user_id=p_user
     and s.stripe_subscription_id is not null
     and s.plan='studio' and s.status in ('active','trialing')
     and s.current_period_end>now()
 )
$$;
revoke all on function studio_private.has_active_studio_subscription(uuid) from public,anon,authenticated;
grant execute on function studio_private.has_active_studio_subscription(uuid) to service_role;
create or replace function studio_private.is_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
   select 1 from public.workspace_members m
   join public.workspaces w on w.id=m.workspace_id
   join public.users u on u.id=w.owner_id
   where m.workspace_id=p_workspace and m.user_id=auth.uid()
     and u.plan='studio' and studio_private.has_active_studio_subscription(w.owner_id)
 )
$$;
revoke all on function studio_private.is_member(uuid) from public,anon,authenticated;
grant execute on function studio_private.is_member(uuid) to authenticated;

create table public.studio_api_usage_monthly (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  checks_used integer not null default 0 check(checks_used between 0 and 2000),
  primary key(workspace_id,period_start)
);
alter table public.studio_api_usage_monthly enable row level security;
revoke all on public.studio_api_usage_monthly from public,anon,authenticated;
grant select,insert,update,delete on public.studio_api_usage_monthly to service_role;

create or replace function public.studio_execute(p_actor uuid,p_workspace uuid,p_action text,p_payload jsonb default '{}')
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
  if owner_plan<>'studio' or not studio_private.has_active_studio_subscription(case when p_action='create_workspace' then p_actor else w.owner_id end) then raise exception 'Studio requis' using errcode='42501'; end if;
  insert into public.workspaces(owner_id,name) values(p_actor,p_payload->>'name') returning * into w;
  insert into public.workspace_members(workspace_id,user_id,role) values(w.id,p_actor,'owner');
  return jsonb_build_object('workspace',to_jsonb(w));
 end if;
 if p_action='list_workspaces' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]') into items from (
   select w1.*,m.role from public.workspaces w1
   join public.workspace_members m on m.workspace_id=w1.id and m.user_id=p_actor
   join public.users u on u.id=w1.owner_id and u.plan='studio' and studio_private.has_active_studio_subscription(w1.owner_id)
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
 if owner_plan<>'studio' or not studio_private.has_active_studio_subscription(case when p_action='create_workspace' then p_actor else w.owner_id end) then raise exception 'Studio requis' using errcode='42501'; end if;
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
create or replace function public.studio_execute_api(p_hash text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.api_keys%rowtype; workspace uuid; reserved integer;
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

 -- Même si 20 clés actives sont utilisées, le compteur est partagé par workspace
 -- et sérialisé par la contrainte PK. Aucune dépense OpenAI, règle seule.
 if p_action='save_check' then
   insert into public.studio_api_usage_monthly(workspace_id,period_start,checks_used)
   values(k.workspace_id,date_trunc('month',timezone('UTC',now()))::date,1)
   on conflict(workspace_id,period_start) do update
      set checks_used=public.studio_api_usage_monthly.checks_used+1
      where public.studio_api_usage_monthly.checks_used<2000
   returning checks_used into reserved;
   if reserved is null then raise exception 'Quota API Studio atteint' using errcode='P0001'; end if;
 end if;
 return public.studio_execute(k.created_by,k.workspace_id,p_action,p_payload);
end $$;
revoke all on function public.studio_execute(uuid,uuid,text,jsonb),public.studio_execute_api(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.studio_execute(uuid,uuid,text,jsonb),public.studio_execute_api(text,text,jsonb) to service_role;
commit;
