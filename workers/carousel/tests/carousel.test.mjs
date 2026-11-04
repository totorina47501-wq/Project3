import {it,describe} from 'node:test';
import {strict as assert} from 'node:assert';
import sharp from 'sharp';
import {mkdtemp,readFile,readdir,rm,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareCarousel,CarouselInputError} from '../src/process.mjs';

async function fixture(root) {
  const a=join(root,'first.png'),b=join(root,'second.png');
  await sharp({create:{width:640,height:360,channels:3,background:'#ffffff'}})
    .png().toFile(a);
  await sharp({create:{width:360,height:640,channels:3,background:'#000000'}})
    .png().toFile(b);
  return [a,b];
}
describe('Carrousel sans analyse IA et sans réseau',()=>{
  it('écrit un manifeste et 2 WebP sans métadonnées personnelles',async()=>{
    const root=await mkdtemp(join(tmpdir(),'mc-carousel-fixture-'));
    try{
      const slides=await fixture(root),out=join(root,'published');
      const result=await prepareCarousel(slides,out);
      assert.equal(result.aiCalls,0);
      assert.equal(result.slides.length,2);
      assert.deepEqual((await readdir(out)).sort(),
        ['manifest.json','slide-01.webp','slide-02.webp'].sort());
      const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
      assert.equal(manifest.slides[0].sourceWidth,640);
      assert.ok(manifest.slides.every(x=>x.outputSha256.length===64));
      assert.ok(!(await readdir(root)).some(x=>x.startsWith('.mc-carousel-stage-')));
      assert.ok(!(await readdir(root)).includes('published.lock'));
    }finally{await rm(root,{recursive:true,force:true})}
  });
  it('refuse des images dupliquées et plus de 5 éléments',async()=>{
    const root=await mkdtemp(join(tmpdir(),'mc-carousel-invalid-'));
    try{
      const [a,b]=await fixture(root);
      await assert.rejects(prepareCarousel([a,a],join(root,'duplicates')),CarouselInputError);
      await assert.rejects(prepareCarousel([a,b,a,b,a,b],join(root,'six')),CarouselInputError);
    }finally{await rm(root,{recursive:true,force:true})}
  });
  it('ne remplace pas un dossier existant',async()=>{
    const root=await mkdtemp(join(tmpdir(),'mc-carousel-existing-'));
    try{
      const inputs=await fixture(root),out=join(root,'proof');
      await mkdir(out);
      await writeFile(join(out,'private.txt'),'DO-NOT-TOUCH');
      await assert.rejects(prepareCarousel(inputs,out),CarouselInputError);
      assert.equal(await readFile(join(out,'private.txt'),'utf8'),'DO-NOT-TOUCH');
    }finally{await rm(root,{recursive:true,force:true})}
  });
  it('rejette un faux PNG sans toucher au dossier final',async()=>{
    const root=await mkdtemp(join(tmpdir(),'mc-carousel-invalid-header-'));
    try{
      const [a]=await fixture(root);
      const fake=join(root,'fake.png');await writeFile(fake,'invalid image bytes');
      await assert.rejects(prepareCarousel([a,fake],join(root,'out')));
      assert.ok(!(await readdir(root)).includes('out'));
      assert.ok(!(await readdir(root)).some(x=>x.startsWith('.mc-carousel-stage-')));
    }finally{await rm(root,{recursive:true,force:true})}
  });
});
