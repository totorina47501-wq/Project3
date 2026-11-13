'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { platformLabels, type SocialAccount, type SocialDraft, SOCIAL_PAGE_SIZE } from '@/lib/social/model';

type SocialPlatform = SocialDraft['platform'];

const socialOAuthTokenMessages: Record<SocialPlatform, string> = {
  instagram: 'Instagram n’a pas finalisé la connexion. Vérifie les autorisations et la configuration de l’application Instagram, puis réessaie.',
  tiktok: 'TikTok n’a pas finalisé la connexion. Vérifie les autorisations et la configuration de l’application TikTok, puis réessaie.',
  youtube: 'L’échange du code de connexion avec Google a échoué. Vérifie la configuration OAuth Google de cet environnement.',
  linkedin: 'LinkedIn n’a pas finalisé la connexion. Vérifie les autorisations et la configuration de l’application LinkedIn, puis réessaie.',
};
const socialOAuthProfileMessages: Record<SocialPlatform, string> = {
  instagram: 'Instagram a autorisé la connexion, mais le compte ou son identifiant n’est pas accessible. Vérifie que ton compte et les autorisations sont compatibles avec l’intégration Instagram.',
  tiktok: 'TikTok a autorisé la connexion, mais le compte ou son identifiant n’est pas accessible. Vérifie les autorisations du profil TikTok et réessaie.',
  youtube: 'Google a autorisé la connexion, mais la chaîne YouTube n’a pas pu être récupérée. Vérifie que YouTube Data API v3 est activée et que ta chaîne est accessible avec ce compte.',
  linkedin: 'LinkedIn a autorisé la connexion, mais le profil n’a pas pu être récupéré. Vérifie les autorisations de ton profil LinkedIn et réessaie.',
};

export function socialOAuthFeedback(query: URLSearchParams): string {
  const outcome = query.get('social_oauth');
  if (outcome !== 'connected' && outcome !== 'unavailable') return '';
  const rawProvider = query.get('provider');
  const provider = rawProvider && Object.prototype.hasOwnProperty.call(platformLabels, rawProvider)
    ? rawProvider as SocialPlatform
    : null;
  if (outcome === 'connected') {
    return provider ? `Compte ${platformLabels[provider]} relié avec succès.` : 'Compte connecté via OAuth.';
  }
  if (!provider) return 'La connexion au réseau social n’a pas pu être finalisée.';
  const stage = query.get('social_oauth_error');
  const reason = query.get('social_oauth_reason');
  if (provider === 'youtube' && stage === 'channel' && reason === 'no_channel') {
    return 'Aucune chaîne YouTube trouvée. Ton compte Google a bien été autorisé, mais aucune chaîne YouTube accessible n’y est associée. Crée d’abord une chaîne YouTube avec ce compte, puis réessaie la connexion. Un compte Google seul ne suffit pas.';
  }
  if (stage === 'channel' && reason === 'profile_unavailable') {
    return socialOAuthProfileMessages[provider];
  }
  if (stage === 'channel') return socialOAuthProfileMessages[provider];
  if (stage === 'token') {
    if (provider === 'youtube') {
      if (reason === 'invalid_client') return 'Google refuse le client OAuth. Vérifie que l’identifiant et le secret correspondent au même client dans cet environnement.';
      if (reason === 'invalid_grant') return 'Google refuse le code OAuth ou PKCE. Démarre une nouvelle connexion et vérifie le client et l’URI de retour.';
      if (reason === 'redirect_uri_mismatch') return 'Google refuse l’URI de retour. Vérifie que le callback est enregistré dans la configuration OAuth Google de cet environnement.';
      if (reason === 'invalid_request') return 'Google refuse les paramètres de la requête OAuth. Vérifie le client et la configuration Google de cet environnement.';
    }
    return socialOAuthTokenMessages[provider];
  }
  if (stage === 'storage') return `Le compte ${platformLabels[provider]} a été reconnu, mais son enregistrement sécurisé est indisponible. Réessaie plus tard.`;
  return `Connexion ${platformLabels[provider]} non finalisée. L’autorisation a peut-être été refusée ou annulée. Réessaie et vérifie les autorisations demandées.`;
}

type Props={initialItems:SocialAccount[];initialTotal:number;initialConnectedTotal?:number;initialUnavailable?:boolean;plan:string};
export function SocialAccounts({initialItems,initialTotal,initialConnectedTotal=0,initialUnavailable=false,plan}:Props){
  const [items,setItems]=useState(initialItems);
  const [total,setTotal]=useState(initialTotal);
  const [connectedTotal,setConnectedTotal]=useState(initialConnectedTotal);
  const [page,setPage]=useState(1);
  const [platform,setPlatform]=useState<SocialDraft['platform']>('instagram');
  const [handle,setHandle]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [unavailable,setUnavailable]=useState(initialUnavailable);
  const [message,setMessage]=useState('');
  const [oauthProviders,setOAuthProviders]=useState<Record<SocialDraft['platform'],boolean>>({
    instagram:false,tiktok:false,youtube:false,linkedin:false,
  });
  const load=useCallback(async(nextPage:number)=>{
    const response=await fetch('/api/social-accounts?page='+nextPage,{cache:'no-store'});
    const body=await response.json() as {items?:SocialAccount[];total?:number;connectedTotal?:number;error?:string};
    if(!response.ok||!Array.isArray(body.items)||!Number.isInteger(body.total)||
      !Number.isInteger(body.connectedTotal)||body.connectedTotal!<0||body.connectedTotal!>body.total!)
      throw new Error(body.error??'Liste indisponible.');
    setItems(body.items);setTotal(body.total!);setConnectedTotal(body.connectedTotal!);setPage(nextPage);setUnavailable(false);
  },[]);
  const changePage=useCallback(async(nextPage:number)=>{
    setBusy(true);setMessage('');
    try{await load(nextPage);}catch(error){setMessage(error instanceof Error?error.message:'Liste indisponible.');}
    finally{setBusy(false);}
  },[load]);
  useEffect(()=>{
    let active=true;
    void fetch('/api/social-accounts/oauth/providers',{cache:'no-store'})
      .then(async response=>{
        const body=await response.json() as {providers?:Record<string,unknown>};
        if(!active||!response.ok||!body.providers)return;
        setOAuthProviders({
          instagram:body.providers.instagram===true,
          tiktok:body.providers.tiktok===true,
          youtube:body.providers.youtube===true,
          linkedin:body.providers.linkedin===true,
        });
      })
      .catch(()=>{});
    const query=new URLSearchParams(window.location.search);
    const outcome=query.get('social_oauth');
    const oauthMessage=socialOAuthFeedback(query);
    if(outcome==='connected'||outcome==='unavailable')window.history.replaceState(null,'','/dashboard/settings');
    // changePage clears normal notifications; restore OAuth outcome after it completes.
    void changePage(1).then(()=>{if(active&&oauthMessage)setMessage(oauthMessage);});
    return ()=>{active=false;};
  },[changePage]);
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/social-accounts'+(editing?'/'+editing:''),{
        method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform,handle}),
      });
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??'Enregistrement indisponible.');
      setEditing(null);setHandle('');
      try{await load(1);setMessage('Déclaration enregistrée.');}
      catch{setUnavailable(true);setMessage('Déclaration enregistrée. Actualise la liste pour consulter le résultat.');}
    }catch(error){setMessage(error instanceof Error?error.message:'Enregistrement indisponible.');}
    finally{setBusy(false);}
  }
  async function remove(account:SocialAccount){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/social-accounts/'+account.id,{method:'DELETE'});
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??'Suppression de la déclaration indisponible.');
      if(editing===account.id){setEditing(null);setHandle('');}
      try{await load(items.length===1&&page>1?page-1:page);setMessage('Déclaration retirée.');}
      catch{setUnavailable(true);setMessage('Déclaration retirée. Actualise la liste pour consulter le résultat.');}
    }catch(error){setMessage(error instanceof Error?error.message:'Suppression de la déclaration indisponible.');}
    finally{setBusy(false);}
  }
  async function connect(provider:SocialDraft['platform']){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/social-accounts/oauth/start',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider}),
      });
      const body=await response.json() as {authorizationUrl?:string;error?:string};
      if(!response.ok||typeof body.authorizationUrl!=='string')throw new Error(body.error??'Connexion indisponible.');
      const destination=new URL(body.authorizationUrl);
      const expected={
        instagram:'https://www.instagram.com',
        tiktok:'https://www.tiktok.com',
        youtube:'https://accounts.google.com',
        linkedin:'https://www.linkedin.com',
      }[provider];
      if(destination.protocol!=='https:'||destination.origin!==expected)throw new Error('Connexion indisponible.');
      window.location.assign(destination.toString());
    }catch(error){setMessage(error instanceof Error?error.message:'Connexion indisponible.');setBusy(false);}
  }
  async function disconnect(account:SocialAccount){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/social-accounts/oauth/disconnect/'+account.id,{method:'POST'});
      const body=await response.json() as {error?:string;revocation?:string};
      if(!response.ok)throw new Error(body.error??'Déconnexion indisponible.');
      await load(page);
      setMessage(body.revocation==='confirmed'
        ?'Connexion retirée et révocation fournisseur confirmée.'
        :'Connexion retirée de MentionCheck. La révocation fournisseur reste à vérifier.');
    }catch(error){setMessage(error instanceof Error?error.message:'Déconnexion indisponible.');}
    finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="social-heading">
    <h2 id="social-heading" className="font-heading text-xl font-bold">Mes comptes sociaux déclarés</h2>
    <p className="text-sm text-slate-600">Ajoute les noms de tes comptes pour organiser ton espace. Une déclaration manuelle ne connecte aucun réseau. OAuth reste désactivé par défaut ; aucune lecture de publication ni publication automatique n’est réalisée.</p>
    <p className="text-sm font-semibold">{unavailable?'Inventaire momentanément indisponible':`${total} compte${total>1?'s':''} enregistré${total>1?'s':''}`}{plan==='solo'?' · Plan Solo : 3 comptes maximum.':plan==='free'?' · Gratuit : 3 comptes maximum.':''}</p>
    {!unavailable&&<p className="text-sm font-semibold text-slate-700" aria-live="polite">
      Comptes reliés : {connectedTotal} · Autres comptes enregistrés : {total-connectedTotal}
    </p>}
    {unavailable&&<button type="button" disabled={busy} onClick={()=>void changePage(page)} className="rounded-lg border px-3 py-2">Actualiser la liste</button>}
    {!unavailable&&!items.length&&<p className="text-sm text-slate-500">Aucun compte déclaré pour le moment.</p>}
    <ul className="divide-y divide-slate-100">
      {items.map(account=><li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-all font-semibold">{platformLabels[account.platform]} · @{account.handle}</p>
          <p className="text-xs text-slate-500">{account.connection_kind==='manual'?'Déclaration manuelle · aucune connexion OAuth':account.connection_kind==='oauth'?'Connexion OAuth active':account.connection_kind==='expired'?'Connexion expirée ou déconnectée · reconnecte le compte pour le réactiver':'Compte historique · connexion non vérifiée'}</p></div>
        {account.connection_kind==='manual'&&<div className="flex gap-2 text-sm">
          <button type="button" disabled={busy} onClick={()=>{setEditing(account.id);setPlatform(account.platform);setHandle(account.handle);setMessage('');}} aria-label={'Modifier @'+account.handle} className="rounded-lg border px-3 py-2">Modifier</button>
          <button type="button" disabled={busy} onClick={()=>void remove(account)} aria-label={'Retirer la déclaration @'+account.handle} className="rounded-lg border px-3 py-2 text-red-700">Retirer</button>
        </div>}
        {account.connection_kind==='expired'&&<button type="button" disabled={busy} onClick={()=>void remove(account)} aria-label={'Retirer la déclaration @'+account.handle} className="rounded-lg border px-3 py-2 text-sm text-red-700">Retirer</button>}
        {account.connection_kind==='oauth'&&<button type="button" disabled={busy} onClick={()=>void disconnect(account)} className="rounded-lg border px-3 py-2 text-sm">Déconnecter</button>}
      </li>)}
    </ul>
    {!editing&&<div className="space-y-2 border-t pt-4">
      <h3 className="font-semibold">Connexion aux réseaux sociaux</h3>
      <div className="flex flex-wrap gap-2">
        {Object.entries(platformLabels).map(([value,label])=>{
          const provider=value as SocialDraft['platform'];
          return oauthProviders[provider]
            ? <button key={provider} type="button" disabled={busy} onClick={()=>void connect(provider)} className="rounded-lg border px-3 py-2 text-sm">Connecter {label}</button>
            : <span key={provider} className="rounded-lg border border-dashed px-3 py-2 text-sm text-slate-500">{label} · Connexion indisponible</span>;
        })}
      </div>
    </div>}
    {total>SOCIAL_PAGE_SIZE&&<nav aria-label="Pages des comptes déclarés" className="flex items-center gap-3 text-sm">
      <button type="button" disabled={busy||page===1} onClick={()=>void changePage(page-1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Précédent</button>
      <span>Page {page}</span>
      <button type="button" disabled={busy||page*SOCIAL_PAGE_SIZE>=total} onClick={()=>void changePage(page+1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Suivant</button>
    </nav>}
    <form onSubmit={event=>void save(event)} className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{editing?'Modifier la déclaration':'Déclarer un compte'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Réseau social</span><select value={platform} onChange={event=>setPlatform(event.target.value as SocialDraft['platform'])} disabled={busy} className="block w-full rounded-lg border p-2">
          {Object.entries(platformLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="space-y-1 text-sm"><span>Nom du compte (sans lien)</span><input value={handle} onChange={event=>setHandle(event.target.value)} required maxLength={200} autoComplete="off" disabled={busy} className="block w-full rounded-lg border p-2" placeholder="@moncompte"/></label>
      </div>
      <div className="flex gap-3"><button disabled={busy||(!editing&&(plan==='solo'||plan==='free')&&total>=3)} className="rounded-xl bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Enregistrement…':editing?'Enregistrer':'Ajouter la déclaration'}</button>
        {editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setHandle('');}} className="rounded-xl border px-4 py-2">Annuler</button>}</div>
    </form>
    {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
    <p className="text-xs text-slate-500">Retirer une déclaration enlève uniquement ces métadonnées de MentionCheck. Cela ne supprime aucun compte sur le réseau social.</p>
  </section>;
}
