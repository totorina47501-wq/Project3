import { applyRules, levelFromRisk, riskFrom } from '../ai/rules';
import type { Platform } from '../ai/schemas';

export function evaluateStudioText(input: { caption: string; platform: Platform }) {
  const violations = applyRules(input.caption, input.platform);
  const risk = riskFrom(violations, 0);
  return {
    score: 100 - risk,
    riskLevel: levelFromRisk(risk),
    violations,
    analysisMode: 'rules_only' as const,
    scoringVersion: 'rules-v1',
    warnings: ['Contrôle de divulgation commerciale par règles automatiques, sans IA. Ce score ne constitue pas une certification juridique.'],
  };
}

type ReportRow = { id: string; workspace_id: string | null; caption: string; platform: Platform };
/** Les lignes viennent d'une requête autorisée ; l'appartenance reste explicite. */
export function buildBrandSafetyReport(workspaceId: string, rows: ReportRow[]) {
  const allowed = rows.filter((row) => row.workspace_id === workspaceId);
  const risks = { low: 0, medium: 0, high: 0, critical: 0 };
  const counts: Record<string, number> = {};
  let totalScore = 0;
  for (const row of allowed) {
    const result = evaluateStudioText(row);
    totalScore += result.score;
    risks[result.riskLevel] += 1;
    for (const violation of result.violations) counts[violation.code] = (counts[violation.code] ?? 0) + 1;
  }
  return {
    total: allowed.length,
    averageScore: allowed.length ? Math.round(totalScore / allowed.length) : null,
    riskCounts: risks,
    violationCounts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    analysisMode: 'rules_only' as const,
    scoringVersion: 'rules-v1',
    scope: '100 dernières vérifications explicitement partagées dans cette équipe ; divulgation commerciale uniquement.',
    warning: 'Rapport indicatif de brand safety limité aux règles de divulgation ; aucun avis juridique ni contrôle de la réputation de marque.',
  };
}
