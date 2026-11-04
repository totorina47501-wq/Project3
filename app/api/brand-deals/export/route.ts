import { requireUser,publicError,HttpError } from '@/lib/security/auth';
import { DEAL_COLUMNS,registryCsv } from '@/lib/brand-deals/model';
import { dealHeaders,dealFilters } from '@/lib/brand-deals/server';
import { buildRegistryPdf } from '@/lib/archive/pdf';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const {user,client}=await requireUser();
    const filters=dealFilters(request);
    const format=new URL(request.url).searchParams.get('format')??'json';
    if(!['json','csv','pdf'].includes(format))throw new HttpError(400,'Format non pris en charge.');
    let query=client.from('brand_deals').select(DEAL_COLUMNS,{count:'exact'}).eq('user_id',user.id);
    if(filters.state==='draft')query=query.is('archived_at',null);
    if(filters.state==='archived')query=query.not('archived_at','is',null);
    if(filters.q)query=query.ilike('brand_name','%'+filters.q+'%');
    const {data,error,count}=await query.order('start_date',{ascending:false}).order('id',{ascending:false}).limit(500);
    if(error)throw new Error('Export indisponible.');
    if(count===null || count===undefined || count>500 || count!==(data??[]).length) {
      throw new HttpError(413,'Export limité à 500 collaborations. Affine les filtres avant de réessayer.');
    }
    const items=data??[];
    const headers={...dealHeaders,'X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="mentioncheck-collaborations.'+format+'"'};
    if(format==='csv')return new Response(registryCsv(items),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}});
    if(format==='pdf')return new Response(new Uint8Array(await buildRegistryPdf(items)),{headers:{...headers,'Content-Type':'application/pdf'}});
    return Response.json({schemaVersion:1,generatedAt:new Date().toISOString(),total:count,complete:true,certified:false,
      filters:{state:filters.state,q:filters.q},
      limitations:'Registre informatif. Métadonnées du registre uniquement ; snapshots accessibles individuellement dans le détail de chaque collaboration. Aucun fichier de contrat ou média incorporé. Horodatage interne, sans signature qualifiée ni tiers de confiance.',
      items,
    },{headers});
  }catch(error){const {status,message}=publicError(error);return Response.json({error:message},{status,headers:dealHeaders});}
}
