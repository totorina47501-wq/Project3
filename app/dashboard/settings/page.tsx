import { MiaIndexAdmin } from '@/components/MiaIndexAdmin';
import { createServerSupabase } from '@/lib/supabase/server';
import { PrivacySettings } from '@/components/PrivacySettings';
import { ErasureRequest } from '@/components/ErasureRequest';
import { openaiReadiness } from '@/lib/openai/config';
import { SocialAccounts } from '@/components/SocialAccounts';
import { AIPreferences } from '@/components/AIPreferences';
import { SOCIAL_COLUMNS, SOCIAL_PAGE_SIZE, type SocialAccount } from '@/lib/social/model';
import { toneSchema } from '@/lib/ai/schemas';
import { subscriptionAccessTier, accessTierWithPromotion } from '@/lib/billing/events';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { planEntitlements } from '@/lib/billing/plans';
import { BillingPortal } from '@/components/BillingPortal';
import { billingGate } from '@/lib/billing/config';

export const dynamic = 'force-dynamic';
export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const ai = openaiReadiness(process.env);
  const stripe = billingGate(process.env);
  const { data: authData } = await supabase.auth.getUser();
  const isMiaAdmin = Boolean(authData.user && (process.env.MIA_ADMIN_USER_IDS ?? '').split(',').map(v => v.trim()).includes(authData.user.id));
  // Stripe Customer ID n'est pas lisible par le rôle authenticated (RLS/GRANT).
  // Ne jamais élargir les droits de cette colonne pour l'interface.
  const { data: userData, error } = await supabase.from('users')
    .select('id,plan,ai_training_opt_in,created_at').single();
  const { data: billingProfile, error: billingProfileError } = stripe.enabled && userData
    ? await createAdminSupabase().from('users')
      .select('stripe_customer_id').eq('id',userData.id).single()
    : {data:null,error:null};
  const { data: subscription, error: subscriptionError } = userData
    ? await supabase.from('subscriptions')
      .select('stripe_subscription_id,plan,status,current_period_end')
      .eq('user_id', userData.id).maybeSingle()
    : { data:null, error:null };
  // Flag inactif jusqu'à migration + activation explicite lors du lancement.
  // Ne pas requêter une table absente de la base de production.
  const promotionEnabled=process.env.PROMO_SOLO_ENABLED==='true';
  const { data:promotion,error:promotionError } = promotionEnabled && userData
    ? await createAdminSupabase().from('promotional_solo_access')
      .select('starts_at,expires_at,activation_pending,reason').eq('user_id',userData.id).maybeSingle()
    : {data:null,error:null};
  const tier = subscriptionError || promotionError ? null
    : accessTierWithPromotion(subscription,promotion);
  const promotionalSolo = tier === 'solo' && subscriptionAccessTier(subscription)==='free';
  const pendingPromotionalSolo = promotionalSolo && promotion?.activation_pending === true;
  // Display uncertainty for prelaunch Solo records without granting any new entitlement.
  const historicalRightsUnverified = !promotionEnabled && tier === 'free' &&
    userData?.plan === 'solo' && Date.parse(userData.created_at ?? '') < Date.parse('2026-11-11T00:00:00Z');
  const rights = tier && !historicalRightsUnverified ? planEntitlements(tier) : null;
  const { data: usage, error: usageError } = await supabase.from('usage_monthly')
    .select('checks_used,rewrites_used,mia_messages_used,period_start')
    .order('period_start', { ascending:false }).limit(1).maybeSingle();
  let socialExpiryFailed=false;
  if(userData){
    try{
      const {error:expiryError}=await supabase.rpc('expire_social_oauth_accounts',{p_user:userData.id});
      socialExpiryFailed=!!expiryError;
    }catch{socialExpiryFailed=true;}
  }
  // The RPC is absent before the production OAuth migration; manual accounts remain usable.
  const socialExpiryUnavailable=socialExpiryFailed&&process.env.SOCIAL_OAUTH_ENABLED==='true';
  const [social,connectedSocial,preferences] = userData ? await Promise.all([
    supabase.from('social_accounts').select(SOCIAL_COLUMNS,{count:'exact'}).eq('user_id',userData.id)
      .order('connected_at',{ascending:false}).order('id',{ascending:false}).range(0,SOCIAL_PAGE_SIZE-1),
    supabase.from('social_accounts').select('id',{count:'exact',head:true})
      .eq('user_id',userData.id).eq('connection_kind','oauth'),
    supabase.from('user_preferences').select('rewrite_tone').eq('user_id',userData.id).maybeSingle(),
  ]) : [null,null,null];
  const tone = toneSchema.safeParse(preferences?.data?.rewrite_tone);
  return <div className="mx-auto max-w-3xl space-y-7">
    <header>
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Ton compte</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Paramètres</h1>
      <p className="mt-2 text-slate-600">
        Gère tes données et consulte tes quotas, sans lancer d&apos;analyse IA.
      </p>
    </header>
    {error || !userData ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
      Les informations du compte sont momentanément indisponibles.
      {' '}<a className="font-semibold underline" href="/dashboard/settings">Réessayer le chargement</a>
    </p> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Mon abonnement actuel</h2>
        <p className="mt-3 text-lg font-semibold">{historicalRightsUnverified ? 'Droits historiques en transition' : tier === null ? 'Statut indisponible' : tier === 'free' ? 'Gratuit' : tier === 'solo' ? promotionalSolo ? pendingPromotionalSolo ? 'Solo offert (avant lancement)' : 'Solo offert (promotion temporaire)' : 'Solo (abonnement test)' : tier === 'pro' ? 'Pro (abonnement test)' : 'Studio (abonnement test)'}</p>
        <p className="mt-1 text-sm text-slate-500">
          {historicalRightsUnverified ? 'Compte Solo historique : statut et plafonds non attestés pendant la transition. Aucune promotion de 30 jours n’est démarrée ici.' :
           tier === 'free' ? 'Aucun abonnement payant actif : quotas gratuits appliqués.' :
           tier === null ? 'Le statut de facturation ne peut pas être vérifié actuellement.' :
           promotionalSolo ? pendingPromotionalSolo
             ? 'Accès Solo pré-lancement sans paiement. La période de 30 jours ne commence qu’au lancement officiel.'
             : 'Accès Solo promotionnel gratuit, sans abonnement ni prélèvement Stripe.' :
           'Abonnement Stripe Sandbox : aucun encaissement réel.'}
        </p>
        {promotionalSolo && promotion?.expires_at && !pendingPromotionalSolo && <p className="mt-1 text-sm text-slate-500">
          Offre de bienvenue valable jusqu’au {new Date(promotion.expires_at).toLocaleDateString('fr-FR')}.
        </p>}
        {usageError ? <p role="alert" className="mt-5 text-sm text-red-800">Quotas momentanément indisponibles.{' '}
          <a className="font-semibold underline" href="/dashboard/settings">Réessayer le chargement</a>
        </p> : <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label:'Checks', value:usage?.checks_used ?? 0, limit:rights?.checksMonthly },
            { label:'Réécritures', value:usage?.rewrites_used ?? 0, limit:rights?.rewritesMonthly },
            { label:'Messages Mia', value:usage?.mia_messages_used ?? 0, limit:rights?.miaMonthly },
          ].map((entry) => <div key={entry.label} className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{entry.label}</p>
            <p className="mt-1 text-2xl font-bold">{entry.value}{entry.limit !== undefined ? <span className="text-sm font-normal text-slate-600"> / {entry.limit}</span> : null}</p>
          </div>)}
        </div>}
        <p className="mt-3 text-xs text-slate-500">Dernière période enregistrée. Les contrôles sans IA ne consomment pas de quota de vérifications payantes.</p>
        {stripe.enabled && stripe.mode && !billingProfileError && billingProfile?.stripe_customer_id &&
          <BillingPortal mode={stripe.mode} />}
        {!stripe.enabled && tier !== 'free' && !promotionalSolo && <p className="mt-3 text-sm text-slate-600">La gestion de facturation est momentanément indisponible. Les droits existants restent consultables.</p>}
      </section>
      <SocialAccounts initialItems={(socialExpiryUnavailable?[]:(social?.data??[])) as unknown as SocialAccount[]} initialTotal={social?.count??0}
        initialConnectedTotal={connectedSocial?.count??0}
        initialUnavailable={socialExpiryUnavailable||!social||!!social.error||!connectedSocial||!!connectedSocial.error} plan={tier ?? 'free'} />
      <AIPreferences initialTone={tone.success?tone.data:'naturel'} initialUnavailable={!preferences||!!preferences.error} />
      <PrivacySettings initialOptIn={userData.ai_training_opt_in ?? false} />
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Configuration OpenAI</h2>
        <p className="mt-2 text-sm text-slate-600">
          État des options détectées sur le serveur, sans requête à OpenAI.
          Une configuration détectée ne prouve pas que la clé fonctionne.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Clé serveur</dt>
            <dd className="font-semibold">{ai.keyConfigured ? 'Configurée (non vérifiée)' : 'Absente'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Pause générale</dt>
            <dd className="font-semibold">{ai.paused ? 'Active' : 'Non activée'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Texte et image existants</dt>
            <dd className="font-semibold">{ai.textEnabled && ai.visionEnabled ? 'Autorisés par configuration' : 'Restreints'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Transcription vidéo</dt>
            <dd className="font-semibold">{ai.audioEnabled ? 'Autorisée (test non réalisé)' : 'Désactivée'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Embeddings juridiques</dt>
            <dd className="font-semibold">{ai.embeddingsEnabled ? 'Autorisés (test non réalisé)' : 'Désactivés'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Transcription et embeddings ne sont pas raccordés à un parcours actif.
          Aucune dépense IA n’est effectuée pour afficher cet état.
        </p>
      </section>
      {isMiaAdmin && <MiaIndexAdmin />}
      <ErasureRequest />
    </>}
  </div>;
}
