import { describe, expect, it } from 'vitest';
import { createSecret, hashSecret, parseApiKey } from '../../lib/studio/secrets';
import { buildBrandSafetyReport, evaluateStudioText } from '../../lib/studio/report';
import { studioActionSchema, studioCheckSchema } from '../../lib/studio/schemas';

describe('Studio secrets', () => {
  it('génère deux secrets indépendants et ne stocke que leur empreinte SHA-256', async () => {
    const first = await createSecret('key');
    const second = await createSecret('key');
    expect(first.secret).toMatch(/^mc_studio_[0-9a-f]{64}$/);
    expect(first.secret).not.toBe(second.secret);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).toBe(await hashSecret(first.secret));
    expect(first.hash).not.toContain(first.secret);
    expect(first.prefix).toBe(first.secret.slice(0, 18));
  });
  it('sépare les jetons invitation des clés API', async () => {
    const invitation = await createSecret('invitation');
    expect(invitation.secret).toMatch(/^mc_invite_[0-9a-f]{64}$/);
    expect(parseApiKey(`Bearer ${invitation.secret}`)).toBeNull();
    expect(parseApiKey('Bearer mc_studio_short')).toBeNull();
    expect(parseApiKey(null)).toBeNull();
    const key = await createSecret('key');
    expect(parseApiKey(`Bearer ${key.secret}`)).toBe(key.secret);
  });
});

describe('Studio contrôle et rapport déterministes', () => {
  it('réutilise les règles de divulgation sans modèle IA', () => {
    const result = evaluateStudioText({ caption: 'Merci @marque pour cette collab', platform: 'instagram' });
    expect(result.violations.map((v) => v.code)).toContain('R1');
    expect(result.analysisMode).toBe('rules_only');
    expect(result.score).toBe(13);
    expect(result.riskLevel).toBe('critical');
    expect(evaluateStudioText({ caption: 'Publicité pour cette marque', platform: 'instagram' }).score).toBe(100);
  });
  it('exclut les données sans appartenance explicite et les autres équipes du rapport', () => {
    const rows = [
      { id: 'a', workspace_id: 'team-a', caption: 'Publicité', platform: 'instagram' as const },
      { id: 'b', workspace_id: 'team-b', caption: 'Sans mention', platform: 'tiktok' as const },
      { id: 'private', workspace_id: null, caption: 'Mon historique privé', platform: 'youtube' as const },
    ];
    const report = buildBrandSafetyReport('team-a', rows);
    expect(report.total).toBe(1);
    expect(report.averageScore).toBe(100);
    expect(report.violationCounts).toEqual({});
    expect(JSON.stringify(report)).not.toContain('historique');
    expect(buildBrandSafetyReport('team-c', rows).averageScore).toBeNull();
    expect(buildBrandSafetyReport('team-a', [...rows].reverse())).toEqual(report);
  });
});

describe('Studio entrées strictes', () => {
  it('refuse toute sélection de plan, identité ou exécution IA depuis le client', () => {
    expect(studioCheckSchema.safeParse({ caption: 'Publicité', platform: 'instagram', execution: 'ai' }).success).toBe(false);
    expect(studioActionSchema.safeParse({ action: 'create_workspace', name: 'Équipe', plan: 'studio' }).success).toBe(false);
    expect(studioActionSchema.safeParse({ action: 'create_workspace', name: 'Équipe', actor: 'other' }).success).toBe(false);
  });
  it('ne permet pas de créer un owner via une invitation ni de modifier le propriétaire', () => {
    expect(studioActionSchema.safeParse({ action: 'invite', workspaceId: crypto.randomUUID(), email: 'a@example.test', role: 'owner' }).success).toBe(false);
    expect(studioActionSchema.safeParse({ action: 'set_role', workspaceId: crypto.randomUUID(), userId: crypto.randomUUID(), role: 'owner' }).success).toBe(false);
  });
});
