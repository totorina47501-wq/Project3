-- Exclusivement sur PostgreSQL local jetable.
begin;
do $$ begin
 if not exists(select 1 from storage.buckets where id='verification-media-derived' and public=false)
 then raise exception 'Bucket dérivé public ou absent'; end if;
end $$;
insert into storage.objects(bucket_id,name) values
 ('verification-media-derived','82000000-0000-4000-8000-000000000001/job/frame-01.jpg');
-- Le harnais omet les grants Storage de la plateforme ; les établir ici pour tester les policies.
grant usage on schema storage to authenticated;
grant select,insert on storage.objects to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='verification-media-derived')
 then raise exception 'Artefact lisible directement par le client'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('verification-media-derived','82000000-0000-4000-8000-000000000001/forged.jpg');
  raise exception 'Artefact falsifiable par le client' using errcode='XX000';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
