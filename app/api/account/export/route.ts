// Export privilégié uniquement après identification serveur et filtres propriétaire explicites.
import { requireUser, publicError } from '@/lib/security/auth';
import { ExportLimitError } from '@/lib/privacy/export';
import { readPersonalData } from '@/lib/privacy/personal-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { user } = await requireUser();
    const payload = await readPersonalData(user);
    return new Response(JSON.stringify(payload,null,2), {
      headers: {
        'Content-Type':'application/json; charset=utf-8',
        'Content-Disposition':'attachment; filename="mentioncheck-mes-donnees.json"',
        'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
      },
    });
  } catch (error) {
    const {status,message} = error instanceof ExportLimitError
      ? {status:413,message:error.message} : publicError(error);
    return Response.json({error:message},{status,headers:{'Cache-Control':'private, no-store'}});
  }
}
