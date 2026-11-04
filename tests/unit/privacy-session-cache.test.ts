import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const sdk=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('@supabase/ssr',()=>({createServerClient:sdk.create}));
import { middleware } from '../../middleware';
beforeEach(()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://supabase.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-test');
  sdk.create.mockImplementation((_url,_key,options)=>({auth:{getUser:async()=>{options.cookies.setAll([{name:'sb-session',value:'private-token',options:{httpOnly:true}}]);return {data:{user:{id:'owner'}},error:null};}}}));
});
describe('Cache des sessions Supabase',()=>{
  it('interdit le cache partagé après rafraîchissement des cookies',async()=>{
    const response=await middleware(new NextRequest('https://local.test/dashboard'));
    expect(response.cookies.get('sb-session')?.value).toBe('private-token');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('Cookie');
  });
  it('ne laisse pas une erreur de rafraîchissement casser les gardes des routes',async()=>{
    sdk.create.mockReturnValue({auth:{getUser:async()=>{throw new Error('provider secret');}}});
    const response=await middleware(new NextRequest('https://local.test/api/account/export'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
