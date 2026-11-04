// Validation FFprobe, pure et offline.
export class VideoInputError extends Error {}
export function validateProbe(probe,bytes){
  if(!Number.isSafeInteger(bytes)||bytes<1||bytes>50*1024*1024)throw new VideoInputError('50 Mio maximum');
  if(!/mov|mp4/.test(String(probe?.format?.format_name)))throw new VideoInputError('MP4/MOV uniquement');
  const v=probe?.streams?.find(s=>s.codec_type==='video');
  if(!v || !Number.isInteger(v.width)||!Number.isInteger(v.height)||
    Math.min(v.width,v.height)<16||Math.max(v.width,v.height)>4096)
    throw new VideoInputError('Flux vidéo invalide');
  const duration=Number(probe.format.duration??v.duration);
  if(!Number.isFinite(duration)||duration<=0||duration>60)throw new VideoInputError('60 s maximum');
  return {durationSeconds:duration,width:v.width,height:v.height,
    hasAudio:probe.streams.some(s=>s.codec_type==='audio'),
    codec:String(v.codec_name??'unknown').slice(0,40)};
}
export function sampleTimes(s){
  if(!Number.isFinite(s)||s<=0||s>60)throw new VideoInputError('Durée invalide');
  return [.15,.5,.85].map(p=>Math.max(0,Math.min(s-.01,Math.round(s*p*1000)/1000)))
    .filter((value,i,all)=>i===0||value>all[i-1]);
}
