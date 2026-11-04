# Video integration contract (offline first)

Status: design only. No processor deployed, no analysis enabled.

## Existing modules
- Upload: app/api/media/prepare, complete and library; private Supabase bucket.
- Processing: workers/video/src/process.mjs validates local MP4/MOV <= 50 MiB and <= 60 s, creates three frames and optional mono WAV.
- Manifest schemaVersion=2 includes video SHA-256, frame digests, audio digest and aiCalls=0.
- Check endpoint currently refuses mediaType video; do not bypass this gate until verified.

## Proposed isolated pipeline
1. Authenticated user uploads a media asset; server verifies owner, actual size and MIME.
2. Server queues a job referencing asset UUID, never a public signed URL.
3. Worker obtains the blob using server-side credentials and verifies SHA-256 before decoding.
4. Sandbox FFmpeg with no network, unprivileged user, resource and time limits.
5. Publish frames, audio and manifest atomically in private storage.
6. Record processing status with idempotency on asset UUID + content digest.
7. Expose only the resulting technical preview; do not claim a video compliance verdict.
8. A later separately approved stage may transcribe and analyze, with explicit quota and budget checks.

## Security and failure gates
- Validate actual media duration with FFprobe; do not trust browser metadata.
- Enforce per-user quota, job retries, worker lease and expiration.
- On partial failure, keep original asset private and never mark analyzed.
- Never execute FFmpeg in the Cloudflare request handler.
- Keep current AI and billing flags disabled.
- Require migration, RLS, mocked integration tests and authenticated E2E before release.

## Tests to add
- Unauthorized user cannot enqueue or read another user's job.
- Same asset submitted twice produces one processing job.
- Invalid MIME, oversized media, malformed container and timeout fail safely.
- Worker crash leaves no published partial output.
- A completed extraction has a verified manifest but no analysis result.
