import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({create:vi.fn(),file:vi.fn(),client:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('openai',()=>({toFile:m.file}));
vi.mock('@/lib/openai/client',()=>({openaiClient:m.client}));
import {transcribePreparedAudio} from '../../lib/openai/audio';
const wav=new Uint8Array(64);wav.set([82,73,70,70],0);wav.set([87,65,86,69],8);
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('OPENAI_PAUSED','false');vi.stubEnv('OPENAI_AUDIO_ENABLED','true');vi.stubEnv('OPENAI_API_KEY','fixture');m.file.mockResolvedValue('local-file');m.client.mockReturnValue({audio:{transcriptions:{create:m.create}}});m.create.mockResolvedValue({text:' Publicité — Test. ',usage:{type:'duration',seconds:2}});});
afterEach(()=>vi.unstubAllEnvs());
it('ne crée aucun fichier et ne contacte aucun client sans activation explicite',async()=>{
 vi.stubEnv('OPENAI_AUDIO_ENABLED','false');await expect(transcribePreparedAudio({bytes:wav,durationSeconds:2})).rejects.toThrow('désactivée');expect(m.file).not.toHaveBeenCalled();expect(m.client).not.toHaveBeenCalled();
});
it('rejette un WAV invalide avant le premier appel',async()=>{
 await expect(transcribePreparedAudio({bytes:new Uint8Array(64),durationSeconds:2})).rejects.toThrow('WAV');expect(m.create).not.toHaveBeenCalled();
});
it('transcrit le WAV validé et distingue la facturation par durée des tokens non fournis',async()=>{
 const result=await transcribePreparedAudio({bytes:wav,durationSeconds:2});
 expect(m.create).toHaveBeenCalledWith({model:'gpt-transcribe',file:'local-file'});expect(result.text).toBe('Publicité — Test.');
 expect(result.tokenCountsReported).toBe(false);expect(result.usage).toMatchObject({model:'gpt-transcribe',promptTokens:0,completionTokens:0,estimatedCostUsd:0.00015});
});
it('conserve les tokens si le fournisseur les rapporte et borne la transcription',async()=>{
 m.create.mockResolvedValue({text:'x'.repeat(13000),usage:{type:'tokens',input_tokens:30,output_tokens:10}});
 const result=await transcribePreparedAudio({bytes:wav,durationSeconds:2});expect(result.text.length).toBe(12000);expect(result.tokenCountsReported).toBe(true);expect(result.usage.promptTokens).toBe(30);
});
it('préserve le coût connu d’une réponse audio mal formée',async()=>{
 m.create.mockResolvedValue({text:null,usage:{type:'duration',seconds:2}});
 await expect(transcribePreparedAudio({bytes:wav,durationSeconds:2})).rejects.toMatchObject({name:'ModelOutputError',usage:{model:'gpt-transcribe',estimatedCostUsd:0.00015}});
});
