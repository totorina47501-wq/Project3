#!/usr/bin/env node
// Préparation des carrousels sur hôte isolé. Aucun appel IA ni réseau.
import sharp from 'sharp';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, realpath, mkdtemp, open, rm, rename, writeFile, stat, unlink } from 'node:fs/promises';
import { dirname, basename, resolve, join, extname } from 'node:path';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 5;
const EXTENSIONS = new Set(['.jpg','.jpeg','.png','.webp']);
const FORMATS = new Set(['jpeg','png','webp']);

export class CarouselInputError extends Error {}

async function hashFile(path) {
  const hash=createHash('sha256');
  for await(const part of createReadStream(path)) hash.update(part);
  return hash.digest('hex');
}
async function ensureAbsent(path) {
  try { await lstat(path); }
  catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new CarouselInputError('Répertoire de sortie déjà utilisé.');
}
export async function prepareCarousel(sourcePaths, destination) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length < 2 || sourcePaths.length > MAX_IMAGES)
    throw new CarouselInputError('Carrousel limité à 2-5 images.');
  const files=sourcePaths.map(path=>resolve(path));
  if (new Set(files).size !== files.length) throw new CarouselInputError('Fichiers dupliqués.');
  const parent=await realpath(dirname(resolve(destination)));
  const out=join(parent,basename(resolve(destination)));
  await ensureAbsent(out);
  const lockPath=out+'.lock';
  let lock,stage;
  try {
    try { lock=await open(lockPath,'wx',0o600); }
    catch(error) {
      if(error?.code==='EEXIST') throw new CarouselInputError('Traitement déjà en cours.');
      throw error;
    }
    await ensureAbsent(out);
    stage=await mkdtemp(join(parent,'.mc-carousel-stage-'));
    const slides=[];
    for(let i=0;i<files.length;i++) {
      const input=files[i];
      if (!input) throw new CarouselInputError('Image manquante.');
      const info=await lstat(input);
      if(!info.isFile() || info.isSymbolicLink() ||
          info.size<1 || info.size>MAX_IMAGE_BYTES || !EXTENSIONS.has(extname(input).toLowerCase()))
        throw new CarouselInputError('Image JPEG/PNG/WebP limitée à 8 Mio.');
      const image=sharp(input,{limitInputPixels:20_000_000,failOn:'error',animated:false});
      const metadata=await image.metadata();
      if(!metadata.format || !FORMATS.has(metadata.format) ||
          !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1 ||
          metadata.width>6000 || metadata.height>6000)
        throw new CarouselInputError('Image corrompue, animée ou trop grande.');
      const name='slide-'+String(i+1).padStart(2,'0')+'.webp';
      // Rotation selon orientation EXIF, puis suppression des métadonnées de sortie.
      await image.rotate().resize(1024,1024,{fit:'inside',withoutEnlargement:true})
        .webp({quality:84,effort:4}).toFile(join(stage,name));
      const output=await stat(join(stage,name));
      if(output.size<1 || output.size>MAX_IMAGE_BYTES)
        throw new CarouselInputError('Transcodage image invalide.');
      slides.push({
        position:i+1,sourceSha256:await hashFile(input),
        sourceWidth:metadata.width,sourceHeight:metadata.height,
        outputFile:name,outputSha256:await hashFile(join(stage,name)),
        outputBytes:output.size,
      });
    }
    const report={schemaVersion:1,processor:'mentioncheck-carousel-offline-v1',
      aiCalls:0,slides,notice:'Images préparées sans analyse de conformité.'};
    await writeFile(join(stage,'manifest.json'),JSON.stringify(report,null,2),
      {mode:0o600,flag:'wx'});
    await ensureAbsent(out);
    await rename(stage,out);
    stage=undefined;
    return report;
  } finally {
    if(stage) await rm(stage,{recursive:true,force:true});
    if(lock){
      await lock.close();
      await unlink(lockPath).catch(err=>{if(err?.code!=='ENOENT')throw err});
    }
  }
}
if(process.argv[1] && basename(process.argv[1])==='process.mjs') {
  const args=process.argv.slice(2);
  if(args.length<3 || args.length>6) {
    process.stderr.write('Usage: node workers/carousel/src/process.mjs <sortie> <image1> <image2> [image3..5]\n');
    process.exitCode=2;
  }else{
    const [out,...inputs]=args;
    prepareCarousel(inputs,out)
      .then(result=>process.stdout.write(JSON.stringify({slides:result.slides.length,aiCalls:0})+'\n'))
      .catch(()=>{process.stderr.write('Préparation carrousel impossible.\n');process.exitCode=1});
  }
}
