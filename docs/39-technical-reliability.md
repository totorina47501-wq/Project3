# Fiabilité technique — 5 novembre 2026

Ce lot suit le commit `7f08d399dddf6e65874d5582bb9f352fa1538449` et conserve
ses améliorations tarifs/SEO. Aucun nouvel appel OpenAI, paiement ou email réel.
Aucune suppression de production ni activation du runner média.

## Journal embedding Mia

Un échec du callback de journalisation remonte jusqu’à la route, qui restitue
le quota applicatif et retourne une erreur. La réponse ne continue plus avec
un coût embedding silencieusement perdu. Une panne de génération ou de RPC
peut toujours utiliser la recherche lexicale ; si l’embedding a été généré,
sa métrique est enregistrée avant la RPC. Une panne de journal ne donne pas
lieu à une nouvelle requête fournisseur. Le coût déjà consommé reste dû au
prestataire ; ce correctif ne prétend pas reconstruire une métrique perdue
pendant une panne de base ni fournir une livraison exactement une fois.

## Période des quotas

`reserve_usage_quota(uuid,text)` appelle le contrôle atomique existant et
renvoie la période UTC de cette même transaction, ou `null` si le quota est
épuisé. Le client serveur conserve cette période ; il n’utilise pas son horloge
pour décider du mois à rembourser.

Le nouvel overload `refund_usage_quota(uuid,text,date)` ne modifie que la
période réservée. Les routes check/Mia et la réécriture automatique l’utilisent.
Les anciennes signatures restent présentes pour les anciens déploiements.
Cela corrige le changement de mois, sans transformer les compteurs en registre
de réservations idempotentes ; une restitution dupliquée reste un sujet distinct.

Migration source : `supabase/migrations/20261105082000_quota_reservation_period.sql`.
Migration distante appliquée : `quota_reservation_period`, version `20261105081854`.
SHA-256 source : `c3872ba2a135ec64f523c83e09407c62a8a68a8a955467b61019fc8b1b7171cd`.

Vérification distante en lecture seule : réservation et nouvel overload de
remboursement exécutables par `service_role`, interdits à `anon` et
`authenticated`. Ancienne signature de remboursement toujours disponible.
Aucune fixture de quota n’a été exécutée sur la production.

La CLI Supabase a été essayée pour générer le fichier, mais échoue avant la
commande sur `/home/agent/.supabase` en lecture seule. Le fichier a donc été
créé dans le dépôt puis vérifié sur PostgreSQL local avant application.

## Solo en mode test

Le composant existant accepte Solo/Pro/Studio. La page n’affiche le CTA Solo
que lorsque la porte Stripe de test est ouverte et que son prix est configuré.
Le prix absent laisse la démonstration gratuite disponible. La désactivation
de facturation masque tous les CTA ; le mode live reste refusé.

## Vérifications et limites

Les régressions ont d’abord reproduit le journal masqué, l’absence de période
retournée et l’absence du CTA Solo. Les tests SQL simulent une restitution sur
le mois précédent tout en préservant le mois courant, testent les trois actions,
le quota épuisé, les périodes invalides et les permissions des RPC.

Le premier lancement Playwright a échoué car son Chromium téléchargé était
absent. Le navigateur système est sélectionné via
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`, sans changement produit.

Le transport Storage et l’hébergement du runner distant, la validation audio,
les intégrations externes non activées et les coordonnées légales restent à
traiter. La protection Supabase contre les mots de passe compromis demeure
un réglage à finaliser. Ne pas refaire l’indexation juridique déjà complète.

## Résultats locaux du lot

- TypeScript et lint : réussis.
- Vitest : 255 tests, 61 fichiers, tous réussis.
- PostgreSQL local : 13 migrations exécutées (pgvector explicitement omis),
  7 suites de régression réussies ; harnais SQL : 4 tests réussis.
- Médias : 27 vidéo + 4 carrousels + 29 jobs, tous réussis.
- RGPD : 7 ; préparation IA : 22 ; fixtures HTTP : 6, tous réussis.
- Playwright avec Chromium système : 21 réussis, 1 ignoré (Storage réel opt-in).
- Build Next.js et bundle OpenNext/Cloudflare : réussis, fournisseurs désactivés.
- Registre : 21 domaines, 35 routes et 14 migrations référencés sans doublon.

Les preuves d’appels OpenAI réels restent celles du commit `0d8aec2` dans
[le bilan précédent](37-real-openai-validation.md). Ce lot n’en a exécuté aucun.
