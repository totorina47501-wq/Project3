// Chemin : components/MiaChat.tsx
'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
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

export function MiaChat({ initialVerificationId }: { initialVerificationId?: string | undefined }) {
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
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside aria-label="Conversations récentes" className="rounded-2xl border border-slate-200 bg-white p-4">
        <button type="button" onClick={startNew} disabled={sending || deleting}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          Nouvelle conversation
        </button>
        <h2 className="mt-6 text-sm font-semibold text-slate-500">Mes discussions</h2>
        {loading && <p role="status" className="mt-3 text-sm text-slate-500">Chargement…</p>}
        {historyError && <div className="mt-3 text-sm text-red-800">
          <p role="alert">{historyError}</p>
          <button type="button" onClick={() => void refreshHistory()} disabled={loading}
            className="mt-2 rounded-lg border border-red-200 px-3 py-2 font-semibold">Réessayer l’historique</button>
        </div>}
        {!loading && !historyError && conversations.length === 0 &&
          <p className="mt-3 text-sm text-slate-500">Aucune discussion enregistrée.</p>}
        <ul className="mt-2 space-y-2">
          {conversations.map((item) => {
            const firstQuestion = item.messages.find((message) => message.role === 'user');
            return <li key={item.id}>
              <button type="button" disabled={sending || deleting} onClick={() => selectConversation(item)}
                aria-current={activeId === item.id ? 'true' : undefined}
                className={'w-full rounded-lg px-3 py-3 text-left text-sm disabled:opacity-50 ' +
                  (activeId === item.id ? 'bg-indigo-100 font-semibold text-indigo-900' :
                    'bg-slate-50 text-slate-800 hover:bg-slate-100')}>
                <span className="block truncate">{firstQuestion?.content ?? 'Discussion Mia'}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {new Date(item.updatedAt).toLocaleDateString('fr-FR')}
                </span>
              </button>
            </li>;
          })}
        </ul>
      </aside>

      <section aria-label="Discussion avec Mia" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-heading text-2xl font-bold">Mia, ton assistante</h2>
            <p className="mt-1 text-sm text-slate-600">Des réponses pédagogiques fondées sur des sources juridiques référencées.</p>
          </div>
          {activeId && <button onClick={() => void removeConversation()} type="button"
            disabled={sending || deleting}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
            {deleting ? 'Suppression…' : 'Supprimer cette discussion'}
          </button>}
        </div>
        {verificationId && <p className="mt-3 text-sm text-indigo-700">
          <Link href={'/dashboard/archive/' + encodeURIComponent(verificationId)}
            className="underline">Discussion liée à une vérification</Link>
        </p>}
        <div aria-live="polite" className="mt-5 max-h-[55vh] min-h-56 space-y-4 overflow-y-auto pr-1">
          {!messages.length && <div className="rounded-xl bg-indigo-50 p-5 text-slate-700">
            <p className="font-semibold">Bonjour ! Je suis Mia.</p>
            <p className="mt-2 text-sm">
              Demande-moi comment signaler une collaboration commerciale, un lien affilié
              ou une image retouchée. Je citerai les références consultées.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Mes réponses ne remplacent pas un avis juridique et les résumés doivent être vérifiés dans les textes officiels.
            </p>
          </div>}
          {messages.map((message, index) => <article key={index}
            className={'rounded-xl p-4 text-sm leading-relaxed ' + (message.role === 'user'
              ? 'ml-5 bg-indigo-100 text-indigo-950' : 'mr-5 bg-slate-50 text-slate-900')}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide">
              {message.role === 'user' ? 'Toi' : 'Mia'}
            </p>
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            {message.role === 'assistant' && !!message.sources?.length &&
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-semibold">Références juridiques consultées</p>
                <ul className="space-y-1">
                  {message.sources.map((source) => <li key={source.articleRef}>
                    <a className="break-words text-xs font-semibold text-indigo-700 underline"
                      href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {source.articleRef} — Legifrance
                    </a>
                  </li>)}
                </ul>
              </div>}
          </article>)}
          {sending && <p className="text-sm text-slate-500" role="status">Mia prépare sa réponse…</p>}
          <div ref={bottom} />
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{notice}</p>}
        <form onSubmit={submit} aria-busy={sending} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
          <label htmlFor="mia-question" className="font-semibold">Ta question</label>
          <textarea disabled={sending || deleting} id="mia-question" value={question} rows={3} maxLength={1600}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Comment déclarer un lien affilié dans une publication Instagram ?"
            className="w-full resize-y rounded-xl border border-slate-300 p-3 outline-none focus:border-accent" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{question.length}/1600</span>
            <button disabled={sending || deleting || question.trim().length < 3} type="submit"
              className="rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-50">
              {sending ? 'Envoi…' : 'Envoyer à Mia'}
            </button>
          </div>
          {sending && <button type="button" onClick={() => {
            pending.current?.abort();
            setNotice('Attente arrêtée. Une réponse déjà demandée peut être enregistrée ; consulte l’historique avant de renvoyer.');
          }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">Arrêter l’attente</button>}
        </form>
      </section>
    </div>
  );
}
