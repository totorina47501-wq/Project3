// Conserver le composant existant, mais ne jamais exposer une collecte
// qui ne dispose pas d'une persistance et d'un effacement durables.
export function LeadFeedbackForm({ origin }: { origin: 'landing' | 'guide' }) {
  return (
    <section aria-labelledby={`feedback-${origin}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id={`feedback-${origin}`} className="font-heading text-2xl font-bold text-primary">
        Retour communautaire volontaire
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        La collecte des retours est temporairement indisponible. Aucun message ni donnée personnelle n&apos;est enregistré ici.
      </p>
    </section>
  );
}
