import { requireUser, HttpError } from '@/lib/security/auth';
import { socialAccountSchema, socialPage, SOCIAL_COLUMNS, SOCIAL_PAGE_SIZE } from '@/lib/social/model';
import { settingsHeaders, settingsError, readBoundedJson, settingsRpcError } from '@/lib/social/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try {
    const {user,client}=await requireUser();
    let expiryFailed=false;
    try{
      const {error}=await client.rpc('expire_social_oauth_accounts',{p_user:user.id});
      expiryFailed=!!error;
    }catch{expiryFailed=true;}
    if(expiryFailed&&process.env.SOCIAL_OAUTH_ENABLED==='true')throw new Error('Comptes indisponibles.');
    let page:number;try{page=socialPage(request);}catch{throw new HttpError(400,'Page invalide.');}
    const offset=(page-1)*SOCIAL_PAGE_SIZE;
    const [inventory, connected] = await Promise.all([
      client.from('social_accounts').select(SOCIAL_COLUMNS,{count:'exact'})
        .eq('user_id',user.id).order('connected_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+SOCIAL_PAGE_SIZE-1),
      // Source of truth: only persisted, active OAuth accounts count as connected.
      // A successful Google consent alone must never increment this counter.
      client.from('social_accounts').select('id',{count:'exact',head:true})
        .eq('user_id',user.id).eq('connection_kind','oauth'),
    ]);
    if(inventory.error||connected.error||inventory.count===null||connected.count===null)throw new Error('Comptes indisponibles.');
    return Response.json({items:inventory.data??[],total:inventory.count,connectedTotal:connected.count,page,pageSize:SOCIAL_PAGE_SIZE},{headers:settingsHeaders});
  }catch(error){return settingsError(error);}
}
export async function POST(request:Request){
  try {
    const {client}=await requireUser();
    const parsed=socialAccountSchema.safeParse(await readBoundedJson(request));
    if(!parsed.success)throw new HttpError(400,'Vérifie la plateforme et le nom du compte.');
    const {data,error}=await client.rpc('save_social_account',{p_id:null,p_platform:parsed.data.platform,p_handle:parsed.data.handle});
    settingsRpcError(error);
    return Response.json({id:data,connectionKind:'manual'},{status:201,headers:settingsHeaders});
  }catch(error){return settingsError(error);}
}
