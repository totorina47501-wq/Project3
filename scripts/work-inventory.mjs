#!/usr/bin/env node
// Registre de fonctionnalités : vérification sans réseau ni crédit API.
import {readFile,readdir,stat} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname,relative,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STATES=new Set(['implemented_code','prepared_disabled','partial','planned']);
const safePath=s=>typeof s==='string'&&!!s&&!s.startsWith('/')&&!s.includes('\\')&&
  s.split('/').every(p=>p!=='.'&&p!=='..'&&!!p);
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

const OPERATION_STATES=new Set(['done','pending','in_progress']);
const OPERATION_ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function inspectOperations(data){
  const errors=[];
  if(!Array.isArray(data?.operations)||!data.operations.length)
    return ['Registre opérationnel manquant'];
  const seen=new Set();
  for(const op of data.operations){
    if(!op||!OPERATION_ID.test(op.id??'')){errors.push('ID opération invalide');continue}
    if(seen.has(op.id))errors.push('Opération dupliquée : '+op.id);
    seen.add(op.id);
    if(!OPERATION_STATES.has(op.status))errors.push('Statut opération invalide : '+op.id);
    if(typeof op.scope!=='string'||!op.scope.trim())
      errors.push('Périmètre opération manquant : '+op.id);
    if(typeof op.environment!=='string'||!op.environment.trim())
      errors.push('Environnement opération manquant : '+op.id);
    if(!Array.isArray(op.evidence)||op.evidence.some(url=>
      typeof url!=='string'||!/^https:\/\/github\.com\/totorina47501-wq\/Project3\//.test(url)))
      errors.push('Preuve opération invalide : '+op.id);
    if(op.status==='done'&&(!op.evidence?.length||
      !/^\d{4}-\d{2}-\d{2}$/.test(op.verifiedAt??'')))
      errors.push('Opération terminée sans preuve datée : '+op.id);
  }
  return errors;
}
export function guardOperation(data,id){
  if(typeof id!=='string'||!OPERATION_ID.test(id))
    return {allowed:false,reason:'Identifiant de mission invalide'};
  const op=data?.operations?.find(x=>x.id===id);
  if(!op)return {allowed:false,reason:'Mission non répertoriée : '+id+' ; rapprochement humain requis avant dispatch'};
  if(op.status==='done')
    return {allowed:false,reason:'ALREADY_DONE '+id+' ; ne pas refaire. Preuve : '+op.evidence.join(' ')};
  if(op.status==='in_progress')
    return {allowed:false,reason:'ALREADY_ASSIGNED '+id+' ; réutiliser la PR/issue existante'};
  return {allowed:true,reason:'PENDING '+id+' ; effectuer encore les vérifications de PR, preuves et droits'};
}
export function guardIssue(data,issue){
  const body=typeof issue?.body==='string'?issue.body:'';
  const matches=[...body.matchAll(/<!--\s*mentioncheck-work-id:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*-->/g)];
  if(matches.length!==1)
    return {allowed:false,reason:'Issue sans identifiant unique <!-- mentioncheck-work-id: ... --> ; aucune affectation'};
  return guardOperation(data,matches[0][1]);
}
async function filesAt(dir,root,all=[]){
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true})}
  catch(e){if(e?.code==='ENOENT')return all;throw e}
  for(const e of entries){
    const path=join(dir,e.name);
    if(e.isDirectory())await filesAt(path,root,all);
    if(e.isFile())all.push(relative(root,path).split(sep).join('/'));
  }
  return all;
}
export function inspectRegistry(data,inventory){
  const errors=[];
  if(data?.schemaVersion!==1||!Array.isArray(data.features)||!data.features.length)
    return ['Registre invalide : version et fonctionnalités manquantes'];
  const ids=new Set(),routes=new Map(),migrations=new Map(),referenced=new Set();
  for(const [index,f] of data.features.entries()){
    if(!f||typeof f!=='object'){errors.push('Entrée incorrecte '+index);continue}
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.id))errors.push('ID incorrect : '+f.id);
    if(ids.has(f.id))errors.push('ID dupliqué : '+f.id);
    ids.add(f.id);
    if(typeof f.name!=='string'||!f.name.trim())errors.push('Titre vide : '+f.id);
    if(!STATES.has(f.status))errors.push('Statut invalide : '+f.id);
    if(!Array.isArray(f.next)||!f.next.length||f.next.some(x=>typeof x!=='string'||!x.trim()))
      errors.push('Écart ou preuve manquants : '+f.id);
    if(!Array.isArray(f.aliases)||!f.aliases.length||f.aliases.some(x=>!norm(x)))
      errors.push('Alias manquant : '+f.id);
    for(const key of ['anchor','test','doc']){
      const path=f[key];
      if(key==='test'&&path===null)continue;
      if(!safePath(path)){errors.push('Chemin invalide '+f.id+' '+key);continue}
      referenced.add(path);
    }
    for(const [key,prefix,ownership] of [
      ['routes','app/api/',routes],['migrations','supabase/migrations/',migrations]]){
      if(!Array.isArray(f[key])){errors.push('Tableau manquant '+f.id+' '+key);continue}
      for(const path of f[key]){
        if(!safePath(path)||!path.startsWith(prefix)||
          (key==='routes'&&!path.endsWith('/route.ts'))||
          (key==='migrations'&&!path.endsWith('.sql'))){
          errors.push('Référence incorrecte '+f.id+' '+String(path));continue;
        }
        if(ownership.has(path))errors.push('DOUBLON '+key+' : '+path+' / '+ownership.get(path)+' et '+f.id);
        ownership.set(path,f.id);
        referenced.add(path);
      }
    }
  }
  const current=new Set(inventory.existing);
  for(const path of referenced)if(!current.has(path))errors.push('Fichier absent : '+path);
  for(const route of inventory.routes)if(!routes.has(route))errors.push('Route non attribuée : '+route);
  for(const migration of inventory.migrations)if(!migrations.has(migration))
    errors.push('Migration non attribuée : '+migration);
  for(const route of routes.keys())if(!inventory.routes.includes(route))
    errors.push('Route inexistante : '+route);
  for(const migration of migrations.keys())if(!inventory.migrations.includes(migration))
    errors.push('Migration inexistante : '+migration);
  return errors.concat(inspectOperations(data));
}
export async function audit(root=ROOT){
  const data=JSON.parse(await readFile(join(root,'docs/work-registry.json'),'utf8'));
  const existing=[...await filesAt(join(root,'app/api'),root),
    ...await filesAt(join(root,'supabase/migrations'),root)];
  for(const f of data.features){
    for(const path of [f.anchor,f.test,f.doc]){
      if(!safePath(path)||existing.includes(path))continue;
      try{if((await stat(join(root,path))).isFile())existing.push(path)}catch{/* Reported below */}
    }
  }
  const routes=existing.filter(s=>s.startsWith('app/api/')&&s.endsWith('/route.ts'));
  const migrations=existing.filter(s=>s.startsWith('supabase/migrations/')&&s.endsWith('.sql'));
  return {data,problems:inspectRegistry(data,{existing,routes,migrations}),
    routeCount:routes.length,migrationCount:migrations.length};
}
async function main(args){
  const task=args[0]??'check';
  const r=await audit();
  if(r.problems.length){for(const p of r.problems)process.stderr.write('ERREUR '+p+'\n');process.exitCode=1;return}
  if(task==='check'){
    process.stdout.write('OK '+r.data.features.length+' fonctionnalités ; '+
      r.routeCount+' routes et '+r.migrationCount+' migrations référencées sans doublon.\n');
    return;
  }
  if(task==='guard'||task==='guard-issue'){
    const decision=task==='guard' ? guardOperation(r.data,args[1]) :
      guardIssue(r.data,JSON.parse(readFileSync(0,'utf8')));
    const stream=decision.allowed?process.stdout:process.stderr;
    stream.write(decision.reason+'\n');
    if(!decision.allowed)process.exitCode=3;
    return;
  }
  if(task==='find'){
    const q=norm(args.slice(1).join(' '));
    if(!q){process.stderr.write('Usage : npm run work:find -- <sujet>\n');process.exitCode=2;return}
    const terms=q.split(' ');
    const matched=r.data.features.filter(f=>{
      const corpus=norm([f.id,f.name,...f.aliases,...f.routes,...f.migrations].join(' '));
      return terms.every(term=>corpus.includes(term));
    });
    if(!matched.length){process.stdout.write('Aucun résultat dans le registre. Inspecter également le code et les MD.\n');return}
    for(const f of matched)process.stdout.write('['+f.status+'] '+f.id+' — '+f.name+'\n'+
      '  Code : '+f.anchor+'\n  Test : '+(f.test??'à créer')+' ; MD : '+f.doc+
      '\n  Reste : '+f.next.join(' ')+'\n');
    return;
  }
  process.stderr.write('Commande inconnue : '+task+'\n');process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(e=>{process.stderr.write(String(e)+'\n');process.exitCode=1});
