import type { ErasureStatus } from './erasure';

type Inventory = { collections: Record<string, unknown[]>; privateFiles: unknown[] };
// Capacité volontairement limitée à préparer. Aucune dépendance Storage/Auth/delete.
export function prepareErasurePlan(userId: string,
  request: { id: string; status: ErasureStatus }, inventory: Inventory,
  options: { execute?: boolean } = {},
) {
  if (options.execute) throw new Error('Exécution destructive désactivée.');
  if (!userId || !request.id || !['requested','reviewing'].includes(request.status))
    throw new Error('Une demande active est requise.');
  const ownedWorkspaces = inventory.collections.workspaces ?? [];
  return {
    schemaVersion: '2026-11-04', requestId: request.id, userId,
    dryRun: true as const, deleted: false as const, status: 'prepared_disabled' as const,
    blockers: [
      'operator_identity_review_required', 'retention_review_required',
      'external_processors_require_manual_review', 'destructive_executor_not_implemented',
      ...(ownedWorkspaces.length ? ['owned_workspaces_require_transfer'] : []),
    ],
    counts: Object.fromEntries(Object.entries(inventory.collections).map(([name, rows])=>[name,rows.length])),
    privateFiles: inventory.privateFiles,
    steps: [
      {kind:'revoke_sessions',state:'pending',note:'Révoquer les sessions et traiter les JWT encore valides avant effacement.'},
      {kind:'revoke_api_keys',state:'pending',note:'Révoquer les clés émises par ce compte, sans supprimer les données privées des autres membres.'},
      {kind:'withdraw_training_consent',state:'pending',note:'Retirer le consentement et exclure tous les feedbacks futurs et existants.'},
      {kind:'private_storage',state:'pending',note:'Supprimer par API Storage uniquement après contrôle propriétaire et conservation.'},
      {kind:'external_processors',state:'pending',note:'Vérifier Stripe, OpenAI, Vault, journaux, sauvegardes et obligations de conservation.'},
      {kind:'database',state:'pending',note:'Transférer les équipes possédées ; traiter liens de preuves et lignes personnelles dans une transaction revue.'},
      {kind:'auth_user',state:'pending',note:'Dernière étape après vérifications externes ; ne jamais clore sur simple planification.'},
    ],
  };
}
