-- Synchronisation transactionnelle des droits ; ne déclenche aucun paiement.
begin;
alter table public.subscriptions add column stripe_created_at timestamptz,
 add column last_stripe_event_at timestamptz;
create function public.sync_stripe_subscription(p_customer text,p_subscription text,p_created timestamptz,
 p_event_at timestamptz,p_plan public.account_plan,p_status public.subscription_status,p_period_end timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; current public.subscriptions;
begin
 if p_customer is null or p_subscription is null or p_created is null or p_event_at is null or p_plan is null or p_status is null
 then raise exception 'Événement incomplet' using errcode='22023'; end if;
 select id into owner_id from public.users where stripe_customer_id=p_customer for update;
 if not found then raise exception 'Client non rattaché' using errcode='22023'; end if;
 select * into current from public.subscriptions where user_id=owner_id for update;
 if found then
  if current.stripe_subscription_id is distinct from p_subscription then
   -- Une ligne historique sans date requiert une réconciliation explicite.
   if current.stripe_created_at is null or p_created<=current.stripe_created_at or p_status='canceled' then return false; end if;
  else
   if current.last_stripe_event_at is not null and p_event_at<=current.last_stripe_event_at then return false; end if;
   if current.status='canceled' and p_status<>'canceled' then return false; end if;
  end if;
 end if;
 insert into public.subscriptions(user_id,stripe_subscription_id,plan,status,current_period_end,stripe_created_at,last_stripe_event_at)
 values(owner_id,p_subscription,p_plan,p_status,p_period_end,p_created,p_event_at)
 on conflict(user_id) do update set stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,
 status=excluded.status,current_period_end=excluded.current_period_end,stripe_created_at=excluded.stripe_created_at,last_stripe_event_at=excluded.last_stripe_event_at;
 update public.users set plan=case when p_status in ('active','trialing') then p_plan else 'solo'::public.account_plan end where id=owner_id;
 return true;
end $$;
revoke all on function public.sync_stripe_subscription(text,text,timestamptz,timestamptz,public.account_plan,public.subscription_status,timestamptz) from public,anon,authenticated;
grant execute on function public.sync_stripe_subscription(text,text,timestamptz,timestamptz,public.account_plan,public.subscription_status,timestamptz) to service_role;
commit;
