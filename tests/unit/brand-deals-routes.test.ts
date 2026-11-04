import { beforeEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({requireUser:vi.fn(),from:vi.fn(),rpc:vi.fn()}));
vi.mock('../../lib/security/auth',async importOriginal=>{
  const original=await importOriginal<typeof import('../../lib/security/auth')>();
  return {...original,requireUser:mocks.requireUser};
});
import { GET,POST } from '../../app/api/brand-deals/route';
import { PATCH,DELETE } from '../../app/api/brand-deals/[id]/route';
import { POST as archive } from '../../app/api/brand-deals/[id]/archive/route';
import { GET as exportRegistry } from '../../app/api/brand-deals/export/route';
import { HttpError } from '../../lib/security/auth';
const id='3a83817f-dadc-478c-889e-2a3721525a76';
const actor='4a83817f-dadc-478c-889e-2a3721525a76';
const url='https://mentioncheck.test/api/brand-deals';
const draft={brand_name:'Marque',start_date:'2026-11-04',end_date:null,contract_url:null,verification_ids:[id]};
const request=(body:unknown,origin='https://mentioncheck.test')=>new Request(url,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
function query(result:unknown) {
  const chain={select:vi.fn(),eq:vi.fn(),is:vi.fn(),not:vi.fn(),ilike:vi.fn(),order:vi.fn(),range:vi.fn(),limit:vi.fn(),then:vi.fn()};
  for(const key of ['select','eq','is','not','ilike','order','range','limit'] as const)chain[key].mockReturnValue(chain);
  chain.then.mockImplementation((resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve));
  mocks.from.mockReturnValue(chain);return chain;
}
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({user:{id:actor},client:{from:mocks.from,rpc:mocks.rpc}});
  mocks.rpc.mockResolvedValue({data:id,error:null});
});
describe('API privée des collaborations',()=>{
  it('refuse les invités avant tout accès aux données',async()=>{
    mocks.requireUser.mockRejectedValue(new HttpError(401,'Connecte-toi pour continuer.'));
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await exportRegistry(new Request(url+'/export'))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('refuse une origine tierce sans écrire',async()=>{
    expect((await POST(request(draft,'https://evil.test'))).status).toBe(403);
    expect((await DELETE(request({},'https://evil.test'),{params:Promise.resolve({id})})).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuse les champs propriétaire et chemins de contrat étrangers',async()=>{
    expect((await POST(request({...draft,user_id:actor}))).status).toBe(400);
    expect((await POST(request({...draft,contract_url:'other/private.pdf'}))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('laisse le RPC déterminer le propriétaire depuis la session',async()=>{
    expect((await POST(request(draft))).status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith('save_brand_deal',{
      p_id:null,p_brand_name:'Marque',p_start_date:'2026-11-04',p_end_date:null,p_contract_url:null,p_verification_ids:[id],
    });
  });
  it('filtre explicitement les lectures par propriétaire et indique le total réel',async()=>{
    const chain=query({data:[],error:null,count:46});
    const response=await GET(new Request(url+'?page=3&state=archived&q=Marque'));
    expect(response.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('user_id',actor);
    expect(chain.select.mock.calls[0]?.[0]).not.toContain('archive_payload');
    expect(chain.range).toHaveBeenCalledWith(40,59);
    expect(await response.json()).toMatchObject({total:46,page:3,pageSize:20,items:[]});
  });
  it('traduit un refus d archive ou une propriété inconnue sans fuite SQL',async()=>{
    mocks.rpc.mockResolvedValueOnce({error:{code:'23514',message:'private SQL'}});
    const response=await PATCH(request(draft),{params:Promise.resolve({id})});
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain('private SQL');
    mocks.rpc.mockResolvedValueOnce({error:{code:'P0002',message:'private SQL'}});
    expect((await archive(request({}),{params:Promise.resolve({id})})).status).toBe(404);
  });
  it('réutilise l archivage atomique et ne fournit aucun hash venant du navigateur',async()=>{
    expect((await archive(request({hash_sha256:'forged'}),{params:Promise.resolve({id})})).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('archive_brand_deal',{p_id:id});
  });
  it('refuse un export tronqué plutôt que présenter un registre complet',async()=>{
    query({data:[draft],error:null,count:601});
    const response=await exportRegistry(new Request(url+'/export?format=json'));
    expect(response.status).toBe(413);
    expect((await response.json()).error).toContain('500');
  });
  it('exporte les métadonnées du registre et décrit les limites du JSON',async()=>{
    const chain=query({data:[{...draft,id}],error:null,count:1});
    const response=await exportRegistry(new Request(url+'/export?format=json'));
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({total:1,complete:true,certified:false,items:[{id}]});
    expect(chain.select.mock.calls[0]?.[0]).not.toContain('archive_payload');
  });
});
