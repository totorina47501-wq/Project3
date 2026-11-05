// Offline operator step. No API calls and no writes to Supabase.
import { readFile, writeFile } from 'node:fs/promises';
import { buildApprovedManifest } from './approved-manifest.mjs';

try {
  const review = JSON.parse(await readFile('mia-review.pending-approval.json', 'utf8'));
  const approvals = JSON.parse(await readFile('mia-approvals.local.json', 'utf8'));
  const manifest = buildApprovedManifest(review.reviewed, approvals.approvals);
  await writeFile('mia-approved-manifest.local.json', JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  console.log('Approved documents prepared for manual import:', manifest.documents.length);
} catch {
  console.error('Review or approval invalid. Nothing was imported.');
  process.exitCode = 1;
}
