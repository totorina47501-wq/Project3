/** Secrets aléatoires 256 bits. Seule l'empreinte est transmise au stockage. */
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSecret(kind: 'key' | 'invitation') {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const secret = `${kind === 'key' ? 'mc_studio_' : 'mc_invite_'}${random}`;
  return { secret, hash: await hashSecret(secret), prefix: secret.slice(0, 18) };
}

export function parseApiKey(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer (mc_studio_[0-9a-f]{64})$/);
  return match?.[1] ?? null;
}
