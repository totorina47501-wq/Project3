import { createServerSupabase } from '@/lib/supabase/server';
import { PrivacySettings } from '@/components/PrivacySettings';
import { ErasureRequest } from '@/components/ErasureRequest';

export const dynamic = 'force-dynamic';
export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const { data: userData, error } = await supabase.from('users')
    .select('plan,ai_training_opt_in,created_at').single();
  const { data: usage } = await supabase.from('usage_monthly')
    .select('checks_used,rewrites_used,mia_messages_used,period_start')
    .order('period_start', { ascending:false }).limit(1).maybeSingle();
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
      <PrivacySettings initialOptIn={userData.ai_training_opt_in ?? false} />
      <ErasureRequest />
    </>}
  </div>;
}
