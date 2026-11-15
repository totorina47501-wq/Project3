import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it,vi } from 'vitest';
import { BrandDeals,requestCreatorMediaKitPdf } from '../../components/BrandDeals';

const mediaKit={
  creator_name:'',description:'',niches:'',formats:'',public_links:'',contact_email:'',contact_url:'',
  include_creator_name:true,include_description:true,include_niches:true,include_formats:true,
  include_public_links:true,include_contact_email:false,include_contact_url:false,
};
describe('Parcours créateur et media kit',()=>{
  it('présente un parcours clavier, local et sans statistiques inventées',()=>{
    const markup=renderToStaticMarkup(createElement(BrandDeals));
    for(const text of [
      'Ma première collaboration',
      'Activité ou niche',
      'Budget déclaré par toi',
      'Générer un modèle déterministe',
      'aucun message n’est envoyé',
      'Extrait facultatif (12 000 caractères maximum)',
      'Aucune statistique, audience, portée, performance',
      'Inclure',
      'Télécharger mon media kit PDF',
      'aria-busy="false"',
      'aria-live="polite"',
    ])expect(markup).toContain(text);
    for(const maxLength of ['12000','120','1200','1000','5000','254','500']) {
      expect(markup).toContain(`maxLength="${maxLength}"`);
    }
    expect(markup).not.toContain('followers');
    expect(markup).not.toContain('impressions');
  });
  it('n’envoie que les champs du kit et garde le brief local',async()=>{
    const input={
      ...mediaKit,creator_name:'Camille',description:'Cuisine',niches:'Cuisine',
      formats:'Vidéo courte',public_links:'https://example.test/profil',
      briefText:'Texte privé à garder dans le navigateur',
    };
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('%PDF-test',{status:200}));
    const result=await requestCreatorMediaKitPdf(input,new AbortController().signal,fetcher);
    expect(result.status).toBe('download');
    const requestBody=JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string,unknown>;
    expect(fetcher).toHaveBeenCalledWith('/api/brand-deals/export',expect.objectContaining({method:'POST'}));
    expect(requestBody).toMatchObject({creator_name:'Camille',public_links:['https://example.test/profil']});
    expect(requestBody).not.toHaveProperty('briefText');
    expect(JSON.stringify(requestBody)).not.toContain('Texte privé');
  });
  it('refuse les champs invalides avant tout appel réseau',async()=>{
    const fetcher=vi.fn<typeof fetch>();
    const result=await requestCreatorMediaKitPdf({...mediaKit,creator_name:'Camille',public_links:'http://example.test'},new AbortController().signal,fetcher);
    expect(result).toEqual({status:'invalid'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('ne révèle pas le corps d’erreur du serveur et distingue réseau et annulation',async()=>{
    const secret='token=ne-pas-afficher';
    const rejected=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error:secret}),{status:500}));
    expect(await requestCreatorMediaKitPdf({...mediaKit,creator_name:'Camille'},new AbortController().signal,rejected)).toEqual({status:'failed'});
    const offline=vi.fn<typeof fetch>().mockRejectedValue(new Error(secret));
    expect(await requestCreatorMediaKitPdf({...mediaKit,creator_name:'Camille'},new AbortController().signal,offline)).toEqual({status:'failed'});
    const controller=new AbortController();
    const cancelled=vi.fn<typeof fetch>().mockImplementation(async(_input,init)=>{
      controller.abort();
      if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
      return new Response('%PDF-test');
    });
    expect(await requestCreatorMediaKitPdf({...mediaKit,creator_name:'Camille'},controller.signal,cancelled)).toEqual({status:'cancelled'});
  });
});
