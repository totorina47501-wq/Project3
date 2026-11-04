// Validation FFprobe, pure et offline.
export class VideoInputError extends Error {}
export function validateProbe(probe,bytes){
  if(!Number.isSafeInteger(bytes)||bytes<1||bytes>50*1024*1024)throw new VideoInputError('50 Mio maximum');
  const formats=String(probe?.format?.format_name??'').split(',');
  if(!formats.some(format=>['mov','mp4'].includes(format.trim())))
    throw new VideoInputError('MP4/MOV uniquement');
  if(!Array.isArray(probe?.streams))throw new VideoInputError('Flux manquants');
  const v=probe.streams.find(s=>s?.codec_type==='video');
  if(!v || !Number.isInteger(v.width)||!Number.isInteger(v.height)||
    Math.min(v.width,v.height)<16||Math.max(v.width,v.height)>4096)
    throw new VideoInputError('Flux vidéo invalide');
  const rawDuration=probe?.format?.duration ?? v.duration;
  // Number(null) et Number('') valent zéro ; les métadonnées doivent être explicites.
  if(typeof rawDuration!=='string' && typeof rawDuration!=='number')
    throw new VideoInputError('Durée absente');
  if(String(rawDuration).trim()==='')throw new VideoInputError('Durée absente');
  const duration=Number(rawDuration);
  if(!Number.isFinite(duration)||duration<=0||duration>60)throw new VideoInputError('60 s maximum');
  return {durationSeconds:duration,width:v.width,height:v.height,
    hasAudio:probe.streams.some(s=>s?.codec_type==='audio'),
    codec:String(v.codec_name??'unknown').slice(0,40)};
}
export function sampleTimes(s){
  if(!Number.isFinite(s)||s<=0||s>60)throw new VideoInputError('Durée invalide');
  return [.15,.5,.85].map(p=>Math.max(0,Math.min(s-.01,Math.round(s*p*1000)/1000)))
    .filter((value,i,all)=>i===0||value>all[i-1]);
}
