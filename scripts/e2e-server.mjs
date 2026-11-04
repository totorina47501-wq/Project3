// Lance uniquement une fixture locale et Next.js avec les fournisseurs désactivés.
import { spawn } from 'node:child_process';
import { createFixtureServer } from './e2e-fixture.mjs';

const fixture = createFixtureServer();
await new Promise((resolve, reject) => {
  fixture.once('error', reject);
  fixture.listen(54329, '127.0.0.1', resolve);
});
const env = { ...process.env };
for (const key of [
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY', 'SUPABASE_SERVICE_KEY', 'MEDIA_RETENTION_SECRET',
]) delete env[key];
Object.assign(env, {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'offline-public-fixture',
  OPENAI_PAUSED: 'true', OPENAI_TEXT_ENABLED: 'false', OPENAI_VISION_ENABLED: 'false',
  OPENAI_AUDIO_ENABLED: 'false', OPENAI_EMBEDDINGS_ENABLED: 'false',
  BILLING_ENABLED: 'false', MEDIA_RETENTION_ENABLED: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
});
const next = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000',
], { env, stdio: 'inherit' });
let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  next.kill(signal);
  fixture.close();
}
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop());
next.once('exit', (code) => {
  fixture.close(() => { process.exitCode = code ?? 1; });
});
next.once('error', (error) => {
  console.error('Impossible de lancer le serveur E2E local :', error.message);
  stop(); process.exitCode = 1;
});
