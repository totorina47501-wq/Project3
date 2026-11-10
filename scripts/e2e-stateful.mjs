// PostgREST minimal de test : SQL réel en mémoire, jamais un serveur de production.
import { randomUUID } from 'node:crypto';
import { createOfflineDatabase } from './test-sql-offline.mjs';
export const FIXTURE_SERVICE_KEY = 'offline-service-fixture';
const tables = new Set(['users','user_preferences','verifications','brand_deals','brand_deal_verifications','social_accounts','subscriptions','media_assets','media_processing_jobs','media_processing_inputs']);
const functions = {
  studio_execute: [['p_actor','uuid'],['p_workspace','uuid'],['p_action','text'],['p_payload','jsonb']],
  studio_execute_api: [['p_hash','text'],['p_action','text'],['p_payload','jsonb']],
  save_brand_deal: [['p_id','uuid'],['p_brand_name','text'],['p_start_date','date'],['p_end_date','date'],['p_contract_url','text'],['p_verification_ids','uuid[]']],
  archive_brand_deal: [['p_id','uuid']], delete_brand_deal_draft: [['p_id','uuid']],
  media_job_enqueue: [['p_user','uuid'],['p_assets','uuid[]'],['p_caption','text'],['p_platform','public.social_platform'],['p_analysis','jsonb']],
  media_job_cancel: [['p_user','uuid'],['p_job','uuid']],
};
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control':'no-store', ...headers } });
export function createStatefulFixture({ users, sessionFor }) {
  let database, tail = Promise.resolve();
  const db = () => database ??= createOfflineDatabase();
  async function exclusive(operation) {
    const previous = tail; let release;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await operation(await db()); } finally { release(); }
  }
  return {
    async close() { await tail; if (database) await (await database).close(); },
    async handle(request, identity) {
      const url = new URL(request.url);
      if (url.pathname === '/__fixture__/scenarios') {
        if (request.method !== 'POST' || request.headers.get('x-mentioncheck-fixture') !== 'local-only') return json({ error:'Fixture privée.' },403);
        return exclusive(async connection => {
          const actors = {}, verificationIds = {};
          for (const role of ['owner','member','outsider']) {
            const id = randomUUID(), email = `${role}-${id}@example.test`;
            const user = { id, aud:'authenticated', role:'authenticated', email, email_confirmed_at:new Date().toISOString(),
              app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:new Date().toISOString() };
            users.set(id,user);
            await connection.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email]);
            await connection.query("update public.users set plan=$2::public.account_plan where id=$1",[id,role==='owner'?'studio':'solo']);
            // Un profil Studio historique seul ne suffit plus : abonnement fictif
            // strictement dans PostgreSQL WASM local, jamais chez Stripe/Supabase.
            if(role==='owner')await connection.query(
              `insert into public.subscriptions(user_id,stripe_subscription_id,plan,status,current_period_end)
                values($1,$2,'studio','active',now()+interval '30 days')`,
              [id,'sub_fixture_offline_'+id.replaceAll('-','')],
            );
            const verification = randomUUID(); verificationIds[role] = verification;
            await connection.query(`insert into public.verifications(id,user_id,platform,content_text,ai_score,ai_risk_level,hash_sha256,status,completed_at)
              values($1,$2,'instagram','PUBLICITÉ — Fixture privée',100,'low',$3,'completed',now())`,[verification,id,'a'.repeat(64)]);
            actors[role] = { id,email,session:sessionFor(user) };
          }
          return json({actors,verificationIds},201);
        });
      }
      if (!url.pathname.startsWith('/rest/v1/')) return null;
      const service = request.headers.get('authorization') === `Bearer ${FIXTURE_SERVICE_KEY}`;
      if (!service && !identity) return json({message:'Session locale requise.'},401);
      return exclusive(async connection => {
        await connection.exec('begin');
        try {
          await connection.exec(service?'set local role service_role':'set local role authenticated');
          await connection.query("select set_config('request.jwt.claim.sub',$1,true)",[identity?.id ?? '']);
          const name = url.pathname.slice('/rest/v1/'.length);
          let response;
          if (name.startsWith('rpc/')) {
            const fn = name.slice(4), params = functions[fn];
            if (!params || request.method !== 'POST') { await connection.exec('rollback'); return json({message:'RPC locale absente.'},404); }
            const input = await request.json();
            const args = params.map(([key,type]) => type==='jsonb' ? JSON.stringify(input[key] ?? {}) : input[key] ?? null);
            const sql = `select public.${fn}(${params.map(([,type],i)=>`$${i+1}::${type}`).join(',')}) as result`;
            response = json((await connection.query(sql,args)).rows[0].result);
          } else {
            if (!tables.has(name) || !['GET','HEAD'].includes(request.method)) { await connection.exec('rollback'); return json({message:'Table ou mutation locale absente.'},405); }
            const fields = (url.searchParams.get('select') ?? '*').split(/,(?![^()]*\))/);
            const args = [], clauses = [], push = value => { args.push(value); return `$${args.length}`; };
            for (const [key,value] of url.searchParams) {
              if (['select','order','limit','offset'].includes(key)) continue;
              if (!/^[a-z_][a-z0-9_]*$/.test(key)) throw new Error('Filtre local invalide.');
              if (value==='not.is.null') clauses.push(`"${key}" is not null`);
              else if (value==='is.null') clauses.push(`"${key}" is null`);
              else if (value.startsWith('eq.')) clauses.push(`"${key}"=${push(value.slice(3))}`);
              else if (value.startsWith('ilike.')) clauses.push(`"${key}" ilike ${push(value.slice(6))}`);
              else if (value.startsWith('gte.')) clauses.push(`"${key}">=${push(value.slice(4))}`);
              else if (value.startsWith('lte.')) clauses.push(`"${key}"<=${push(value.slice(4))}`);
              else throw new Error('Opérateur local non implémenté.');
            }
            const where = clauses.length ? ` where ${clauses.join(' and ')}` : '';
            const columns = fields.map(field => {
              if (field==='brand_deal_verifications(verification_id)' && name==='brand_deals') return `(select coalesce(jsonb_agg(jsonb_build_object('verification_id',b.verification_id)),'[]') from public.brand_deal_verifications b where b.deal_id=brand_deals.id) as brand_deal_verifications`;
              if (field==='*') return '*';
              if (!/^[a-z_][a-z0-9_]*$/.test(field)) throw new Error('Projection locale non implémentée.');
              return `"${field}"`;
            }).join(',');
            const count = Number((await connection.query(`select count(*) as n from public.${name}${where}`,args)).rows[0].n);
            const orderRaw = url.searchParams.get('order') ?? '';
            const order = orderRaw ? ' order by '+orderRaw.split(',').map(item => {
              const [field,direction] = item.split('.');
              if (!/^[a-z_][a-z0-9_]*$/.test(field) || !['asc','desc'].includes(direction)) throw new Error('Tri local invalide.');
              return `"${field}" ${direction}`;
            }).join(',') : '';
            const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000);
            if (!Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(limit) || limit<1 || limit>1000) throw new Error('Pagination locale invalide.');
            const rows = (await connection.query(`select ${columns} from public.${name}${where}${order} limit ${limit} offset ${offset}`,args)).rows;
            const headers = {'Content-Range':rows.length?`${offset}-${offset+rows.length-1}/${count}`:`*/${count}`};
            const single = request.headers.get('accept')?.includes('application/vnd.pgrst.object+json');
            if (single && rows.length!==1) response=json({code:'PGRST116',message:'Objet local non unique.'},406,headers);
            else if (request.method==='HEAD') response=new Response(null,{status:200,headers});
            else response=json(single?rows[0]:rows,200,headers);
          }
          await connection.exec('commit'); return response;
        } catch (error) {
          await connection.exec('rollback');
          const status = error.code==='42501'?403:error.code==='P0002'?404:['23514','23505'].includes(error.code)?409:400;
          return json({code:error.code ?? 'FIXTURE_SQL',message:'Requête SQL locale refusée.'},status);
        }
      });
    },
  };
}
