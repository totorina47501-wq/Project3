import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const shell=readFileSync(resolve(process.cwd(),'scripts/recette/isolated-postgres-restore.sh'),'utf8');
const doc=readFileSync(resolve(process.cwd(),'docs/52-recette-isolee-cout-minimal.md'),'utf8');

describe('Recette PostgreSQL isolée — contrat de sécurité',()=>{
  it('conserve une syntaxe Bash valide sans exécuter Docker',()=>{
    expect(()=>execFileSync('bash',['-n','scripts/recette/isolated-postgres-restore.sh'])).not.toThrow();
  });
  it('refuse tout moteur Docker distant et interdit une connexion réseau au conteneur',()=>{
    expect(shell).toContain('docker context inspect default');
    expect(shell).toContain('DOCKER_HOST');
    expect(shell).toContain('DOCKER_CONTEXT');
    expect(shell).toContain('unix://');
    expect(shell).toContain('--network none');
    expect(shell).not.toContain('--publish');
    expect(shell).not.toContain('--mount');
    expect(shell).not.toContain('--volume');
  });
  it('utilise seulement une fixture synthétique et nettoie sur succès comme sur erreur',()=>{
    expect(shell).toContain('POSTGRES_DB=mentioncheck_fixture');
    expect(shell).toContain('recette_fixture');
    expect(shell).toContain('pg_dump');
    expect(shell).toContain('pg_restore');
    expect(shell).toContain('mentioncheck_restored');
    expect(shell).toContain('trap cleanup EXIT');
    expect(shell).toContain('docker --context default rm -f');
    expect(shell).not.toContain('SUPABASE_SERVICE_KEY');
    expect(shell).not.toContain('SUPABASE_DB_URL');
  });
  it('ne prétend pas certifier la prod et préserve les portes de recette hébergée',()=>{
    expect(doc).toContain('Il ne prouve ni la restauration');
    expect(doc).toContain('supabase db reset --local');
    expect(doc).toContain('Ne jamais utiliser');
    expect(doc).toContain('PLAYWRIGHT_BASE_URL');
    expect(doc).toContain('leaked-password');
    expect(doc).toContain('Non exécuté');
    expect(doc).toContain('ne ferme pas #16');
  });
});
