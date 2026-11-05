import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalErasureLab, runLocalErasure } from './local-erasure.mjs';
const subject = '90000000-0000-4000-8000-000000000001';
const other = '90000000-0000-4000-8000-000000000002';
const approvals = { identityReviewed: true, retentionReviewed: true, processorsReviewed: true };
test('effacement local : dry-run, refus distant, reprise, isolation et journal sans PII', async t => {
  const lab = await createLocalErasureLab();
  try {
    await lab.seedSubject(subject); await lab.seedSubject(other);
    await lab.seedSharedAccess(subject,other);
    const requestId = await lab.request(subject);
    await t.test('refuse tout client arbitraire ou option de connexion', async () => {
      await assert.rejects(createLocalErasureLab({ url: 'postgres://interdit' }));
      await assert.rejects(runLocalErasure({}, { subjectId: subject, requestId }));
    });
    await t.test('prévisualise sans modifier les données', async () => {
      const before = await lab.inspect(subject);
      const preview = await runLocalErasure(lab, { subjectId: subject, requestId });
      assert.equal(preview.dryRun, true); assert.equal(preview.deleted, false);
      assert.deepEqual(await lab.inspect(subject), before);
    });
    await t.test('exécution exige confirmation et trois revues explicites', async () => {
      await assert.rejects(runLocalErasure(lab, { subjectId: subject, requestId, execute: true }));
      await assert.rejects(runLocalErasure(lab, { subjectId: subject, requestId, execute: true, confirmation: 'EFFACER UNIQUEMENT LA FIXTURE LOCALE', approvals: { ...approvals, retentionReviewed: false } }));
    });
    await t.test('une panne conserve les étapes terminées et peut reprendre', async () => {
      const options = { subjectId: subject, requestId, execute: true, confirmation: 'EFFACER UNIQUEMENT LA FIXTURE LOCALE', approvals };
      const failed = await runLocalErasure(lab, { ...options, failBefore: 'database' });
      assert.equal(failed.status, 'interrupted');
      assert.ok(failed.steps.includes('private_storage')); assert.ok(!failed.steps.includes('database'));
      const partial = await lab.inspect(subject);
      assert.equal(partial.sessions, 0); assert.equal(partial.privateFiles, 0); assert.equal(partial.profile, 1);
      assert.equal(partial.activeKeys, 0);
      const result = await runLocalErasure(lab, options);
      assert.equal(result.status, 'completed_local'); assert.equal(result.deleted, true);
      assert.deepEqual(result.steps, ['revoke_sessions','revoke_api_keys','withdraw_training_consent','private_storage','external_processors','database','auth_user']);
      const empty = await lab.inspect(subject); assert.equal(empty.auth, 0); assert.equal(empty.profile, 0);
      assert.equal(empty.metrics, 0); assert.equal((await lab.inspect(other)).metrics, 1);
      assert.equal((await lab.inspect(other)).profile, 1); assert.equal((await lab.inspect(other)).privateFiles, 1);
      assert.ok(!JSON.stringify(result).includes(subject)); assert.ok(!JSON.stringify(result).includes('example.test'));
      assert.deepEqual(await runLocalErasure(lab, options), result);
    });
  } finally { await lab.close(); }
});
test('une équipe possédée ou une conservation imposée bloque l’exécution locale', async () => {
  const lab = await createLocalErasureLab();
  try {
    await lab.seedSubject(subject, { ownedWorkspace: true });
    await lab.seedSubject(other, { retained: true });
    for (const id of [subject, other]) {
      const requestId = await lab.request(id);
      const result = await runLocalErasure(lab, { subjectId: id, requestId, execute: true, confirmation: 'EFFACER UNIQUEMENT LA FIXTURE LOCALE', approvals });
      assert.equal(result.status, 'blocked_local'); assert.equal(result.deleted, false);
      assert.equal((await lab.inspect(id)).auth, 1);
    }
  } finally { await lab.close(); }
});
test('reprend après effacement du profil, avant la dernière étape Auth', async () => {
  const lab=await createLocalErasureLab();
  try {
    await lab.seedSubject(subject); const requestId=await lab.request(subject);
    const options={subjectId:subject,requestId,execute:true,confirmation:'EFFACER UNIQUEMENT LA FIXTURE LOCALE',approvals};
    const interrupted=await runLocalErasure(lab,{...options,failBefore:'auth_user'});
    assert.equal(interrupted.status,'interrupted'); assert.equal((await lab.inspect(subject)).profile,0);
    assert.equal((await lab.inspect(subject)).auth,1);
    assert.equal((await runLocalErasure(lab,options)).status,'completed_local');
  }finally{await lab.close();}
});
