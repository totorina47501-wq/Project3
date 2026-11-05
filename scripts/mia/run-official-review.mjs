// Phase 2, volontairement manuelle : produit une revue locale, sans écrire dans Supabase.
import { readFile, writeFile } from 'node:fs/promises';
import { reviewOfficialCandidates } from './review-official.mjs';

try {
  const input = JSON.parse(await readFile('mia-candidates.pending-review.json', 'utf8'));
  if (!Array.isArray(input.candidates)) throw new Error('Format invalide');
  const reviewed = await reviewOfficialCandidates(input.candidates);
  await writeFile('mia-review.pending-approval.json', JSON.stringify({
    generatedAt: new Date().toISOString(), reviewed,
    notice: 'Prévisualisations non approuvées. Vérifier texte, version, droits et date avant import.',
  }, null, 2), { mode: 0o600 });
  console.log('Prévisualisations à examiner :', reviewed.length);
} catch {
  console.error('Revue impossible ; aucune écriture distante.');
  process.exitCode = 1;
}
