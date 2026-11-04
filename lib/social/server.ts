import { z } from 'zod';
import { HttpError, publicError } from '@/lib/security/auth';
import { isSameOrigin } from '@/lib/security/origin';
export const settingsHeaders = {'Cache-Control':'private, no-store'};
export function settingsError(error:unknown):Response {
  const {status,message}=publicError(error);
  return Response.json({error:message},{status,headers:settingsHeaders});
}
export function accountId(id:string):string {
  if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'Compte déclaré introuvable.');
  return id;
}
export function assertSettingsOrigin(request:Request):void {
  if(!isSameOrigin(request))throw new HttpError(403,'Origine de la requête refusée.');
}
export async function readBoundedJson(request:Request):Promise<unknown> {
  assertSettingsOrigin(request);
  // Les clients applicatifs envoient de petits objets. La limite porte aussi sur
  // les flux sans Content-Length, avant leur décodage complet.
  const reader=request.body?.getReader();
  if(!reader)throw new HttpError(400,'Requête JSON invalide.');
  const chunks:Uint8Array[]=[];let length=0;
  try {
    for(;;){
      const next=await reader.read();if(next.done)break;
      length+=next.value.byteLength;
      if(length>2048){await reader.cancel();throw new HttpError(413,'Requête trop volumineuse.');}
      chunks.push(next.value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw new HttpError(400,'Requête JSON invalide.');}
}
export function settingsRpcError(error:{code?:string}|null):void {
  if(!error)return;
  if(error.code==='P0002')throw new HttpError(404,'Compte déclaré introuvable.');
  if(error.code==='23505')throw new HttpError(409,'Ce compte est déjà déclaré.');
  if(error.code==='P0001')throw new HttpError(409,'La limite de 3 comptes du plan Solo est atteinte.');
  if(error.code==='42501')throw new HttpError(403,'Seuls les comptes déclarés manuellement peuvent être modifiés ici.');
  if(error.code==='22023'||error.code==='23514')throw new HttpError(400,'Paramètres invalides.');
  throw new Error('Paramètres indisponibles.');
}
