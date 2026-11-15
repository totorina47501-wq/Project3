# MIA-LEGAL-CORPUS-001 — préflight offline (15/11/2026)

## Portée exécutée

- Tâches 1–2 uniquement, hors ligne, sans écriture Supabase, sans import, sans indexation, sans appel OpenAI payant.
- Pipeline existant réutilisé (`collect-official`, `review-official`, `approved-manifest`, `plan-approved-import`, `run-approved-import`).

## État des portes

- `SUPABASE_SERVICE_KEY`: absent dans l'environnement local de validation.
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`: absents.
- `OPENAI_API_KEY`: absent.
- `MIA_IMPORT_APPROVED`: absent.

Conséquence: aucun accès lecture distante production/staging, aucun import possible, aucun embedding possible. Le statut reste **PARTIAL/BLOCKED** pour la revue juridique réelle et la validation 30/30.

## Contrôles livrés dans ce lot

- Restriction des hôtes de découverte/revue aux seules sources officielles autorisées par les garde-fous du pipeline (`www.legifrance.gouv.fr`, `www.economie.gouv.fr`).
- Statut explicite `verification_status=not_verified` ajouté aux artefacts de découverte/revue tant qu'une relecture juridique humaine n'a pas validé version/date/provenance.
- Correction du manifeste approuvé: plusieurs `article_ref` peuvent désormais partager la même `source_url` officielle (cas réel des 5 références historiques), unicité maintenue sur `article_ref`.
- Refus explicite d'une régression de version légale (`effective_on` plus ancienne) dans le plan d'import pour une référence déjà existante.
- Tests offline renforcés, dont scénario de dry-run déterministe attendu: `25 insert / 0 update / 5 unchanged`.

## Résultat de conformité de ce lot

- Aucun manifeste "approuvé" n'est revendiqué pour 25 nouvelles fiches.
- Aucun import ni indexation n'est revendiqué.
- Aucun statut 30/30 n'est revendiqué.
- Livrable conforme à un préflight technique offline: outillage durci + preuves de blocage explicites en l'absence de relecture juridique et d'accès officiels distants dans cet environnement.
