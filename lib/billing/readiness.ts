import { billingGate } from './config';

// Dossier opérateur privé. Aucune valeur du dossier ni aucun secret n'est repris
// dans le résultat ; la présence d'une référence ne prouve pas sa validation.
export type CommercialReadinessInput = {
  environment?: Readonly<Record<string, string | undefined>>;
  publisher?: Partial<Record<'legalName' | 'legalForm' | 'registeredOffice' | 'registration' | 'contactEmail' | 'publicationDirector', string>>;
  terms?: Partial<Record<'version' | 'taxDisplay' | 'cancellationPolicy' | 'withdrawalPolicy' | 'disputeResolution', string>>;
  privacy?: Partial<Record<'version' | 'contactEmail' | 'retentionSchedule' | 'erasureProcedure' | 'processingRegister', string>>;
  reviews?: Partial<Record<'legal' | 'cloudflareDpa' | 'supabaseDpa' | 'openaiDpa' | 'transfers' | 'billingSandbox', string>>;
};
type CheckStatus = 'missing' | 'invalid' | 'present';
type ReadinessCheck = { field: string; label: string; status: CheckStatus; action: string };
export type CommercialReadiness = {
  mode: 'offline-diagnostic';
  readyForReview: boolean;
  canOpenCommercial: false;
  capabilities: { billing: 'disabled' | 'test-only'; email: 'preview-only'; socialAccounts: 'manual-only' };
  checks: ReadinessCheck[];
  blockers: { code: string; description: string }[];
};
function realText(value: string): boolean {
  return value.length <= 500 && !/[\x00-\x1f]/.test(value) &&
    !/^(?:à (?:compléter|renseigner|définir)|a completer|todo|tbd|placeholder|changeme|<[^>]+>)$/iu.test(value);
}
function email(value: string): boolean {
  return realText(value) && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value);
}
function httpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}

/** Diagnostic pur : ni SDK, ni réseau, ni écriture, ni activation de fournisseur. */
export function assessCommercialReadiness(input: CommercialReadinessInput = {}): CommercialReadiness {
  const env = input.environment ?? {};
  const checks: ReadinessCheck[] = [];
  function add(field: string, label: string, value: string | undefined, action: string, validate = realText) {
    const trimmed = value?.trim();
    checks.push({ field, label, status: !trimmed ? 'missing' : validate(trimmed) ? 'present' : 'invalid', action });
  }
  const publisherFields = [
    ['legalName', 'Identité juridique de l’éditeur', 'Renseigner la raison sociale ou le nom de l’exploitant ; le nom du produit ne suffit pas.'],
    ['legalForm', 'Forme juridique', 'Renseigner la forme juridique réelle de l’exploitant.'],
    ['registeredOffice', 'Adresse de l’éditeur', 'Renseigner l’adresse professionnelle publiable de l’éditeur.'],
    ['registration', 'Immatriculation', 'Renseigner l’immatriculation applicable et le registre compétent.'],
    ['contactEmail', 'Contact officiel', 'Renseigner une adresse email officielle surveillée.'],
    ['publicationDirector', 'Responsable de publication', 'Renseigner le nom du responsable de publication.'],
  ] as const;
  for (const [key, label, action] of publisherFields)
    add('publisher.' + key, label, input.publisher?.[key], action, key === 'contactEmail' ? email : realText);
  const termsFields = [
    ['version', 'Conditions contractuelles publiées', 'Renseigner la version approuvée des conditions effectivement publiées.'],
    ['taxDisplay', 'Présentation fiscale des prix', 'Confirmer « ttc » ou « ht » et adapter l’affichage au public concerné.'],
    ['cancellationPolicy', 'Résiliation et renouvellement', 'Renseigner les modalités, l’échéance et le parcours effectif de résiliation.'],
    ['withdrawalPolicy', 'Rétractation', 'Renseigner les règles de rétractation applicables à la clientèle retenue.'],
    ['disputeResolution', 'Réclamations et litiges', 'Renseigner le contact de réclamation et le dispositif de règlement des litiges applicable.'],
  ] as const;
  for (const [key, label, action] of termsFields)
    add('terms.' + key, label, input.terms?.[key], action, key === 'taxDisplay' ? value => value === 'ttc' || value === 'ht' : realText);
  const privacyFields = [
    ['version', 'Politique de confidentialité publiée', 'Renseigner la version de la politique publiée avec les traitements réellement activés.'],
    ['contactEmail', 'Contact pour les droits RGPD', 'Renseigner une adresse surveillée pour les demandes de droits.'],
    ['retentionSchedule', 'Durées de conservation', 'Référencer la matrice des durées par donnée, journal, fichier, prestataire et sauvegarde.'],
    ['erasureProcedure', 'Procédure d’effacement', 'Référencer la procédure revue : inventaire, conservation légale, fichiers, prestataires, comptes et preuve de traitement.'],
    ['processingRegister', 'Registre des traitements', 'Référencer le registre : finalités, bases légales, destinataires, durées et droits.'],
  ] as const;
  for (const [key, label, action] of privacyFields)
    add('privacy.' + key, label, input.privacy?.[key], action, key === 'contactEmail' ? email : realText);
  const reviewFields = [
    ['legal', 'Revue du dossier commercial', 'Référencer la revue des mentions légales, conditions, prix, limites et promesses.'],
    ['cloudflareDpa', 'Accord Cloudflare', 'Référencer la revue du contrat de sous-traitance Cloudflare et des services réellement utilisés.'],
    ['supabaseDpa', 'Accord Supabase', 'Référencer la revue du contrat de sous-traitance Supabase, de la région et des sauvegardes.'],
    ['openaiDpa', 'Accord OpenAI', 'Référencer la revue du contrat API OpenAI, de la conservation fournisseur et des transferts.'],
    ['transfers', 'Transferts internationaux', 'Référencer les garanties et l’analyse des transferts internationaux applicables.'],
    ['billingSandbox', 'Recette du paiement de test', 'Référencer la recette Stripe en bac à sable : souscription, changement d’offre, échec, annulation et événements rejoués.'],
  ] as const;
  for (const [key, label, action] of reviewFields)
    add('reviews.' + key, label, input.reviews?.[key], action);
  add('environment.NEXT_PUBLIC_APP_URL', 'Origine publique canonique', env.NEXT_PUBLIC_APP_URL,
    'Configurer une origine HTTPS canonique sans chemin, identifiants ni paramètres.', httpsOrigin);
  add('environment.STRIPE_MODE', 'Mode Stripe', env.STRIPE_MODE, 'Préparer uniquement le mode « test ».', value => value === 'test');
  add('environment.STRIPE_SECRET_KEY', 'Clé Stripe de test présente', env.STRIPE_SECRET_KEY,
    'Configurer une clé de test dans le gestionnaire de secrets ; ne pas la copier dans le dossier.', value => /^sk_test_[A-Za-z0-9_]+$/.test(value));
  add('environment.STRIPE_WEBHOOK_SECRET', 'Signature du webhook de test présente', env.STRIPE_WEBHOOK_SECRET,
    'Configurer le secret de signature de l’endpoint de test dans le gestionnaire de secrets.', value => /^whsec_[A-Za-z0-9_]+$/.test(value));
  const priceFields = ['STRIPE_PRICE_SOLO', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_STUDIO'] as const;
  for (const field of priceFields) {
    add('environment.' + field, 'Tarif Stripe de test ' + field.replace('STRIPE_PRICE_', ''), env[field],
      'Renseigner un identifiant de tarif de test distinct ; confirmer montant, devise, périodicité et fiscalité dans Stripe.', value =>
        /^price_[A-Za-z0-9]+$/.test(value) && priceFields.filter(other => env[other] === value).length === 1);
  }
  return {
    mode: 'offline-diagnostic', readyForReview: checks.every(check => check.status === 'present'), canOpenCommercial: false,
    capabilities: { billing: billingGate(env).enabled ? 'test-only' : 'disabled', email: 'preview-only', socialAccounts: 'manual-only' },
    checks,
    // Ces limites décrivent le code livré. Compléter un dossier n'active rien.
    blockers: [
      { code: 'BILLING_LIVE_NOT_APPROVED', description: 'Le code prépare Stripe live derrière les validations obligatoires (éditeur immatriculé, fiscalité, conditions, services IA actifs, clés live et domaine). Aucune validation d’ouverture n’est attestée.' },
      { code: 'BILLING_CARD_PAYMENT_TEST_MISSING', description: 'Checkout authentifié, portail et webhooks signés sont certifiés en Sandbox. Le paiement par carte test, SCA/3DS, facture payée, erreur de paiement et rétractation restent à contrôler.' },
      { code: 'PERSONAL_DATA_ERASURE_REVIEW', description: 'Le parcours d’effacement global et les conservations chez les prestataires doivent être opérés et validés ; la demande actuelle ne supprime rien.' },
      { code: 'EMAIL_DELIVERY_UNIMPLEMENTED', description: 'Les emails sont rendus localement ; transport, domaine expéditeur, déclencheurs, suivi et accord Resend restent à préparer avant tout envoi.' },
    ],
  };
}
