'use client';

import { FormEvent, useState } from 'react';

type FeedbackReceipt = {
  feedbackId: string;
  deleteToken: string;
  receivedAt: string;
  message: string;
};

export function LeadFeedbackForm({ origin }: { origin: 'landing' | 'guide' }) {
  const [message, setMessage] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<FeedbackReceipt | null>(null);

  function utmFromLocation() {
    if (typeof window === 'undefined') {
      return { source: null, medium: null, campaign: null };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source'),
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    setReceipt(null);
    try {
      const response = await fetch('/api/marketing/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sourceUrl: sourceUrl.trim() || undefined,
          consent,
          origin,
          utm: consent ? utmFromLocation() : undefined,
        }),
      });
      const data = await response.json().catch(() => ({})) as Partial<FeedbackReceipt> & { error?: string; message?: string };
      if (!response.ok || !data.feedbackId || !data.deleteToken || !data.receivedAt || !data.message) {
        throw new Error(data.error ?? 'Impossible d\'envoyer le retour.');
      }
      setReceipt({
        feedbackId: data.feedbackId,
        deleteToken: data.deleteToken,
        receivedAt: data.receivedAt,
        message: data.message,
      });
      setMessage('');
      setSourceUrl('');
      setConsent(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d\'envoyer le retour.');
    } finally {
      setSending(false);
    }
  }

  async function removeFeedback() {
    if (!receipt || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/marketing/feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId: receipt.feedbackId,
          deleteToken: receipt.deleteToken,
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Suppression impossible.');
      setReceipt(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setSending(false);
    }
  }

  return <section aria-labelledby="feedback-landing" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <h2 id="feedback-landing" className="font-heading text-2xl font-bold text-primary">Retour communautaire volontaire</h2>
    <p className="mt-3 text-sm leading-6 text-slate-600">
      Collecte minimale: votre message, un lien source optionnel et votre consentement explicite. Aucun cookie marketing ajouté par ce formulaire.
    </p>

    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-semibold text-primary" htmlFor={`feedback-message-${origin}`}>
        Votre retour (minimum 20 caractères)
      </label>
      <textarea
        id={`feedback-message-${origin}`}
        name="message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        required
        minLength={20}
        maxLength={1200}
        rows={5}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-accent placeholder:text-slate-400 focus:ring-2"
        placeholder="Ce qui vous aide, ce qui manque, ce qui vous bloque..."
      />

      <label className="block text-sm font-semibold text-primary" htmlFor={`feedback-source-${origin}`}>
        Lien source (optionnel)
      </label>
      <input
        id={`feedback-source-${origin}`}
        name="source"
        type="url"
        value={sourceUrl}
        onChange={(event) => setSourceUrl(event.target.value)}
        placeholder="https://..."
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-accent placeholder:text-slate-400 focus:ring-2"
      />

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" htmlFor={`feedback-consent-${origin}`}>
        <input
          id={`feedback-consent-${origin}`}
          name="consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>J&apos;autorise l&apos;enregistrement local de ce retour pour améliorer MentionCheck. Je peux le supprimer immédiatement après envoi.</span>
      </label>

      <button type="submit" disabled={sending} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
        {sending ? 'Envoi…' : 'Envoyer mon retour'}
      </button>
    </form>

    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

    {receipt && <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p role="status">{receipt.message}</p>
      <p className="mt-1 text-xs">Reçu à {new Date(receipt.receivedAt).toLocaleString('fr-FR', { timeZone: 'UTC' })} (UTC).</p>
      <button type="button" onClick={removeFeedback} disabled={sending} className="mt-3 rounded-lg border border-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70">
        Supprimer ce retour
      </button>
    </div>}
  </section>;
}
