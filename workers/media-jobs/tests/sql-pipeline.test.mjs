// De bout en bout : vraies migrations + PostgreSQL WASM + Sharp, aucun fournisseur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
    await t.test('un bail expiré est repris avec un nouveau jeton et un seul résultat SQL', async () => {
      const expired = await enqueue('PUBLICITÉ — Bail expiré');
      const abandoned = await queue.claim(randomUUID());
      assert.equal(abandoned.id, expired);
      await db.query("update public.media_processing_jobs set lease_until=now()-interval '1 second' where id=$1", [expired]);
      assert.equal(await queue.isCancelled(expired, abandoned.leaseToken), true);
      assert.equal(await queue.complete(expired, abandoned.leaseToken, {}), false);
      assert.equal(await queue.fail(expired, abandoned.leaseToken, 'PROCESS_FAILED'), false);

      const retry = await queue.claim(randomUUID());
      assert.equal(retry.id, expired);
      assert.notEqual(retry.leaseToken, abandoned.leaseToken);
      assert.deepEqual(await runQueuedMediaJob({
        queue: {
          claim: async () => retry,
          isCancelled: queue.isCancelled,
          complete: queue.complete,
          fail: queue.fail,
        },
        workerId: randomUUID(),
        inputRoot: inputs,
        outputRoot: outputs,
      }), { state: 'completed', id: expired });

      assert.deepEqual((await db.query(`select j.status,j.attempts,
        (select count(*)::integer from public.verifications where id=j.verification_id) as verification_count
        from public.media_processing_jobs j where j.id=$1`, [expired])).rows[0],
      { status: 'completed', attempts: 2, verification_count: 1 });
    });
    await t.test('toutes les sources d’un carrousel restent protégées par les références SQL', async () => {
      await assert.rejects(db.query('delete from public.media_assets where id=$1', [assets[1]]), /foreign key/i);
      // Aucune mutation externe : cet échec de suppression concerne la fixture mémoire.
      assert.equal((await db.query('select count(*)::integer as n from public.media_assets')).rows[0].n, 2);
    });
    await t.test('un échec FFmpeg épuise les retries SQL sans dupliquer la vérification', async () => {
      const videoAsset = randomUUID(), path = `${owner}/${randomUUID()}.mp4`;
      const bytes = Buffer.from('synthetic invalid MP4');
      await mkdir(join(inputs, owner), { recursive: true });
      await writeFile(join(inputs, path), bytes);
      await db.query(`insert into public.media_assets(id,user_id,kind,status,storage_path,mime_type,declared_bytes,actual_bytes,completed_at,expires_at,media_sha256)
        values($1,$2,'video','ready',$3,'video/mp4',$4,$4,now(),now()+interval '1 day',$5)`,
      [videoAsset, owner, path, bytes.length, createHash('sha256').update(bytes).digest('hex')]);
      const caption = 'PUBLICITÉ — Échec FFmpeg';
      const enqueueVideo = async () => (await db.query(
        `select public.media_job_enqueue($1,$2::uuid[],$3,'tiktok',$4::jsonb) as id`,
        [owner, [videoAsset], caption, JSON.stringify({ score: 100, riskLevel: 'low', violations: [] })],
      )).rows[0].id;
      const failedJob = await enqueueVideo();

      for (let attempt = 1; attempt <= 3; attempt++) {
        if (attempt > 1) {
          await db.query("update public.media_processing_jobs set available_at=now()-interval '1 second' where id=$1", [failedJob]);
        }
        assert.deepEqual(await runQueuedMediaJob({ queue, workerId: randomUUID(), inputRoot: inputs, outputRoot: outputs }),
          { state: 'failed', id: failedJob, code: 'PROCESS_FAILED' });
        const row = (await db.query(`select j.status,j.attempts,j.failure_code,v.status as verification_status
          from public.media_processing_jobs j join public.verifications v on v.id=j.verification_id where j.id=$1`, [failedJob])).rows[0];
        assert.deepEqual(row, {
          status: attempt === 3 ? 'failed' : 'queued',
          attempts: attempt,
          failure_code: 'PROCESS_FAILED',
          verification_status: attempt === 3 ? 'failed' : 'queued',
        });
      }

      assert.equal(await enqueueVideo(), failedJob);
      assert.equal((await db.query('select count(*)::integer as n from public.verifications where id=(select verification_id from public.media_processing_jobs where id=$1)', [failedJob])).rows[0].n, 1);
      assert.equal((await readdir(outputs)).includes(failedJob), false);
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
