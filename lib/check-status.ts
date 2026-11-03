// Source de vérité pour afficher les contrôles sauvegardés dans le cockpit.
// Le statut explicite en base prévaut sur l'absence de score.
export type CheckStatus = 'queued' | 'processing' | 'completed' | 'accepted' | 'kept' | 'failed';
export function isScoredCheck(record: { status: string; ai_score: number | null }): boolean {
  return ['completed', 'accepted', 'kept'].includes(record.status)
    && typeof record.ai_score === 'number';
}
export function checkLabel(status: string, score: number | null): string {
  if (status === 'failed') return 'Échec — à relancer';
  if (status === 'queued') return 'En attente';
  if (status === 'processing') return 'En traitement';
  if (['completed', 'accepted', 'kept'].includes(status)) {
    return score === null ? 'Résultat indisponible' : score + '/100';
  }
  return 'Statut indisponible';
}
