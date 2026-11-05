// Exécution opt-in en local ou CI : MIA_OFFICIAL_SITEMAPS contient les URL XML approuvées.
import { writeFile } from 'node:fs/promises';
import { collectOfficialCandidates } from './collect-official.mjs';

const feeds = (process.env.MIA_OFFICIAL_SITEMAPS ?? '').split(',').map(x=>x.trim()).filter(Boolean);
if (!feeds.length) {
  console.error('Configurer MIA_OFFICIAL_SITEMAPS avec des flux XML officiels vérifiés.');
  process.exitCode = 2;
} else {
  try {
    const candidates = await collectOfficialCandidates({ feeds });
    await writeFile('mia-candidates.pending-review.json', JSON.stringify({
      generatedAt: new Date().toISOString(), candidates,
      notice: 'Découvertes uniquement : aucune source approuvée ni indexée automatiquement.',
    }, null, 2), { flag: 'w', mode: 0o600 });
    console.log('Candidats à examiner :', candidates.length);
  } catch {
    console.error('Collecte échouée ; aucun document publié.');
    process.exitCode = 1;
  }
}
