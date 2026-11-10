import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/lead-magnet/route';
import { LEAD_MAGNET_FILENAME } from '../../lib/marketing/lead-magnet';

describe('Lead magnet download route', () => {
  it('retourne un fichier texte avec headers de téléchargement', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('content-disposition')).toContain(LEAD_MAGNET_FILENAME);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const text = await response.text();
    expect(text).toContain('pas un avis juridique');
    expect(text).toContain('legifrance.gouv.fr');
  });
});
