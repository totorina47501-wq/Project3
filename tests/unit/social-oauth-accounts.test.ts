import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createSocialOAuthAccountStore } from '@/lib/social/oauth/accounts';

describe('Social OAuth account store', () => {
  it('lit les identifiants de révocation Facebook uniquement côté serveur', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: ['{"userAccessToken":"offline-user-token"}'],
      error: null,
    });
    const store = createSocialOAuthAccountStore({ rpc } as never);

    await expect(store.readFacebookCredentials({ userId: 'owner-id' }))
      .resolves.toEqual(['{"userAccessToken":"offline-user-token"}']);
    expect(rpc).toHaveBeenCalledWith('read_facebook_oauth_credentials', {
      p_user: 'owner-id',
    });
  });

  it('mappe uniquement le code de quota Facebook à un conflit client', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'MC001', message: 'Social account limit reached' },
    });
    const store = createSocialOAuthAccountStore({ rpc } as never);

    await expect(store.saveFacebookPageSelection({
      userId: 'owner-id',
      sessionId: 'session-id',
      pageIds: ['123'],
    })).rejects.toMatchObject({
      status: 409,
      message: 'La limite de 3 comptes du plan Solo est atteinte.',
    });
  });

  it('ne transforme pas une autre erreur interne en message de quota', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Internal credential state' },
    });
    const store = createSocialOAuthAccountStore({ rpc } as never);

    await expect(store.saveFacebookPageSelection({
      userId: 'owner-id',
      sessionId: 'session-id',
      pageIds: ['123'],
    })).rejects.toThrow('Facebook Page selection unavailable.');
  });
});
