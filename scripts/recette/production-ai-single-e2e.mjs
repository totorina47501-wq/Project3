// One-time real production AI smoke using the official public signup/login flows.
// All credentials are generated in-memory on the GitHub runner and never logged or persisted.
// Operator's separate Supabase SQL confirmation is required; no bypass of app auth.
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const qaPrefix='mentioncheckcorp+mcqa-';
export const prompt='Publicité : ce message présente un partenariat rémunéré pour un café imaginaire.';
const app='https://mentioncheck.app';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const expected='refs/heads/main';

export function responseSummary(sse) {
  const frames=sse.split(/\n\n+/).map(frame=>{
    const name=frame.match(/^event: ([^\n\r]+)/m)?.[1];
    const data=frame.match(/^data: ([^\n\r]+)/m)?.[1];
    if(!name||!data)return null;
    try{return {name,data:JSON.parse(data)};}catch{return {name,data:null};}
  }).filter(Boolean);
  const completed=frames.filter(x=>x.name==='done');
  if(completed.length!==1)return {completed:false,errors:frames.filter(x=>x.name==='error').length};
  const d=completed[0].data;
  if(!d || !['full','partial','rules_only'].includes(d.analysisMode))return {completed:false,errors:1};
  return {completed:true,mode:d.analysisMode,scoreValid:typeof d.score==='number'&&d.score>=0&&d.score<=100,
    aiFlagCount:Array.isArray(d.aiFlags)?d.aiFlags.length:0,
    rewritePresent:typeof d.rewrite?.rewrittenCaption==='string'&&d.rewrite.rewrittenCaption.length>0,
    warningCount:Array.isArray(d.warnings)?d.warnings.length:0};
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY,'totorina47501-wq/Project3');
  const manualMain=process.env.GITHUB_REF===expected &&
    process.env.GITHUB_EVENT_NAME==='push';
  const firstPartyQaPr=process.env.GITHUB_EVENT_NAME==='pull_request' &&
    process.env.GITHUB_HEAD_REF==='qa/execute-production-ai-once-20261114' &&
    process.env.GITHUB_BASE_REF==='main';
  assert.ok(manualMain || firstPartyQaPr,'Production QA not authorized for this ref');
  assert.equal(process.env.PRODUCTION_QA_MODE,'one-shot-text-only');
  const suffix=randomBytes(10).toString('hex');
  const email=qaPrefix+suffix+'@gmail.com';
  const password='McQA'+randomBytes(32).toString('base64url')+'!7z';
  const common={origin:app,'content-type':'application/json'};
  const started=Date.now();
  const registration=await fetch(app+'/api/auth/register',{
    method:'POST',headers:common,body:JSON.stringify({email,password}),signal:AbortSignal.timeout(25000)});
  if(registration.status!==201){
    console.log('QA_SIGNUP_FAILED_HTTP_'+registration.status);
    process.exitCode=1;return;
  }
  console.log('QA_SIGNUP_ACCEPTED_CONFIRM_IN_SUPABASE');
  console.log('QA_NO_PASSWORD_OR_SESSION_LOGGED');
  // Operator-only SQL: confirm the most recent single new qaPrefix auth.users
  // and set app_metadata.validation_fixture = true. No other account must be touched.
  let sessionCookies='';
  for(let i=0;i<5;i++){
    await sleep(i===0?38000:37000);
    const login=await fetch(app+'/api/auth/login',{
      method:'POST',headers:common,body:JSON.stringify({email,password}),signal:AbortSignal.timeout(24000)});
    if(login.status===200){
      const cookies=login.headers.getSetCookie();
      sessionCookies=cookies.map(s=>s.split(';')[0]).join('; ');
      if(!sessionCookies){console.log('QA_LOGIN_NO_SESSION_COOKIE');process.exitCode=1;return;}
      console.log('QA_AUTHENTICATED_LOGIN_200');
      break;
    }
    if(login.status!==401){
      console.log('QA_LOGIN_STOP_HTTP_'+login.status);process.exitCode=1;return;
    }
  }
  if(!sessionCookies){console.log('QA_CONFIRMATION_NOT_COMPLETED');process.exitCode=1;return;}
  const privateCheck=await fetch(app+'/api/mia/conversations',{
    method:'GET',headers:{cookie:sessionCookies,origin:app},signal:AbortSignal.timeout(18000)});
  if(privateCheck.status!==200){
    console.log('QA_PRIVATE_AUTH_FAILED_HTTP_'+privateCheck.status);process.exitCode=1;return;
  }
  console.log('QA_PRIVATE_SESSION_VALIDATED');
  // Exactly ONE paid check, only with the synthetic non-personal caption.
  const r=await fetch(app+'/api/check',{
    method:'POST',headers:{...common,cookie:sessionCookies},
    body:JSON.stringify({caption:prompt,platform:'instagram',execution:'ai',mediaType:'none'}),
    signal:AbortSignal.timeout(110000)});
  if(r.status!==200){
    console.log('QA_AI_CHECK_FAILED_HTTP_'+r.status);process.exitCode=1;return;
  }
  const summary=responseSummary(await r.text());
  if(!summary.completed){
    console.log('QA_AI_SSE_INCOMPLETE_OR_ERROR');process.exitCode=1;return;
  }
  console.log('QA_AI_RESULT_MODE '+summary.mode);
  console.log('QA_AI_RESULT_SCORE_VALID '+summary.scoreValid);
  console.log('QA_AI_RESULT_FLAGS '+summary.aiFlagCount);
  console.log('QA_AI_RESULT_REWRITE_PRESENT '+summary.rewritePresent);
  console.log('QA_AI_RESULT_WARNINGS '+summary.warningCount);
  console.log('QA_TIME_SECONDS '+Math.round((Date.now()-started)/1000));
  if(summary.mode!=='full' || !summary.scoreValid)process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(err=>{console.error('QA_STOP '+(err?.name==='TimeoutError'?'TIMEOUT':'UNEXPECTED_ERROR'));process.exitCode=1;});
}
