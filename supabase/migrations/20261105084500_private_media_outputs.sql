-- Artefacts techniques du runner : aucun accès direct client, aucune suppression.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('verification-media-derived','verification-media-derived',false,8388608,
 array['image/jpeg','image/webp','audio/wav','application/json'])
on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from storage.buckets where id='verification-media-derived'
  and public=false and file_size_limit=8388608
  and allowed_mime_types=array['image/jpeg','image/webp','audio/wav','application/json']) then
  raise exception 'Configuration du bucket dérivé incompatible';
 end if;
end $$;
-- Aucune policy Storage n’accorde de lecture/écriture client sur ce bucket.
-- Seul le serveur reçoit et relit les artefacts avant finalisation du bail.
commit;
