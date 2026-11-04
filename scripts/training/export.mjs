// Entrée locale relue ; le programme ne contacte jamais Supabase ou OpenAI.
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareDataset } from './dataset.mjs';
import { signDataset, readKey } from './integrity.mjs';

export async function exportDataset(args) {
  const [inputPath, quarter, keyPath, outputPath, ...extra] = args;
  if (!inputPath || !quarter || !keyPath || !outputPath || extra.length) {
    throw new Error('Usage : npm run training:prepare -- lot.json AAAA-Q4 cle.bin dossier-nouveau');
  }
  const inputStat = await stat(inputPath);
  if (!inputStat.isFile() || inputStat.size > 20 * 1024 * 1024 ||
      (process.platform !== 'win32' && (inputStat.mode & 0o077))) {
    throw new Error('Le lot doit être un fichier privé (chmod 600), limité à 20 Mio.');
  }
  const keyStat = await stat(keyPath);
  if (keyStat.size < 32 || keyStat.size > 4096 || (process.platform !== 'win32' && (keyStat.mode & 0o077))) {
    throw new Error('La clé doit être privée (chmod 600), entre 32 et 4096 octets.');
  }
  const envelope = JSON.parse(await readFile(inputPath, 'utf8'));
  const age = Date.now() - Date.parse(envelope.captured_at);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) {
    throw new Error('Le relevé des consentements doit dater de moins de 24 heures.');
  }
  const key = await readKey(keyPath);
  const result = prepareDataset(envelope.rows, { quarter, key });
  if (!result.examples.length) throw new Error('Aucune paire admissible ; aucun fichier écrit.');
  const output = resolve(outputPath);
  // Répertoire neuf et privé : aucun écrasement d’un lot antérieur.
  await mkdir(output, { mode: 0o700 });
  const hashes = {};
  for (const split of ['train', 'validation']) {
    const lines = result.manifest.filter(item => item.split === split).map(item => result.examples[item.line - 1]);
    const content = lines.map(line => JSON.stringify(line)).join('\n') + (lines.length ? '\n' : '');
    hashes[`${split}.jsonl`] = createHash('sha256').update(content).digest('hex');
    await writeFile(join(output, `${split}.jsonl`), content, { mode: 0o600, flag: 'wx' });
  }
  const manifestBytes = JSON.stringify({ captured_at: envelope.captured_at, entries: result.manifest }, null, 2);
  await writeFile(join(output, 'manifest.json'), manifestBytes, { mode: 0o600, flag: 'wx' });
  // Ce rapport n’inclut ni texte ni identité ni secret.
  const report = { ...result.report, sha256: hashes };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
  await signDataset(output, manifestBytes, report, key);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  exportDataset(process.argv.slice(2)).then(report => console.log(JSON.stringify(report))).catch(() => {
    // Ne jamais afficher l’entrée JSON ou une erreur contenant un texte privé.
    console.error('Préparation refusée. Vérifiez les arguments, la fraîcheur du relevé, les consentements et les permissions des fichiers.');
    process.exitCode = 1;
  });
}
