import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ server: vi.fn(), requireUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: mocks.server }));
vi.mock('@/lib/security/auth', () => ({
  requireUser: mocks.requireUser,
  publicError: () => ({ status: 503, message: 'Le service est momentanément indisponible.' }),
}));
vi.mock('server-only', () => ({}));
import Dashboard from '../../app/dashboard/page';
import Archives from '../../app/dashboard/archive/page';
import Settings from '../../app/dashboard/settings/page';
import { AIPreferences } from '../../components/AIPreferences';

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('Reprise des lectures privées sans inventer de données', () => {
  it('distingue un cockpit indisponible d’un historique vide et propose de recharger', async () => {
    const query = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { code: 'offline' } }) };
    mocks.server.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({data:{user:{id:'local'}}}) }, from: () => query });
    const html = renderToStaticMarkup(await Dashboard());
    expect(html).toContain('role="alert"');
    expect(html).toContain('Réessayer le chargement');
    expect(html).not.toContain('Aucune vérification.');
    expect(html).not.toMatch(/Vérifications récentes<\/p><strong[^>]*>0<\/strong>/);
  });

  it('conserve les filtres au rechargement des archives après erreur', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { code: 'offline' } }) };
    mocks.requireUser.mockResolvedValue({ user: { id: 'local' }, client: { from: () => query } });
    const html = renderToStaticMarkup(await Archives({ searchParams: Promise.resolve({ q: 'exemple', page: '2' }) }));
    expect(html).toContain('Réessayer le chargement');
    expect(html).toContain('q=exemple');
    expect(html).toContain('page=2');
    expect(html).not.toContain('Aucune archive sur cette page.');
  });

  it('ne présente pas une erreur de lecture des quotas comme zéro utilisation', async () => {
    mocks.server.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({data:{user:{id:'local'}}}) }, from: (table: string) => {
      const result = table === 'users' ? { data: { id: 'local', plan: 'solo' }, error: null }
        : { data: null, error: { code: 'offline' } };
      const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue(result),
        limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result) };
      return query;
    } });
    const html = renderToStaticMarkup(await Settings());
    expect(html).toContain('Quotas momentanément indisponibles.');
    expect(html).not.toMatch(/Checks<\/p><p[^>]*>0<\/p>/);
  });

  it.each([
    { createdAt: '2026-11-10T23:59:59Z', legacy: true },
    { createdAt: '2026-11-11T00:00:00Z', legacy: false },
  ])('ne déduit pas les quotas historiques du seul défaut Gratuit ($createdAt)', async ({ createdAt, legacy }) => {
    vi.stubEnv('PROMO_SOLO_ENABLED', 'false');
    mocks.server.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'local' } } }) },
      from: (table: string) => {
        if (table === 'promotional_solo_access') throw new Error('Production promotion table is absent');
        const result = table === 'users'
          ? { data: { id: 'local', plan: 'solo', created_at: createdAt }, error: null }
          : table === 'usage_monthly'
            ? { data: { checks_used: 7, rewrites_used: 2, mia_messages_used: 4 }, error: null }
            : { data: null, count: 0, error: null };
        const resolved = Promise.resolve(result);
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue(result),
          limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue(result),
          maybeSingle: vi.fn().mockResolvedValue(result), then: resolved.then.bind(resolved) };
      },
    });
    const html = renderToStaticMarkup(await Settings());
    const subscriptionSection = html.split('Mon abonnement actuel')[1]!.split('</section>')[0]!;
    if (legacy) {
      expect(subscriptionSection).toContain('Droits historiques en transition');
      expect(subscriptionSection).not.toContain('Gratuit');
      expect(subscriptionSection).not.toContain('quotas gratuits appliqués');
      expect(subscriptionSection).not.toMatch(/> \/ [13]<\/span>/);
      expect(subscriptionSection).toContain('>7</p>');
      expect(subscriptionSection).not.toContain('Solo offert');
    } else {
      expect(subscriptionSection).toContain('Gratuit');
      expect(subscriptionSection).toContain('quotas gratuits appliqués');
      expect(subscriptionSection).toMatch(/> \/ 3<\/span>/);
    }
  });

  it.each(['response', 'exception'])('masque les connexions si la vérification d’expiration échoue (%s)', async (failure) => {
    vi.stubEnv('SOCIAL_OAUTH_ENABLED', 'true');
    const rpc = failure === 'response'
      ? vi.fn().mockResolvedValue({ error: { code: 'offline' } })
      : vi.fn().mockRejectedValue(new Error('offline'));
    mocks.server.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'local' } } }) },
      rpc,
      from: (table: string) => {
        const result = table === 'users' ? { data: { id: 'local', plan: 'free' }, error: null }
          : table === 'social_accounts' ? { data: [{ id: 'account', platform: 'youtube', handle: 'stale-channel', connection_kind: 'oauth', connected_at: '2026-11-04' }], count: 1, error: null }
          : { data: null, error: null };
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue(result),
          limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue(result),
          maybeSingle: vi.fn().mockResolvedValue(result),
          then: Promise.resolve(result).then.bind(Promise.resolve(result)) };
      },
    });
    const html = renderToStaticMarkup(await Settings());
    expect(html).toContain('Inventaire momentanément indisponible');
    expect(html).not.toContain('Connexion OAuth active');
    expect(html).not.toContain('Comptes reliés : 1');
  });

  it('annonce comme une erreur la préférence qui n’a pas pu être lue', () => {
    const html = renderToStaticMarkup(createElement(AIPreferences, { initialUnavailable: true }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Préférence momentanément indisponible');
  });
});
