alter table public.brand_deals
  add column creator_details jsonb,
  add constraint brand_deals_creator_details_object check(
    creator_details is null or (
      jsonb_typeof(creator_details)='object'
      and octet_length(creator_details::text)<=12000
    )
  );

drop function public.save_brand_deal(uuid,text,date,date,text,uuid[]);

create function public.save_brand_deal(
  p_id uuid,p_brand_name text,p_start_date date,p_end_date date,p_contract_url text,
  p_creator_details jsonb,p_verification_ids uuid[]
)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result_id uuid; stamp timestamptz;
begin
  if actor is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  if p_brand_name is null or length(trim(p_brand_name)) not between 1 and 200
    or p_start_date is null or p_end_date<p_start_date
    or p_verification_ids is null or cardinality(p_verification_ids)>50
    or cardinality(p_verification_ids)<>(select count(distinct x) from unnest(p_verification_ids) x)
  then raise exception 'Brouillon invalide' using errcode='22023'; end if;
  if p_creator_details is not null and (
    jsonb_typeof(p_creator_details)<>'object'
    or octet_length(p_creator_details::text)>12000
    or exists(
      select 1 from jsonb_each(p_creator_details) entry
      where entry.key not in(
        'niche','platform','format','deliverables','duration','budget',
        'reuse_rights','exclusivity','proposal'
      )
      or jsonb_typeof(entry.value)<>'string'
      or (
        entry.key='platform'
        and entry.value#>>'{}' not in('','instagram','tiktok','youtube','linkedin','other')
      )
      or length(entry.value#>>'{}')>case entry.key
        when 'niche' then 120
        when 'platform' then 20
        when 'format' then 100
        when 'deliverables' then 1000
        when 'duration' then 120
        when 'budget' then 120
        when 'reuse_rights' then 200
        when 'exclusivity' then 200
        when 'proposal' then 2500
        else 0
      end
    )
  ) then raise exception 'Détails de collaboration invalides' using errcode='22023'; end if;
  if p_contract_url is not null and (
    length(p_contract_url)>500 or p_contract_url !~ ('^'||actor::text||'/[a-zA-Z0-9/_\-.]+$')
    or p_contract_url ~ '(^|/)\.\.?(/|$)' or p_contract_url like '%//%'
    or not exists(select 1 from storage.objects where bucket_id='deal-contracts' and name=p_contract_url)
  ) then raise exception 'Contrat privé introuvable' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_verification_ids) x where not exists(
    select 1 from public.verifications v where v.id=x and v.user_id=actor
  )) then raise exception 'Vérification introuvable' using errcode='22023'; end if;
  if p_id is null then
    insert into public.brand_deals(user_id,brand_name,start_date,end_date,contract_url,creator_details)
      values(actor,trim(p_brand_name),p_start_date,p_end_date,p_contract_url,p_creator_details)
      returning id into result_id;
  else
    select id,archived_at into result_id,stamp from public.brand_deals
      where id=p_id and user_id=actor for update;
    if not found then raise exception 'Collaboration introuvable' using errcode='P0002'; end if;
    if stamp is not null then raise exception 'Archive immuable' using errcode='23514'; end if;
    update public.brand_deals set brand_name=trim(p_brand_name),start_date=p_start_date,
      end_date=p_end_date,contract_url=p_contract_url,creator_details=p_creator_details
      where id=result_id and user_id=actor;
    delete from public.brand_deal_verifications where deal_id=result_id and user_id=actor;
  end if;
  insert into public.brand_deal_verifications(deal_id,user_id,verification_id)
    select result_id,actor,x from unnest(p_verification_ids) x;
  return result_id;
end;
$$;

create function public.save_brand_deal(
  p_id uuid,p_brand_name text,p_start_date date,p_end_date date,p_contract_url text,
  p_verification_ids uuid[]
)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_details jsonb;
begin
  if p_id is not null then
    select creator_details into saved_details from public.brand_deals
      where id=p_id and user_id=auth.uid() for update;
  end if;
  return public.save_brand_deal(
    p_id,p_brand_name,p_start_date,p_end_date,p_contract_url,saved_details,p_verification_ids
  );
end;
$$;

create or replace function public.archive_brand_deal(p_id uuid)
returns public.brand_deals language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); deal public.brand_deals; stamp timestamptz; links jsonb; payload jsonb;
begin
  if actor is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  select * into deal from public.brand_deals where id=p_id and user_id=actor for update;
  if not found then raise exception 'Collaboration introuvable' using errcode='P0002'; end if;
  if deal.archived_at is not null then return deal; end if;
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
  payload:=jsonb_build_array('mentioncheck-deal-v2',deal.id::text,actor::text,deal.brand_name,
    deal.start_date::text,deal.end_date::text,deal.contract_url,deal.creator_details::text,
    to_char(deal.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),links);
  update public.brand_deals set archived_at=stamp,archive_payload=payload,
    hash_sha256=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex')
    where id=deal.id and user_id=actor returning * into deal;
  return deal;
end;
$$;

revoke all on function public.save_brand_deal(uuid,text,date,date,text,jsonb,uuid[]) from public,anon,authenticated;
revoke all on function public.save_brand_deal(uuid,text,date,date,text,uuid[]) from public,anon,authenticated;
revoke all on function public.archive_brand_deal(uuid) from public,anon,authenticated;
grant execute on function public.save_brand_deal(uuid,text,date,date,text,jsonb,uuid[]) to authenticated;
grant execute on function public.save_brand_deal(uuid,text,date,date,text,uuid[]) to authenticated;
grant execute on function public.archive_brand_deal(uuid) to authenticated;
