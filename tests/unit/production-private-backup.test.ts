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


describe('Production private backup — offline Docker restore verification', () => {
  const verify = (env: Record<string, string>) => spawnSync('bash', [file, '--verify-restore'], {
    env: { ...process.env, CI: '', GITHUB_ACTIONS: '', DOCKER_HOST: '', DOCKER_CONTEXT: '',
      MENTIONCHECK_PROD_POSTGRES_URL: '', MENTIONCHECK_STAGING_POSTGRES_URL: '',
      MC_ENCRYPTED_ARCHIVE: '', MC_BACKUP_WORKDIR: '', MC_BACKUP_AGE_IDENTITY: '',
      MC_EXPECT_AUTH_USERS: '', MC_EXPECT_APP_USERS: '', MC_EXPECT_QUOTA_ROWS: '',
      MC_EXPECT_STORAGE_METADATA: '', ...env },
    encoding: 'utf8',
    timeout: 4000,
  });
  it('keeps the shell syntax valid', () => {
    const run = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
    expect(run.status).toBe(0);
  });
  it('rejects CI on the restoration mode before touching Docker', () => {
    const run = verify({ GITHUB_ACTIONS: 'true' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Refused CI / GitHub Actions');
  });
  it('rejects remote database URLs even with a requested local restore', () => {
    const run = verify({ MENTIONCHECK_PROD_POSTGRES_URL:
      'postgresql://postgres:private@db.zcztvberuihphqklhjsr.supabase.co:5432/postgres?sslmode=require' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Restore mode refuses remote database URLs');
    expect(run.stderr).not.toContain('private@');
  });
  it('rejects nonlocal Docker host overrides', () => {
    const run = verify({ DOCKER_HOST: 'tcp://example.invalid:2375' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Remote Docker endpoints');
  });
  it('never exposes a network port, host bind mount, secrets or a false full-PRA claim', () => {
    expect(source).toContain('--verify-restore');
    expect(source).toContain('--network none');
    expect(source).toContain('--tmpfs /var/lib/postgresql/data');
    expect(source).toContain('--single-transaction --set ON_ERROR_STOP=1');
    expect(source).toContain('MC_LOGICAL_DOCKER_RESTORE_VERIFIED');
    expect(source).toContain('STORAGE_OBJECT_BYTES_NOT_RESTORED');
    expect(source).toContain('MC_EXPECT_STORAGE_METADATA');
    expect(source).toContain('migration_schema.sql');
    expect(source).not.toMatch(/docker run[^\n]*(?:--publish|-p [0-9]|-v \/)/);
  });
});
