// Import explicite : le plan approuvé est lié au manifeste et aux seules lignes ciblées.
import { createHash } from 'node:crypto';
import { planApprovedImport } from './plan-approved-import.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const confirmationFor = (manifest, expected) => hash({manifest,expected});
export function prepareApprovedImport(manifest, existing) {
 const plan=planApprovedImport(manifest,existing);
 if(manifest.documents.length===0)throw new Error('Le manifeste approuvé est vide.');
 const current=new Map(existing.map(doc=>[doc.article_ref,doc]));
 const expected=manifest.documents.map(doc=>{
  const old=current.get(doc.article_ref);
  return old?{article_ref:old.article_ref,exists:true,content:old.content,source_url:old.source_url,effective_on:old.effective_on??null}:
   {article_ref:doc.article_ref,exists:false};
 });
 return {...plan,expected,confirmation:confirmationFor(manifest,expected)};
}
export async function executeApprovedImport({admin,manifest,prepared,approved,confirmation}) {
 if(approved!==true||confirmation!==prepared.confirmation||
  confirmationFor(manifest,prepared.expected)!==prepared.confirmation)
  throw new Error('Import non approuvé ou aperçu périmé : refaire le plan et confirmer son empreinte.');
 // Le serveur revalide le manifeste, verrouille puis compare le snapshot avant toute écriture.
 const {data,error}=await admin.rpc('import_approved_law_documents',{
  p_manifest:manifest,p_expected:prepared.expected,
 });
 if(error?.code==='40001')throw new Error('Corpus modifié depuis l’aperçu : refaire le plan.');
 if(error||!data)throw new Error('Import refusé ; aucune écriture partielle n’a été conservée.');
 return data;
}
