'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Platform } from '@/lib/ai/schemas';
import { StudioInvitationForm } from './StudioInvitationForm';

type Workspace = { id: string; name: string; role?: string };
type Member = { user_id: string; email: string; role: 'owner' | 'admin' | 'member' };
type Invitation = { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
type Key = { id: string; name: string; prefix: string; scopes: string[]; expires_at: string; revoked_at: string | null };
type Check = { id: string; caption: string; platform: string; result: { score: number; riskLevel: string }; created_at: string };
type Overview = { workspace: Workspace; role: string; members: Member[]; invitations: Invitation[]; keys: Key[]; checks: Check[];
  report: { total: number; averageScore: number | null; violationCounts: Record<string, number>; scope: string; warning: string } };
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

async function requestStudio(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, { cache: 'no-store', ...(body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Studio indisponible.');
  return result;
}

export function StudioPanel() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [keyName, setKeyName] = useState('');
  const [writeScope, setWriteScope] = useState(false);
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');

  useEffect(() => {
    let cancelled = false;
    requestStudio('/api/studio').then((data) => {
      if (!cancelled) { setWorkspaces(data.workspaces); setSelected(data.workspaces[0]?.id ?? ''); }
    }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!selected) { setOverview(null); return; }
    let cancelled = false;
    setOverview(null);
    setLoading(true);
    requestStudio(`/api/studio?workspaceId=${encodeURIComponent(selected)}`).then((data) => {
      if (!cancelled) setOverview(data);
    }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  async function perform(body: Record<string, unknown>) {
    setBusy(true); setError(''); setNotice(''); setSecret(null);
    try {
      const result = await requestStudio('/api/studio', body);
      if (result.token) setSecret({ label: 'Jeton d’invitation à transmettre à la personne invitée', value: result.token });
      if (result.secret) setSecret({ label: 'Clé API Studio', value: result.secret });
      if (body.action === 'accept_invitation') setToken('');
      if (body.action === 'invite') setEmail('');
      if (body.action === 'create_key') setKeyName('');
      if (body.action === 'check') setCaption('');
      const list = await requestStudio('/api/studio');
      setWorkspaces(list.workspaces);
      const next = result.workspace?.id ?? selected ?? list.workspaces[0]?.id ?? '';
      if (next !== selected) setSelected(next);
      else if (next) setOverview(await requestStudio(`/api/studio?workspaceId=${encodeURIComponent(next)}`));
      setNotice('Action enregistrée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Studio indisponible.'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent, body: Record<string, unknown>) { event.preventDefault(); void perform(body); }
  const manager = overview?.role === 'owner' || overview?.role === 'admin';

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-sm font-bold uppercase text-accent">Équipe</p>
      <h1 className="mt-2 font-heading text-4xl font-bold">Studio</h1>
      <p className="mt-3 text-slate-600">Jusqu’à cinq sièges, propriétaire et invitations en attente compris. Les textes soumis ici sont partagés avec l’équipe. L’historique personnel reste privé.</p>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {secret && <section aria-label="Secret affiché une seule fois" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="font-semibold">{secret.label}</h2>
      <p className="text-sm">Copie ce secret maintenant : il ne sera plus affiché après fermeture, nouvelle action ou rechargement. Aucun email n’est envoyé. Transmets le jeton par un canal de confiance.</p>
      <output className="block select-all break-all rounded-lg bg-white p-3 font-mono text-sm">{secret.value}</output>
      <button type="button" className={button} onClick={() => setSecret(null)}>J’ai conservé le secret, fermer</button>
    </section>}
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={(e) => submit(e, { action: 'create_workspace', name })} className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="font-heading text-xl font-bold">Créer mon équipe</h2>
        <p className="text-sm text-slate-600">Un espace par propriétaire disposant déjà du plan Studio. Cette action ne modifie aucun abonnement.</p>
        <fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Nom de l’équipe<input required maxLength={100} className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button className={button}>Créer l’espace</button></fieldset>
      </form>
      <form onSubmit={(e) => submit(e, { action: 'accept_invitation', token })} className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="font-heading text-xl font-bold">Rejoindre une équipe</h2>
        <p className="text-sm text-slate-600">Connecte-toi avec l’email vérifié invité. Le jeton expire après sept jours et s’utilise une seule fois.</p>
        <fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Jeton d’invitation<input required type="password" autoComplete="off" className={field} value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <button className={button}>Accepter l’invitation</button></fieldset>
      </form>
    </div>
    <label className="block text-sm font-semibold">Équipe active<select disabled={busy || !workspaces.length} className={field} value={selected} onChange={(e) => { setError(''); setSecret(null); setSelected(e.target.value); }}>
      {!workspaces.length && <option value="">Aucune équipe accessible</option>}
      {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select></label>
    {loading && <p role="status">Chargement de l’équipe…</p>}
    {overview && <>
      <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-heading text-xl font-bold">Membres · {overview.members.length}/5 · ton rôle : {overview.role}</h2>
        <ul className="space-y-3">{overview.members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm">
          <span className="break-all">{member.email} · {member.role}</span>
          {manager && member.role !== 'owner' && (overview.role === 'owner' || member.role === 'member') && <div className="flex flex-wrap gap-2">
            {overview.role === 'owner' && <button disabled={busy} className={button} onClick={() => void perform({ action: 'set_role', workspaceId: selected, userId: member.user_id, role: member.role === 'member' ? 'admin' : 'member' })}>{member.role === 'member' ? 'Nommer administrateur' : 'Passer membre'}</button>}
            <button disabled={busy} className={button} onClick={() => void perform({ action: 'remove_member', workspaceId: selected, userId: member.user_id })}>Retirer {member.email}</button>
          </div>}
        </li>)}</ul>
        <StudioInvitationForm workspaceId={selected} actorRole={overview.role} disabled={busy}
          email={email} requestedRole={inviteRole} onEmailChange={setEmail} onRoleChange={setInviteRole}
          onInvite={(input) => void perform(input)} />
        {manager && <ul className="space-y-2">{overview.invitations.map((inv) => <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>{inv.email} · {inv.role} · {inv.accepted_at ? 'acceptée' : inv.revoked_at ? 'révoquée' : `expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}</span>
          {!inv.accepted_at && !inv.revoked_at && <button disabled={busy} className={button} onClick={() => void perform({ action: 'revoke_invitation', workspaceId: selected, id: inv.id })}>Révoquer l’invitation de {inv.email}</button>}
        </li>)}</ul>}
      </section>
      {manager && <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-heading text-xl font-bold">Clés API</h2>
        <p className="text-sm text-slate-600">Valables 90 jours pour cette équipe. Le retrait ou la rétrogradation du créateur invalide ses clés. Révoque toute clé divulguée.</p>
        <form onSubmit={(e) => submit(e, { action: 'create_key', workspaceId: selected, name: keyName, scopes: writeScope ? ['checks:read', 'checks:write'] : ['checks:read'] })}>
          <fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Nom de la clé<input className={field} required maxLength={80} value={keyName} onChange={(e) => setKeyName(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={writeScope} onChange={(e) => setWriteScope(e.target.checked)} />Autoriser aussi les contrôles de texte sans IA</label>
            <button className={button}>Créer une clé</button></fieldset>
        </form>
        <ul className="space-y-3">{overview.keys.map((key) => <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{key.name} · {key.prefix}… · {key.scopes.join(', ')} · {key.revoked_at ? 'révoquée' : `expire le ${new Date(key.expires_at).toLocaleDateString('fr-FR')}`}</span>
          {!key.revoked_at && <button disabled={busy} className={button} onClick={() => void perform({ action: 'revoke_key', workspaceId: selected, id: key.id })}>Révoquer {key.name}</button>}
        </li>)}</ul>
      </section>}
      <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-heading text-xl font-bold">Contrôler un texte pour l’équipe</h2>
        <form onSubmit={(e) => submit(e, { action: 'check', workspaceId: selected, caption, platform })}>
          <fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Texte partagé<textarea required maxLength={10000} rows={5} className={field} value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
            <label className="block text-sm">Plateforme<select className={field} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>{['instagram', 'tiktok', 'youtube', 'linkedin'].map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            <p className="text-sm text-slate-600">Règles de divulgation commerciale uniquement. Aucun modèle IA, aucun média, aucune certification juridique.</p><button className={button}>Contrôler et partager avec l’équipe</button>
          </fieldset>
        </form>
      </section>
      <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-heading text-xl font-bold">Rapport de brand safety · divulgation</h2>
        <p>{overview.report.total} textes · score moyen : {overview.report.averageScore === null ? 'aucune donnée' : `${overview.report.averageScore}/100`}</p>
        <p className="text-sm text-slate-600">{overview.report.scope} {overview.report.warning}</p>
        <ul className="text-sm">{Object.entries(overview.report.violationCounts).map(([code, count]) => <li key={code}>{code} : {count} signalements</li>)}</ul>
        <h3 className="font-semibold">Vérifications partagées</h3>
        {!overview.checks.length && <p className="text-sm">Aucune vérification partagée.</p>}
        <ul className="space-y-3">{overview.checks.map((check) => <li key={check.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{check.platform} · {check.result.score}/100 · risque {check.result.riskLevel}</p><p className="mt-1 whitespace-pre-wrap break-words">{check.caption}</p></li>)}</ul>
      </section>
    </>}
  </div>;
}
