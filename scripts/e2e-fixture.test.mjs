// Ces tests n'utilisent que le serveur de fixture local, jamais Supabase distant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureServer, FIXTURE_USER_ID, createFixtureSession } from './e2e-fixture.mjs';

test('la fixture exige un jeton local et ne renvoie aucun secret serveur', async () => {
  const server = createFixtureServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${url}/auth/v1/user`)).status, 401);
    const session = createFixtureSession();
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const user = await response.json();
    assert.equal(user.id, FIXTURE_USER_ID);
    assert.equal(user.email, 'createur@example.test');
    assert.equal(user.role, 'authenticated');
    assert.equal('refresh_token' in user, false);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('un chemin fournisseur inconnu est refusé et les mutations de données sont interdites', async () => {
  const server = createFixtureServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${url}/v1/chat/completions`, { method: 'POST' })).status, 404);
    const session = createFixtureSession();
    assert.equal((await fetch(`${url}/rest/v1/users`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` },
    })).status, 405);
    assert.equal((await fetch(`${url}/rest/v1/social_accounts`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })).status, 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
