'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

const ANALYTICS_STORAGE_KEY = 'mentioncheck.analytics-consent.v2';
const LEGACY_ANALYTICS_STORAGE_KEY = 'mentioncheck.analytics-consent.v1';
// Refresh both acceptance and refusal after approximately six months (CNIL guidance).
const ANALYTICS_CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const GOOGLE_TAG_URL = 'https://www.googletagmanager.com/gtm.js?id=GTM-P83X0PBJ';

type AnalyticsChoice = 'loading' | 'undecided' | 'accepted' | 'rejected';

function readStoredChoice(): 'undecided' | 'accepted' | 'rejected' {
  try {
    // Legacy values had no date, so their validity cannot be established.
    window.localStorage.removeItem(LEGACY_ANALYTICS_STORAGE_KEY);
    const raw = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return 'undecided';
    const stored = JSON.parse(raw) as { choice?: unknown; savedAt?: unknown };
    if (
      stored &&
      (stored.choice === 'accepted' || stored.choice === 'rejected') &&
      typeof stored.savedAt === 'number' &&
      Number.isFinite(stored.savedAt) &&
      stored.savedAt <= Date.now() &&
      Date.now() - stored.savedAt < ANALYTICS_CONSENT_TTL_MS
    ) return stored.choice;
    window.localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  } catch {
    // Storage can be unavailable or malformed; without a valid choice, no Google tag.
  }
  return 'undecided';
}

function clearGoogleAnalyticsCookies() {
  const names = document.cookie
    .split(';')
    .map(part => part.trim().split('=')[0] ?? '')
    .filter(name => name === '_ga' || name === '_gid' || /^_ga_|^_gat/.test(name));

  const hostname = window.location.hostname;
  const domains = hostname === 'mentioncheck.app' || hostname.endsWith('.mentioncheck.app')
    ? ['', '; domain=mentioncheck.app', '; domain=.mentioncheck.app']
    : [''];

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = name + '=; Max-Age=0; path=/' + domain + '; SameSite=Lax';
    }
  }
}

/**
 * No network connection to Google is made until the visitor grants analytics consent.
 * This is independent from the authenticated AI-training opt-in preference.
 */
export function AnalyticsConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsChoice>('loading');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setChoice(readStoredChoice());
  }, []);

  function select(next: 'accepted' | 'rejected') {
    const withdrawing = next === 'rejected' && choice === 'accepted';

    try {
      window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify({ choice: next, savedAt: Date.now() }));
    } catch {
      // Keep the choice for this page only when persistent storage is unavailable.
    }

    setChoice(next);
    setEditing(false);

    if (withdrawing) {
      clearGoogleAnalyticsCookies();
      // Removing a script element does not stop the already loaded Google tag.
      // A reload prevents any further hits from its existing runtime.
      window.location.reload();
    }
  }

  // Never overlay account forms or mobile navigation. Visitors can revisit the
  // cookie preference from the privacy policy, linked throughout the site.
  const showChoices = editing || (choice === 'undecided' && pathname === '/');
  const showSettings = choice !== 'loading' && !showChoices && pathname === '/legal/confidentialite';

  return (
    <>
      {choice === 'accepted' && (
        <>
          <Script id="mentioncheck-google-data-layer" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());`}
          </Script>
          <Script id="mentioncheck-google-tag" src={GOOGLE_TAG_URL} strategy="afterInteractive" />
        </>
      )}

      {choice !== 'loading' && showChoices && (
        <section
          aria-label="Choix des cookies statistiques"
          className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-xl rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl sm:bottom-6 sm:p-5"
        >
          <h2 className="text-base font-bold text-slate-900">Statistiques de fréquentation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Avec votre accord, MentionCheck utilise Google Analytics pour mesurer les visites et améliorer le site.
            Vous pouvez refuser sans perdre l&apos;accès au service, puis changer d&apos;avis à tout moment.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            En savoir plus dans notre{' '}
            <Link className="font-semibold underline" href="/legal/confidentialite">politique de confidentialité</Link>.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => select('rejected')}
              className="rounded-lg border-2 border-indigo-700 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900"
            >
              Refuser les statistiques
            </button>
            <button
              type="button"
              onClick={() => select('accepted')}
              className="rounded-lg border-2 border-indigo-700 bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Autoriser les statistiques
            </button>
          </div>
        </section>
      )}

      {showSettings && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="fixed bottom-3 right-3 z-[80] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
        >
          Gérer les cookies
        </button>
      )}
    </>
  );
}
