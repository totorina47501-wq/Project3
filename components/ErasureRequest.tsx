'use client';
import { useEffect, useState } from 'react';
import type { ErasureStatus } from '@/lib/privacy/erasure';

type Erasure = {
  id: string; status: ErasureStatus;
  requested_at: string; cancelled_at: string | null;
};
const description: Record<ErasureStatus,string> = {
  requested: 'Demande reçue, en attente de traitement.',
  reviewing: 'Demande en cours d’examen. Contacte le support pour toute modification.',
  cancelled: 'Dernière demande annulée.',
  completed: 'Demande indiquée comme traitée par l’équipe.',
  rejected: 'La demande nécessite une vérification complémentaire.',
};

export function ErasureRequest() {
  const [record,setRecord] = useState<Erasure | null>(null);
  const [confirmation,setConfirmation] = useState('');
  const [pending,setPending] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [preview,setPreview] = useState<{files:number;ownedWorkspaces:boolean}|null>(null);

  useEffect(()=>{
    let active=true;
    void fetch('/api/account/erasure',{cache:'no-store'})
      .then(async response=>{
        const result=await response.json() as {request?:Erasure|null;error?:string};
        if(!response.ok)throw new Error(result.error??'Suivi indisponible.');
        if(active)setRecord(result.request??null);
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Suivi indisponible.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);

  async function submit(action:'request'|'cancel') {
    setError('');setMessage('');setPending(true);
    try{
      const response=await fetch('/api/account/erasure',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(action==='request'
          ? {action,confirmation}:{action}),
      });
      const result=await response.json() as {request?:Erasure;error?:string};
      if(!response.ok || !result.request)
        throw new Error(result.error??'Action indisponible.');
      setRecord(result.request);
      setConfirmation('');
      setMessage(action==='request'
        ? 'Demande enregistrée. Ton compte reste actif pour le moment.'
        : 'Demande annulée. Aucun contenu n’a été supprimé.');
    }catch(e){
      setError(e instanceof Error?e.message:'Action indisponible.');
    }finally{setPending(false);}
  }

  async function preparePreview() {
    setPending(true);setError('');
    try {
      const response=await fetch('/api/account/erasure',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'preview'}),
      });
      const result=await response.json() as {error?:string;plan?:{dryRun:boolean;deleted:boolean;privateFiles:unknown[];blockers:string[]}};
      if (!response.ok || !result.plan?.dryRun || result.plan.deleted)
        throw new Error(result.error??'Préparation indisponible.');
      setPreview({files:result.plan.privateFiles.length,
        ownedWorkspaces:result.plan.blockers.includes('owned_workspaces_require_transfer')});
    } catch(e) {setError(e instanceof Error?e.message:'Préparation indisponible.');}
    finally {setPending(false);}
  }

  const active=record?.status==='requested'||record?.status==='reviewing';
  return <section aria-labelledby="erasure-heading"
    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
    <h2 id="erasure-heading" className="font-heading text-xl font-bold">
      Demander la suppression de mon compte
    </h2>
    <p className="text-sm text-slate-600">
      Ce formulaire enregistre une demande de droit à l’effacement. Il ne supprime
      pas immédiatement ton compte, tes archives ou tes fichiers. Le traitement
      complet nécessite encore une procédure de vérification sécurisée.
    </p>
    {loading ? <p role="status" className="text-sm text-slate-500">
      Consultation de la demande…
    </p> : <>
      {record && <p role="status"
        className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <strong>Statut :</strong> {description[record.status]??'Statut inconnu.'}
      </p>}
      {!active && <div className="space-y-3">
        <label htmlFor="erasure-confirmation" className="block text-sm font-semibold">
          Écris SUPPRIMER pour déposer une demande
        </label>
        <input id="erasure-confirmation" type="text" autoComplete="off"
          value={confirmation} onChange={e=>setConfirmation(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-3"
          placeholder="SUPPRIMER"/>
        <button type="button"
          disabled={pending||confirmation!=='SUPPRIMER'}
          onClick={()=>void submit('request')}
          className="rounded-lg border border-red-600 px-4 py-2.5 font-semibold text-red-700 disabled:opacity-50">
          Enregistrer ma demande d’effacement
        </button>
      </div>}
      {active && <div className="space-y-2">
        <button type="button" disabled={pending} onClick={()=>void preparePreview()}
          className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 disabled:opacity-50">
          Préparer un état des données à traiter
        </button>
        {preview && <p role="status" className="text-sm text-slate-600">
          État préparé : {preview.files} fichier(s) privé(s) inventorié(s). Aucun contenu
          n&apos;a été supprimé. Un opérateur doit vérifier ton identité, les prestataires
          et les obligations de conservation avant le traitement.
          {preview.ownedWorkspaces && ' Une équipe dont tu es propriétaire nécessite un transfert préalable.'}
        </p>}
      </div>}
      {record?.status==='requested' && <button type="button"
        disabled={pending} onClick={()=>void submit('cancel')}
        className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 disabled:opacity-50">
        Annuler ma demande
      </button>}
    </>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
