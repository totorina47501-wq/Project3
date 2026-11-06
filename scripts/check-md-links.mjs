import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const SKIP_DIRS=new Set(['node_modules','.git','.next','.open-next','receipts']);
const EXTERNAL=/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function stripCode(text){
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm,m=>m.replace(/[^\n]/g,'')).replace(/`[^`\n]*`/g,'');
}

export function extractTargets(text){
  const out=[];const src=stripCode(text);
  const inline=/!?\[(?:[^\[\]]|\[[^\]]*\])*\]\(\s*(<[^>\n]*>|[^\s)]*(?:\([^\s)]*\)[^\s)]*)*)/g;
  for(const m of src.matchAll(inline)){let t=m[1];if(t.startsWith('<'))t=t.slice(1,-1);out.push(t)}
  for(const m of src.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]*>|\S+)/gm)){let t=m[1];if(t.startsWith('<'))t=t.slice(1,-1);out.push(t)}
  return out;
}

export function localPath(target){
  const t=target.trim();
  if(!t||t.startsWith('#')||EXTERNAL.test(t))return null;
  const path=t.split('#')[0].split('?')[0];
  if(!path)return null;
  try{return decodeURI(path)}catch{return path}
}

export function checkContent(text,file,root,exists=existsSync){
  const problems=[];
  for(const target of extractTargets(text)){
    const p=localPath(target);
    if(p===null)continue;
    const abs=p.startsWith('/')?resolve(root,'.'+p):resolve(dirname(file),p);
    const rel=relative(root,abs);
    if(rel.startsWith('..')||isAbsolute(rel)){problems.push({file:relative(root,file),target,reason:'hors dépôt'});continue}
    if(!exists(abs))problems.push({file:relative(root,file),target,reason:'cible absente'});
  }
  return problems;
}

export function listMarkdown(root){
  const files=[];
  for(const e of readdirSync(root,{withFileTypes:true}))
    if(e.isFile()&&e.name.endsWith('.md'))files.push(join(root,e.name));
  const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){
    if(SKIP_DIRS.has(e.name))continue;const p=join(d,e.name);
    if(e.isDirectory())walk(p);else if(e.name.endsWith('.md'))files.push(p)}};
  if(existsSync(join(root,'docs')))walk(join(root,'docs'));
  return files.sort();
}

export function checkRepo(root){
  return listMarkdown(root).flatMap(f=>checkContent(readFileSync(f,'utf8'),f,root));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=process.argv.includes('--report');
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const problems=checkRepo(root);
  for(const p of problems)console.log(`${p.file}: ${p.target} (${p.reason})`);
  console.log(`${problems.length} lien(s) interne(s) cassé(s)${report?' [rapport non bloquant]':''}`);
  process.exit(problems.length&&!report?1:0);
}

// CI revalidation marker: code behavior unchanged; recheck Copilot PR on current GitHub policy.
