// Chemin : components/MiaChat.tsx
'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUp, MessageCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { MiaMessage } from '@/lib/mia/schemas';

type Conversation = {
  id: string;
  verificationId: string | null;
  updatedAt: string;
  messages: MiaMessage[];
};
type Reply = {
  conversationId: string;
  answer: string;
  sources: NonNullable<MiaMessage['sources']>;
  error?: string;
};

export function MiaChat({ initialVerificationId, displayName }: { initialVerificationId?: string | undefined; displayName?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState(initialVerificationId ?? '');
  const [messages, setMessages] = useState<MiaMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const greeting = displayName ? `Hello ${displayName} !` : 'Hello !';
  const pending = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  async function refreshHistory(signal?: AbortSignal) {
    setLoading(true);
    setHistoryError('');
    try {
      const response = await fetch('/api/mia/conversations', { cache: 'no-store', ...(signal ? { signal } : {}) });
      const data = await response.json() as { conversations?: Conversation[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Historique indisponible.');
      if (!signal?.aborted) setConversations(data.conversations ?? []);
    } catch {
      if (!signal?.aborted) setHistoryError('Impossible de charger l’historique des discussions.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshHistory(controller.signal);
    return () => { controller.abort(); pending.current?.abort(); };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  function startNew() {
    if (sending || deleting) return;
    setActiveId(null);
    setVerificationId(initialVerificationId ?? '');
    setMessages([]);
    setQuestion('');
    setError('');
    setNotice('');
  }
  function selectConversation(item: Conversation) {
    if (sending || deleting) return;
    setActiveId(item.id);
    setVerificationId(item.verificationId ?? '');
    setMessages(item.messages);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (pending.current || deleting || text.length < 3) return;
    const controller = new AbortController();
    pending.current = controller;
    const previous = messages;
    setMessages([...previous, { role: 'user', content: text }]);
    setSending(true);
    setError('');
    setNotice('');
    setQuestion('');
    try {
      const response = await fetch('/api/mia/chat', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          ...(activeId ? { conversationId: activeId }
            : verificationId ? { verificationId } : {}),
        }),
      });
      const data = await response.json() as Reply;
      if (!response.ok) throw new Error(data.error ?? 'Mia est momentanément indisponible.');
      setMessages([...previous,
        { role: 'user', content: text },
        { role: 'assistant', content: data.answer, sources: data.sources },
      ]);
      setActiveId(data.conversationId);
      await refreshHistory(controller.signal);
    } catch (cause) {
      setMessages(previous);
      setQuestion(text);
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Erreur inattendue.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setSending(false);
      }
    }
  }

  async function removeConversation() {
    if (!activeId || sending || deleting) return;
    const id = activeId;
    const controller = new AbortController();
    pending.current = controller;
    setDeleting(true); setError('');
    try {
      const response = await fetch('/api/mia/conversations/delete', {
        signal: controller.signal,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Suppression impossible.');
      setConversations((old) => old.filter((item) => item.id !== id));
      setActiveId(null);
      setVerificationId(initialVerificationId ?? '');
      setMessages([]);
      setQuestion('');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Suppression indisponible.');
    } finally {
      if (pending.current === controller) pending.current = null;
      setDeleting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside aria-label="Conversations récentes" className="min-w-0 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <button type="button" onClick={startNew} disabled={sending || deleting}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50">
          <Plus className="h-5 w-5" aria-hidden="true" /> Nouvelle discussion
        </button>
        <div className="mt-6 flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Historique
        </div>
        {loading && <p role="status" className="mt-3 text-sm text-slate-500">Chargement…</p>}
        {historyError && <div className="mt-3 text-sm text-red-800">
          <p role="alert">{historyError}</p>
          <button type="button" onClick={() => void refreshHistory()} disabled={loading}
            className="mt-2 min-h-11 rounded-xl border border-red-200 px-3 py-2 font-semibold">Réessayer l’historique</button>
        </div>}
        {!loading && !historyError && conversations.length === 0 &&
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">Tes prochaines discussions apparaîtront ici.</p>}
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto lg:max-h-[60vh]">
          {conversations.map((item) => {
            const firstQuestion = item.messages.find((message) => message.role === 'user');
            return <li key={item.id}>
              <button type="button" disabled={sending || deleting} onClick={() => selectConversation(item)}
                aria-current={activeId === item.id ? 'true' : undefined}
                className={'w-full rounded-2xl px-3 py-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 ' +
                  (activeId === item.id ? 'bg-indigo-50 font-semibold text-indigo-950 ring-1 ring-indigo-200' :
                    'text-slate-700 hover:bg-slate-50')}>
                <span className="block truncate">{firstQuestion?.content ?? 'Discussion Mia'}</span>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {new Date(item.updatedAt).toLocaleDateString('fr-FR')}
                </span>
              </button>
            </li>;
          })}
        </ul>
      </aside>

      <section aria-label="Discussion avec Mia" className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-bold text-slate-900">Mia</h2>
              <p className="text-sm text-slate-600">Ton copilote pour les mentions commerciales</p>
            </div>
          </div>
          {activeId && <button onClick={() => void removeConversation()} type="button"
            disabled={sending || deleting} aria-label="Supprimer cette discussion"
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>{deleting ? 'Suppression…' : 'Supprimer'}</span>
          </button>}
        </div>
        {verificationId && <p className="px-4 pt-3 text-sm text-indigo-700 sm:px-6">
          <Link href={'/dashboard/archive/' + encodeURIComponent(verificationId)}
            className="underline underline-offset-2">Discussion liée à une vérification</Link>
        </p>}
        <div aria-live="polite" aria-label="Messages" className="min-h-72 max-h-[60vh] flex-1 space-y-5 overflow-y-auto bg-gradient-to-b from-white to-slate-50/60 px-3 py-6 sm:px-6">
          {!messages.length && <div className="mx-auto max-w-xl space-y-5 py-5 text-center sm:py-10">
            <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-slate-900">{greeting}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-600">Moi, c’est Mia. Je t’aide à comprendre les règles des collaborations commerciales, simplement et avec des sources.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                'Comment signaler un partenariat rémunéré ?',
                'Quelles mentions pour un lien affilié ?',
                'Que dire pour une image retouchée ?',
                'Quelles obligations pour un jeu concours ?',
              ].map((suggestion) => <button key={suggestion} type="button"
                onClick={() => setQuestion(suggestion)} disabled={sending || deleting}
                className="min-h-14 rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50">
                {suggestion}
              </button>)}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">Mia fournit des informations pédagogiques, pas un avis juridique. Vérifie toujours les textes officiels.</p>
          </div>}
          {messages.map((message, index) => <article key={index}
            className={'flex min-w-0 items-end gap-2 ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}>
            {message.role === 'assistant' && <div aria-hidden="true" className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Sparkles className="h-4 w-4" /></div>}
            <div className={'min-w-0 max-w-[88%] rounded-3xl px-4 py-3 text-base leading-relaxed shadow-sm sm:max-w-[78%] ' +
              (message.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' :
                'rounded-bl-md border border-slate-200 bg-white text-slate-900')}>
              <p className={'mb-1 text-xs font-semibold ' + (message.role === 'user' ? 'text-indigo-100' : 'text-indigo-700')}>
                {message.role === 'user' ? 'Toi' : 'Mia'}
              </p>
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
              {message.role === 'assistant' && !!message.sources?.length &&
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">Sources juridiques</p>
                  <ul className="space-y-2">
                    {message.sources.map((source) => <li key={source.articleRef}>
                      <a className="break-all text-sm font-semibold text-indigo-700 underline underline-offset-2"
                        href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {source.articleRef} — Légifrance
                      </a>
                    </li>)}
                  </ul>
                </div>}
            </div>
          </article>)}
          {sending && <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white"><Sparkles className="h-4 w-4" /></span>
            <span className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3">Mia prépare sa réponse…</span>
          </div>}
          <div ref={bottom} />
        </div>
        {error && <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mx-4 mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{notice}</p>}
        <form onSubmit={submit} aria-busy={sending} className="border-t border-slate-100 bg-white p-3 sm:p-5">
          <label htmlFor="mia-question" className="sr-only">Ta question</label>
          <div className="flex min-w-0 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <textarea disabled={sending || deleting} id="mia-question" value={question} rows={2} maxLength={1600}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Écris à Mia…"
              className="max-h-40 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-base leading-relaxed text-slate-900 outline-none placeholder:text-slate-500" />
            <button disabled={sending || deleting || question.trim().length < 3} type="submit"
              aria-label={sending ? 'Envoi en cours' : 'Envoyer à Mia'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40">
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>Mia peut se tromper. Vérifie les sources citées.</span>
            <span>{question.length}/1600</span>
          </div>
          {sending && <button type="button" onClick={() => {
            pending.current?.abort();
            setNotice('Attente arrêtée. Une réponse déjà demandée peut être enregistrée ; consulte l’historique avant de renvoyer.');
          }} className="mt-2 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Arrêter l’attente</button>}
        </form>
      </section>
    </div>
  );
}
