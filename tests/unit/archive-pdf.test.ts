import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildArchivePdf } from '../../lib/archive/pdf';
import type { ArchivePdfData } from '../../lib/archive/pdf';

const example: ArchivePdfData = {
  id: '3a83817f-dadc-478c-889e-2a3721525a76',
  platform: 'instagram',
  createdAt: '2026-11-04T00:10:00Z',
  completedAt: '2026-11-04T00:11:00Z',
  status: 'accepted',
  originalCaption: 'J’adore cette crème ! #Collaboration — réduction 20 %.',
  acceptedCaption: 'Publicité — J’adore cette crème ! #sponsorisé',
  score: 45,
  riskLevel: 'high',
  sha256: '0123456789abcdef'.repeat(4),
  promptVersion: 'v1.1',
  violations: [{
    code:'R1',title:'Mention absente',explanation:'La publicité doit être claire.',
    source:'Loi 2023-451, art. 5-2',
  }],
};
describe('Export PDF non certifié des archives', () => {
  it('génère un PDF relisible, en conservant les accents courants', async () => {
    const bytes = await buildArchivePdf(example);
    expect(Array.from(bytes.slice(0, 5))).toEqual([37, 80, 68, 70, 45]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPages().length).toBeGreaterThan(0);
    expect(pdf.getTitle()).toContain('MentionCheck');
  });
  it('gère les textes longs sans dépasser une page', async () => {
    const bytes = await buildArchivePdf({ ...example, originalCaption:'URL'+('x'.repeat(7000)) });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPages().length).toBeGreaterThan(1);
  });
});
