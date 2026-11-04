#!/usr/bin/env node
import {open,constants} from 'node:fs/promises';
import {writeSync} from 'node:fs';
import {runMediaJob,recoverMediaJob} from './jobs.mjs';
const args=process.argv.slice(2);
if(args.length!==3){
  writeSync(2,'Usage: node workers/media-jobs/src/run.mjs job.json entrées sorties\n       node workers/media-jobs/src/run.mjs --recover identifiant sorties\n');
  process.exitCode=2;
}else{
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  try{
    let result;
    if(args[0]==='--recover')result=await recoverMediaJob(args[1],{outputRoot:args[2]});
    else{
      const handle=await open(args[0],constants.O_RDONLY|constants.O_NOFOLLOW);
      let job;
      try{
        const info=await handle.stat();
        if(!info.isFile()||info.size<1||info.size>65536)throw new Error('Manifeste invalide');
        const buffer=Buffer.alloc(65537);
        const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
        if(bytesRead!==info.size)throw new Error('Manifeste modifié');
        job=JSON.parse(buffer.toString('utf8',0,bytesRead));
      }finally{await handle.close();}
      result=await runMediaJob(job,{inputRoot:args[1],outputRoot:args[2],signal:controller.signal});
    }
    writeSync(1,JSON.stringify({success:true,state:result.state,aiCalls:0})+'\n');
  }catch(error){
    writeSync(2,JSON.stringify({success:false,code:error.name==='MediaJobError'?error.code:'JOB_FAILED',aiCalls:0})+'\n');
    process.exitCode=1;
  }finally{
    process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);
  }
}
