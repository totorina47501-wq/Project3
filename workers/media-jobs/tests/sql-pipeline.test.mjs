// De bout en bout : vraies migrations + PostgreSQL WASM + Sharp, aucun fournisseur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { createOfflineDatabase } from '../../../scripts/test-sql-offline.mjs';
import { runQueuedMediaJob } from '../src/queue-runner.mjs';
import { createLocalSqlMediaQueue } from '../src/sql-queue.mjs';

test('file SQL → Sharp → contrôle textuel et preuve archivée, sans IA', async t => {
  const db = await createOfflineDatabase();
  const root = await mkdtemp(join(tmpdir(), 'mentioncheck-sql-media-'));
  const owner = '80000000-0000-4000-8000-000000000001';
  const group = randomUUID(), assets = [], inputs = join(root, 'inputs'), outputs = join(root, 'outputs');
  try {
    await mkdir(join(inputs, owner), { recursive: true }); await mkdir(outputs);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [owner, 'local@example.test']);
    for (let i = 0; i < 2; i++) {
      const id = randomUUID(), path = `${owner}/${randomUUID()}.png`;
      await sharp({ create: { width: 64, height: 64, channels: 3, background: i ? 'blue' : 'red' } }).png().toFile(join(inputs, path));
      const bytes = await readFile(join(inputs, path));
      await db.query(`insert into public.media_assets(id,user_id,group_id,kind,status,storage_path,mime_type,declared_bytes,actual_bytes,completed_at,expires_at,media_sha256)
        values($1,$2,$3,'image','ready',$4,'image/png',$5,$5,now(),now()+interval '1 day',$6)`,
      [id, owner, group, path, bytes.length, createHash('sha256').update(bytes).digest('hex')]);
      assets.push(id);
    }
    const enqueue = async caption => (await db.query(`select public.media_job_enqueue($1,$2::uuid[],$3,'instagram',$4::jsonb) as id`,
      [owner, assets, caption, JSON.stringify({ score: 100, riskLevel: 'low', violations: [] })])).rows[0].id;
    const id = await enqueue('PUBLICITÉ — Test local');
    const queue = createLocalSqlMediaQueue(db);
    await t.test('le runner produit et finalise le même job sous bail SQL', async () => {
      assert.deepEqual(await runQueuedMediaJob({ queue, workerId: randomUUID(), inputRoot: inputs, outputRoot: outputs }), { state: 'completed', id });
      const { rows } = await db.query(`select j.status,j.result,v.status as verification_status,v.ai_score,v.hash_sha256,v.ai_explanation
        from public.media_processing_jobs j join public.verifications v on v.id=j.verification_id where j.id=$1`, [id]);
      assert.equal(rows[0].status, 'completed'); assert.equal(rows[0].verification_status, 'completed');
      assert.equal(rows[0].ai_score, 100); assert.match(rows[0].hash_sha256, /^[a-f0-9]{64}$/);
      assert.equal(rows[0].result.aiCalls, 0); assert.equal(rows[0].result.artifacts.length, 3);
      assert.equal(rows[0].ai_explanation.analysisMode, 'rules_only');
      assert.ok(rows[0].ai_explanation.warnings.some(text => text.includes('sans analyse visuelle IA')));
      assert.equal((await db.query('select count(*)::integer as n from public.ai_analyses')).rows[0].n, 0);
    });
    await t.test('le même contenu reprend sa preuve sans créer une nouvelle vérification', async () => {
      assert.equal(await enqueue('PUBLICITÉ — Test local'), id);
      assert.equal((await db.query('select count(*)::integer as n from public.verifications')).rows[0].n, 1);
      assert.deepEqual(await runQueuedMediaJob({ queue, workerId: randomUUID(), inputRoot: inputs, outputRoot: outputs }), { state: 'idle' });
    });
    await t.test('un job annulé ne peut ni démarrer ni produire un succès tardif', async () => {
      const cancelled = await enqueue('PUBLICITÉ — Autre légende');
      const lease = await queue.claim(randomUUID());
      assert.equal(lease.id, cancelled);
      assert.equal((await db.query('select public.media_job_cancel($1,$2) as ok', [owner, cancelled])).rows[0].ok, true);
      assert.equal(await queue.isCancelled(cancelled, lease.leaseToken), true);
      assert.equal(await queue.complete(cancelled, lease.leaseToken, {}), false);
    });
    await t.test('toutes les sources d’un carrousel restent protégées par les références SQL', async () => {
      await assert.rejects(db.query('delete from public.media_assets where id=$1', [assets[1]]), /foreign key/i);
      // Aucune mutation externe : cet échec de suppression concerne la fixture mémoire.
      assert.equal((await db.query('select count(*)::integer as n from public.media_assets')).rows[0].n, 2);
    });
    await t.test('la même file traite une vidéo FFmpeg et archive les trois frames', async () => {
      const videoId=randomUUID(),path=`${owner}/${randomUUID()}.mp4`;
      const generated=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=size=160x120:rate=6','-t','1','-c:v','mpeg4','-pix_fmt','yuv420p','-y',join(inputs,path)],{timeout:15000});
      assert.equal(generated.status,0);
      const bytes=await readFile(join(inputs,path));
      await db.query(`insert into public.media_assets(id,user_id,kind,status,storage_path,mime_type,declared_bytes,actual_bytes,completed_at,expires_at,media_sha256)
        values($1,$2,'video','ready',$3,'video/mp4',$4,$4,now(),now()+interval '1 day',$5)`,[videoId,owner,path,bytes.length,createHash('sha256').update(bytes).digest('hex')]);
      const job=(await db.query(`select public.media_job_enqueue($1,$2::uuid[],'PUBLICITÉ — Vidéo','tiktok',$3::jsonb) as id`,[owner,[videoId],JSON.stringify({score:100,riskLevel:'low',violations:[]})])).rows[0].id;
      assert.equal((await runQueuedMediaJob({queue,workerId:randomUUID(),inputRoot:inputs,outputRoot:outputs})).state,'completed');
      const result=(await db.query('select result from public.media_processing_jobs where id=$1',[job])).rows[0].result;
      assert.equal(result.aiCalls,0);assert.equal(result.artifacts.filter(a=>a.name.endsWith('.jpg')).length,3);
    });
  } finally {
    await db.close(); await rm(root, { recursive: true, force: true });
  }
});
