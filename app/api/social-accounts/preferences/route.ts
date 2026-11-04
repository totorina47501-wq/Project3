import { requireUser, HttpError } from '@/lib/security/auth';
import { preferenceSchema } from '@/lib/social/model';
import { settingsHeaders, settingsError, readBoundedJson } from '@/lib/social/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  try {
    const {user,client}=await requireUser();
    const {data,error}=await client.from('user_preferences').select('rewrite_tone').eq('user_id',user.id).maybeSingle();
    if(error)throw new Error('Préférences indisponibles.');
    return Response.json({rewriteTone:data?.rewrite_tone??'naturel'},{headers:settingsHeaders});
  }catch(error){return settingsError(error);}
}
export async function PUT(request:Request){
  try {
    const {user,client}=await requireUser();
    const parsed=preferenceSchema.safeParse(await readBoundedJson(request));
    if(!parsed.success)throw new HttpError(400,'Choisis une tonalité proposée.');
    const {error}=await client.from('user_preferences').upsert({user_id:user.id,rewrite_tone:parsed.data.rewriteTone},{onConflict:'user_id'});
    if(error)throw new Error('Préférences indisponibles.');
    return Response.json(parsed.data,{headers:settingsHeaders});
  }catch(error){return settingsError(error);}
}
