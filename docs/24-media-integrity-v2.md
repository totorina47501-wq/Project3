# Media integrity v2 — rollout checklist

## Existing reused modules
The upload preparation and confirmation routes, private Storage, RLS, SHA-256 implementation, offline FFmpeg/Sharp workers and anti-duplication registry already exist. This branch does not recreate them.

## What this branch changes
- Adds nullable `public.media_assets.media_sha256` with a 64-character lower-case hex check. Old ready rows remain NULL.
- Writes digest, size, timestamps and ready state in one conditional pending-to-ready update.
- On retry of already-ready uploads, returns the persisted digest when available.
- On concurrent confirmations, the losing request re-reads the winner's persisted digest and returns it if ready.
- All columns are still owner-scoped on read, and the new column is accessible only to the service role. Never trust a browser-supplied digest.
- Tests only pure integrity logic: invalid hashes, limits, feature-off compatibility, and response privacy. Authenticated E2E, concurrent database operations and Storage overwrite resistance still require integration tests.

## Deployment order (required)
1. Verify the actual project's migration history and RLS/policies; apply this SQL migration once using the normal Supabase migration workflow, **before** toggling the feature.
2. Confirm `media_sha256` exists, constraint active, existing rows unchanged.
3. Deploy code with `MEDIA_SHA256_PERSISTENCE_ENABLED` absent/false: uploads continue through the legacy path.
4. Set `MEDIA_SHA256_PERSISTENCE_ENABLED=true` only after schema is present; exercise authenticated upload and simultaneous confirmations with disposable test files.
5. Measure Cloudflare memory/CPU for 50 MiB blob SHA-256. If not safe, route hashing through a separate bounded worker before enabling public video uploads.
6. Verify Storage object immutability (signed upload tokens and overwrite prevention), or the digest may describe an earlier version of a mutable object.

**Not done:** schema application to the live database, encrypted/signed evidence attestation, FFmpeg queue activation, transcript, AI calls, legal certification, and production E2E. `media_sha256` is a technical checksum only.

Zero paid API calls. No changes to existing bot/rule algorithms or billing.
