// Pas de canonical vers mentioncheck.fr tant que ce domaine n'est pas vérifié.
export function publicSiteUrl(): string {
  const raw=process.env.NEXT_PUBLIC_APP_URL;
  if (raw) {
    try {
      const url=new URL(raw);
      if(url.protocol==='https:' && !url.username && !url.password)
        return url.origin;
    } catch {/* URL invalide : conserver l'adresse Cloudflare active */ }
  }
  return 'https://mentioncheck.toto-rina47501.workers.dev';
}
