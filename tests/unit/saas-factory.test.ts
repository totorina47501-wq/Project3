import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateProject, parseConfigText, validateConfig } from '../../tools/saas-factory/generate.mjs';

const generatorPath = path.resolve('tools/saas-factory/generate.mjs');
const minimalConfig = {
  schemaVersion: 1,
  productName: 'Atelier Exemple',
  projectSlug: 'atelier-exemple',
  domain: 'atelier.example',
  modules: ['ai-disabled'],
  languages: ['fr-FR'],
  defaultLanguage: 'fr-FR',
  deploymentTarget: 'none',
};

let temporaryRoot: string;

function configText(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ ...minimalConfig, ...overrides });
}

function generate(overrides: Record<string, unknown> = {}, write = false, root = path.join(temporaryRoot, 'output')) {
  return generateProject({ configText: configText(overrides), outputRoot: root, write });
}

beforeEach(() => {
  temporaryRoot = mkdtempSync(path.join(tmpdir(), 'saas-factory-test-'));
});

afterEach(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe('SaaS Factory generator', () => {
  it('validates camelCase v1 configuration and canonicalizes module order', () => {
    const config = validateConfig({
      ...minimalConfig,
      modules: ['media', 'ai-disabled', 'api'],
      languages: ['fr-FR', 'en'],
      defaultLanguage: 'en',
    });
    expect(config.modules).toEqual(['ai-disabled', 'api', 'media']);
    expect(config.languages).toEqual(['fr-FR', 'en']);
    expect(config.defaultLanguage).toBe('en');
  });

  it('rejects duplicate JSON keys rather than silently accepting the last value', () => {
    expect(() => parseConfigText('{"schemaVersion":1,"schemaVersion":1}')).toThrow(/Duplicate JSON key/);
    expect(() => parseConfigText('{"nested":{"name":1,"name":2}}')).toThrow(/Duplicate JSON key/);
    expect(() => parseConfigText('{"schemaVersion":1}\u00a0')).toThrow(/Invalid JSON/);
  });

  it.each([
    ['unknown field', { unexpected: true }],
    ['wrong schema version', { schemaVersion: 2 }],
    ['wrong product name type', { productName: 42 }],
    ['wrong modules type', { modules: 'ai-disabled' }],
    ['wrong languages item type', { languages: ['fr-FR', 1] }],
    ['unsafe slug', { projectSlug: '../outside' }],
    ['encoded slug', { projectSlug: '%2e%2e' }],
    ['reserved device slug', { projectSlug: 'con' }],
    ['malformed domain', { domain: 'https://atelier.example/path' }],
    ['unknown module', { modules: ['ai-disabled', 'payments'] }],
    ['missing AI opt-out', { modules: ['api'] }],
    ['duplicate module', { modules: ['ai-disabled', 'ai-disabled'] }],
    ['invalid language', { languages: ['en_US'] }],
    ['non-canonical language', { languages: ['en-us'], defaultLanguage: 'en-us' }],
    ['duplicate canonical language', { languages: ['en', 'en'], defaultLanguage: 'en' }],
    ['unlisted default language', { defaultLanguage: 'en' }],
    ['unknown deployment target', { deploymentTarget: 'production' }],
  ])('rejects %s before writing', (_name, overrides) => {
    expect(() => generate(overrides)).toThrow();
    expect(readdirSync(temporaryRoot)).toEqual([]);
  });

  it('prints a deterministic dry-run manifest without creating files', () => {
    const outputRoot = path.join(temporaryRoot, 'not-created');
    const first = generate({ modules: ['ai-disabled', 'api'], languages: ['en', 'fr-FR'], defaultLanguage: 'en' }, false, outputRoot);
    const second = generate({ modules: ['ai-disabled', 'api'], languages: ['en', 'fr-FR'], defaultLanguage: 'en' }, false, outputRoot);
    expect(second.files).toEqual(first.files);
    expect(first.modules).toEqual(['ai-disabled', 'api']);
    expect(first.files).toContain('app/api/example/route.js');
    expect(first.files).toContain('i18n/messages/en.json');
    expect(first.files).toContain('i18n/messages/fr-FR.json');
    expect(first.checks).toContain('no network or remote commands');
    expect(readdirSync(temporaryRoot)).toEqual([]);
  });

  it('does not use network APIs while generating a complete option set', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const manifest = generate({
      modules: ['ai-disabled', 'api', 'auth', 'billing-test', 'media'],
      deploymentTarget: 'cloudflare-opennext',
    }, true);
    const project = manifest.destination;
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(manifest.files).toContain('wrangler.jsonc');
    expect(manifest.files).toContain('open-next.config.ts');
    expect(execFileSync(process.execPath, ['--test'], { cwd: project, encoding: 'utf8' })).toContain('tests');
    vi.restoreAllMocks();
  });

  it('writes only into a new destination and refuses a second write', () => {
    const manifest = generate({}, true);
    expect(readFileSync(path.join(manifest.destination, 'app/page.tsx'), 'utf8')).toContain('Welcome');
    expect(readdirSync(manifest.destination)).not.toContain('.git');
    expect(() => generate({}, true)).toThrow(/already exists/);
    expect(readFileSync(path.join(manifest.destination, 'app/page.tsx'), 'utf8')).toContain('Welcome');
  });

  it('rejects output roots containing symbolic links', () => {
    const actualRoot = path.join(temporaryRoot, 'actual');
    const linkedRoot = path.join(temporaryRoot, 'linked');
    mkdirSync(actualRoot);
    symlinkSync(actualRoot, linkedRoot);
    expect(() => generate({}, true, linkedRoot)).toThrow(/symbolic links/);
    expect(readdirSync(actualRoot)).toEqual([]);
  });

  it('refuses case-insensitive destination collisions', () => {
    const outputRoot = path.join(temporaryRoot, 'output');
    mkdirSync(outputRoot);
    mkdirSync(path.join(outputRoot, 'ATELIER-EXEMPLE'));
    expect(() => generate({}, true, outputRoot)).toThrow(/collides by case/);
  });

  it('rejects sentinels and credentials from generated content', () => {
    expect(() => generate({ productName: 'Mia Example' })).toThrow(/exclusion check/);
    const root = path.join(temporaryRoot, 'output');
    expect(readdirSync(temporaryRoot)).not.toContain(path.basename(root));
  });

  it('renders only the selected deployment configuration and never deploys', () => {
    const manifest = generate({
      modules: ['ai-disabled', 'auth'],
      deploymentTarget: 'none',
    });
    expect(manifest.files).toContain('lib/auth.mjs');
    expect(manifest.files).not.toContain('wrangler.jsonc');
    expect(manifest.files).not.toContain('.git');
  });

  it('keeps test configuration secret-free and deployment-free', () => {
    const manifest = generate({
      modules: ['ai-disabled', 'api', 'auth', 'billing-test', 'media'],
      deploymentTarget: 'cloudflare-opennext',
    }, true);
    const project = manifest.destination;
    const packageJson = JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8'));
    const workflow = readFileSync(path.join(project, '.github/workflows/ci.yml'), 'utf8');
    const environmentExample = readFileSync(path.join(project, '.env.example'), 'utf8');
    const cloudflare = JSON.parse(readFileSync(path.join(project, 'wrangler.jsonc'), 'utf8'));
    expect(packageJson.devDependencies['@opennextjs/cloudflare']).toBeTruthy();
    expect(workflow).toContain('npm run build:worker');
    expect(workflow).not.toMatch(/deploy|secret|token/i);
    expect(environmentExample).toMatch(/REPLACE_WITH_LOCAL_URL/);
    expect(environmentExample).not.toMatch(/(?:sk|ghp)_[A-Za-z0-9]{20,}/);
    expect(cloudflare).not.toHaveProperty('account_id');
    expect(cloudflare).not.toHaveProperty('zone_id');
  });

  it('CLI defaults to dry-run and accepts explicit write mode', () => {
    const configPath = path.join(temporaryRoot, 'config.json');
    const outputRoot = path.join(temporaryRoot, 'output');
    writeFileSync(configPath, configText());
    const dryRun = spawnSync(process.execPath, [generatorPath, '--config', configPath, '--output-root', outputRoot], { encoding: 'utf8' });
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout).mode).toBe('dry-run');
    expect(readdirSync(temporaryRoot)).not.toContain('output');

    const write = spawnSync(process.execPath, [generatorPath, '--config', configPath, '--output-root', outputRoot, '--write'], { encoding: 'utf8' });
    expect(write.status).toBe(0);
    expect(JSON.parse(write.stdout).mode).toBe('write');
    expect(readdirSync(outputRoot)).toEqual(['atelier-exemple']);
  });
});
