export const creatorChallengeNiches = [
  { value: 'beaute', label: 'Beauté et bien-être' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'culture', label: 'Culture et loisirs' },
  { value: 'sport', label: 'Sport et mouvement' },
  { value: 'autre', label: 'Autre sujet' },
] as const;

export const creatorChallengePlatforms = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
] as const;

export const creatorChallengeGoals = [
  { value: 'pratique', label: 'Prendre confiance en pratiquant' },
  { value: 'communaute', label: 'Échanger avec une communauté' },
  { value: 'portfolio', label: 'Préparer un portfolio' },
] as const;

export type CreatorChallengePreferences = {
  niche: (typeof creatorChallengeNiches)[number]['value'];
  platform: (typeof creatorChallengePlatforms)[number]['value'];
  goal: (typeof creatorChallengeGoals)[number]['value'];
};

export type CreatorChallengeProgress = CreatorChallengePreferences & {
  started: boolean;
  completedDays: number[];
};

export type AccountScopedCreatorChallengeProgress = {
  storageKey: string;
  progress: CreatorChallengeProgress;
};

export type CreatorChallengeMission = {
  day: number;
  week: number;
  title: string;
  detail: string;
};

export const defaultCreatorChallengeProgress: CreatorChallengeProgress = {
  started: false,
  completedDays: [],
  niche: 'autre',
  platform: 'instagram',
  goal: 'pratique',
};

export const creatorChallengeWeeks = [
  {
    week: 1,
    title: 'Clarifier ton identité et ta niche',
    missions: [
      ['Choisir un fil rouge', 'Note trois sujets de {{niche}} que tu aimes explorer, puis choisis celui qui t’intéresse le plus.'],
      ['Penser à une personne', 'Décris en une phrase à qui tu souhaites t’adresser et quel type de question cette personne pourrait avoir.'],
      ['Repérer tes forces', 'Liste trois choses que tu peux partager honnêtement : une expérience, une méthode ou une découverte.'],
      ['Relire ton profil', 'Regarde ta bio sur {{platform}}. Est-elle compréhensible et fidèle à ce que tu veux publier ?'],
      ['Choisir un objectif réaliste', 'Garde ton objectif « {{goal}} » en tête. Définis une petite action que tu contrôles, sans viser un nombre d’abonnés.'],
      ['Poser tes limites', 'Note les sujets ou informations personnelles que tu préfères ne pas publier. Tu peux aussi garder cette note hors ligne.'],
      ['Présenter ton univers', 'Écris une phrase simple qui décrit les sujets que tu partageras autour de {{niche}}. Évite les résultats garantis.'],
    ],
  },
  {
    week: 2,
    title: 'Trouver des idées et écrire',
    missions: [
      ['Noter des questions', 'Écris cinq questions courantes autour de {{niche}}, sans conserver de nom ni de message privé.'],
      ['Choisir une idée utile', 'Choisis une question et note ce que tu peux expliquer à partir de ton expérience réelle.'],
      ['Vérifier une information', 'Si ton idée contient un fait, vérifie-le auprès d’une source fiable avant de le reprendre.'],
      ['Écrire une accroche', 'Rédige une première phrase claire sur un sujet de {{niche}}, sans exagération ni promesse.'],
      ['Faire un plan court', 'Prépare un brouillon avec une idée principale, deux ou trois étapes et une conclusion.'],
      ['Choisir un format', 'Choisis un format que tu sais réaliser sur {{platform}} avec le matériel dont tu disposes déjà.'],
      ['Relire à voix haute', 'Lis ton brouillon. Simplifie les phrases difficiles et retire ce que tu ne peux pas étayer.'],
      ['Garder une prochaine idée', 'Note une autre idée à reprendre plus tard afin de ne pas dépendre d’une publication quotidienne.'],
    ],
  },
  {
    week: 3,
    title: 'Préparer une publication responsable',
    missions: [
      ['Choisir ton rythme', 'Choisis un moment réaliste pour préparer ou publier. Tu peux avancer à ton rythme, sans fréquence imposée.'],
      ['Relire les affirmations', 'Repère les conseils ou affirmations de ton brouillon et indique ce qui les appuie réellement.'],
      ['Vérifier les mentions utiles', 'S’il y a un partenariat, consulte les consignes actuelles de la plateforme et les indications applicables à ta situation.'],
      ['Soigner l’accessibilité', 'Ajoute des sous-titres si nécessaire et relis le texte à l’écran pour vérifier qu’il reste facile à suivre.'],
      ['Vérifier les autorisations', 'Confirme que tu peux utiliser les images, musiques et extraits choisis, ou remplace ceux dont les droits sont incertains.'],
      ['Retirer les promesses', 'Remplace les formulations absolues ou les résultats garantis par des faits précis et vérifiables.'],
      ['Protéger ta vie privée', 'Vérifie que ton brouillon et ton profil ne révèlent pas par inadvertance une information personnelle.'],
      ['Relire avant publication', 'Relis une dernière fois la légende et les éléments visuels. Tu peux publier toi-même ou conserver le brouillon.'],
    ],
  },
  {
    week: 4,
    title: 'Préparer un media kit et approcher une marque',
    missions: [
      ['Choisir des exemples', 'Sélectionne jusqu’à trois exemples de contenu que tu peux présenter comme ton travail. Si tu ajoutes des statistiques, relève-les toi-même depuis la plateforme et indique leur période.'],
      ['Rassembler tes liens', 'Prépare les liens publics que tu souhaites partager et vérifie qu’ils ne dévoilent rien de privé.'],
      ['Préparer ton media kit', 'Organise une présentation simple de ton univers, tes formats et tes coordonnées professionnelles facultatives.'],
      ['Trouver une marque pertinente', 'Choisis une marque dont les produits ou valeurs correspondent réellement à tes contenus. Note pourquoi.'],
      ['Lire un brief avec attention', 'Pour un brief reçu, relève les livrables, délais, droits demandés et questions à clarifier avant d’accepter.'],
      ['Rédiger une approche', 'Prépare un message personnalisé en brouillon. N’invente pas de chiffres et ne l’envoie pas automatiquement.'],
      ['Choisir la suite', 'Relis ton objectif « {{goal}} » et choisis une prochaine étape que tu peux décider toi-même. Aucun résultat n’est garanti.'],
    ],
  },
] as const;

export const creatorChallengeMissions: CreatorChallengeMission[] = creatorChallengeWeeks.flatMap(
  ({ week, missions }) => missions.map(([title, detail], index) => ({
    day: creatorChallengeWeeks.slice(0, week - 1).reduce((total, item) => total + item.missions.length, 0) + index + 1,
    week,
    title,
    detail,
  })),
);

export const creatorChallengeMissionCount = 30;
export const creatorChallengeStoragePrefix = 'mentioncheck:creator-challenge:v1:';

const nicheValues = new Set(creatorChallengeNiches.map(({ value }) => value));
const platformValues = new Set(creatorChallengePlatforms.map(({ value }) => value));
const goalValues = new Set(creatorChallengeGoals.map(({ value }) => value));

export function getCreatorChallengeStorageKey(accountHash: string): string {
  if (!/^[a-f0-9]{64}$/.test(accountHash)) {
    throw new Error('Invalid creator challenge account key.');
  }
  return `${creatorChallengeStoragePrefix}${accountHash}`;
}

export function getCreatorChallengeProgressForAccount(
  stored: AccountScopedCreatorChallengeProgress | null,
  storageKey: string,
): CreatorChallengeProgress {
  return stored?.storageKey === storageKey
    ? stored.progress
    : { ...defaultCreatorChallengeProgress };
}

export function parseCreatorChallengeProgress(value: string | null): CreatorChallengeProgress {
  if (!value || value.length > 4096) return { ...defaultCreatorChallengeProgress };

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...defaultCreatorChallengeProgress };
    }

    const record = parsed as Record<string, unknown>;
    const completedDays = Array.isArray(record.completedDays)
      ? [...new Set(record.completedDays.filter((day): day is number =>
        typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= creatorChallengeMissionCount,
      ))]
      : [];
    return {
      started: record.started === true,
      completedDays,
      niche: typeof record.niche === 'string' && nicheValues.has(record.niche as CreatorChallengeProgress['niche'])
        ? record.niche as CreatorChallengeProgress['niche']
        : defaultCreatorChallengeProgress.niche,
      platform: typeof record.platform === 'string' && platformValues.has(record.platform as CreatorChallengeProgress['platform'])
        ? record.platform as CreatorChallengeProgress['platform']
        : defaultCreatorChallengeProgress.platform,
      goal: typeof record.goal === 'string' && goalValues.has(record.goal as CreatorChallengeProgress['goal'])
        ? record.goal as CreatorChallengeProgress['goal']
        : defaultCreatorChallengeProgress.goal,
    };
  } catch {
    return { ...defaultCreatorChallengeProgress };
  }
}

export function personalizeCreatorChallengeMission(
  mission: CreatorChallengeMission,
  preferences: CreatorChallengePreferences,
): CreatorChallengeMission {
  const niche = creatorChallengeNiches.find((item) => item.value === preferences.niche)?.label ?? 'ton sujet';
  const platform = creatorChallengePlatforms.find((item) => item.value === preferences.platform)?.label ?? 'ta plateforme';
  const goal = creatorChallengeGoals.find((item) => item.value === preferences.goal)?.label ?? 'ton objectif';
  return {
    ...mission,
    detail: mission.detail
      .replaceAll('{{niche}}', niche)
      .replaceAll('{{platform}}', platform)
      .replaceAll('{{goal}}', goal),
  };
}
