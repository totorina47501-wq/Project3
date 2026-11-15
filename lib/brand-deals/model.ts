import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
}, 'Date invalide.');
export const creatorDetailsSchema=z.object({
  niche:z.string().trim().max(120).default(''),
  platform:z.enum(['instagram','tiktok','youtube','linkedin','other','']).default(''),
  format:z.string().trim().max(100).default(''),
  deliverables:z.string().trim().max(1000).default(''),
  duration:z.string().trim().max(120).default(''),
  budget:z.string().trim().max(120).default(''),
  reuse_rights:z.string().trim().max(200).default(''),
  exclusivity:z.string().trim().max(200).default(''),
  proposal:z.string().trim().max(2500).default(''),
}).strict();
export type CreatorDetails=z.infer<typeof creatorDetailsSchema>;
export function createCreatorProposal(input:CreatorDetails):string {
  const details=creatorDetailsSchema.parse(input);
  return [
    'Bonjour,',
    '',
    `Je vous contacte au sujet d’une possible collaboration autour de ${details.niche||'mon activité'}.`,
    `Plateforme : ${details.platform||'à préciser'}. Format : ${details.format||'à préciser'}.`,
    `Livrables envisagés : ${details.deliverables||'à définir ensemble'}.`,
    `Durée souhaitée : ${details.duration||'à discuter'}.`,
    `Budget déclaré : ${details.budget||'à discuter'}.`,
    `Droits de réutilisation : ${details.reuse_rights||'à préciser'}. Exclusivité : ${details.exclusivity||'à préciser'}.`,
    '',
    'Ces éléments sont une base de discussion modifiable, pas un accord ni un avis juridique.',
    '',
    'Bonne journée,',
  ].join('\n');
}
const publicUrl=z.string().trim().max(500).url().refine(value=>{
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}
  catch {return false;}
},'Utilise un lien HTTPS public.');
export const creatorMediaKitSchema=z.object({
  creator_name:z.string().trim().max(120).default(''),
  description:z.string().trim().max(1200).default(''),
  niches:z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  formats:z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  public_links:z.array(publicUrl).max(10).default([]),
  contact_email:z.string().trim().max(254).email().or(z.literal('')).default(''),
  contact_url:z.union([publicUrl,z.literal('')]).default(''),
  include_creator_name:z.boolean().default(true),
  include_description:z.boolean().default(true),
  include_niches:z.boolean().default(true),
  include_formats:z.boolean().default(true),
  include_public_links:z.boolean().default(true),
  include_contact_email:z.boolean().default(false),
  include_contact_url:z.boolean().default(false),
}).strict();
export type CreatorMediaKit=z.infer<typeof creatorMediaKitSchema>;
export const dealDraftSchema = z.object({
  brand_name:z.string().trim().min(1).max(200),
  start_date:date,
  end_date:date.nullable().default(null),
  contract_url:z.string().min(1).max(500).nullable().default(null),
  creator_details:creatorDetailsSchema.nullable().default(null),
  verification_ids:z.array(z.string().uuid()).max(50).default([])
    .refine(ids=>new Set(ids).size===ids.length,'Vérifications dupliquées.'),
}).strict().refine(value=>!value.end_date || value.end_date>=value.start_date, {
  message:'La fin doit suivre le début.',path:['end_date'],
});
export type DealDraft = z.infer<typeof dealDraftSchema>;
export const dealListSchema=z.object({
  page:z.coerce.number().int().min(1).max(10000).default(1),
  state:z.enum(['all','draft','archived']).default('all'),
  q:z.string().trim().max(100).regex(/^[\p{L}\p{N}\s.'’&()\-]*$/u).default(''),
});
export const DEAL_PAGE_SIZE=20;
export type DealFilters=z.infer<typeof dealListSchema>;
export type DealRecord={
  id:string;brand_name:string;start_date:string;end_date:string|null;
  contract_url:string|null;created_at:string;archived_at:string|null;hash_sha256:string|null;
  creator_details?:CreatorDetails|null;
  archive_payload?:unknown;
  brand_deal_verifications?:Array<{verification_id:string}>;
};
export const DEAL_EXPORT_COLUMNS='id,brand_name,start_date,end_date,contract_url,created_at,archived_at,hash_sha256,brand_deal_verifications(verification_id)';
export const DEAL_COLUMNS=DEAL_EXPORT_COLUMNS+',creator_details';

export const DEAL_DETAIL_COLUMNS=DEAL_COLUMNS+',archive_payload';

export function assertOwnedContract(userId:string,path:string|null):void {
  if(path===null)return;
  if(!path.startsWith(userId+'/') || !/^[a-zA-Z0-9/_\-.]+$/.test(path) || path.split('/').some(part=>!part || part==='.' || part==='..')) {
    throw new Error('Chemin de contrat privé invalide.');
  }
}
// Le snapshot versionné ne contient que tableaux et scalaires, sans objets.
// Les espaces après virgules reproduisent exactement jsonb::text PostgreSQL.
export type ArchiveValue=string|null|ArchiveValue[];
export function archiveCanonicalText(value:ArchiveValue):string {
  return Array.isArray(value) ? '['+value.map(archiveCanonicalText).join(', ')+']' : JSON.stringify(value);
}
export async function archiveDigest(value:ArchiveValue):Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(archiveCanonicalText(value)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
type RegistryEntry=Pick<DealRecord,'id'|'brand_name'|'start_date'|'end_date'|'archived_at'|'hash_sha256'>;
export function registryCsv(records:RegistryEntry[]):string {
  const cell=(value:string|null)=>'"'+(value && /^[\s]*[=+\-@\t\r\n]/.test(value)?"'"+value:value??'').replace(/"/g,'""')+'"';
  const rows=[['Registre MentionCheck — Informatif, sans signature qualifiée'],
    ['Identifiant','Marque','Début','Fin','État','Archivage UTC','SHA-256'],
    ...records.map(row=>[row.id,row.brand_name,row.start_date,row.end_date,row.archived_at?'archivé':'brouillon',row.archived_at,row.hash_sha256])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
