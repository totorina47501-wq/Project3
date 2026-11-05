-- Attribution des coûts IA au compte, y compris Mia sans vérification liée.
-- Compatibilité avec les anciens clients qui ne fournissent que verification_id.
begin;
alter table public.ai_analyses add column user_id uuid references public.users(id) on delete cascade;
update public.ai_analyses a set user_id=v.user_id from public.verifications v where v.id=a.verification_id;
alter table public.ai_analyses alter column user_id set not null;
alter table public.ai_analyses alter column verification_id drop not null;
alter table public.ai_analyses drop constraint ai_analyses_stage_check;
alter table public.ai_analyses add constraint ai_analyses_stage_check
 check(stage in ('text','vision','transcription','rewrite','assistant','embedding'));
alter table public.ai_analyses add constraint ai_usage_link_required
 check(verification_id is not null or stage in ('assistant','embedding'));
create index ai_analyses_owner_recent_idx on public.ai_analyses(user_id,created_at desc);
create function public.assign_ai_usage_owner() returns trigger language plpgsql
 set search_path='' as $$
declare owner_id uuid;
begin
 if new.verification_id is not null then
  select user_id into owner_id from public.verifications where id=new.verification_id;
  if owner_id is null or (new.user_id is not null and new.user_id<>owner_id)
  then raise exception 'Attribution IA refusée' using errcode='42501'; end if;
  new.user_id:=owner_id;
 end if;
 if new.user_id is null then raise exception 'Propriétaire IA requis' using errcode='23502'; end if;
 return new;
end $$;
revoke all on function public.assign_ai_usage_owner() from public,anon,authenticated;
create trigger assign_ai_usage_owner before insert or update of user_id,verification_id on public.ai_analyses
 for each row execute function public.assign_ai_usage_owner();
drop policy ai_analyses_select_own on public.ai_analyses;
create policy ai_analyses_select_own on public.ai_analyses for select to authenticated
 using ((select auth.uid())=user_id);
grant select(user_id) on public.ai_analyses to authenticated;
grant select,insert on public.ai_analyses to service_role;
grant select on public.verifications to service_role;
commit;
