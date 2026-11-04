import { HttpError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
import { dealDraftSchema,assertOwnedContract,dealListSchema,DEAL_PAGE_SIZE,type DealFilters } from './model';
import { z } from 'zod';

export const dealHeaders={'Cache-Control':'private, no-store'};
export function dealId(id:string):string {
  if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'Collaboration introuvable.');
  return id;
}
export function dealFilters(request:Request):DealFilters {
  const params=new URL(request.url).searchParams;
  const parsed=dealListSchema.safeParse(Object.fromEntries(['page','state','q'].flatMap(key=>params.has(key)?[[key,params.get(key)]]:[])));
  if(!parsed.success)throw new HttpError(400,'Filtres invalides. Vérifie la recherche et le numéro de page.');
  return parsed.data;
}
export function assertDealOrigin(request:Request):void {
  if(!isSameOrigin(request))throw new HttpError(403,'Origine de la requête refusée.');
}
export async function draftRequest(request:Request,userId:string) {
  assertDealOrigin(request);
  const text=await request.text();
  if(text.length>30000)throw new HttpError(413,'Brouillon trop volumineux.');
  let value:unknown;
  try {value=JSON.parse(text);}catch {throw new HttpError(400,'Brouillon JSON invalide.');}
  const parsed=dealDraftSchema.safeParse(value);
  if(!parsed.success)throw new HttpError(400,'Vérifie la marque, les dates et les identifiants des vérifications.');
  try {assertOwnedContract(userId,parsed.data.contract_url);}catch {throw new HttpError(400,'Contrat privé invalide.');}
  return parsed.data;
}
export function dealRpcError(error:{code?:string}|null):void {
  if(!error)return;
  if(error.code==='P0002')throw new HttpError(404,'Collaboration introuvable.');
  if(error.code==='23514')throw new HttpError(409,'Archive immuable ou vérifications liées non finalisées.');
  if(error.code==='22023'||error.code==='23503')throw new HttpError(400,'Contrat ou vérification introuvable, ou brouillon invalide.');
  throw new Error('Collaboration indisponible.');
}
export function dealRange(filters:DealFilters):[number,number] {
  const offset=(filters.page-1)*DEAL_PAGE_SIZE;
  return [offset,offset+DEAL_PAGE_SIZE-1];
}
