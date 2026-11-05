-- Base locale jetable seulement ; aucun appel fournisseur.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('a1000000-0000-4000-8000-000000000001','usage-a@example.test',now()),
 ('a1000000-0000-4000-8000-000000000002','usage-b@example.test',now());
insert into public.verifications(id,user_id,platform,content_text)
 values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','instagram','Fixture');
insert into public.ai_analyses(verification_id,stage,model_used)
 values('a2000000-0000-4000-8000-000000000001','text','gpt-4o');
do $$ begin
 if (select user_id from public.ai_analyses where verification_id='a2000000-0000-4000-8000-000000000001')<>'a1000000-0000-4000-8000-000000000001'::uuid then raise exception 'Ancien client non compatible'; end if;
 begin
  insert into public.ai_analyses(user_id,verification_id,stage,model_used)
   values('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','text','gpt-4o');
  raise exception 'Attribution tierce acceptée' using errcode='XX000';
 exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
insert into public.ai_analyses(user_id,verification_id,stage,model_used,prompt_tokens,cost_usd)
 values('a1000000-0000-4000-8000-000000000001',null,'assistant','gpt-4o',10,.000025);
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.ai_analyses)<>2 then raise exception 'Coût Mia absent du compte'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.ai_analyses) then raise exception 'Fuite des métriques'; end if;
 if has_table_privilege('authenticated','public.ai_analyses','INSERT') then raise exception 'Facturation client modifiable'; end if;
end $$;
reset role;
rollback;
