// Chemin : components/ComplianceScore.tsx
export function ComplianceScore({ score }: { score: number }) {
  const tone = score >= 80 ? 'text-emerald-700 bg-emerald-50' :
    score >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return (
    <div className={'rounded-2xl p-6 ' + tone}>
      <p className="text-sm font-bold uppercase tracking-wide">Score de conformité estimé</p>
      <strong className="mt-2 block font-heading text-6xl">{score}<span className="text-2xl">/100</span></strong>
      <p className="mt-3 text-sm">Indicateur de risques détectés, pas une certification juridique.</p>
    </div>
  );
}
