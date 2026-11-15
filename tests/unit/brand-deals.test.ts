import { describe, expect, it } from 'vitest';
import { createCreatorProposal, creatorDetailsSchema, creatorMediaKitSchema, dealDraftSchema, dealListSchema, assertOwnedContract, archiveCanonicalText, archiveDigest, registryCsv } from '../../lib/brand-deals/model';

const draft = { brand_name:'  Marque été ', start_date:'2026-11-04', end_date:null, contract_url:null, verification_ids:[] };
describe('Brouillons de collaborations et archives', () => {
  it('normalise la marque et refuse propriétés sensibles ou dates impossibles', () => {
    expect(dealDraftSchema.parse(draft).brand_name).toBe('Marque été');
    for (const change of [{user_id:'other'}, {archived_at:'2026-11-04'}, {start_date:'2026-02-30'}, {end_date:'2026-11-03'}]) {
      expect(dealDraftSchema.safeParse({...draft,...change}).success).toBe(false);
    }
    expect(dealDraftSchema.safeParse({...draft,verification_ids:['bad']}).success).toBe(false);
  });
  it('limite et déduplique les vérifications liées', () => {
    const id='3a83817f-dadc-478c-889e-2a3721525a76';
    expect(dealDraftSchema.safeParse({...draft,verification_ids:[id,id]}).success).toBe(false);
    expect(dealDraftSchema.safeParse({...draft,verification_ids:Array.from({length:51},()=>id)}).success).toBe(false);
  });
  it('borne les détails de proposition et ne valide que les liens HTTPS publics du media kit',()=>{
    expect(creatorDetailsSchema.safeParse({niche:'Cuisine',platform:'instagram',format:'Reel',proposal:'<script>texte</script>'}).success).toBe(true);
    expect(creatorDetailsSchema.safeParse({platform:'inventé'}).success).toBe(false);
    expect(creatorDetailsSchema.safeParse({proposal:'x'.repeat(2501)}).success).toBe(false);
    expect(creatorMediaKitSchema.safeParse({public_links:['https://example.test/profil']}).success).toBe(true);
    for(const url of ['javascript:alert(1)','http://example.test','******example.test']) {
      expect(creatorMediaKitSchema.safeParse({public_links:[url]}).success).toBe(false);
    }
    expect(creatorMediaKitSchema.safeParse({creator_name:'Camille',include_creator_name:false}).success).toBe(true);
    const proposal=createCreatorProposal(creatorDetailsSchema.parse({niche:'Cuisine',budget:'100 €'}));
    expect(proposal).toContain('Budget déclaré : 100 €');
    expect(proposal).toContain('base de discussion modifiable');
    expect(proposal).not.toMatch(/audience|portée|partenariat déjà réalisé/i);
  });
  it('n accepte que des chemins de contrat privés possédés', () => {
    const user='3a83817f-dadc-478c-889e-2a3721525a76';
    expect(()=>assertOwnedContract(user,user+'/contract.pdf')).not.toThrow();
    for(const path of ['https://public.test/a.pdf','other/contract.pdf',user+'/../a.pdf']) {
      expect(()=>assertOwnedContract(user,path)).toThrow();
    }
  });
  it('refuse une pagination ou des filtres non supportés', () => {
    expect(dealListSchema.parse({}).page).toBe(1);
    for(const query of [{page:'0'},{page:'1.5'},{page:'10001'},{state:'pending'},{q:'%'}]) {
      expect(dealListSchema.safeParse(query).success).toBe(false);
    }
  });
  it('stabilise le texte canonique JSON utilisé par PostgreSQL et SHA-256', async () => {
    const snapshot=['mentioncheck-deal-v1','Été',null,['id','abc']];
    expect(archiveCanonicalText(snapshot)).toBe('["mentioncheck-deal-v1", "Été", null, ["id", "abc"]]');
    const hash=await archiveDigest(snapshot);
    expect(hash).toBe('750d95ceb386857c1a8095db493b8b2aa7d3d397ec750ae927b2f2ec3a0fc674');
    expect(await archiveDigest([...snapshot,'modifié'])).not.toBe(hash);
    expect(await archiveDigest(snapshot)).toBe(hash);
  });
  it('exporte un CSV échappé sans formule de tableur ni faux certificat', () => {
    const csv=registryCsv([{id:'x',brand_name:'=SUM(1,2)"',start_date:'2026-11-04',end_date:null,archived_at:null,hash_sha256:null}]);
    expect(csv).toContain('"\'=SUM(1,2)"""');
    expect(csv).toContain('brouillon');
    expect(csv).toContain('Informatif');
  });
});
