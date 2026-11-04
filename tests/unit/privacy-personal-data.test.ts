import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),requireUser:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('@/lib/security/auth',()=>({requireUser:mocks.requireUser,publicError:()=>({status:503,message:'Export indisponible.'})}));
import { GET } from '../../app/api/account/export/route';

type Call={table:string;fields:string;filters:Array<[string,unknown]>;offset:number};
const calls:Call[]=[];
beforeEach(()=>{
  calls.length=0;
  const from=(table:string)=>{
    const call:Call={table,fields:'',filters:[],offset:0};calls.push(call);
    const query={select:(fields:string)=>{call.fields=fields;return query;},eq:(key:string,value:unknown)=>{call.filters.push([key,value]);return query;},order:()=>query,
      range:async(offset:number)=>{call.offset=offset;return {data:table==='verifications'?Array.from({length:Math.min(200,1205-offset)},(_,i)=>({id:`v${offset+i}`})):[],count:table==='verifications'?1205:0,error:null};},
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
      else if(call.table==='ai_analyses') expect(call.filters).toContainEqual(['verifications.user_id','owner']);
      else expect(call.filters.some(([key,value])=>['user_id','owner_id','created_by','accepted_by','email'].includes(key)&&['owner','owner@test'].includes(String(value)))).toBe(true);
      expect(call.fields).not.toContain('token_hash');
      expect(call.fields).not.toContain('access_token_vault_id');
    }
    expect(calls.find(call=>call.table==='rewrite_feedback')?.fields).toContain('accepted_caption');
    expect(calls.find(call=>call.table==='ai_analyses')?.fields).toContain('raw_response');
  });
});

it('signale explicitement un export trop volumineux sans livrer un JSON partiel',async()=>{
  const query={select:()=>query,eq:()=>query,order:()=>query,single:async()=>({data:{id:'owner'},error:null}),range:async()=>({data:[],count:100001,error:null})};
  mocks.admin.mockReturnValue({from:()=>query});
  const response=await GET();
  expect(response.status).toBe(413);
  expect(await response.text()).toContain('extraction accompagnée');
});
