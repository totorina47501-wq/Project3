import { z } from 'zod';
import { platformSchema } from '../ai/schemas';

const id = z.string().uuid();
const role = z.enum(['admin', 'member']);
export const studioCheckSchema = z.object({
  caption: z.string().trim().min(1).max(10000),
  platform: platformSchema,
}).strict();
export const studioActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_workspace'), name: z.string().trim().min(1).max(100) }).strict(),
  z.object({ action: z.literal('accept_invitation'), token: z.string().regex(/^mc_invite_[0-9a-f]{64}$/) }).strict(),
  z.object({ action: z.literal('invite'), workspaceId: id, email: z.string().trim().email().max(320), role }).strict(),
  z.object({ action: z.literal('revoke_invitation'), workspaceId: id, id }).strict(),
  z.object({ action: z.literal('remove_member'), workspaceId: id, userId: id }).strict(),
  z.object({ action: z.literal('set_role'), workspaceId: id, userId: id, role }).strict(),
  z.object({ action: z.literal('create_key'), workspaceId: id, name: z.string().trim().min(1).max(80),
    scopes: z.array(z.enum(['checks:read', 'checks:write'])).min(1).max(2) }).strict(),
  z.object({ action: z.literal('revoke_key'), workspaceId: id, id }).strict(),
  z.object({ action: z.literal('check'), workspaceId: id,
    caption: z.string().trim().min(1).max(10000), platform: platformSchema }).strict(),
]);
export const workspaceIdSchema = id;
export type StudioAction = z.infer<typeof studioActionSchema>;
