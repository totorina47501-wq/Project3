import { describe, expect, it } from 'vitest';
import { hasClearLeadingDisclosure, improveSponsoredRewrite, needsVisibleDisclosure }
  from '../../lib/ai/disclosure';

describe('Mentions sponsorisées explicites', () => {
  it('refuse une simple mention vague en fin de texte', () => {
    expect(hasClearLeadingDisclosure('Crème au top ! #Collaboration')).toBe(false);
    expect(hasClearLeadingDisclosure('#Collaboration Crème au top')).toBe(false);
  });
  it('reconnaît les mentions françaises lisibles au début', () => {
    expect(hasClearLeadingDisclosure('Publicité — Voici la crème')).toBe(true);
    expect(hasClearLeadingDisclosure('Collaboration commerciale : ma crème')).toBe(true);
    expect(hasClearLeadingDisclosure('#sponsorisé par une marque — crème')).toBe(true);
    expect(hasClearLeadingDisclosure('PUBLICITÉ #codepromo')).toBe(true);
  });
  it('améliore la proposition sponsorisée R1 en supprimant le hashtag vague', () => {
    const res=improveSponsoredRewrite({
      rewrittenCaption: "J'adore cette crème ! #Collaboration",
      changes:[], confidence:0.8,
    }, [{ code:'R1' }]);
    expect(res.rewrittenCaption).toBe("Publicité — J'adore cette crème !");
    expect(res.changes).toHaveLength(1);
    expect(res.confidence).toBe(0.8);
  });
  it('n’altère pas une réécriture déjà claire', () => {
    const candidate={rewrittenCaption:'Collaboration commerciale — crème',changes:[]};
    expect(improveSponsoredRewrite(candidate,[{code:'R1'}])).toBe(candidate);
  });
  it('n’ajoute pas d’affirmation publicitaire hors contexte suspect', () => {
    const candidate={rewrittenCaption:'J’aime cette crème.',changes:[]};
    expect(improveSponsoredRewrite(candidate,[])).toBe(candidate);
    expect(needsVisibleDisclosure([{code:'R2'}])).toBe(true);
  });
  it('respecte la limite des changements du contrat Zod', () => {
    const existing=Array.from({length:12},(_,i)=>({before:'x'+i,after:'y'+i,reason:'r'}));
    const res=improveSponsoredRewrite({rewrittenCaption:'Une crème #Collab',changes:existing},
      [{code:'R1'}]);
    expect(res.changes).toHaveLength(12);
  });
});
