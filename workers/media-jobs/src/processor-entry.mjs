// Sous-processus privé : jamais un serveur, aucun fournisseur ni queue distante.
// L'enfant attend que son PID soit journalisé avant tout décodage.
if(process.send){
  process.once('disconnect',()=>{
    if(process.platform!=='win32')process.kill(-process.pid,'SIGKILL');
    else process.exit(1);
  });
  await new Promise(resolve=>process.once('message',message=>{if(message==='start')resolve();}));
}
const [kind,destination,...inputs]=process.argv.slice(2);
try{
  if(kind==='video'){
    const {processVideo}=await import('../../video/src/process.mjs');
    await processVideo(inputs[0],destination);
  }else if(kind==='carousel'){
    const {prepareCarousel}=await import('../../carousel/src/process.mjs');
    await prepareCarousel(inputs,destination);
  }else throw new Error('Type refusé');
}catch{
  process.exitCode=1;
}
// Fermer explicitement le canal IPC une fois les opérations locales terminées.
process.removeAllListeners('disconnect');
if(process.connected)process.disconnect();
