import { describe, expect, it } from 'vitest';
import { missingAuthConfig, categorizeAuthError } from '../../lib/security/auth-diagnostics';
describe('Diagnostic sécurisé de la connexion', () => {
  it('identifie la configuration manquante sans retourner de valeurs', () => {
    const missing = missingAuthConfig({ supabaseUrl:'https://example.test', supabaseKey:'' });
    expect(missing).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    expect(JSON.stringify(missing)).not.toContain('https://example.test');
  });
  it('différencie mot de passe, limitation et panne externe', () => {
    expect(categorizeAuthError({ code:'invalid_credentials',status:400 }))
      .toBe('invalid_credentials');
    expect(categorizeAuthError({ status:429 })).toBe('rate_limited');
    expect(categorizeAuthError({ status:503 })).toBe('provider_unavailable');
  });
  it('ne loggue jamais un texte brut fourni par un tiers', () => {
    expect(categorizeAuthError(new Error('secret'))).toBe('configuration_error');
  });
});
