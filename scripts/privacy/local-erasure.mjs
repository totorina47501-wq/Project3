// Laboratoire exclusivement en mémoire. Ce module n’est importé par aucune route.
import { randomUUID } from 'node:crypto';
import { createOfflineDatabase } from '../test-sql-offline.mjs';
import { prepareErasurePlan } from '../../lib/privacy/erasure-plan.ts';
const labs = new WeakMap();
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const STEPS = ['revoke_sessions','revoke_api_keys','withdraw_training_consent','private_storage','external_processors','database','auth_user'];
const requireId = id => { if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Identifiant de fixture invalide.'); };

export async function createLocalErasureLab() {
  if (arguments.length) throw new Error('Aucune configuration de connexion n’est autorisée.');
  const db = await createOfflineDatabase();
  await db.exec(`
    create schema local_erasure;
    create table local_erasure.sessions(id uuid primary key,user_id uuid not null);
    create table local_erasure.files(id uuid primary key,user_id uuid not null,bytes bytea not null);
    create table local_erasure.retention(user_id uuid primary key);
    create table local_erasure.runs(request_id uuid primary key,subject_id uuid not null,
      steps jsonb not null default '[]',status text not null default 'prepared_local');
  `);
  const context = { db, closed: false, tail: Promise.resolve() };
  const lab = Object.freeze({
    async seedSubject(id, options = {}) {
      requireId(id); if (context.closed) throw new Error('Laboratoire fermé.');
      await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, `${id}@example.test`]);
      await db.query('update public.users set ai_training_opt_in=true where id=$1', [id]);
      await db.query('insert into local_erasure.sessions values($1,$2)', [randomUUID(), id]);
      await db.query('insert into local_erasure.files values($1,$2,$3)', [randomUUID(), id, new Uint8Array([1,2,3])]);
      await db.query("insert into public.verifications(user_id,platform,content_text) values($1,'instagram','Fixture privée locale')", [id]);
      await db.query("insert into public.ai_analyses(user_id,stage,model_used,prompt_tokens) values($1,'assistant','gpt-4o',1)", [id]);
      if (options.ownedWorkspace) await db.query("insert into public.workspaces(owner_id,name) values($1,'Équipe locale')", [id]);
      if (options.retained) await db.query('insert into local_erasure.retention values($1)', [id]);
    },
    async request(id) {
      requireId(id);
      return (await db.query('insert into public.privacy_erasure_requests(user_id) values($1) returning id', [id])).rows[0].id;
    },
    async seedSharedAccess(id, ownerId) {
      requireId(id); requireId(ownerId);
      const workspace = (await db.query("insert into public.workspaces(owner_id,name) values($1,'Autre équipe locale') returning id", [ownerId])).rows[0].id;
      await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'admin')",[workspace,id]);
      await db.query("insert into public.api_keys(workspace_id,created_by,name,token_hash,prefix,scopes) values($1,$2,'Fixture locale',$3,'mc_studio_fixture',array['checks:read'])",[workspace,id,'d'.repeat(64)]);
    },
    async inspect(id) {
      requireId(id);
      return (await db.query(`select
        (select count(*)::integer from auth.users where id=$1) as auth,
        (select count(*)::integer from public.users where id=$1) as profile,
        (select count(*)::integer from local_erasure.sessions where user_id=$1) as sessions,
        (select count(*)::integer from local_erasure.files where user_id=$1) as "privateFiles",
        (select count(*)::integer from public.verifications where user_id=$1) as verifications,
        (select count(*)::integer from public.ai_analyses where user_id=$1) as metrics,
        (select count(*)::integer from public.api_keys where created_by=$1 and revoked_at is null) as "activeKeys"`, [id])).rows[0];
    },
    async close() { await context.tail; context.closed = true; await db.close(); },
  });
  labs.set(lab, context);
  return lab;
}

export async function runLocalErasure(lab, options = {}) {
  const context = labs.get(lab);
  if (!context || context.closed) throw new Error('Fabrique locale en mémoire requise.');
  // Sérialisation pour que deux commandes ne partagent jamais une transaction.
  const previous = context.tail;
  let release; context.tail = new Promise(resolve => { release = resolve; });
  await previous;
  try { return await execute(context.db, options); }
  finally { release(); }
}

async function execute(db, { subjectId, requestId, execute = false, confirmation, approvals, failBefore } = {}) {
  requireId(subjectId); requireId(requestId);
  if (failBefore !== undefined && !STEPS.includes(failBefore)) throw new Error('Point de panne local invalide.');
  const stored = (await db.query('select * from local_erasure.runs where request_id=$1 and subject_id=$2', [requestId, subjectId])).rows[0];
  const summary = (status, steps) => ({ mode: 'local-memory-only', dryRun: false, status, deleted: status === 'completed_local', steps });
  if (stored?.status === 'completed_local') return summary(stored.status, stored.steps);
  const request = (await db.query('select id,status from public.privacy_erasure_requests where id=$1 and user_id=$2', [requestId, subjectId])).rows[0];
  if ((!request && !stored?.steps.includes('database')) || (request && !['requested','reviewing'].includes(request.status))) throw new Error('Demande locale active requise.');
  const workspaces = (await db.query('select id from public.workspaces where owner_id=$1', [subjectId])).rows;
  const plan = prepareErasurePlan(subjectId, request ?? { id: requestId, status: 'reviewing' }, { collections: { workspaces }, privateFiles: [] });
  const retained = (await db.query('select 1 from local_erasure.retention where user_id=$1', [subjectId])).rows.length > 0;
  if (!execute) return { ...plan, mode: 'local-memory-only', blockers: [...plan.blockers, ...(retained ? ['retention_local_hold'] : [])] };
  if (confirmation !== 'EFFACER UNIQUEMENT LA FIXTURE LOCALE' ||
      !approvals || approvals.identityReviewed !== true || approvals.retentionReviewed !== true || approvals.processorsReviewed !== true) {
    throw new Error('Confirmation locale et revues explicites requises.');
  }
  if (workspaces.length || retained) return summary('blocked_local', []);
  await db.query('insert into local_erasure.runs(request_id,subject_id) values($1,$2) on conflict do nothing', [requestId, subjectId]);
  const steps = [...(stored?.steps ?? [])];
  for (const step of STEPS) {
    if (steps.includes(step)) continue;
    if (step === failBefore) {
      await db.query("update local_erasure.runs set status='interrupted' where request_id=$1", [requestId]);
      return summary('interrupted', steps);
    }
    await db.exec('begin');
    try {
      switch (step) {
        // Sessions et octets sont des fixtures mémoire : aucun SDK Auth/Storage.
        case 'revoke_sessions': await db.query('delete from local_erasure.sessions where user_id=$1', [subjectId]); break;
        case 'revoke_api_keys':
          await db.query('update public.api_keys set revoked_at=now() where created_by=$1 and revoked_at is null', [subjectId]);
          await db.query('update public.workspace_invitations set revoked_at=now() where created_by=$1 and revoked_at is null', [subjectId]); break;
        case 'withdraw_training_consent': await db.query('update public.users set ai_training_opt_in=false where id=$1', [subjectId]); break;
        case 'private_storage': await db.query('delete from local_erasure.files where user_id=$1', [subjectId]); break;
        case 'external_processors':
          // La revue est une condition d’exécution, jamais un faux appel fournisseur.
          break;
        case 'database':
          await db.query('delete from public.brand_deal_verifications where user_id=$1', [subjectId]);
          await db.query('delete from public.brand_deals where user_id=$1', [subjectId]);
          await db.query('delete from public.media_processing_jobs where user_id=$1', [subjectId]);
          await db.query('delete from public.api_keys where created_by=$1', [subjectId]);
          await db.query('delete from public.workspace_verifications where created_by=$1', [subjectId]);
          await db.query('delete from public.users where id=$1', [subjectId]); break;
        case 'auth_user': await db.query('delete from auth.users where id=$1', [subjectId]); break;
      }
      steps.push(step);
      await db.query('update local_erasure.runs set steps=$2::jsonb,status=$3 where request_id=$1',
        [requestId, JSON.stringify(steps), step === 'auth_user' ? 'completed_local' : 'processing_local']);
      await db.exec('commit');
    } catch {
      await db.exec('rollback');
      await db.query("update local_erasure.runs set status='interrupted' where request_id=$1", [requestId]);
      return summary('interrupted', steps.filter(item => item !== step));
    }
  }
  return summary('completed_local', steps);
}
