export type LeadMagnetSource = {
  label: string;
  url: string;
  checkedAt: string;
};

export const LEAD_MAGNET_FILENAME = 'mentioncheck-checklist-influence-commerciale-2026-11-10.txt';
export const LEAD_MAGNET_UPDATED_AT = '2026-11-10';
export const LEAD_MAGNET_SOURCES: LeadMagnetSource[] = [
  {
    label: 'Légifrance — Loi n° 2023-451 du 9 juin 2023 (version en vigueur consultée)',
    url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000047663185/2026-09-06',
    checkedAt: '2026-11-10',
  },
  {
    label: 'Ministère de l\'Économie — Guide de bonne conduite, influence commerciale (juin 2026)',
    url: 'https://www.economie.gouv.fr/files/files/2026/Guide-influence-commerciale.pdf',
    checkedAt: '2026-11-10',
  },
  {
    label: 'Ministère de l\'Économie — Influenceurs : quels sont mes devoirs ?',
    url: 'https://www.economie.gouv.fr/influenceurs-quels-sont-mes-devoirs',
    checkedAt: '2026-11-10',
  },
];

const checklist = [
  'CHECKLIST OPERATIONNELLE — MENTIONS COMMERCIALES (Brouillon MentionCheck)',
  '',
  'Avertissement: information generale, pas un avis juridique ni une certification.',
  'Valider votre situation avec un professionnel du droit avant diffusion.',
  '',
  '1) Avant publication',
  '- Identifier toute contrepartie (argent, cadeaux, voyage, affiliation, commission).',
  '- Declarer explicitement le caractere commercial du contenu.',
  '- Identifier clairement la marque ou l\'annonceur concerne.',
  '- Verifier la lisibilite de la mention dans le format reel publie.',
  '',
  '2) Validation interne',
  '- Verifier les affirmations produit et conserver les elements de preuve.',
  '- Relire les obligations contractuelles et les restrictions sectorielles.',
  '- Definir les responsabilites annonceur/studio/createur avant publication.',
  '',
  '3) Points de vigilance juridiques a valider',
  '- Qualification de la contrepartie et regime applicable.',
  '- Regles specifiques au produit, a l\'audience et a la plateforme.',
  '- Modalites de conservation des preuves et obligations documentaires.',
  '',
  'Sources officielles consultees:',
  ...LEAD_MAGNET_SOURCES.map((source) => `- ${source.label} | ${source.url} | consulte le ${source.checkedAt}`),
  '',
  'Version MentionCheck: 2026-11-10',
];

export function leadMagnetText() {
  return `${checklist.join('\n')}\n`;
}
