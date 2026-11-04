// Purge contrôlée des médias préparés, par Storage API uniquement.
// Désactivée par défaut ; jamais appelée par le navigateur utilisateur.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { selectExpiredMedia, type Candidate } from '@/lib/media/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_PER_RUN = 20;
const QUERY_LIMIT = 250;

function isAuthorized(request: Request, secret: string): boolean {
  const credential = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!credential.startsWith(prefix)) return false;
  const supplied = credential.slice(prefix.length);
  if (!supplied || supplied.length > 1024) return false;
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}
export async function POST(request: Request) {
  const secret = process.env.MEDIA_RETENTION_TOKEN;
  if (!secret || secret.length < 32) {
    return Response.json({ error: 'Nettoyage non configuré.' }, { status: 503 });
  }
  if (!isAuthorized(request, secret)) {
    return Response.json({ error: 'Accès refusé.' }, { status: 401 });
  }
  const execute = new URL(request.url).searchParams.get('execute') === 'true';
  if (execute && process.env.MEDIA_RETENTION_ENABLED !== 'true') {
    return Response.json({ error: 'Suppression physique désactivée.' }, { status: 503 });
  }
  try {
    const admin = createAdminSupabase();
    const now = new Date().toISOString();
    const { data, error } = await admin.from('media_assets')
      .select('id,user_id,storage_path,status,expires_at')
      .lt('expires_at', now).order('expires_at',{ ascending:true }).limit(QUERY_LIMIT);
    if (error || !data) throw new Error('Requête de rétention indisponible.');
    const candidates = data as Candidate[];
    const paths = candidates.map(x => x.storage_path);
    const { data: referenced, error: referenceError } = paths.length ?
      await admin.from('verifications').select('media_url')
        .in('media_url', paths).not('media_url','is',null) :
      { data: [], error:null };
    if (referenceError) throw new Error('Références non vérifiables.');
    const protectedPaths = new Set((referenced??[]).flatMap(x =>
      x.media_url ? [String(x.media_url)] : []));
    if (process.env.MEDIA_JOBS_SCHEMA_READY === 'true' && candidates.length) {
      const { data: inputs, error: inputsError } = await admin.from('media_processing_inputs')
        .select('asset_id').in('asset_id', candidates.map(row => row.id));
      if (inputsError) throw new Error('Preuves techniques non vérifiables.');
      const linked = new Set((inputs ?? []).map(row => row.asset_id));
      for (const row of candidates) if (linked.has(row.id)) protectedPaths.add(row.storage_path);
    }
    const eligible = selectExpiredMedia(candidates, protectedPaths)
      .slice(0,MAX_PER_RUN);
    if (!execute) {
      return Response.json({
        dryRun:true,eligible:eligible.length,
        referenced:protectedPaths.size, scanned:candidates.length, limit:QUERY_LIMIT,
      }, { headers:{ 'Cache-Control':'no-store' } });
    }
    let removed = 0, failed = 0;
    for (const asset of eligible) {
      // La ligne est propriétaire / UUID valide et ne référence pas une preuve.
      const { error: fileError } = await admin.storage.from('verification-media')
        .remove([asset.storage_path]);
      if (fileError) { failed++; continue; }
      const { error: dbError } = await admin.from('media_assets')
        .delete().eq('id',asset.id).eq('user_id',asset.user_id)
        .eq('storage_path',asset.storage_path).lt('expires_at',now);
      if (dbError) failed++;
      else removed++;
    }
    return Response.json({dryRun:false,scanned:candidates.length,
      eligible:eligible.length,removed,failed}, {
      status:failed>0?503:200,headers:{'Cache-Control':'no-store'},
    });
  } catch {
    // Ne jamais journaliser l'identifiant, le chemin Storage ou le token.
    return Response.json({error:'Nettoyage indisponible.'},{
      status:503,headers:{'Cache-Control':'no-store'},
    });
  }
}
