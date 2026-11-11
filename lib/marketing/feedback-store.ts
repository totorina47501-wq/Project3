// L'ancien stub basé sur une Map mémoire a été retiré : il ne garantissait
// ni conservation ni effacement entre les instances Cloudflare.
// La route /api/marketing/feedback retourne 503 tant qu'un stockage durable
// et un effacement vérifiable n'ont pas été validés en staging.
export {};
