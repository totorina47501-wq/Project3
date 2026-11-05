import { beforeEach,expect,it,vi } from 'vitest';
import { z } from 'zod';
const calls=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/openai/client',()=>({openaiClient:()=>({chat:{completions:{create:calls.create}}})}));
import { chatText } from '../../lib/openai';
import { ModelOutputError } from '../../lib/openai/errors';
const schema=z.object({rewrittenCaption:z.string(),changes:z.array(z.object({before:z.string(),after:z.string(),reason:z.string()})),confidence:z.number().min(0).max(1)});
const valid={rewrittenCaption:'Publicité — Démo.',changes:[{before:'Démo.',after:'Publicité — Démo.',reason:'Mention explicite.'}],confidence:.9};
beforeEach(()=>calls.create.mockReset());
const completion=(content:string,extra:Record<string,unknown>={})=>({choices:[{message:{content},finish_reason:'stop',...extra}],usage:{prompt_tokens:100,completion_tokens:50}});
it('impose un schéma JSON strict dont changes est un tableau, sans conserver les données',async()=>{
  calls.create.mockResolvedValue(completion(JSON.stringify(valid)));
  expect((await chatText('Consigne','Donnée fictive',schema)).value).toEqual(valid);
  expect(calls.create.mock.calls[0]![0]).toMatchObject({store:false,response_format:{type:'json_schema',json_schema:{strict:true}}});
});
it('conserve le coût et la catégorie si la réponse JSON ne respecte pas le schéma',async()=>{
  calls.create.mockResolvedValue(completion(JSON.stringify({...valid,changes:{before:'Texte privé'}})));
  try{await chatText('Consigne','Donnée fictive',schema);throw new Error('Refus attendu');}
  catch(error){expect(error).toBeInstanceOf(ModelOutputError);const failure=error as ModelOutputError;expect(failure.kind).toBe('schema_mismatch');expect(failure.usage.promptTokens).toBe(100);expect(failure.usage.estimatedCostUsd).toBeGreaterThan(0);expect(JSON.stringify(failure)).not.toContain('Texte privé');}
});
it('distingue une réponse tronquée et un refus du modèle',async()=>{
  for(const [extra,kind] of [[{finish_reason:'length'},'token_limit'],[{message:{content:null,refusal:'Motif privé'}},'refusal']] as const){
    calls.create.mockResolvedValue(completion('invalide',extra));
    await expect(chatText('Consigne','Donnée fictive',schema)).rejects.toMatchObject({name:'ModelOutputError',kind});
  }
});
