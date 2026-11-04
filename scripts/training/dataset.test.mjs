// Les fixtures ne quittent jamais le processus de test.
import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareDataset } from './dataset.mjs';

const key = Buffer.alloc(32, 7);
const row = () => ({
  id: 'feedback-1', user_id: 'user-1', original_caption: 'Découvrez cette crème.',
  accepted_caption: 'PUBLICITÉ — Découvrez cette crème.', prompt_version: 'v1.0',
  accepted_at: '2026-10-15T12:00:00Z', training_consent_snapshot: true,
  current_training_consent: true, erasure_requested: false, review_approved: true,
});
const run = (rows) => prepareDataset(rows, { quarter: '2026-Q4', key });

test('produit des messages et une provenance pseudonymisée, sans identifiant brut', () => {
  const result = run([row()]);
  assert.equal(result.examples.length, 1);
  assert.deepEqual(result.examples[0].messages.map(m => m.role), ['system', 'user', 'assistant']);
  assert.equal(result.manifest[0].line, 1);
  assert.match(result.manifest[0].subject, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result).includes('user-1'));
  assert.equal(run([row()]).manifest[0].subject, result.manifest[0].subject);
});

for (const [name, override] of [
  ['consentement actuel retiré', { current_training_consent: false }],
  ['absence de consentement initial', { training_consent_snapshot: false }],
  ['effacement demandé', { erasure_requested: true }],
  ['absence de relecture humaine', { review_approved: false }],
  ['consentement invalide', { current_training_consent: 'true' }],
  ['trimestre différent', { accepted_at: '2026-09-30T23:59:59Z' }],
  ['date invalide', { accepted_at: 'invalide' }],
  ['absence de modification', { accepted_caption: row().original_caption }],
]) {
  test(`exclut : ${name}`, () => assert.equal(run([{ ...row(), ...override }]).examples.length, 0));
}

test('masque contacts, liens, comptes sociaux, téléphones et IBAN', () => {
  const text = 'Écrivez à alice@example.fr, @alice, https://exemple.fr/alice ou +33 6 12 34 56 78. FR76 3000 6000 0112 3456 7890 189';
  const result = run([{ ...row(), original_caption: text, accepted_caption: `PUBLICITÉ — ${text}` }]);
  assert.equal(result.examples.length, 1);
  const output = JSON.stringify(result.examples);
  for (const privateValue of ['alice', 'exemple.fr', '12 34 56', '3000 6000']) assert.ok(!output.includes(privateValue));
});

test('écarte les secrets plutôt que les exporter', () => {
  assert.equal(run([{ ...row(), original_caption: 'Jeton sk-proj-abcdefghijklmnopqrstuvwxyz1234' }]).examples.length, 0);
});

test('déduplique les paires après masquage et sépare les jeux par utilisateur', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ ...row(), id: `feedback-${i}`, original_caption: `Produit ${i}`, accepted_caption: `PUBLICITÉ — Produit ${i}` }));
  const result = run([...rows, rows[0]]);
  assert.equal(result.examples.length, 10);
  assert.equal(new Set(result.manifest.map(m => m.split)).size, 1);
  assert.equal(result.report.excluded.duplicate, 1);
});

test('refuse un trimestre ou une clé inadapté', () => {
  assert.throws(() => prepareDataset([], { quarter: '2026-Q5', key }));
  assert.throws(() => prepareDataset([], { quarter: '2026-Q4', key: Buffer.alloc(3) }));
});
