# Correction upload Cloudflare sans crédits IA

L'espace Médias transmet maintenant au navigateur la configuration publique Supabase depuis le rendu serveur, afin de ne pas dépendre de l'injection `NEXT_PUBLIC_*` au moment du build Cloudflare. La clé est publique (publishable/anon), jamais `service_role`.

En cas d'échec du transfert ou de confirmation, l'application tente de supprimer la fiche `pending` et l'objet Storage associé via l'API authentifiée existante. Si cette suppression échoue, le média reste non confirmé, jamais marqué `ready` artificiellement.

Vérification post-déploiement : importer un MP4 de moins de 6 Mo dans Médias ; constater `ready`, `actual_bytes`, `completed_at` et `media_sha256` sur Supabase ; aucun appel OpenAI. Vérifier les logs Cloudflare si le transfert échoue encore. Les anciennes fiches `pending` ne sont pas supprimées automatiquement par cette correction.
