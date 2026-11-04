import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('relevé SQL : consentements actuels, effacement et relecture refusée par défaut', async () => {
  const db = new PGlite();
  try {
    // Schéma réduit pour exercer la requête réelle, sans connexion distante.
    await db.exec(`
      create table public.users(id text primary key, ai_training_opt_in boolean);
      create table public.rewrite_feedback(id text, user_id text, original_caption text,
        accepted_caption text, prompt_version text, accepted_at timestamptz, training_consent_snapshot boolean);
      create table public.privacy_erasure_requests(user_id text, status text);
      insert into public.users values ('allowed',true),('revoked',false),('erasing',true);
      insert into public.rewrite_feedback values
        ('a','allowed','Original','PUBLICITÉ Original','v1.0','2026-10-01Z',true),
        ('b','revoked','Original','PUBLICITÉ Original','v1.0','2026-10-01Z',true),
        ('c','erasing','Original','PUBLICITÉ Original','v1.0','2026-10-01Z',true),
        ('d','allowed','Original','PUBLICITÉ Original','v1.0','2026-10-01Z',false);
      insert into public.privacy_erasure_requests values ('erasing','requested');
    `);
    const results = await db.exec(await readFile(new URL('./snapshot.sql', import.meta.url), 'utf8'));
    const payload = results.flatMap(result => result.rows).find(row => row.jsonb_build_object)?.jsonb_build_object;
    assert.ok(payload.captured_at);
    assert.deepEqual(payload.rows.map(row => row.id), ['a','c']);
    assert.equal(payload.rows.find(row => row.id === 'c').erasure_requested, true);
    assert.ok(payload.rows.every(row => row.review_approved === false && row.current_training_consent === true));
    const count = await db.query('select count(*)::integer as count from public.rewrite_feedback');
    assert.equal(count.rows[0].count, 4);
  } finally {
    await db.close();
  }
});
