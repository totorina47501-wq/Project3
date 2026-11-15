import { z } from 'zod';
import { assertSettingsOrigin, readBoundedJson, settingsError, settingsHeaders } from '@/lib/social/server';
import {
  refreshFacebookPageSelection,
  type FacebookPageCandidate,
} from '@/lib/social/oauth/exchange';
import { createSocialOAuthAccountStore } from '@/lib/social/oauth/accounts';
import { socialOAuthConfig } from '@/lib/social/oauth/providers';
import { requireSocialOAuthSession } from '@/lib/social/oauth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const refreshSchema = z.object({ refresh: z.literal(true) }).strict();
const selectionSchema = z.object({
  pageIds: z.array(z.string().regex(/^[0-9]{1,32}$/)).min(1).max(20),
}).strict();

function pageList(pages: FacebookPageCandidate[]) {
  return pages.map(({ id, name }) => ({ id, name }));
}

export async function GET() {
  try {
    const { user, sessionId } = await requireSocialOAuthSession();
    if (!socialOAuthConfig('facebook')) {
      return Response.json({ error: 'Connexion indisponible.' }, {
        status: 503,
        headers: settingsHeaders,
      });
    }
    const selection = await createSocialOAuthAccountStore().readFacebookPageSelection({
      userId: user.id,
      sessionId,
    });
    if (!selection) {
      return Response.json({ error: 'Sélection Facebook expirée. Recommence la connexion.' }, {
        status: 404,
        headers: settingsHeaders,
      });
    }
    return Response.json({ pages: pageList(selection.pages) }, { headers: settingsHeaders });
  } catch (error) {
    return settingsError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSettingsOrigin(request);
    const { user, sessionId } = await requireSocialOAuthSession();
    if (!socialOAuthConfig('facebook')) {
      return Response.json({ error: 'Connexion indisponible.' }, {
        status: 503,
        headers: settingsHeaders,
      });
    }
    const body = await readBoundedJson(request);
    const refresh = refreshSchema.safeParse(body);
    const store = createSocialOAuthAccountStore();
    if (refresh.success) {
      const selection = await store.readFacebookPageSelection({ userId: user.id, sessionId });
      if (!selection) {
        return Response.json({ error: 'Sélection Facebook expirée. Recommence la connexion.' }, {
          status: 404,
          headers: settingsHeaders,
        });
      }
      const refreshed = await refreshFacebookPageSelection({
        tokenSecret: selection.tokenSecret,
      });
      await store.stageFacebookPageSelection({
        userId: user.id,
        sessionId,
        tokenSecret: refreshed.tokenSecret,
        pages: refreshed.pages,
      });
      return Response.json({ pages: pageList(refreshed.pages) }, { headers: settingsHeaders });
    }
    const selected = selectionSchema.safeParse(body);
    if (!selected.success || new Set(selected.data.pageIds).size !== selected.data.pageIds.length) {
      return Response.json({ error: 'Sélection de Pages invalide.' }, {
        status: 400,
        headers: settingsHeaders,
      });
    }
    const selectedCount = await store.saveFacebookPageSelection({
      userId: user.id,
      sessionId,
      pageIds: selected.data.pageIds,
    });
    return Response.json({ selected: selectedCount }, { headers: settingsHeaders });
  } catch (error) {
    return settingsError(error);
  }
}
