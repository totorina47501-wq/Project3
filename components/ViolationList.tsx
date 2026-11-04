// Chemin : components/ViolationList.tsx
import type { Violation } from '@/lib/ai/schemas';

export function ViolationList({ violations }: { violations: Violation[] }) {
  return (
    <section>
      <h3 className="font-heading text-xl font-bold">Points à vérifier</h3>
      {!violations.length ? (
        <p className="mt-3 text-emerald-700">Aucune violation déterministe détectée.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {violations.map((violation, index) => (
            <li key={violation.code + index} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <strong>{violation.code} — {violation.title}</strong>
              <p className="mt-1 text-sm text-slate-700">{violation.explanation}</p>
              <p className="mt-2 text-xs text-slate-500">{violation.source}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
