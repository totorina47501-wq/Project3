import { requireUser,publicError,HttpError } from '@/lib/security/auth';
import { DEAL_DETAIL_COLUMNS } from '@/lib/brand-deals/model';
import { dealHeaders,dealId,draftRequest,dealRpcError,assertDealOrigin } from '@/lib/brand-deals/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context) {
  try {
    const {user,client}=await requireUser();
    const id=dealId((await params).id);
    const {data,error}=await client.from('brand_deals').select(DEAL_DETAIL_COLUMNS).eq('id',id).eq('user_id',user.id).single();
    if(error||!data)throw new HttpError(404,'Collaboration introuvable.');
    return Response.json({item:data},{headers:dealHeaders});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
export async function PATCH(request:Request,{params}:Context) {
  try {
    const {user,client}=await requireUser();
    const id=dealId((await params).id);
    const draft=await draftRequest(request,user.id);
    const {data,error}=await client.rpc('save_brand_deal',{
      p_id:id,p_brand_name:draft.brand_name,p_start_date:draft.start_date,p_end_date:draft.end_date,
      p_contract_url:draft.contract_url,p_verification_ids:draft.verification_ids,
    });
    dealRpcError(error);
    return Response.json({id:data},{headers:dealHeaders});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
export async function DELETE(request:Request,{params}:Context) {
  try {
    const {client}=await requireUser();
    assertDealOrigin(request);
    const id=dealId((await params).id);
    const {error}=await client.rpc('delete_brand_deal_draft',{p_id:id});
    dealRpcError(error);
    return new Response(null,{status:204,headers:dealHeaders});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
