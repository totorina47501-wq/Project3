// Chemin : lib/ai/text-analyzer.ts
import { chatText } from '@/lib/openai';
import { TEXT_SYSTEM } from '@/lib/ai/prompts';
import { textModelSchema, type Platform } from '@/lib/ai/schemas';
import { applyRules, riskFrom, levelFromRisk } from '@/lib/ai/rules';

export async function analyzeText(caption: string, platform: Platform,
  context?: {observations:Array<{name:string;analysis:string}>;transcript?:string}) {
  const ruleViolations = applyRules(caption, platform);
  const result = await chatText(
    TEXT_SYSTEM,
    JSON.stringify({ plateforme: platform, légende: caption, ...(context?{contexteMédia:context}:{}) }),
    textModelSchema,
  );
  const aiFlags = result.value.flags;
  const confidence = aiFlags.length > 0
    ? Math.max(...aiFlags.map((flag) => flag.confidence))
    : 0;
  const riskScore = riskFrom(ruleViolations, confidence);
  return {
    ruleViolations,
    aiFlags,
    riskScore,
    riskLevel: levelFromRisk(riskScore),
    usage: result.usage,
  };
}
