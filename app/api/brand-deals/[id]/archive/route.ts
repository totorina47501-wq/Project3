import { requireUser,publicError } from '@/lib/security/auth';
import { dealHeaders,dealId,dealRpcError,assertDealOrigin } from '@/lib/brand-deals/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {client}=await requireUser();
    assertDealOrigin(request);
    const id=dealId((await params).id);
    const {data,error}=await client.rpc('archive_brand_deal',{p_id:id});
    dealRpcError(error);
    return Response.json({item:data},{headers:dealHeaders});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
