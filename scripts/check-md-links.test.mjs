import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {checkContent,extractTargets,localPath} from './check-md-links.mjs';
const root=resolve('/repo'),file=resolve('/repo/docs/a.md');
const present=new Set([resolve('/repo/docs/b.md'),resolve('/repo/README.md'),resolve('/repo/docs/mon fichier.md')]);
const run=t=>checkContent(t,file,root,p=>present.has(p));
describe('Liens Markdown internes, sans réseau',()=>{
  it('accepte les liens valides relatifs et racine',()=>assert.deepEqual(run('[b](b.md) [r](../README.md) [x](/README.md)'),[]));
  it('signale les liens cassés',()=>{
    const r=run('[x](absent.md)');assert.equal(r.length,1);assert.equal(r[0].target,'absent.md');
  });
  it('ignore les fragments seuls et vérifie le chemin avant #',()=>{
    assert.deepEqual(run('[a](#titre) [b](b.md#ancre-inexistante)'),[]);
    assert.equal(run('[b](zzz.md#a)').length,1);
  });
  it('ignore les liens externes',()=>assert.deepEqual(run('[a](https://x.io/a.md) [m](mailto:a@b.c) [p](//cdn/x)'),[]));
  it('décode les chemins encodés',()=>{
    assert.deepEqual(run('[a](mon%20fichier.md)'),[]);
    assert.equal(localPath('a%20b.md?x=1#h'),'a b.md');
  });
  it('ignore le code et signale les sorties du dépôt',()=>{
    assert.deepEqual(run('`[a](x.md)`\n```\n[a](y.md)\n```\n'),[]);
    assert.equal(run('[a](../../etc/passwd)')[0].reason,'hors dépôt');
  });
  it('extrait les définitions de référence',()=>assert.deepEqual(extractTargets('[a]: <b.md> "t"'),['b.md']));
});
