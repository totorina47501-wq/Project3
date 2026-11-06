import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),requireUser:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('@/lib/security/auth',()=>({requireUser:mocks.requireUser,publicError:()=>({status:503,message:'Export indisponible.'})}));
import { GET } from '../../app/api/account/export/route';

type Call={table:string;fields:string;filters:Array<[string,unknown]>;offset:number};
const calls:Call[]=[];
const ownerScopedRows:Record<string,Record<string,unknown>[]>={
  usage_monthly:[
    {user_id:'owner',period_start:'2026-11-01',mia_messages_used:3},
    {user_id:'other',period_start:'2026-11-01',mia_messages_used:99},
  ],
  ai_analyses:[
    {id:'mia-owner',user_id:'owner',stage:'assistant',model_used:'gpt-4o',cost_usd:.01},
    {id:'mia-other',user_id:'other',stage:'assistant',model_used:'gpt-4o',cost_usd:9.99},
  ],
};
beforeEach(()=>{
  calls.length=0;
  const from=(table:string)=>{
    const call:Call={table,fields:'',filters:[],offset:0};calls.push(call);
    const query={select:(fields:string)=>{call.fields=fields;return query;},eq:(key:string,value:unknown)=>{call.filters.push([key,value]);return query;},order:()=>query,
      range:async(offset:number,end:number)=>{call.offset=offset;
        if(table==='verifications')return {data:Array.from({length:Math.min(200,1205-offset)},(_,i)=>({id:`v${offset+i}`})),count:1205,error:null};
        const rows=(ownerScopedRows[table]??[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        return {data:rows.slice(offset,end+1),count:rows.length,error:null};},
      single:async()=>({data:{id:'owner',email:'owner@test',ai_training_opt_in:false},error:null})};
    return query;
  };
  const client={from,storage:{from:()=>({list:async()=>({data:[],error:null})})}};
  mocks.admin.mockReturnValue(client);
  mocks.requireUser.mockResolvedValue({user:{id:'owner',email:'owner@test',user_metadata:{name:'Person'},identities:[]},client});
});
describe('Export personnel complet dans le périmètre annoncé',()=>{
  it('exporte plus de mille vérifications et isole chaque lecture privilégiée',async()=>{
    const response=await GET();
    expect(response.status).toBe(200);
    const result=await response.json();
    expect(result.collections.verifications).toHaveLength(1205);
    expect(result.privateFiles).toEqual([]);
    expect(result.information.structuredDataComplete).toBe(true);
    expect(result.information.isComplete).toBe(false);
    expect(result.auth.user_metadata).toEqual({name:'Person'});
    for(const call of calls){
      if(call.table==='users') expect(call.filters).toContainEqual(['id','owner']);
      else if(call.table==='ai_analyses') expect(call.filters).toContainEqual(['user_id','owner']);
      else expect(call.filters.some(([key,value])=>['user_id','owner_id','created_by','accepted_by','email'].includes(key)&&['owner','owner@test'].includes(String(value)))).toBe(true);
      expect(call.fields).not.toContain('token_hash');
      expect(call.fields).not.toContain('access_token_vault_id');
    }
    expect(calls.find(call=>call.table==='rewrite_feedback')?.fields).toContain('accepted_caption');
    expect(calls.find(call=>call.table==='ai_analyses')?.fields).toContain('raw_response');
  });
  it('exporte les métriques Mia et compteurs de quota du seul propriétaire',async()=>{
    const response=await GET();
    expect(response.status).toBe(200);
    const result=await response.json();
    expect(result.collections.metrics).toEqual([
      expect.objectContaining({id:'mia-owner',user_id:'owner',stage:'assistant'}),
    ]);
    expect(result.collections.usage).toEqual([
      expect.objectContaining({user_id:'owner',mia_messages_used:3}),
    ]);
    expect(JSON.stringify([result.collections.metrics,result.collections.usage])).not.toContain('other');
    expect(calls.find(call=>call.table==='ai_analyses')?.filters).toContainEqual(['user_id','owner']);
    expect(calls.find(call=>call.table==='usage_monthly')?.filters).toContainEqual(['user_id','owner']);
  });
});

it('signale explicitement un export trop volumineux sans livrer un JSON partiel',async()=>{
  const query={select:()=>query,eq:()=>query,order:()=>query,single:async()=>({data:{id:'owner'},error:null}),range:async()=>({data:[],count:100001,error:null})};
  mocks.admin.mockReturnValue({from:()=>query});
  const response=await GET();
  expect(response.status).toBe(413);
  expect(await response.text()).toContain('extraction accompagnée');
});

it('inclut les artefacts dérivés privés du seul propriétaire dans le manifeste RGPD',async()=>{
 const client=mocks.admin();
 client.storage.from=(bucket:string)=>({list:async(prefix:string,options:{offset:number})=>({data:bucket==='verification-media-derived'&&prefix==='owner'&&options.offset===0?[{id:'derived-file',name:'slide-01.webp',metadata:{size:100}}]:[],error:null})});
 const response=await GET();expect(response.status).toBe(200);
 const result=await response.json();
 expect(result.privateFiles).toContainEqual({bucket:'verification-media-derived',path:'owner/slide-01.webp',id:'derived-file',metadata:{size:100}});
});

it('inclut les analyses média après migration même lorsque leur exécution est désactivée',async()=>{
 vi.stubEnv('MEDIA_AI_SCHEMA_READY','true');vi.stubEnv('MEDIA_AI_ENABLED','false');
 try{
  const response=await GET();expect(response.status).toBe(200);
  expect((await response.json()).collections.mediaAiRuns).toEqual([]);
  expect(calls.find(call=>call.table==='media_ai_runs')?.filters).toContainEqual(['user_id','owner']);
 }finally{vi.unstubAllEnvs();}
});
