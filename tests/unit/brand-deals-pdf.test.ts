import { describe,expect,it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildCreatorMediaKitPdf,buildRegistryPdf } from '../../lib/archive/pdf';
import { creatorMediaKitSchema } from '../../lib/brand-deals/model';
describe('Registre de collaborations informatif',()=>{
  it('conserve un PDF lisible et pagine les longs registres',async()=>{
    const rows=Array.from({length:30},(_,i)=>({id:'collaboration-'+i,brand_name:'Marque été '+i,start_date:'2026-11-04',end_date:null,archived_at:null,hash_sha256:null}));
    const bytes=await buildRegistryPdf(rows);
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toContain('Registre');
    expect(pdf.getSubject()).toContain('non certifie');
    expect(pdf.getPages().length).toBeGreaterThan(1);
  });
  it('génère un media kit sans chiffres inventés et respecte les rubriques désactivées',async()=>{
    const data=creatorMediaKitSchema.parse({
      creator_name:'<script>texte</script>',description:'Créatrice indépendante',
      niches:['Cuisine'],formats:['Vidéo courte'],public_links:['https://example.test/profil'],
      include_description:false,include_niches:false,include_formats:false,include_public_links:false,
      contact_email:'',contact_url:'',include_contact_email:false,include_contact_url:false,
    });
    const pdf=await PDFDocument.load(await buildCreatorMediaKitPdf(data));
    expect(pdf.getTitle()).toBe('Media kit créateur');
    expect(pdf.getSubject()).toContain('non certifiée');
    expect(pdf.getPages()).toHaveLength(1);
    expect(pdf.getPages()[0]?.node.Annots()?.size()).toBe(0);
  });
  it('refuse les coordonnées invalides, les liens non HTTPS et les champs hors limites',()=>{
    const valid={
      creator_name:'Camille',description:'',niches:[],formats:[],public_links:[],
      contact_email:'',contact_url:'',
      include_creator_name:true,include_description:true,include_niches:true,include_formats:true,
      include_public_links:true,include_contact_email:false,include_contact_url:false,
    };
    for(const invalid of [
      {contact_email:'pas-une-adresse'},
      {contact_url:'http://example.test'},
      {public_links:['http://example.test']},
      {public_links:['******example.test/profil']},
      {creator_name:'x'.repeat(121)},
      {description:'x'.repeat(1201)},
      {niches:['x'.repeat(81)]},
      {niches:Array.from({length:11},()=> 'Cuisine')},
      {formats:Array.from({length:11},()=> 'Vidéo courte')},
      {public_links:Array.from({length:11},(_,index)=>`https://example.test/${index}`)},
    ]) {
      expect(creatorMediaKitSchema.safeParse({...valid,...invalid}).success).toBe(false);
    }
    expect(creatorMediaKitSchema.safeParse({...valid,contact_url:'https://example.test/contact'}).success).toBe(true);
    expect(creatorMediaKitSchema.safeParse({...valid,public_links:['https://example.test/profil']}).success).toBe(true);
  });
});
