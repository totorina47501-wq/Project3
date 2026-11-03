// Chemin : lib/archive/pdf.ts
// Export documentaire non certifié : la signature et l'horodatage probant
// demandent des prestataires spécialisés distincts.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type ArchivePdfData = {
  id: string;
  platform: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  originalCaption: string;
  acceptedCaption: string | null;
  score: number | null;
  riskLevel: string | null;
  sha256: string | null;
  promptVersion: string | null;
  violations: Array<{ code: string; title: string; explanation: string; source: string }>;
};

function safeText(input: string): string {
  // Fontes standards PDF WinAnsi : convertir seulement les caractères non
  // représentables ; les accents latins habituels sont conservés.
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[œŒ]/g, (char) => char === 'œ' ? 'oe' : 'OE')
    .replace(/[–—−]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[…]/g, '...')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
}

export async function buildArchivePdf(report: ArchivePdfData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle('MentionCheck - Rapport de verification ' + report.id);
  document.setAuthor('MentionCheck');
  document.setSubject('Synthese de controle documentaire non certifiee');
  document.setKeywords(['MentionCheck', 'transparence', 'rapport', 'non certifie']);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28, height = 841.89, margin = 46;
  let page: PDFPage;
  let y = 0;

  function newPage() {
    page = document.addPage([width, height]);
    y = height - margin;
  }
  function ensure(lines = 1, leading = 17) {
    if (y - lines * leading < 65) newPage();
  }
  function drawLine(text: string, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>;
    indent?: number; leading?: number } = {}) {
    const font = options.font ?? regular;
    const size = options.size ?? 11;
    const leading = options.leading ?? 17;
    ensure(1, leading);
    if (text.trim()) page.drawText(safeText(text), {
      x: margin + (options.indent ?? 0), y, size, font, color: options.color ?? rgb(0.13, 0.17, 0.26),
    });
    y -= leading;
  }
  function paragraph(text: string, options: { font?: PDFFont; size?: number; indent?: number } = {}) {
    const font = options.font ?? regular, size = options.size ?? 10.5;
    const indent = options.indent ?? 0;
    const allowed = width - margin * 2 - indent;
    for (const originalLine of safeText(text).split(/\n/)) {
      const tokens = originalLine.split(/\s+/);
      let current = '';
      for (const token of tokens) {
        const proposed = current ? current + ' ' + token : token;
        if (font.widthOfTextAtSize(proposed, size) <= allowed) {
          current = proposed;
          continue;
        }
        if (current) { drawLine(current, { font, size, indent }); current = ''; }
        // La légende peut contenir de longs liens ou codes sans espaces.
        let part = '';
        for (const letter of token) {
          if (font.widthOfTextAtSize(part + letter, size) > allowed && part) {
            drawLine(part, { font, size, indent }); part = '';
          }
          part += letter;
        }
        current = part;
      }
      drawLine(current, { font, size, indent });
    }
    y -= 6;
  }
  function heading(title: string) {
    y -= 9;
    ensure(2, 19);
    drawLine(title, { font: bold, size: 13, color: rgb(0.24, 0.23, 0.78), leading: 23 });
  }

  newPage();
  drawLine('MentionCheck', { font: bold, size: 22, color: rgb(0.24, 0.23, 0.78), leading: 31 });
  drawLine('RAPPORT DE VERIFICATION - NON CERTIFIE', { font: bold, size: 11, leading: 21 });
  paragraph('Ce document contient un resume de controle automatise et/ou assiste par IA. Il ne constitue ni une certification juridique, ni une preuve horodatee par tiers de confiance.');
  heading('Identification');
  paragraph('Verification : ' + report.id);
  paragraph('Plateforme : ' + report.platform);
  paragraph('Date de creation UTC : ' + report.createdAt);
  if (report.completedAt) paragraph('Date de fin UTC : ' + report.completedAt);
  paragraph('Etat : ' + report.status);
  paragraph('Score indicatif : ' + (report.score === null ? 'non disponible' : report.score + '/100'));
  paragraph('Niveau de risque : ' + (report.riskLevel ?? 'non calcule'));
  heading('Publication originale');
  paragraph(report.originalCaption);
  if (report.acceptedCaption) {
    heading('Version acceptee par le createur');
    paragraph(report.acceptedCaption);
  }
  heading('Points de controle signales');
  if (report.violations.length === 0) paragraph('Aucun signalement enregistre.');
  for (const item of report.violations) {
    paragraph(item.code + ' - ' + item.title, { font: bold });
    paragraph(item.explanation);
    paragraph('Reference : ' + item.source, { size: 9 });
  }
  heading('Integrite et limites');
  paragraph('SHA-256 des donnees canoniques de verification : ' + (report.sha256 ?? 'non disponible'), { size: 9 });
  paragraph('Version du moteur : ' + (report.promptVersion ?? 'non disponible'));
  paragraph('L empreinte enregistree couvre les donnees canoniques de la verification, pas necessairement les octets originaux de chaque media. Aucune signature electronique qualifiee ou horodatage de confiance n est emis.');
  const pages = document.getPages();
  for (let i = 0; i < pages.length; i++) {
    const currentPage = pages[i];
    if (!currentPage) continue;
    currentPage.drawText('MentionCheck - Rapport informatif - Page ' + (i + 1) + '/' + pages.length, {
      x: margin, y: 29, font: regular, size: 9, color: rgb(0.45, 0.47, 0.53),
    });
  }
  return document.save();
}
