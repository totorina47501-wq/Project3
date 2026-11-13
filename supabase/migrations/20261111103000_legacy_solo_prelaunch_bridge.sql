-- Transition additive à la promotion EXISTANTE : staging / harnais hors ligne d'abord.
-- Ne jamais déployer isolément sur PROD : les migrations antérieures changent
-- les droits des 2 comptes historiques jusqu'à la création ATOMIQUE des lignes
-- activation_pending (préflight + sauvegarde restaurable obligatoire).
-- Aucune ligne promotionnelle n'est créée par cette migration.
begin;
alter table public.promotional_solo_access
  add column activation_pending boolean not null default false;
alter table public.promotional_solo_access
  alter column starts_at drop not null,
  alter column expires_at drop not null;
alter table public.promotional_solo_access
  drop constraint promotional_solo_duration;
alter table public.promotional_solo_access
  add constraint promotional_solo_duration check (
    (activation_pending and reason='legacy_launch_solo_30d'
      and starts_at is null and expires_at is null)
    or
    (not activation_pending and starts_at is not null and expires_at is not null
      and expires_at > starts_at and expires_at <= starts_at + interval '30 days')
  );
-- Préserve exactement les contrôles de sécurité / priorité Stripe de la fonction
-- existante, en ajoutant un seul droit server-only pour deux bénéficiaires autorisés.
create or replace function public.consume_usage_quota(p_user_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  paid_plan public.account_plan;
  period date := date_trunc('month', timezone('UTC',now()))::date;
  allowance integer;
  consumed boolean;
begin
  if p_action not in ('check','rewrite','mia') then
    raise exception 'Action de quota inconnue' using errcode='22023';
  end if;
  -- Sérialise la réservation avec la synchronisation Stripe, qui verrouille users.
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'Compte introuvable' using errcode='22023'; end if;
  select s.plan into paid_plan from public.subscriptions s
    where s.user_id=p_user_id
      and s.stripe_subscription_id is not null
      and s.status in ('active','trialing')
      and s.current_period_end > now();
  -- Deux comptes historiques peuvent conserver Solo en attente du GO, sans
  -- démarrer les 30 jours ; seule une transition opérateur active la fenêtre.
  -- Jamais par le navigateur, users.plan ou une fausse souscription Stripe.
  if paid_plan is null and exists(
    select 1 from public.promotional_solo_access p where p.user_id=p_user_id
      and (
        (p.activation_pending and p.reason='legacy_launch_solo_30d'
         and p.starts_at is null and p.expires_at is null)
        or (not p.activation_pending and now()>=p.starts_at and now()<p.expires_at)
      )
  ) then paid_plan:='solo'::public.account_plan; end if;
  -- Sans abonnement actif ni promotion valide : 3/1/3. Une colonne users.plan='solo' n'est PAS une preuve de paiement.
  allowance := case p_action
    when 'check' then case paid_plan when 'solo' then 30 when 'pro' then 500 when 'studio' then 2000 else 3 end
    when 'rewrite' then case paid_plan when 'solo' then 5 when 'pro' then 500 when 'studio' then 2000 else 1 end
    else case paid_plan when 'solo' then 20 when 'pro' then 300 when 'studio' then 1500 else 3 end
  end;
  insert into public.usage_monthly(user_id,period_start)
    values(p_user_id,period) on conflict(user_id,period_start) do nothing;
  if p_action='check' then
    update public.usage_monthly set checks_used=checks_used+1
      where user_id=p_user_id and period_start=period and checks_used<allowance
      returning true into consumed;
  elsif p_action='rewrite' then
    update public.usage_monthly set rewrites_used=rewrites_used+1
      where user_id=p_user_id and period_start=period and rewrites_used<allowance
      returning true into consumed;
  else
    update public.usage_monthly set mia_messages_used=mia_messages_used+1
      where user_id=p_user_id and period_start=period and mia_messages_used<allowance
      returning true into consumed;
  end if;
  return coalesce(consumed,false);
end $$;
revoke all on function public.consume_usage_quota(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_usage_quota(uuid,text) to service_role;
commit;
