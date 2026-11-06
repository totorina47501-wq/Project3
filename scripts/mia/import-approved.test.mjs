// Fournisseurs simulés : le plan n'écrit jamais et une confirmation doit viser ce snapshot précis.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareApprovedImport, executeApprovedImport } from './import-approved.mjs';
const content = 'Synthèse fictive pour vérifier uniquement le mécanisme technique.';
const doc = {article_ref:'TEST',content,source_url:'https://www.legifrance.gouv.fr/loda/id/TEST',effective_on:'2026-11-05',
 content_sha256:createHash('sha256').update(content).digest('hex'),source_sha256:'a'.repeat(64),reviewed_by:'Test local',reviewed_at:'2026-11-05T12:00:00Z'};
const manifest={schemaVersion:1,status:'approved_for_manual_import',documents:[doc]};
describe('import juridique contrôlé sans réseau',()=>{
 it('produit un plan stable, lié au contenu courant, sans rien écrire',()=>{
  const a=prepareApprovedImport(manifest,[]);const b=prepareApprovedImport(manifest,[]);
  assert.equal(a.confirmation,b.confirmation);assert.equal(a.inserts,1);
  assert.deepEqual(a.expected,[{article_ref:'TEST',exists:false}]);
  assert.notEqual(a.confirmation,prepareApprovedImport(manifest,[doc]).confirmation);
 });
 it('bloque sans approbation et avec une confirmation ne correspondant pas au plan',async()=>{
  let calls=0;const admin={rpc:async()=>{calls++;return {data:{},error:null};}};
  const prepared=prepareApprovedImport(manifest,[]);
  await assert.rejects(executeApprovedImport({admin,manifest,prepared,approved:false,confirmation:prepared.confirmation}));
  await assert.rejects(executeApprovedImport({admin,manifest,prepared,approved:true,confirmation:'0'.repeat(64)}));
  assert.equal(calls,0);
 });
 it('ne transmet que la RPC transactionnelle et son snapshot attendu',async()=>{
  const prepared=prepareApprovedImport(manifest,[]);const calls=[];
  const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:{inserted:1,updated:0,unchanged:0,alreadyApplied:false},error:null};}};
  assert.equal((await executeApprovedImport({admin,manifest,prepared,approved:true,confirmation:prepared.confirmation})).inserted,1);
  assert.equal(calls[0].name,'import_approved_law_documents');assert.deepEqual(calls[0].args.p_expected,prepared.expected);
 });
 it('refuse la modification du plan après son aperçu et propage un conflit SQL',async()=>{
  const prepared=prepareApprovedImport(manifest,[]);
  const admin={rpc:async()=>({data:null,error:{code:'40001'}})};
  await assert.rejects(executeApprovedImport({admin,manifest,prepared:{...prepared,expected:[]},approved:true,confirmation:prepared.confirmation}));
  await assert.rejects(executeApprovedImport({admin,manifest,prepared,approved:true,confirmation:prepared.confirmation}),/modifié/);
 });
});
