import { requireUser, HttpError } from '@/lib/security/auth';
import { socialAccountSchema } from '@/lib/social/model';
import { settingsHeaders, settingsError, readBoundedJson, accountId, assertSettingsOrigin, settingsRpcError } from '@/lib/social/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Context){
  try {
    const {client}=await requireUser();
    const id=accountId((await context.params).id);
    const parsed=socialAccountSchema.safeParse(await readBoundedJson(request));
    if(!parsed.success)throw new HttpError(400,'Vérifie la plateforme et le nom du compte.');
    const {data,error}=await client.rpc('save_social_account',{p_id:id,p_platform:parsed.data.platform,p_handle:parsed.data.handle});
    settingsRpcError(error);
    return Response.json({id:data,connectionKind:'manual'},{headers:settingsHeaders});
  }catch(error){return settingsError(error);}
}
export async function DELETE(request:Request,context:Context){
  try {
    assertSettingsOrigin(request);
    const {client}=await requireUser();
    const id=accountId((await context.params).id);
    const {error}=await client.rpc('remove_social_account',{p_id:id});settingsRpcError(error);
    return Response.json({removed:true},{headers:settingsHeaders});
  }catch(error){return settingsError(error);}
}
