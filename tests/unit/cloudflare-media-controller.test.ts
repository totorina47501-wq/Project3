import {beforeEach,expect,it,vi} from 'vitest';
import {CloudflareMediaController} from '../../lib/media/cloudflare-controller';
let now:number;
function fixture(jobs:unknown[]=[]){
 const data=new Map<string,unknown>();let alarm:number|null=null;
 const storage={get:async<T>(key:string)=>data.get(key) as T|undefined,put:async(key:string,value:unknown)=>{data.set(key,value);},getAlarm:async()=>alarm,setAlarm:async(value:number)=>{alarm=value;},deleteAlarm:async()=>{alarm=null;}};
 const container={running:false,images:{base:'registry.test/image@sha256:fixture'},start:vi.fn((options:unknown)=>{void options;container.running=true;}),destroy:vi.fn(async()=>{container.running=false;}),setInactivityTimeout:vi.fn(async()=>{})};
 const env={MEDIA_CLOUDFLARE_RUNNER_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://zcztvberuihphqklhjsr.supabase.co',SUPABASE_SERVICE_KEY:'server-fixture-never-sent'};
 const fetcher=vi.fn(async()=>Response.json(jobs));
 const runner=new CloudflareMediaController({storage,container},env,fetcher,()=>now);
 return {runner,storage,container,env,fetcher,data,alarm:()=>alarm};
}
beforeEach(()=>{now=Date.parse('2026-11-05T12:00:00Z');});
it('ne démarre pas de conteneur quand la file est vide',async()=>{
 const f=fixture();await f.runner.alarm();expect(f.container.start).not.toHaveBeenCalled();expect(f.alarm()).toBeNull();
});
it('réveille uniquement par POST interne et planifie une alarme avant le démarrage',async()=>{
 const f=fixture([{status:'queued',available_at:new Date(now-1).toISOString()}]);
 expect((await f.runner.fetch(new Request('https://internal/wake'))).status).toBe(405);
 expect((await f.runner.fetch(new Request('https://internal/wake',{method:'POST'}))).status).toBe(202);
 expect(f.container.start).not.toHaveBeenCalled();expect(f.alarm()).not.toBeNull();
 await f.runner.alarm();expect(f.container.start).toHaveBeenCalledOnce();
 expect(f.container.start.mock.calls[0]?.[0]).toMatchObject({enableInternet:true,env:{MEDIA_RUNNER_ONCE:'true',MEDIA_RUNNER_ENABLED:'true',SUPABASE_SERVICE_KEY:'server-fixture-never-sent'}});
 const status=await (await f.runner.fetch(new Request('https://internal/status'))).text();expect(status).not.toContain('server-fixture');
});
it('ne démarre pas avant disponibilité et ne vole pas un bail actif',async()=>{
 const f=fixture([{status:'processing',lease_until:new Date(now+60000).toISOString()}]);
 await f.runner.alarm();expect(f.container.start).not.toHaveBeenCalled();expect(f.alarm()).toBeGreaterThan(now);
});
it('arrête le conteneur au délai maximal et refuse les secrets absents',async()=>{
 const f=fixture([{status:'queued',available_at:new Date(now-1).toISOString()}]);await f.runner.alarm();now+=271000;
 await f.runner.alarm();expect(f.container.destroy).toHaveBeenCalledOnce();
 const g=fixture();g.env.SUPABASE_SERVICE_KEY='';expect((await g.runner.fetch(new Request('https://internal/wake',{method:'POST'}))).status).toBe(503);expect(g.fetcher).not.toHaveBeenCalled();
});
it('ne redémarre pas un conteneur actif et respecte le coupe-circuit',async()=>{
 const f=fixture([{status:'queued',available_at:new Date(now-1).toISOString()}]);await f.runner.alarm();now+=15000;await f.runner.alarm();expect(f.container.start).toHaveBeenCalledOnce();
 Object.assign(f.env,{MEDIA_RUNNER_PAUSED:'true'});await f.runner.alarm();expect(f.container.destroy).toHaveBeenCalledOnce();
});
it('borne les démarrages horaires et les reprises après panne de file',async()=>{
 const f=fixture([{status:'queued',available_at:new Date(now-1).toISOString()}]);f.data.set('budget',{hour:Math.floor(now/3600000),count:60});
 await f.runner.alarm();expect(f.container.start).not.toHaveBeenCalled();expect(f.alarm()).toBeGreaterThan(now);
 const g=fixture();g.fetcher.mockRejectedValue(new Error('message privé'));for(let i=0;i<5;i++)await g.runner.alarm();expect(g.alarm()).toBeNull();
});
it('appelle fetch avec le contexte global exigé par le runtime Cloudflare',async()=>{
 const f=fixture();
 const nativeLike=vi.fn(function(this:unknown){
  if(this!==globalThis)throw new TypeError('Illegal invocation');
  return Promise.resolve(Response.json([{status:'queued',available_at:new Date(now-1).toISOString()}]));
 });
 const controller=new CloudflareMediaController({storage:f.storage,container:f.container},f.env,nativeLike,()=>now);
 await controller.alarm();expect(f.container.start).toHaveBeenCalledOnce();
});
it('diagnostique une erreur HTTP sans révéler le corps ni la clé',async()=>{
 const f=fixture();f.fetcher.mockResolvedValue(new Response('Donnée privée', {status:403}));await f.runner.alarm();
 const response=await f.runner.fetch(new Request('https://internal/status'));const data=await response.json();
 expect(data).toMatchObject({failureStage:'poll',httpStatus:403});expect(JSON.stringify(data)).not.toContain('Donnée privée');expect(JSON.stringify(data)).not.toContain('server-fixture');
});
