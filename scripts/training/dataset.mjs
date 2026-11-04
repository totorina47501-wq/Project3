// Préparation locale uniquement : aucune dépendance réseau et aucun entraînement.
import { createHash, createHmac } from 'node:crypto';

export const DATASET_VERSION = 'mentioncheck-rewrite-v1';
const instruction = 'Réécris cette publication avec une mention publicitaire explicite et immédiatement visible. Préserve son sens et son style, sans inventer de faits.';
const digest = (value) => createHash('sha256').update(value).digest('hex');

export function redactContacts(text) {
  return text.normalize('NFC')
    .replace(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/gi, '[IBAN]')
    .replace(/https?:\/\/[^\s<>]+|\bwww\.[^\s<>]+/gi, '[LIEN]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[EMAIL]')
    .replace(/(^|\s)@[\p{L}\p{N}_.-]+/gu, '$1[COMPTE]')
    .replace(/(?:\+33|0033|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}\b/g, '[TÉLÉPHONE]')
    .trim();
}

export function prepareDataset(rows, { quarter, key }) {
  if (!/^\d{4}-Q[1-4]$/.test(quarter)) throw new Error('Trimestre attendu : AAAA-Q1 à AAAA-Q4.');
  if (!Buffer.isBuffer(key) || key.length < 32) throw new Error('Une clé locale de 32 octets minimum est obligatoire.');
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Le lot doit contenir au maximum 10 000 lignes.');
  const [year, q] = quarter.split('-Q').map(Number);
  const start = Date.UTC(year, (q - 1) * 3, 1);
  const end = Date.UTC(year, q * 3, 1);
  const identify = value => createHmac('sha256', key).update(value).digest('hex');
  const examples = [], manifest = [], seen = new Set();
  const excluded = {};
  const reject = reason => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  for (const row of rows) {
    if (!row || typeof row !== 'object' ||
        !['id', 'user_id', 'original_caption', 'accepted_caption', 'prompt_version', 'accepted_at'].every(field => typeof row[field] === 'string' && row[field].trim().length > 0)) {
      reject('invalid'); continue;
    }
    if (row.training_consent_snapshot !== true || row.current_training_consent !== true || row.erasure_requested !== false) {
      reject('consent'); continue;
    }
    if (row.review_approved !== true) { reject('review'); continue; }
    const date = Date.parse(row.accepted_at);
    if (!Number.isFinite(date) || date < start || date >= end) { reject('period'); continue; }
    const texts = [row.original_caption, row.accepted_caption];
    // Une détection de secret invalide toute la paire, même avec accord humain.
    if (texts.some(text => /(?:sk-(?:proj-)?[a-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)/i.test(text))) {
      reject('secret'); continue;
    }
    if (texts.some(text => text.length > 10000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text))) {
      reject('invalid'); continue;
    }
    const [original, accepted] = texts.map(redactContacts);
    if (!original || !accepted || original === accepted) { reject('unchanged'); continue; }
    const hash = digest(JSON.stringify([original, accepted]));
    if (seen.has(hash)) { reject('duplicate'); continue; }
    seen.add(hash);
    const subject = identify(`subject:${row.user_id}`);
    // Un même créateur reste dans un seul jeu : pas de fuite train/évaluation.
    const split = parseInt(subject.slice(0, 8), 16) % 5 === 0 ? 'validation' : 'train';
    examples.push({ messages: [
      { role: 'system', content: instruction },
      { role: 'user', content: original },
      { role: 'assistant', content: accepted },
    ] });
    manifest.push({ line: examples.length, subject, feedback: identify(`feedback:${row.id}`), split, sha256: hash });
  }
  return { examples, manifest, report: {
    version: DATASET_VERSION, quarter, received: rows.length, accepted: examples.length, excluded,
    train: manifest.filter(item => item.split === 'train').length,
    validation: manifest.filter(item => item.split === 'validation').length,
    requiresFinalHumanReview: true, trainingStarted: false,
  } };
}
