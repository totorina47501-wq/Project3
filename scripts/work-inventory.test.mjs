import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {inspectRegistry,guardOperation,guardIssue} from './work-inventory.mjs';
const route='app/api/check/route.ts',migration='supabase/migrations/202611032001_initial_schema.sql';
const f={id:'checks',name:'Vérification',status:'partial',anchor:route,
  test:'tests/unit/rules.test.ts',doc:'docs/03-ai.md',aliases:['check'],
  routes:[route],migrations:[migration],next:['E2E authentifié restant']};
const i={existing:[route,migration,f.test,f.doc],routes:[route],migrations:[migration]};
const operation={id:'pra-prod-storage-copy',status:'done',scope:'13 objets sauvegardés',
  environment:'pra',verifiedAt:'2026-11-12',
  evidence:['https://github.com/totorina47501-wq/Project3/issues/16']};
const pending={id:'solo-prod-cutover',status:'pending',scope:'Transition non effectuée',environment:'production',evidence:[]};
const working={id:'oauth-provider-review',status:'in_progress',scope:'PR existante',environment:'staging',evidence:[]};
const db=features=>({schemaVersion:1,features,operations:[operation,pending,working]});
describe('Registre anti-doublon, sans réseau',()=>{
  it('valide les propriétaires uniques',()=>assert.deepEqual(inspectRegistry(db([f]),i),[]));
  it('rejette le même ID, route et migration appartenant à deux modules',()=>{
    const s=inspectRegistry(db([f,{...f}]),i).join(' ');
    assert.match(s,/ID dupliqué/);assert.match(s,/DOUBLON routes/);assert.match(s,/DOUBLON migrations/);
  });
  it('rejette une route ou migration sans propriétaire',()=>{
    const s=inspectRegistry(db([{...f,routes:[],migrations:[]}]),i).join(' ');
    assert.match(s,/Route non attribuée/);assert.match(s,/Migration non attribuée/);
  });
  it('rejette un chemin fictif et un statut prétendant être en production',()=>{
    const s=inspectRegistry(db([{...f,anchor:'faux/code.ts',status:'production_verified'}]),i).join(' ');
    assert.match(s,/Fichier absent/);assert.match(s,/Statut invalide/);
  });
  it('refuse les chemins hors dépôt',()=>{
    assert.match(inspectRegistry(db([{...f,anchor:'../secret'}]),i).join(' '),/Chemin invalide/);
  });
});

describe('Verrou opérationnel anti-doublons, hors ligne',()=>{
  it('refuse une restauration déjà prouvée',()=>{
    const result=guardOperation(db([f]),'pra-prod-storage-copy');
    assert.equal(result.allowed,false);assert.match(result.reason,/ALREADY_DONE/);
  });
  it('refuse une mission déjà affectée et une mission absente',()=>{
    assert.match(guardOperation(db([f]),'oauth-provider-review').reason,/ALREADY_ASSIGNED/);
    assert.equal(guardOperation(db([f]),'unknown-operation').allowed,false);
  });
  it('laisse passer uniquement la mission encore à faire',()=>{
    assert.equal(guardOperation(db([f]),'solo-prod-cutover').allowed,true);
  });
  it('exige un work-id unique sur la même issue et refuse les doublons',()=>{
    const marker='<!-- mentioncheck-work-id: pra-prod-storage-copy -->';
    assert.equal(guardIssue(db([f]),{body:marker}).allowed,false);
    assert.equal(guardIssue(db([f]),{body:'aucune référence'}).allowed,false);
    assert.equal(guardIssue(db([f]),{body:marker+' '+marker}).allowed,false);
    assert.equal(guardIssue(db([f]),{body:'<!-- mentioncheck-work-id: solo-prod-cutover -->'}).allowed,true);
  });
  it('interdit une fausse preuve ou une opération doublée dans la CI',()=>{
    const s=inspectRegistry({...db([f]),operations:[operation,{...operation,evidence:['http://invalide']}]},i).join(' ');
    assert.match(s,/Opération dupliquée/);assert.match(s,/Preuve opération invalide/);
    assert.match(inspectRegistry({...db([f]),operations:[{...operation,evidence:[]}]},i).join(' '),/sans preuve datée/);
    assert.match(inspectRegistry({schemaVersion:1,features:[f]},i).join(' '),/Registre opérationnel manquant/);
  });
});
