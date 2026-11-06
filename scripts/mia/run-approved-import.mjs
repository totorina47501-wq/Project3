#!/usr/bin/env node
// Aucun import implicite, aucune suppression et aucun appel OpenAI dans cette commande.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { readCorpusPages } from '../../lib/mia/corpus-pages.mjs';
import { prepareApprovedImport,executeApprovedImport } from './import-approved.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')) {
 console.log('Usage: node scripts/mia/run-approved-import.mjs --manifest fichier.json [--snapshot corpus.json] [--execute --confirm empreinte]');
 console.log('Par défaut : aperçu sans écriture. --snapshot permet un aperçu totalement hors ligne.');
 console.log('Exécution : MIA_IMPORT_APPROVED=true ; aperçu courant et empreinte --confirm obligatoires. Aucun appel OpenAI.');
 process.exit(0);
}
try {
 const options={};
 for(let i=0;i<args.length;i++) {
  const key=args[i];
  if(!['--manifest','--snapshot','--execute','--confirm'].includes(key)||key in options)throw new Error('Option non reconnue ou répétée. Utiliser --help.');
  if(key==='--execute')options[key]=true;
  else {const value=args[++i];if(!value||value.startsWith('--'))throw new Error('Valeur d’option manquante.');options[key]=value;}
 }
 if(!options['--manifest']||(options['--snapshot']&&options['--execute'])||(!options['--execute']&&options['--confirm']))
  throw new Error('Manifeste requis ; snapshot réservé à l’aperçu hors ligne.');
 const load=async path=>{const text=await readFile(path,'utf8');if(Buffer.byteLength(text)>2_000_000)throw new Error('Fichier trop volumineux.');return JSON.parse(text);};
 const manifest=await load(options['--manifest']);
 let admin,existing;
 if(options['--snapshot'])existing=await load(options['--snapshot']);
 else {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL??process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_KEY;
  if(!url||!key)throw new Error('Accès opérateur Supabase requis, ou --snapshot pour rester hors ligne.');
  admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  existing=await readCorpusPages(async(offset,size)=>await admin.from('law_documents')
   .select('article_ref,content,source_url,effective_on',{count:'exact'}).order('article_ref',{ascending:true}).range(offset,offset+size-1));
 }
 const prepared=prepareApprovedImport(manifest,existing);
 const {expected,...preview}=prepared;
 console.log(JSON.stringify(preview,null,2));
 if(options['--execute']) {
  const receipt=await executeApprovedImport({admin,manifest,prepared,approved:process.env.MIA_IMPORT_APPROVED==='true',confirmation:options['--confirm']});
  console.log(JSON.stringify({applied:true,receipt},null,2));
 }
} catch(error) {console.error(error instanceof Error?error.message:'Import refusé.');process.exitCode=1;}
