# Media integrity integration — zero-credit delivery

Status: **partial**, server-side upload confirmation enhanced; no legal certification.

## Already present, reused
- Private bucket `verification-media` and owned `media_assets` rows.
- `POST /api/media/complete` with authenticated owner lookup, Origin guard, expiry, Storage MIME/size check and pending-to-ready compare-and-set.
- `lib/evidence/private-media.ts` and SHA-256 helpers, offline unit tests.
- FFmpeg/Sharp offline processors (not connected to Cloudflare requests).

## This change
For a pending upload, after checking the private Storage object's reported MIME and size, the server downloads its actual bytes and hashes them with SHA-256. If the download fails or the byte length differs, the upload is **not** marked ready. On success the response includes `mediaSha256` as a technical digest. The client does not supply this value. Existing ready uploads remain idempotent and do not return a digest, to avoid falsely claiming historical proof.

**Limit:** the digest is returned to the caller but **not persisted** in `media_assets` or `verifications`. It is not yet a durable archive or an independently signed proof. A dedicated reviewed SQL migration and server-side persistence must precede any claim of immutable evidence. The existing `verifications.hash_sha256` semantics are unchanged.

## Safety and follow-up
- This request can download up to 50 MiB; measure memory/CPU on Cloudflare Workers and consider an asynchronous bounded worker for large videos before broad rollout.
- Supabase Storage download is server-side only; no signed URLs or secrets are logged.
- Verify migrations, authenticated E2E and real Cloudflare memory/time limits before activating video analysis.
- No OpenAI, Whisper, Stripe or paid API calls; no FFmpeg in request handlers.
- Offline checks: `npm run work:check`, `npm run work:test`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
