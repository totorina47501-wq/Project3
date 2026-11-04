// Chemin : lib/ai/rewriter.ts
import { chatText } from '@/lib/openai';
import { REWRITE_SYSTEM } from '@/lib/ai/prompts';
import { rewriteModelSchema, type Violation } from '@/lib/ai/schemas';
import type { z } from 'zod';
import { improveSponsoredRewrite } from '@/lib/ai/disclosure';

export type Tone = 'institutionnel' | 'naturel' | 'créatif';
export type RewriteResult = z.infer<typeof rewriteModelSchema>;

export async function rewriteCompliant(
  caption: string,
  violations: Violation[],
  tone: Tone = 'naturel',
) {
  const result = await chatText(
    REWRITE_SYSTEM,
    JSON.stringify({ tonalité: tone, légende_originale: caption, problèmes: violations }),
    rewriteModelSchema,
  );
  return { ...improveSponsoredRewrite(result.value, violations), usage: result.usage };
}
