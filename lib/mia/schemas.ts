// Chemin : lib/mia/schemas.ts
import { z } from 'zod';

export const miaQuestionSchema = z.object({
  question: z.string().trim().min(3, 'Pose une question à Mia.').max(1600),
  conversationId: z.string().uuid().optional(),
  verificationId: z.string().uuid().optional(),
}).strict();
export type MiaQuestion = z.infer<typeof miaQuestionSchema>;

export const miaSourceSchema = z.object({
  articleRef: z.string(),
  sourceUrl: z.string().url(),
  effectiveOn: z.string().nullable(),
  checkedAt: z.string().nullable(),
});

export const miaMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(5000),
  sources: z.array(miaSourceSchema).max(5).optional(),
});
export type MiaMessage = z.infer<typeof miaMessageSchema>;

export const miaModelSchema = z.object({
  answer: z.string().trim().min(1).max(3500),
  citations: z.array(z.string()).max(5),
});
