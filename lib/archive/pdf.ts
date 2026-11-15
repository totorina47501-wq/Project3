// Chemin : lib/archive/pdf.ts
// Export documentaire non certifié : la signature et l'horodatage probant
// demandent des prestataires spécialisés distincts.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { creatorMediaKitSchema, type CreatorMediaKit } from '../brand-deals/model';

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

export type RegistryPdfEntry={
  id:string;brand_name:string;start_date:string;end_date:string|null;
  archived_at:string|null;hash_sha256:string|null;
};
// Étend les exports documentaires existants ; aucun certificat n'est émis.
export async function buildRegistryPdf(records:RegistryPdfEntry[]):Promise<Uint8Array> {
  const document=await PDFDocument.create();
  document.setTitle('MentionCheck - Registre des collaborations');
  document.setAuthor('MentionCheck');
  document.setSubject('Registre informatif non certifie');
  const regular=await document.embedFont(StandardFonts.Helvetica);
  const bold=await document.embedFont(StandardFonts.HelveticaBold);
  let page:PDFPage;
  let y=0;
  function line(text:string,heading=false) {
    const font=heading?bold:regular,size=heading?12:10;
    // Découpage par caractère pour éviter le dépassement des longs UUID/SHA-256.
    for(const paragraph of safeText(text).split(/\n/)) {
      let remaining=paragraph;
      do {
        if(y<60){page=document.addPage([595.28,841.89]);y=795;}
        let length=remaining.length;
        while(length>1 && font.widthOfTextAtSize(remaining.slice(0,length),size)>500)length--;
        page.drawText(remaining.slice(0,length),{x:46,y,size,font,color:rgb(.13,.17,.26)});
        y-=17;remaining=remaining.slice(length);
      }while(remaining.length);
    }
  }
  line('MentionCheck - Registre des collaborations',true);
  line('Document informatif non certifie. '+records.length+' collaboration(s).');
  line('Empreinte SHA-256 et horodatage interne : aucune signature qualifiee ni horodatage de confiance.');
  line('Les fichiers de contrats et les medias ne sont pas incorpores au PDF.');
  if(records.length===0)line('Aucun resultat pour les filtres appliques.');
  for(const row of records) {
    line('');line(row.brand_name,true);line('Identifiant : '+row.id);
    line('Du '+row.start_date+(row.end_date?' au '+row.end_date:''));
    line(row.archived_at?'Archivee UTC : '+row.archived_at:'Brouillon - non archive');
    line('SHA-256 : '+(row.hash_sha256??'non disponible'));
  }
  const pages=document.getPages();
  pages.forEach((current,index)=>current.drawText('MentionCheck - Informatif - Page '+(index+1)+'/'+pages.length,{x:46,y:29,font:regular,size:9}));
  return document.save();
}

export async function buildCreatorMediaKitPdf(input:CreatorMediaKit):Promise<Uint8Array> {
  const data=creatorMediaKitSchema.parse(input);
  const document=await PDFDocument.create();
  document.setTitle('Media kit créateur');
  document.setAuthor('MentionCheck');
  document.setSubject('Présentation déclarative non certifiée');
  const regular=await document.embedFont(StandardFonts.Helvetica);
  const bold=await document.embedFont(StandardFonts.HelveticaBold);
  const width=595.28,height=841.89,margin=46;
  let page:PDFPage;
  let y=0;
  function newPage() {
    page=document.addPage([width,height]);
    y=height-margin;
  }
  function line(text:string,font:PDFFont=regular,size=10.5,leading=16) {
    if(y-leading<58)newPage();
    page.drawText(safeText(text),{x:margin,y,size,font,color:rgb(.13,.17,.26)});
    y-=leading;
  }
  function paragraph(text:string) {
    const allowed=width-margin*2,size=10.5;
    for(const sourceLine of safeText(text).split(/\n/)) {
      let current='';
      for(const token of sourceLine.split(/\s+/)) {
        const proposed=current?current+' '+token:token;
        if(regular.widthOfTextAtSize(proposed,size)<=allowed){current=proposed;continue;}
        if(current){line(current);current='';}
        let part='';
        for(const character of token) {
          if(regular.widthOfTextAtSize(part+character,size)>allowed&&part){line(part);part='';}
          part+=character;
        }
        current=part;
      }
      line(current);
    }
    y-=6;
  }

  newPage();
  line(data.include_creator_name&&data.creator_name?data.creator_name:'Kit média',bold,22,32);
  paragraph('Présentation préparée par le créateur. Les informations sont déclaratives et ne constituent ni une vérification ni une certification.');
  if(data.include_description&&data.description) {
    line('À propos',bold,13,22);
    paragraph(data.description);
  }
  if(data.include_niches&&data.niches.length) {
    line('Niches',bold,13,22);
    paragraph(data.niches.join(' · '));
  }
  if(data.include_formats&&data.formats.length) {
    line('Formats proposés',bold,13,22);
    paragraph(data.formats.join(' · '));
  }
  if(data.include_public_links&&data.public_links.length) {
    line('Liens publics fournis',bold,13,22);
    for(const link of data.public_links)paragraph(link);
  }
  if(data.include_contact_email&&data.contact_email) {
    line('Contact',bold,13,22);
    paragraph(data.contact_email);
  }
  if(data.include_contact_url&&data.contact_url) {
    if(!(data.include_contact_email&&data.contact_email))line('Contact',bold,13,22);
    paragraph(data.contact_url);
  }
  const pages=document.getPages();
  pages.forEach((current,index)=>current.drawText('MentionCheck - Média kit informatif - Page '+(index+1)+'/'+pages.length,{
    x:margin,y:29,font:regular,size:9,color:rgb(.45,.47,.53),
  }));
  return document.save();
}
