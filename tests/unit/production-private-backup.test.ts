import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const file = resolve(process.cwd(), 'scripts/recette/production-private-backup.sh');
const source = readFileSync(file, 'utf8');
const exec = (env: Record<string, string>) => spawnSync('bash', [file, '--backup'], {
  env: { ...process.env, CI: '', GITHUB_ACTIONS: '', DOCKER_HOST: '', DOCKER_CONTEXT: '',
    MC_BACKUP_DIR: '', MC_BACKUP_WORKDIR: '', MC_BACKUP_AGE_IDENTITY: '',
    MENTIONCHECK_PROD_POSTGRES_URL: '', ...env },
  encoding: 'utf8',
  timeout: 4000,
});

describe('Production private backup security boundary (offline)', () => {
  it('refuses CI before reading database credentials', () => {
    const run = exec({ CI: 'true' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Refused CI / GitHub Actions');
  });
  it('refuses a missing URL before running a dump', () => {
    const run = exec({});
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Production DB URL missing');
  });
  it('refuses the known staging project, even with TLS', () => {
    const run = exec({ MENTIONCHECK_PROD_POSTGRES_URL:
      'postgresql://postgres:fake@db.ukvgnkxgzyhswgpnvyzz.supabase.co:5432/postgres?sslmode=require' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('DB target does not match');
    expect(run.stderr).not.toContain('fake@');
  });
  it('refuses production without TLS and transaction-pooler port 6543', () => {
    for (const url of [
      'postgresql://postgres:fake@db.zcztvberuihphqklhjsr.supabase.co:5432/postgres',
      'postgresql://postgres.zcztvberuihphqklhjsr:fake@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require',
    ]) {
      const run=exec({ MENTIONCHECK_PROD_POSTGRES_URL:url });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain('DB target does not match');
    }
  });
  it('never schedules backup on GitHub, commits secrets or uploads an artifact', () => {
    expect(source).toContain('GITHUB_ACTIONS');
    expect(source).toContain('git -C "$path" rev-parse --show-toplevel');
    expect(source).toContain('age -r "$recipient"');
    expect(source).toContain('age -d -i "$key"');
    expect(source).toContain('storage object bytes need a separate backup');
    expect(source).not.toMatch(/actions\/upload-artifact|git add|git push|wrangler deploy/);
  });
});
