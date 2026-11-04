// Retrait local : nouveau lot signé, jamais de téléversement ou entraînement.
import { createHmac } from 'node:crypto';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { privateRead, readKey, sha256, signDataset, verifySignature } from './integrity.mjs';
export async function revokeDataset(args) {
  const [sourcePath, revocationsPath, keyPath, outputPath, ...extra] = args;
  if (!sourcePath || !revocationsPath || !keyPath || !outputPath || extra.length) throw new Error('Quatre chemins locaux requis.');
  const source = resolve(sourcePath), output = resolve(outputPath);
  const info = await lstat(source);
  if (!info.isDirectory() || info.isSymbolicLink() || (process.platform !== 'win32' && (info.mode & 0o077))) throw new Error('Lot source privé requis.');
  const key = await readKey(keyPath);
  const manifestBytes = await privateRead(join(source, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes), report = JSON.parse(await privateRead(join(source, 'report.json')));
  const integrity = JSON.parse(await privateRead(join(source, 'integrity.json'), 4096));
  if (!verifySignature(manifestBytes, report, integrity, key)) throw new Error('Intégrité du lot ou clé incorrecte.');
  const revocations = JSON.parse(await privateRead(revocationsPath));
  const age = Date.now() - Date.parse(revocations.captured_at);
  const list = value => Array.isArray(value) && value.length <= 10000 && value.every(id => typeof id === 'string' && id.trim() && id.length <= 200);
  if (!Number.isFinite(age) || age < 0 || age > 86400000 || revocations.review_approved !== true ||
      !list(revocations.user_ids) || !list(revocations.feedback_ids) || !(revocations.user_ids.length + revocations.feedback_ids.length)) throw new Error('Liste de retrait fraîche et revue requise.');
  const identify = value => createHmac('sha256', key).update(value).digest('hex');
  const subjects = new Set(revocations.user_ids.map(id => identify(`subject:${id}`)));
  const feedbacks = new Set(revocations.feedback_ids.map(id => identify(`feedback:${id}`)));
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== report.accepted || report.accepted > 10000) throw new Error('Manifeste incohérent.');
  const original = {};
  for (const split of ['train', 'validation']) {
    const bytes = await privateRead(join(source, `${split}.jsonl`));
    if (sha256(bytes) !== report.sha256?.[`${split}.jsonl`]) throw new Error('Jeu altéré.');
    original[split] = bytes.toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    if (original[split].length !== manifest.entries.filter(entry => entry.split === split).length) throw new Error('Nombre de lignes incohérent.');
  }
  const kept = { train: [], validation: [] }, positions = { train: 0, validation: 0 }, entries = [];
  for (const [index, entry] of manifest.entries.entries()) {
    if (!['train','validation'].includes(entry.split) || entry.line !== index + 1) throw new Error('Entrée de manifeste invalide.');
    const example = original[entry.split][positions[entry.split]++];
    if (!example?.messages || example.messages.length !== 3) throw new Error('Paire invalide.');
    if (subjects.has(entry.subject) || feedbacks.has(entry.feedback)) continue;
    kept[entry.split].push(example); entries.push({ ...entry, line: entries.length + 1 });
  }
  const hashes = {};
  // Tous les contrôles précèdent la création d’une sortie privée et neuve.
  await mkdir(output, { mode: 0o700 });
  for (const split of ['train','validation']) {
    const content = kept[split].map(example => JSON.stringify(example)).join('\n') + (kept[split].length ? '\n' : '');
    hashes[`${split}.jsonl`] = sha256(content);
    await writeFile(join(output, `${split}.jsonl`), content, { mode: 0o600, flag: 'wx' });
  }
  const nextManifest = JSON.stringify({ captured_at: revocations.captured_at, entries }, null, 2);
  const nextReport = { ...report, accepted: entries.length, train: kept.train.length, validation: kept.validation.length,
    sha256: hashes, requiresFinalHumanReview: true, trainingStarted: false,
    revocation: { removed: manifest.entries.length - entries.length, sourceManifestSha256: sha256(manifestBytes), reviewedAt: revocations.captured_at } };
  await writeFile(join(output, 'manifest.json'), nextManifest, { mode: 0o600, flag: 'wx' });
  await writeFile(join(output, 'report.json'), JSON.stringify(nextReport, null, 2), { mode: 0o600, flag: 'wx' });
  await signDataset(output, nextManifest, nextReport, key);
  return nextReport;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  revokeDataset(process.argv.slice(2)).then(report => console.log(JSON.stringify(report))).catch(() => {
    console.error('Retrait refusé : vérifie les fichiers privés, la clé, leur intégrité et la liste des révocations.'); process.exitCode = 1;
  });
}
