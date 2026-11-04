import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportDataset } from './export.mjs';

test('CLI : permissions privées, JSONL valide, refus des relevés périmés et écrasements', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentioncheck-training-'));
  try {
    const input = join(dir, 'lot.json'), key = join(dir, 'key.bin'), output = join(dir, 'output');
    await writeFile(key, Buffer.alloc(32, 7), { mode: 0o600 });
    const envelope = { captured_at: new Date().toISOString(), rows: [{
      id: 'feedback-1', user_id: 'user-1', original_caption: 'Ma crème préférée.',
      accepted_caption: 'PUBLICITÉ — Ma crème préférée.', prompt_version: 'v1.0',
      accepted_at: '2026-10-15T12:00:00Z', training_consent_snapshot: true,
      current_training_consent: true, erasure_requested: false, review_approved: true,
    }] };
    await writeFile(input, JSON.stringify(envelope), { mode: 0o600 });
    const run = () => exportDataset([input, '2026-Q4', key, output]);
    const result = await run();
    assert.equal(result.accepted, 1);
    assert.equal((await stat(output)).mode & 0o777, 0o700);
    const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
    for (const split of ['train', 'validation']) {
      const path = join(output, `${split}.jsonl`);
      assert.equal((await stat(path)).mode & 0o777, 0o600);
      for (const line of (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean)) assert.equal(JSON.parse(line).messages.length, 3);
      assert.match(report.sha256[`${split}.jsonl`], /^[a-f0-9]{64}$/);
    }
    await assert.rejects(run());
    await rm(output, { recursive: true });
    envelope.captured_at = '2020-01-01T00:00:00Z';
    await writeFile(input, JSON.stringify(envelope), { mode: 0o600 });
    await assert.rejects(run());
    await assert.rejects(access(output));
  } finally {
    // Uniquement le répertoire temporaire créé par ce test, jamais une donnée distante.
    await rm(dir, { recursive: true, force: true });
  }
});
