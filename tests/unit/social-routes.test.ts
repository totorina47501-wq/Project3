import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/security/auth',async importOriginal=>({...await importOriginal<typeof import('@/lib/security/auth')>(),requireUser:mocks.auth}));
import { POST, GET } from '../../app/api/social-accounts/route';
import { PATCH, DELETE } from '../../app/api/social-accounts/[id]/route';
import { GET as preferences, PUT } from '../../app/api/social-accounts/preferences/route';
import { HttpError } from '@/lib/security/auth';
const id='3a83817f-dadc-478c-889e-2a3721525a76';
const context={params:Promise.resolve({id})};
const request=(body:unknown={},origin='https://local.test')=>new Request('https://local.test/api/social-accounts',{method:'POST',headers:{origin},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:'owner'},client:{rpc:mocks.rpc,from:mocks.from}});mocks.rpc.mockResolvedValue({data:id,error:null});});
describe('Routes de déclarations sociales',()=>{
  it('refuse les visiteurs sans session et origine étrangère',async()=>{
    mocks.auth.mockRejectedValueOnce(new HttpError(401,'Connexion requise.'));
    expect((await POST(request({platform:'instagram',handle:'ok'}))).status).toBe(401);
    expect((await POST(request({},'https://evil.test'))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('crée et modifie uniquement les métadonnées autorisées dans la transaction de quota',async()=>{
    expect((await POST(request({platform:'instagram',handle:' @Creator '}))).status).toBe(201);
    expect(mocks.rpc).toHaveBeenLastCalledWith('save_social_account',{p_id:null,p_platform:'instagram',p_handle:'creator'});
    expect((await PATCH(request({platform:'tiktok',handle:'ok'}),context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith('save_social_account',{p_id:id,p_platform:'tiktok',p_handle:'ok'});
    expect((await POST(request({platform:'instagram',handle:'ok',plan:'studio'}))).status).toBe(400);
  });
  it('rapporte la limite, les doublons, les lignes absentes et masque les erreurs SDK',async()=>{
    for(const [code,status] of [['P0001',409],['23505',409],['P0002',404],['42501',403],['SDK_PRIVATE',503]] as const){
      mocks.rpc.mockResolvedValueOnce({data:null,error:{code,message:'secret_internal'}});
      const response=await POST(request({platform:'instagram',handle:'ok'}));
      expect(response.status).toBe(status);expect(await response.text()).not.toContain('secret_internal');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });
  it('supprime via une RPC de propriété explicite sans toucher un fournisseur',async()=>{
    const response=await DELETE(request(),context);expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('remove_social_account',{p_id:id});
  });
  it('borne la lecture au propriétaire et exclut systématiquement Vault',async()=>{
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn().mockResolvedValue({data:[],count:0,error:null})};
    mocks.from.mockReturnValue(query);
    expect((await GET(new Request('https://local.test/api/social-accounts?page=2'))).status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('user_id','owner');expect(query.range).toHaveBeenCalledWith(25,49);
    expect(query.select.mock.calls[0]?.[0]).not.toContain('vault');
    expect((await GET(new Request('https://local.test/api/social-accounts?page=no'))).status).toBe(400);
  });
  it('lit et persiste un ton sans permettre de changer le plan',async()=>{
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{rewrite_tone:'créatif'},error:null}),upsert:vi.fn().mockResolvedValue({error:null})};
    mocks.from.mockReturnValue(query);
    expect(await (await preferences()).json()).toEqual({rewriteTone:'créatif'});
    expect((await PUT(request({rewriteTone:'institutionnel'}))).status).toBe(200);
    expect(query.upsert).toHaveBeenCalledWith({user_id:'owner',rewrite_tone:'institutionnel'},{onConflict:'user_id'});
    expect((await PUT(request({rewriteTone:'naturel',plan:'pro'}))).status).toBe(400);
  });
});
