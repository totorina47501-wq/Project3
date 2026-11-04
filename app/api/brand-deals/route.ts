import { requireUser,publicError } from '@/lib/security/auth';
import { DEAL_COLUMNS,DEAL_PAGE_SIZE } from '@/lib/brand-deals/model';
import { dealHeaders,dealFilters,dealRange,draftRequest,dealRpcError } from '@/lib/brand-deals/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const {user,client}=await requireUser();
    const filters=dealFilters(request);
    let query=client.from('brand_deals').select(DEAL_COLUMNS,{count:'exact'}).eq('user_id',user.id);
    if(filters.state==='draft')query=query.is('archived_at',null);
    if(filters.state==='archived')query=query.not('archived_at','is',null);
    if(filters.q)query=query.ilike('brand_name','%'+filters.q+'%');
    const {data,error,count}=await query.order('start_date',{ascending:false}).order('id',{ascending:false}).range(...dealRange(filters));
    if(error)throw new Error('Registre indisponible.');
    return Response.json({items:data??[],total:count,page:filters.page,pageSize:DEAL_PAGE_SIZE},{headers:dealHeaders});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
export async function POST(request:Request) {
  try {
    const {user,client}=await requireUser();
    const draft=await draftRequest(request,user.id);
    const {data,error}=await client.rpc('save_brand_deal',{
      p_id:null,p_brand_name:draft.brand_name,p_start_date:draft.start_date,p_end_date:draft.end_date,
      p_contract_url:draft.contract_url,p_verification_ids:draft.verification_ids,
    });
    dealRpcError(error);
    return Response.json({id:data},{status:201,headers:dealHeaders});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
