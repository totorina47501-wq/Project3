import { expect, it } from 'vitest';
import { evaluateRewriteCandidates } from '../../lib/ai/evaluation';
const item = { id:'fixture_1',platform:'instagram',approvedCaption:'PUBLICITÉ — Ma crème.',baselineCaption:'Ma crème.',candidateCaption:'PUBLICITÉ — Ma crème.' };
it('compare deux sorties sans appel IA, sans promotion automatique ni texte privé dans le rapport',()=>{
  const report=evaluateRewriteCandidates([item]);
  expect(report.delta.disclosurePassed).toBe(1);expect(report.delta.exactMatches).toBe(1);
  expect(report.delta.meanHeuristicScore).toBeGreaterThan(0);
  expect(report.requiresHumanReview).toBe(true);expect(report.canPromoteAutomatically).toBe(false);
  expect(JSON.stringify(report)).not.toContain('Ma crème');
});
it('ne masque pas une régression et refuse un jeu vide, dupliqué ou malformé',()=>{
  const report=evaluateRewriteCandidates([{...item,baselineCaption:item.candidateCaption,candidateCaption:item.baselineCaption}]);
  expect(report.delta.disclosurePassed).toBe(-1);expect(report.delta.meanHeuristicScore).toBeLessThan(0);
  expect(()=>evaluateRewriteCandidates([])).toThrow();
  expect(()=>evaluateRewriteCandidates([item,item])).toThrow();
  expect(()=>evaluateRewriteCandidates([{...item,candidateCaption:''}])).toThrow();
});
