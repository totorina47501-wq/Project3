import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {inspectRegistry} from './work-inventory.mjs';
const route='app/api/check/route.ts',migration='supabase/migrations/202611032001_initial_schema.sql';
const f={id:'checks',name:'Vérification',status:'partial',anchor:route,
  test:'tests/unit/rules.test.ts',doc:'docs/03-ai.md',aliases:['check'],
  routes:[route],migrations:[migration],next:['E2E authentifié restant']};
const i={existing:[route,migration,f.test,f.doc],routes:[route],migrations:[migration]};
const db=features=>({schemaVersion:1,features});
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
