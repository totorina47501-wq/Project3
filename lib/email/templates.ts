// Rendu local uniquement. Aucun client Resend, destinataire ou fonction d'envoi.
type Common = {siteOrigin:string};
export type EmailInput = Common & (
  | {kind:'welcome';name:string}
  | {kind:'report-ready';verificationId:string}
  | {kind:'quota-warning';used:number;limit:number;periodEnd:string}
  | {kind:'erasure-received';requestId:string}
  | {kind:'critical-compliance';verificationId:string;signals:number}
  | {kind:'monthly-report';period:string;checks:number;risks:number}
  | {kind:'subscription-confirmed';plan:'solo'|'pro'|'studio'}
);
export type RenderedEmail = {subject:string;text:string;html:string};
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
function escapeHtml(value:string):string {
  return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
}
function originUrl(raw:string):string {
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
    throw new Error('Origine HTTPS seule requise.');
  return url.origin;
}
export function renderEmail(input:EmailInput):RenderedEmail {
  const origin=originUrl(input.siteOrigin);
  let subject:string;let paragraphs:string[];let path='/dashboard';let action='Ouvrir MentionCheck';
  switch(input.kind){
    case 'critical-compliance':
      if(!uuid.test(input.verificationId)||!Number.isSafeInteger(input.signals)||input.signals<1||input.signals>1000)throw new Error('Alerte invalide.');
      subject='Mia a repéré des signaux à vérifier avant publication';
      paragraphs=[`Mia a relevé ${input.signals} signal(s) de risque dans ta publication.`,`Relis le contrôle et corrige les mentions avant publication. Ce résultat dépend des contrôles exécutés ; il ne certifie pas la conformité juridique.`];
      path='/dashboard/archive/'+input.verificationId;action='Relire le contrôle';break;
    case 'monthly-report':
      if(!/^(0[1-9]|1[0-2])\/20\d{2}$/.test(input.period)||![input.checks,input.risks].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=100000))throw new Error('Rapport mensuel invalide.');
      subject=`Ton bilan MentionCheck — ${input.period}`;
      paragraphs=[`${input.checks} vérification(s) réalisée(s) sur la période ${input.period}.`,`Mia a intercepté ${input.risks} signal(s) de risque à relire ce mois-ci.`,`Retrouve tes contrôles et corrections dans tes archives.`];path='/dashboard/archive';action='Consulter mon bilan';break;
    case 'subscription-confirmed': {
      const labels={solo:'Solo',pro:'Pro',studio:'Studio'};
      if(!Object.hasOwn(labels,input.plan))throw new Error('Offre invalide.');
      subject=`Confirmation de ton offre MentionCheck ${labels[input.plan]}`;
      paragraphs=[`Ton offre ${labels[input.plan]} est enregistrée.`,`Retrouve le détail de tes droits et de ton abonnement dans tes paramètres.`];path='/dashboard/settings';action='Voir mon abonnement';break;
    }
    case 'welcome':
      if(!input.name.trim()||input.name.length>200||/[\x00-\x1f]/.test(input.name))throw new Error('Nom invalide.');
      subject='Bienvenue sur MentionCheck';
      paragraphs=[`Bonjour ${input.name.trim()},`,`Ton espace MentionCheck est prêt. Tu peux commencer par un contrôle des mentions sans IA, sans consommer de crédit IA.`];break;
    case 'report-ready':
      if(!uuid.test(input.verificationId))throw new Error('Identifiant invalide.');
      subject='Ton rapport MentionCheck est disponible';
      paragraphs=['Une vérification est disponible dans ton espace privé. Consulte son mode d’analyse et ses éventuelles limites avant de publier.','Le rapport est une aide à la vérification ; il ne constitue pas une certification juridique.'];
      path='/dashboard/archive/'+input.verificationId;action='Consulter le rapport';break;
    case 'quota-warning':
      if(!Number.isSafeInteger(input.used)||!Number.isSafeInteger(input.limit)||input.used<0||input.limit<1||input.used>input.limit||!/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)||Number.isNaN(Date.parse(input.periodEnd))||new Date(input.periodEnd).toISOString().slice(0,10)!==input.periodEnd)
        throw new Error('Quota invalide.');
      subject='Point sur ton quota MentionCheck';
      paragraphs=[`Tu as utilisé ${input.used} sur ${input.limit} actions de ton quota. Fin de période : ${input.periodEnd}.`,'Les contrôles de texte sans IA restent accessibles sans consommer de quota IA.'];
      path='/dashboard/settings';action='Consulter mes quotas';break;
    case 'erasure-received':
      if(!uuid.test(input.requestId))throw new Error('Identifiant invalide.');
      subject='Ta demande d’effacement MentionCheck a été reçue';
      paragraphs=[`Référence de ta demande : ${input.requestId}.`,'La demande a été enregistrée ; aucune suppression automatique n’a été lancée. Son suivi et les étapes restantes sont disponibles dans les paramètres.'];
      path='/dashboard/settings';action='Suivre ma demande';break;
  }
  const url=origin+path;
  const text=[subject,...paragraphs,`${action} : ${url}`,'MentionCheck — Cet email ne contient aucune légende ni fichier privé.'].join('\n\n');
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>'+escapeHtml(subject)+'</title></head><body><main><h1>'+escapeHtml(subject)+'</h1>'+paragraphs.map(p=>'<p>'+escapeHtml(p)+'</p>').join('')+'<p><a href="'+escapeHtml(url)+'">'+escapeHtml(action)+'</a></p><p>MentionCheck — Cet email ne contient aucune légende ni fichier privé.</p></main></body></html>';
  return {subject,text,html};
}
export function emailPreviews(siteOrigin:string):{name:EmailInput['kind'];email:RenderedEmail}[]{
  const id='3a83817f-dadc-478c-889e-2a3721525a76';
  const examples:EmailInput[]=[
    {kind:'welcome',name:'Camille',siteOrigin},
    {kind:'report-ready',verificationId:id,siteOrigin},
    {kind:'quota-warning',used:18,limit:20,periodEnd:'2026-12-01',siteOrigin},
    {kind:'erasure-received',requestId:id,siteOrigin},
    {kind:'critical-compliance',verificationId:id,signals:3,siteOrigin},
    {kind:'monthly-report',period:'11/2026',checks:30,risks:5,siteOrigin},
    {kind:'subscription-confirmed',plan:'solo',siteOrigin},
  ];
  return examples.map(input=>({name:input.kind,email:renderEmail(input)}));
}
