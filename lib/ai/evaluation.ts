// Comparaison hors ligne de sorties déjà disponibles. Aucun modèle n’est appelé.
import { z } from 'zod';
import { platformSchema } from './schemas';
import { applyRules, riskFrom } from './rules';
const sample = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), platform: platformSchema,
  approvedCaption: z.string().trim().min(1).max(10000),
  baselineCaption: z.string().trim().min(1).max(10000),
  candidateCaption: z.string().trim().min(1).max(10000),
}).strict();
export type RewriteEvaluationSample = z.input<typeof sample>;
export function evaluateRewriteCandidates(input: unknown) {
  const samples = z.array(sample).min(1).max(10000).parse(input);
  if (new Set(samples.map(item => item.id)).size !== samples.length) throw new Error('Exemples d’évaluation dupliqués.');
  const summarize = (field: 'baselineCaption'|'candidateCaption') => {
    let disclosurePassed = 0, exactMatches = 0, score = 0;
    for (const item of samples) {
      const violations = applyRules(item[field], item.platform);
      if (!violations.some(violation => violation.code === 'R1')) disclosurePassed++;
      if (item[field] === item.approvedCaption) exactMatches++;
      score += 100 - riskFrom(violations, 0);
    }
    return { disclosurePassed, exactMatches, meanHeuristicScore: Math.round(score / samples.length * 100) / 100 };
  };
  const baseline = summarize('baselineCaption'), candidate = summarize('candidateCaption');
  return {
    version: 'rewrite-evaluation-v1', examples: samples.length, baseline, candidate,
    delta: { disclosurePassed: candidate.disclosurePassed - baseline.disclosurePassed,
      exactMatches: candidate.exactMatches - baseline.exactMatches,
      meanHeuristicScore: Math.round((candidate.meanHeuristicScore - baseline.meanHeuristicScore) * 100) / 100 },
    requiresHumanReview: true as const, canPromoteAutomatically: false as const,
    limitations: 'Comparaison aux corrections relues et aux règles automatiques. Le sens, les faits et les obligations non couvertes exigent une revue humaine.',
  };
}
