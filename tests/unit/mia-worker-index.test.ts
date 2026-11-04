import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Mia one-shot Worker index', () => {
  const route = readFileSync('app/api/internal/mia-index/route.ts','utf8');
  it('requiert un jeton serveur et ne renvoie jamais le jeton', () => {
    expect(route).toContain("authorized(request, token)");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("'Cache-Control': 'no-store'");
  });
  it('est limité à cinq références validées et ne fait aucun appel en dry-run', () => {
    expect(route).toContain('const MAX_DOCUMENTS = 5');
    expect(route).toContain('validatedLawSource(item)');
    expect(route.indexOf('if (!execute) return Response.json')).toBeLessThan(route.indexOf('await generateLegalEmbedding'));
  });
  it('ne permet pas une dépense si le flag embeddings est désactivé', () => {
    expect(route).toContain("process.env.OPENAI_EMBEDDINGS_ENABLED !== 'true'");
    expect(route).toContain("process.env.OPENAI_PAUSED === 'true'");
  });
});
