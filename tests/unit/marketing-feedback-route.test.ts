import { afterEach, describe, expect, it } from 'vitest';
import { DELETE, POST } from '../../app/api/marketing/feedback/route';
import { __unsafeResetMarketingFeedbackStore } from '../../lib/marketing/feedback-store';

function postRequest(body: string, origin = 'https://local.test') {
  return new Request('https://local.test/api/marketing/feedback', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body,
  });
}

function deleteRequest(body: string, origin = 'https://local.test') {
  return new Request('https://local.test/api/marketing/feedback', {
    method: 'DELETE',
    headers: { origin, 'content-type': 'application/json' },
    body,
  });
}

afterEach(() => {
  __unsafeResetMarketingFeedbackStore();
});

describe('Marketing feedback API', () => {
  it('accepte un feedback consenti puis autorise sa suppression', async () => {
    const create = await POST(postRequest(JSON.stringify({
      message: 'Retour de communauté test: la checklist est claire et utile pour la préparation.',
      sourceUrl: 'https://example.test/post',
      consent: true,
      origin: 'landing',
      utm: { source: 'reddit', medium: 'community', campaign: 'pilot' },
    })));
    expect(create.status).toBe(200);
    const created = await create.json() as { feedbackId: string; deleteToken: string; retention: string };
    expect(created.retention).toBe('local_stub');
    const remove = await DELETE(deleteRequest(JSON.stringify({
      feedbackId: created.feedbackId,
      deleteToken: created.deleteToken,
    })));
    expect(remove.status).toBe(200);
    expect(await remove.json()).toMatchObject({ deleted: true });
  });

  it('refuse les envois sans consentement explicite', async () => {
    const response = await POST(postRequest(JSON.stringify({
      message: 'Ce texte dépasse vingt caractères mais sans consentement explicite.',
      consent: false,
      origin: 'landing',
    })));
    expect(response.status).toBe(422);
  });

  it('rejette les origines tierces', async () => {
    const response = await POST(postRequest(JSON.stringify({
      message: 'Ce texte dépasse vingt caractères avec consentement explicite.',
      consent: true,
      origin: 'guide',
    }), 'https://evil.test'));
    expect(response.status).toBe(403);
  });
});
