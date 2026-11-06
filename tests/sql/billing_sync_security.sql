begin;
insert into auth.users(id,email,email_confirmed_at) values('96000000-0000-4000-8000-000000000001','billing-local@example.test',now());
update public.users set stripe_customer_id='cus_local_atomic' where id='96000000-0000-4000-8000-000000000001';
do $$ begin
 if has_function_privilege('authenticated','public.sync_stripe_subscription(text,text,timestamptz,timestamptz,public.account_plan,public.subscription_status,timestamptz)','EXECUTE') then raise exception 'RPC exposée'; end if;
 if not public.sync_stripe_subscription('cus_local_atomic','sub_old','2026-01-01','2026-01-02','pro','active',null) then raise exception 'Création refusée'; end if;
 if not public.sync_stripe_subscription('cus_local_atomic','sub_new','2026-02-01','2026-02-02','studio','active',null) then raise exception 'Remplacement refusé'; end if;
 if public.sync_stripe_subscription('cus_local_atomic','sub_old','2026-01-01','2026-03-02','pro','canceled',null) then raise exception 'Ancienne suppression acceptée'; end if;
 if public.sync_stripe_subscription('cus_local_atomic','sub_old','2026-01-01','2026-03-03','pro','active',null) then raise exception 'Ancienne mise à jour acceptée'; end if;
 if (select plan from public.users where stripe_customer_id='cus_local_atomic')<>'studio' then raise exception 'Droits désynchronisés'; end if;
 if not public.sync_stripe_subscription('cus_local_atomic','sub_new','2026-02-01','2026-04-01','studio','canceled',null) then raise exception 'Annulation refusée'; end if;
 if public.sync_stripe_subscription('cus_local_atomic','sub_new','2026-02-01','2026-05-01','studio','active',null) then raise exception 'Résurrection acceptée'; end if;
 if (select plan from public.users where stripe_customer_id='cus_local_atomic')<>'solo' then raise exception 'Révocation non atomique'; end if;
end $$;
rollback;
