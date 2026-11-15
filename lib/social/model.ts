import { z } from 'zod';
import { platformSchema, toneSchema } from '@/lib/ai/schemas';

export const SOCIAL_COLUMNS = 'id,platform,handle,display_name,connection_kind,connected_at';
export const SOCIAL_PAGE_SIZE = 25;
export const socialPlatformSchema = z.enum(['instagram', 'tiktok', 'youtube', 'linkedin', 'facebook']);
export const manualSocialPlatformLabels = {instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',linkedin:'LinkedIn'};
export const socialAccountSchema = z.object({
  platform: platformSchema,
  handle: z.string().trim().transform(value=>value.replace(/^@/,'').toLowerCase())
    .pipe(z.string().min(1).max(200).regex(/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u)),
}).strict();
export const preferenceSchema = z.object({rewriteTone:toneSchema}).strict();
export type RewriteTone = z.infer<typeof toneSchema>;
export type SocialDraft = z.infer<typeof socialAccountSchema>;
export type SocialPlatform = z.infer<typeof socialPlatformSchema>;
export type SocialAccount = {platform:SocialPlatform;handle:string;id:string;display_name?:string|null;connection_kind:'manual'|'oauth'|'expired'|'unknown';connected_at:string};
export function socialPage(request:Request):number {
  const value=new URL(request.url).searchParams.get('page')??'1';
  if(!/^[1-9]\d{0,3}$/.test(value))throw new Error('Page invalide.');
  return Number(value);
}
export const platformLabels = {instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',linkedin:'LinkedIn',facebook:'Facebook'};
