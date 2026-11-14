// Chemin : components/AuthForm.tsx
'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const passwordInputId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const isLogin = mode === 'login';
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setMessage('');
    setNeedsConfirmation(false);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/' + mode, {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => {
        throw new Error('Le service est momentanément indisponible. Réessaie dans un instant.');
      }) as { ok?: boolean; error?: string; code?: string; message?: string };
      if (!response.ok) {
        if (isLogin && data.code === 'email_not_confirmed') setNeedsConfirmation(true);
        throw new Error(data.error ?? 'Opération impossible.');
      }
      if (isLogin) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setMessage(data.message ?? 'Vérifie tes emails pour activer le compte.');
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Opération impossible.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }

  async function resendConfirmation() {
    if (!isLogin || !needsConfirmation || !email || resending || loading) return;
    setResending(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? 'Envoi indisponible.');
      setMessage(data.message ?? 'Si une confirmation est attendue, vérifie ta boîte email.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Envoi indisponible.');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link href="/" className="font-heading text-xl font-bold text-primary">✓ MentionCheck</Link>
        <h1 className="mt-8 font-heading text-3xl font-bold">
          {isLogin ? 'Content de te retrouver !' : 'Rejoins MentionCheck'}
        </h1>
        <p className="mt-2 text-slate-600">
          {isLogin ? 'Connecte-toi pour checker une publication.' : 'Crée ton compte pour découvrir Mia.'}
        </p>
        <form onSubmit={submit} aria-busy={loading} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">
            Adresse email
            <input type="email" required disabled={loading} autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-accent"
              placeholder="toi@exemple.fr" />
          </label>
          <div className="block text-sm font-semibold">
            <label htmlFor={passwordInputId} className="block">Mot de passe</label>
            <div className="relative mt-2">
              <input id={passwordInputId} type={showPassword ? 'text' : 'password'} required disabled={loading}
                minLength={isLogin ? 8 : 12} autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none focus:border-accent" />
              <button type="button" aria-label={showPassword ? 'Masquer les caractères saisis' : 'Afficher les caractères saisis'}
                aria-controls={passwordInputId} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
              </button>
            </div>
            {!isLogin && <span className="mt-1 block text-xs font-normal text-slate-500">
              Au moins 12 caractères avec une minuscule, une majuscule, un chiffre et un symbole. Utilise un mot de passe unique et non compromis.
            </span>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <button disabled={loading} type="submit"
            className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? isLogin ? 'Connexion en cours…' : 'Création en cours…' : isLogin ? 'Se connecter' : "Créer mon compte"}
          </button>
        </form>
        {isLogin && needsConfirmation && (
          <div className="mt-4 text-center text-sm">
            <button type="button" disabled={loading || resending} onClick={resendConfirmation}
              className="font-semibold text-accent underline disabled:opacity-50">
              {resending ? 'Envoi en cours…' : 'Renvoyer le mail de confirmation'}
            </button>
          </div>
        )}
        {isLogin && (
          <p className="mt-4 text-center text-sm">
            <Link className="font-semibold text-accent underline" href="/forgot-password">
              Mot de passe oublié ?
            </Link>
          </p>
        )}
        <p className="mt-7 text-center text-sm text-slate-600">
          {isLogin ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
          <Link className="font-semibold text-accent underline" href={isLogin ? '/register' : '/login'}>
            {isLogin ? 'Inscris-toi' : 'Connecte-toi'}
          </Link>
        </p>
      </section>
    </main>
  );
}
