#!/usr/bin/env node
// Diagnostic local uniquement : aucun SDK fournisseur, aucune écriture de dossier.
import {readFile,open} from 'node:fs/promises';
import ts from 'typescript';
const sections=new Set(['publisher','terms','privacy','reviews']);
function validate(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Dossier invalide.');
 for(const [section,fields] of Object.entries(value)){
  if(!sections.has(section)||!fields||typeof fields!=='object'||Array.isArray(fields))throw new Error('Section invalide.');
  if(Object.values(fields).some(field=>typeof field!=='string'||field.length>500))throw new Error('Champ invalide.');
 }
 return value;
}
async function loadDiagnostic(){
 // Les deux seuls modules chargés sont le contrôle existant et sa configuration pure.
 // Les valeurs privées ne sont jamais interpolées dans le code compilé.
 const encode=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const config=encode(compile(await readFile(new URL('../../lib/billing/config.ts',import.meta.url),'utf8')));
 const source=compile(await readFile(new URL('../../lib/billing/readiness.ts',import.meta.url),'utf8'));
 if(!source.includes("from './config'"))throw new Error('Dépendance locale inattendue.');
 return (await import(encode(source.replace("from './config'",`from '${config}'`)))).assessCommercialReadiness;
}
try{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){
  console.log('Usage : node scripts/commercial/check.mjs [--dossier chemin/prive.json]');
  console.log('Diagnostic sans fournisseur : code 0 = dossier présent pour revue, 2 = incomplet, 1 = entrée invalide. Aucune activation commerciale.');
 }else{
  if(args.length!==0&&(args.length!==2||args[0]!=='--dossier'||!args[1]||args[1].startsWith('--')))throw new Error('Options invalides.');
  let dossier={};
  if(args.length){
   const file=await open(args[1],'r');
   try{
    if(!(await file.stat()).isFile())throw new Error('Fichier requis.');
    const buffer=Buffer.alloc(32769);const {bytesRead}=await file.read(buffer,0,buffer.length,0);
    if(bytesRead>32768)throw new Error('Dossier volumineux.');
    dossier=validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytesRead))));
   }finally{await file.close();}
  }
  const assess=await loadDiagnostic();const report=assess({...dossier,environment:process.env});
  console.log(JSON.stringify(report,null,2));process.exitCode=report.readyForReview?0:2;
 }
}catch{
 // Ni contenu privé, ni secret, ni chemin local dans le message d'erreur.
 console.error('Diagnostic impossible : vérifier les options et le dossier JSON (32 Kio maximum, champs textuels).');
 process.exitCode=1;
}
