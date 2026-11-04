// Chemin : lib/ai/schemas.ts
import { z } from 'zod';

export const platformSchema = z.enum(['instagram', 'tiktok', 'youtube', 'linkedin']);
export const mediaTypeSchema = z.enum(['none', 'image', 'carousel', 'video']);
export const toneSchema = z.enum(['naturel', 'créatif', 'institutionnel']);

export const checkInputSchema = z.object({
  caption: z.string().trim().min(1, 'Écris une légende.').max(10000),
  platform: platformSchema,
  execution: z.enum(['rules_only', 'ai']).default('rules_only'),
  mediaUrl: z.string().min(5).max(500).optional(),
  mediaType: mediaTypeSchema.default('none'),
}).strict().refine(
  (v) => (v.mediaType === 'none') === (v.mediaUrl === undefined),
  'Précise un média et son type ensemble.',
);

export const violationSchema = z.object({
  code: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  explanation: z.string(),
  source: z.string(),
});
export type Violation = z.infer<typeof violationSchema>;
export type Platform = z.infer<typeof platformSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const aiFlagSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
});
export type AiFlag = z.infer<typeof aiFlagSchema>;

export const textModelSchema = z.object({
  flags: z.array(aiFlagSchema).max(6),
});
export const visionModelSchema = z.object({
  hasBrandLogo: z.boolean(),
  brandNames: z.array(z.string()).max(8),
  hasPromoCode: z.boolean(),
  hasPeople: z.boolean(),
  confidence: z.number().min(0).max(1),
  rawAnalysis: z.string().max(2000),
});
export const rewriteModelSchema = z.object({
  rewrittenCaption: z.string(),
  changes: z.array(z.object({
    before: z.string(),
    after: z.string(),
    reason: z.string(),
  })).max(12),
  confidence: z.number().min(0).max(1),
});
export type Rewrite = z.infer<typeof rewriteModelSchema>;

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ModelTelemetry = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
};

export type AnalysisResult = {
  score: number;
  riskLevel: RiskLevel;
  violations: Violation[];
  aiFlags: AiFlag[];
  rewrite: Rewrite | null;
  hashSha256: string;
  verificationId: string;
  analysisMode: 'full' | 'partial' | 'rules_only';
  warnings: string[];
};
