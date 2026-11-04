import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('Indexeur légal : aucun appel par défaut', () => {
  it('affiche son aide sans clé Supabase ni OpenAI', () => {
    const result = spawnSync(process.execPath, ['scripts/mia/index-law-vectors.mjs', '--help'], {
      encoding: 'utf8', timeout: 6000, env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('aperçu sans appel OpenAI');
  });
  it('refuse toute option inconnue sans requête réseau', () => {
    const result = spawnSync(process.execPath, ['scripts/mia/index-law-vectors.mjs', '--paid'], {
      encoding: 'utf8', timeout: 6000, env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Option non reconnue');
  });
});
