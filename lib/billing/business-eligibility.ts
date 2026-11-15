/**
 * Garde B2B précommercial : seules les données app_metadata issues de Supabase Auth
 * (administrées côté service-role, et non user_metadata) peuvent être utilisées.
 * Une déclaration utilisateur ou un simple texte d'interface ne sont jamais une preuve.
 *
 * Ce prédicat ne réalise PAS de vérification de registre, juridique ou fiscale.
 * L'opérateur doit avoir contrôlé l'entreprise et l'usage dans son activité principale
 * avant de renseigner ces champs. Aucune écriture admin n'est faite ici.
 */
const MAX_REVIEW_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function isVerifiedFrenchProfessionalBuyer(appMetadata: unknown, now = Date.now()): boolean {
  if (!appMetadata || typeof appMetadata !== 'object' || Array.isArray(appMetadata)) return false;
  const verification = (appMetadata as Record<string, unknown>).mentioncheck_b2b;
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) return false;
  const claim = verification as Record<string, unknown>;
  if (claim.verified !== true ||
      claim.country !== 'FR' ||
      claim.purchase_purpose !== 'core_professional_activity' ||
      claim.reviewed_by !== 'operator') return false;
  if (typeof claim.legal_name !== 'string' || claim.legal_name.trim().length < 2 ||
      typeof claim.registration_id !== 'string' ||
      !/^(?:\d{9}|\d{14})$/.test(claim.registration_id)) return false;
  if (typeof claim.reviewed_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(claim.reviewed_at)) return false;
  const reviewed = Date.parse(claim.reviewed_at);
  return Number.isFinite(reviewed) && Number.isFinite(now) &&
    reviewed <= now && now - reviewed <= MAX_REVIEW_AGE_MS;
}
