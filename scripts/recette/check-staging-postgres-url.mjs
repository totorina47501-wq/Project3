// Refuse toute connexion autre que la base PostgreSQL du projet Supabase staging.
import assert from 'node:assert/strict';
const reference='ukvgnkxgzyhswgpnvyzz';
const production='zcztvberuihphqklhjsr';
const connection=process.env.MENTIONCHECK_STAGING_POSTGRES_URL;
assert.ok(connection,'MENTIONCHECK_STAGING_POSTGRES_URL manquant');
assert.equal(process.env.OPENAI_PAUSED,'true');
assert.equal(process.env.BILLING_ENABLED,'false');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,
 'https://'+reference+'.supabase.co');
assert.ok(!connection.includes(production),'Refus URL PostgreSQL production');
let url;
try{url=new URL(connection);}catch{throw Error('Chaîne PostgreSQL mal formée');}
assert.ok(['postgres:','postgresql:'].includes(url.protocol),'Protocole PostgreSQL requis');
assert.ok(url.username && url.password,'Utilisateur et mot de passe requis');
assert.equal(url.pathname,'/postgres','La base cible doit être postgres');
const host=url.hostname.toLowerCase();
const user=decodeURIComponent(url.username).toLowerCase();
const refInHost=host==='db.'+reference+'.supabase.co';
const refInUser=user==='postgres.'+reference;
const poolerHost=host.endsWith('.pooler.supabase.com')||host==='aws-0-eu-central-1.pooler.supabase.com';
const poolerValid=poolerHost&&refInUser;
assert.ok(refInHost||poolerValid,
 'Cible non certifiable : utiliser une URL directe db.<ref>.supabase.co ou un pooler avec postgres.<ref>');
assert.ok(!/[^0-9]/.test(url.port||'5432'),'Port invalide');
assert.ok(!url.searchParams.has('application_name') ||
 url.searchParams.get('application_name')?.length<100);
console.log('STAGING_DATABASE_URL_BOUNDARY_PASS project='+reference+
 ' mode='+(refInHost?'direct':'pooler'));
