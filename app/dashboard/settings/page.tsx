import { createServerSupabase } from '@/lib/supabase/server';
import { PrivacySettings } from '@/components/PrivacySettings';
import { ErasureRequest } from '@/components/ErasureRequest';
import { openaiReadiness } from '@/lib/openai/config';
import { SocialAccounts } from '@/components/SocialAccounts';
import { AIPreferences } from '@/components/AIPreferences';
import { SOCIAL_COLUMNS, SOCIAL_PAGE_SIZE, type SocialAccount } from '@/lib/social/model';
import { toneSchema } from '@/lib/ai/schemas';

export const dynamic = 'force-dynamic';
export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const ai = openaiReadiness(process.env);
  const { data: userData, error } = await supabase.from('users')
    .select('id,plan,ai_training_opt_in,created_at').single();
  const { data: usage } = await supabase.from('usage_monthly')
    .select('checks_used,rewrites_used,mia_messages_used,period_start')
    .order('period_start', { ascending:false }).limit(1).maybeSingle();
  const [social,preferences] = userData ? await Promise.all([
    supabase.from('social_accounts').select(SOCIAL_COLUMNS,{count:'exact'}).eq('user_id',userData.id)
      .order('connected_at',{ascending:false}).order('id',{ascending:false}).range(0,SOCIAL_PAGE_SIZE-1),
    supabase.from('user_preferences').select('rewrite_tone').eq('user_id',userData.id).maybeSingle(),
  ]) : [null,null];
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
    </p> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Mon abonnement actuel</h2>
        <p className="mt-3 text-lg font-semibold capitalize">{userData.plan}</p>
        <p className="mt-1 text-sm text-slate-500">Les paiements ne sont pas encore activés.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label:'Checks', value:usage?.checks_used ?? 0 },
            { label:'Réécritures', value:usage?.rewrites_used ?? 0 },
            { label:'Messages Mia', value:usage?.mia_messages_used ?? 0 },
          ].map((entry) => <div key={entry.label} className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{entry.label}</p>
            <p className="mt-1 text-2xl font-bold">{entry.value}</p>
          </div>)}
        </div>
        <p className="mt-3 text-xs text-slate-500">Dernière période enregistrée. Les contrôles sans IA ne consomment pas de quota de vérifications payantes.</p>
      </section>
      <SocialAccounts initialItems={(social?.data??[]) as unknown as SocialAccount[]} initialTotal={social?.count??0}
        initialUnavailable={!social||!!social.error} plan={userData.plan} />
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
      <ErasureRequest />
    </>}
  </div>;
}
