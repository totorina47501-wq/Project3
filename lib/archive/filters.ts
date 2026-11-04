import { z } from 'zod';
export const archiveFiltersSchema=z.object({
  page:z.coerce.number().int().min(1).max(10000).default(1),
  q:z.string().trim().max(100).regex(/^[\p{L}\p{N}\s.'’&()\-]*$/u).default(''),
  platform:z.enum(['','instagram','tiktok','youtube','linkedin']).default(''),
  status:z.enum(['','queued','processing','completed','accepted','kept','failed']).default(''),
  from:z.union([z.literal(''),z.iso.date()]).default(''),
  to:z.union([z.literal(''),z.iso.date()]).default(''),
}).refine(value=>!value.from||!value.to||value.from<=value.to,{message:'Intervalle de dates invalide.'});
export type ArchiveFilters=z.infer<typeof archiveFiltersSchema>;
export function archivePageHref(filters:ArchiveFilters,page:number):string {
  const params=new URLSearchParams({...filters,page:String(page)});
  for(const [key,value] of Array.from(params.entries()))if(!value)params.delete(key);
  return '/dashboard/archive?'+params;
}
