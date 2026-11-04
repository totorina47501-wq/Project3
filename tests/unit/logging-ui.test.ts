import { describe, expect, it, vi } from 'vitest';
import { logServerError, sanitizeLogContext } from '../../lib/security/logging';

describe('Journalisation serveur minimale et expurgée', () => {
  it('retient uniquement les métadonnées opérationnelles connues', () => {
    expect(sanitizeLogContext({ category: 'network', stage: 'text', status: 503,
      runtimeKeyPresent: false, email: 'personne@example.test', caption: 'Texte privé',
      token: 'mc_studio_private', authorization: 'Bearer secret', prompt: 'secret',
    })).toEqual({ category: 'network', stage: 'text', status: 503, runtimeKeyPresent: false });
  });
  it('ne journalise ni message, ni stack, ni cause d’une erreur', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const cause = new Error('personne@example.test Bearer private sk-proj-private');
      logServerError('archive_pdf_failure', new Error('Texte privé\nforge=true', { cause }), {
        category: 'provider', status: 503, token: 'eyJhbGciOiJ...signature',
      });
      expect(output).toHaveBeenCalledOnce();
      const serialized = JSON.stringify(output.mock.calls);
      expect(serialized).toContain('archive_pdf_failure');
      expect(serialized).toContain('provider');
      for (const value of ['personne@', 'Bearer', 'sk-proj', 'Texte privé', 'forge=', 'eyJhbG', 'stack', 'cause'])
        expect(serialized).not.toContain(value);
    } finally { output.mockRestore(); }
  });
  it('rejette aussi les injections dans le nom événement ou les champs autorisés', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      logServerError('failure\r\nforged=true', { name: 'personne@example.test', status: 503 }, {
        category: 'network\nforged=true', stage: 'Bearer secret', status: Infinity,
        missingVariables: ['NEXT_PUBLIC_SUPABASE_URL', 'SECRET=private'],
      });
      expect(output.mock.calls).toEqual([['[mentioncheck][invalid_event]', {
        errorType: 'unknown', missingVariables: ['NEXT_PUBLIC_SUPABASE_URL'],
      }]]);
    } finally { output.mockRestore(); }
  });
});
