// Exécution directe : node --test --test-isolation=none ... ; aucun port ouvert.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureApp, FIXTURE_SERVICE_KEY } from '../../../scripts/e2e-fixture.mjs';
const app = createFixtureApp();
after(() => app.close());
const call = (path, data, token, method = data === undefined ? 'GET' : 'POST') => app.handle(new Request('http://127.0.0.1:54329' + path, {
  method, headers: { 'x-mentioncheck-fixture': 'local-only', ...(token ? { authorization: 'Bearer ' + token } : {}) },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
}));
async function scenario() {
  const response = await call('/__fixture__/scenarios', {});
  assert.equal(response.status, 201);
  return response.json();
}
async function studio(actor, workspace, action, payload = {}) {
  return call('/rest/v1/rpc/studio_execute', { p_actor: actor, p_workspace: workspace, p_action: action, p_payload: payload }, FIXTURE_SERVICE_KEY);
}

test('la fixture exécute les vraies permissions Studio et les invitations single-use en SQL', async () => {
  const { actors } = await scenario();
  const owner = actors.owner.id, member = actors.member.id;
  const created = await studio(owner, null, 'create_workspace', { name: 'Équipe locale' });
  assert.equal(created.status, 200);
  const workspace = (await created.json()).workspace.id;
  assert.equal((await studio(member, workspace, 'overview')).status, 403);
  assert.equal((await call('/rest/v1/rpc/studio_execute', { p_actor: owner, p_workspace: workspace, p_action: 'overview' }, actors.member.session.access_token)).status, 403);
  assert.equal((await studio(owner, workspace, 'invite', { email: actors.member.email, role: 'member', token_hash: 'a'.repeat(64) })).status, 200);
  assert.equal((await studio(member, null, 'accept_invitation', { token_hash: 'a'.repeat(64) })).status, 200);
  assert.equal((await studio(member, null, 'accept_invitation', { token_hash: 'a'.repeat(64) })).status, 403);
  assert.equal((await studio(member, workspace, 'create_key', { name: 'interdit', token_hash: 'b'.repeat(64), prefix: 'mc_studio_local', scopes: ['checks:read'] })).status, 403);
});

test('une clé de lecture ne peut écrire et sa révocation ferme l’accès', async () => {
  const { actors } = await scenario();
  const owner = actors.owner.id;
  const created = await studio(owner, null, 'create_workspace', { name: 'API locale' });
  const workspace = (await created.json()).workspace.id;
  const response = await studio(owner, workspace, 'create_key', { name: 'lecture', token_hash: 'c'.repeat(64), prefix: 'mc_studio_local', scopes: ['checks:read'] });
  assert.equal(response.status, 200);
  const key = (await response.json()).key;
  const api = (action) => call('/rest/v1/rpc/studio_execute_api', { p_hash: 'c'.repeat(64), p_action: action, p_payload: {} }, FIXTURE_SERVICE_KEY);
  assert.equal((await api('checks')).status, 200);
  assert.equal((await api('save_check')).status, 403);
  await studio(owner, workspace, 'revoke_key', { id: key.id });
  assert.equal((await api('checks')).status, 403);
});

test('collaboration archivée SQL, projection privée, filtre propriétaire et mutation refusée', async () => {
  const { actors, verificationIds } = await scenario();
  const token = actors.owner.session.access_token;
  const draft = { p_id: null, p_brand_name: 'Marque locale', p_start_date: '2026-11-01', p_end_date: null, p_contract_url: null, p_verification_ids: [verificationIds.owner] };
  const saved = await call('/rest/v1/rpc/save_brand_deal', draft, token);
  assert.equal(saved.status, 200);
  const id = await saved.json();
  assert.equal((await call('/rest/v1/rpc/archive_brand_deal', { p_id: id }, token)).status, 200);
  const read = await call('/rest/v1/brand_deals?select=id,brand_name,hash_sha256,archive_payload,brand_deal_verifications(verification_id)&id=eq.' + id, undefined, token);
  assert.equal(read.status, 200);
  const [item] = await read.json();
  assert.equal(item.brand_name, 'Marque locale');
  assert.ok(item.archive_payload);
  assert.equal(item.brand_deal_verifications[0].verification_id, verificationIds.owner);
  const foreign = await call('/rest/v1/brand_deals?select=id,brand_name&id=eq.' + id, undefined, actors.outsider.session.access_token);
  assert.deepEqual(await foreign.json(), []);
  const listed = await call('/rest/v1/brand_deals?select=id,brand_name&archived_at=not.is.null', undefined, token);
  assert.equal(listed.headers.get('content-range'), '0-0/1');
  assert.equal('archive_payload' in (await listed.json())[0], false);
  assert.equal((await call('/rest/v1/rpc/save_brand_deal', { ...draft, p_id: id, p_brand_name: 'Modification interdite' }, token)).status, 409);
  assert.equal((await call('/rest/v1/rpc/delete_brand_deal_draft', { p_id: id }, token)).status, 409);
});

test('la fixture ne simule jamais un téléversement Storage réussi ni un fournisseur externe', async () => {
  assert.equal((await call('/storage/v1/object/verification-media/file.png', {}, FIXTURE_SERVICE_KEY)).status, 404);
  assert.equal((await call('/v1/chat/completions', {}, FIXTURE_SERVICE_KEY)).status, 404);
});
