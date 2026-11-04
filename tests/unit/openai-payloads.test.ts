import { describe, expect, it } from 'vitest';
import { validatePreparedAudio, validateEmbeddingText, validateEmbeddingVector }
  from '../../lib/openai/validation';

const wav = new Uint8Array(64);
wav.set([82,73,70,70],0); // RIFF
wav.set([87,65,86,69],8); // WAVE

describe('Validations OpenAI hors ligne',()=>{
  it('accepte seulement des échantillons WAV bornés',()=>{
    expect(()=>validatePreparedAudio({bytes:wav,durationSeconds:30})).not.toThrow();
    expect(()=>validatePreparedAudio({bytes:wav,durationSeconds:61})).toThrow();
    expect(()=>validatePreparedAudio({bytes:new Uint8Array(64),durationSeconds:10})).toThrow();
    expect(()=>validatePreparedAudio({bytes:new Uint8Array(0),durationSeconds:10})).toThrow();
  });
  it('rejette les prompts embedding excessifs ou vides',()=>{
    expect(validateEmbeddingText('  collaboration commerciale  ')).toBe('collaboration commerciale');
    expect(()=>validateEmbeddingText(' '.repeat(10))).toThrow();
    expect(()=>validateEmbeddingText('a'.repeat(5001))).toThrow();
  });
  it('refuse les vecteurs mal formés avant toute écriture',()=>{
    expect(()=>validateEmbeddingVector(Array(1536).fill(0.4))).not.toThrow();
    expect(()=>validateEmbeddingVector(Array(3072).fill(0.4))).toThrow();
    const nanVector=Array(1536).fill(0.4);nanVector[0]=NaN;
    expect(()=>validateEmbeddingVector(nanVector)).toThrow();
  });
});
