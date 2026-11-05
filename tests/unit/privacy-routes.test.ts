import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({requireUser:vi.fn(),admin:vi.fn(),server:vi.fn(),inventory:vi.fn()}));
vi.mock('@/lib/security/auth', async()=>{
  class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
  return {HttpError,requireUser:mocks.requireUser,publicError:(error:unknown)=>error instanceof HttpError ? {status:error.status,message:error.message}:{status:503,message:'Le service est momentanément indisponible.'}};
});
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('@/lib/privacy/personal-data',()=>({readPersonalData:mocks.inventory}));
import { POST as consent } from '../../app/api/account/consent/route';
import { GET as status, POST as erasure } from '../../app/api/account/erasure/route';

const request=(body:string, origin='https://local.test')=>new Request('https://local.test/api/account/consent',{method:'POST',headers:{origin},body});
beforeEach(()=>{vi.clearAllMocks();mocks.requireUser.mockResolvedValue({user:{id:'owner'},client:{from:vi.fn(()=>{throw new Error('SDK_PRIVATE_DETAILS');}),rpc:vi.fn(()=>{throw new Error('SDK_PRIVATE_DETAILS');})}});});
describe('Frontière des routes personnelles',()=>{
  it.each([consent,erasure])('refuse un corps excessif avant toute écriture',async handler=>{
    const response=await handler(request(JSON.stringify({text:'x'.repeat(3000)})));
    expect(response.status).toBe(413);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('private');
  });
  it.each([consent,erasure])('rejette les origines tierces',async handler=>{
    const response=await handler(request('{}','https://evil.test'));
    expect(response.status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('ne renvoie aucun détail SDK et empêche le cache des erreurs',async()=>{
    const response=await consent(request('{"aiTrainingOptIn":false}'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('SDK_PRIVATE_DETAILS');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('isole explicitement le suivi au compte connecté',async()=>{
    const eq=vi.fn().mockReturnThis();
    const query={select:vi.fn().mockReturnThis(),eq,order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};
    mocks.requireUser.mockResolvedValue({user:{id:'owner'},client:{from:()=>query}});
    expect((await status()).status).toBe(200);
    expect(eq).toHaveBeenCalledWith('user_id','owner');
  });
});

it('prépare et journalise un dry-run sans aucune suppression',async()=>{
  const insert=vi.fn().mockResolvedValue({data:null,error:null});
  const forbiddenMutation=vi.fn();
  const storageRemove=vi.fn();
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{id:'request',status:'requested'},error:null}),
    insert,update:forbiddenMutation,delete:forbiddenMutation,upsert:forbiddenMutation};
  mocks.admin.mockReturnValue({from:()=>query,storage:{from:()=>({remove:storageRemove})}});
  const inventory={collections:{workspaces:[],metrics:[{id:'mia-usage'}],usage:[{mia_messages_used:3}]},privateFiles:[{bucket:'verification-media',path:'owner/file.png'}]};
  mocks.inventory.mockResolvedValue(inventory);
  const response=await erasure(request('{"action":"preview"}'));
  expect(response.status).toBe(200);
  const body=await response.json();
  expect(body.plan).toMatchObject({dryRun:true,deleted:false,status:'prepared_disabled',
    counts:{workspaces:0,metrics:1,usage:1},privateFiles:inventory.privateFiles});
  expect(mocks.inventory).toHaveBeenCalledWith({id:'owner'});
  expect(insert).toHaveBeenCalledTimes(1);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({mode:'dry_run',status:'prepared_disabled',user_id:'owner'}));
  expect(forbiddenMutation).not.toHaveBeenCalled();
  expect(storageRemove).not.toHaveBeenCalled();
});

it('retire le consentement via la transaction versionnée en base',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:false,error:null});
  mocks.requireUser.mockResolvedValue({user:{id:'owner'},client:{rpc}});
  const response=await consent(request('{"aiTrainingOptIn":false}'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({aiTrainingOptIn:false});
  expect(rpc).toHaveBeenCalledWith('set_training_consent',{p_opt_in:false});
});
