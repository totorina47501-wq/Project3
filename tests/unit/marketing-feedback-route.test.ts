import { describe, expect, it } from 'vitest';
import { DELETE, POST } from '../../app/api/marketing/feedback/route';

function request(method: 'POST' | 'DELETE', origin = 'https://local.test') {
  return new Request('https://local.test/api/marketing/feedback', {
    method,
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Un retour volontaire avec consentement mais sans stockage durable disponible.',
      consent: true,
      origin: 'landing',
      feedbackId: '11111111-1111-4111-8111-111111111111',
      deleteToken: '22222222-2222-4222-8222-222222222222',
    }),
  });
}

describe('Marketing feedback désactivé tant que la persistance manque', () => {
  it('ne produit aucun faux reçu ni identifiant de suppression', async () => {
    const response = await POST(request('POST'));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.json() as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    expect(body).not.toHaveProperty('feedbackId');
    expect(body).not.toHaveProperty('deleteToken');
    expect(body).not.toHaveProperty('receivedAt');
  });

  it('ne prétend pas avoir supprimé des données volatiles', async () => {
    const response = await DELETE(request('DELETE'));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('deleted');
  });

  it('refuse toujours les origines tierces', async () => {
    expect((await POST(request('POST', 'https://evil.test'))).status).toBe(403);
    expect((await DELETE(request('DELETE', 'https://evil.test'))).status).toBe(403);
  });
});
