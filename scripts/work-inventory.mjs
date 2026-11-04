#!/usr/bin/env node
// Registre de fonctionnalités : vérification sans réseau ni crédit API.
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,relative,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STATES=new Set(['implemented_code','prepared_disabled','partial','planned']);
const safePath=s=>typeof s==='string'&&!!s&&!s.startsWith('/')&&!s.includes('\\')&&
  s.split('/').every(p=>p!=='.'&&p!=='..'&&!!p);
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
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
  return errors;
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
