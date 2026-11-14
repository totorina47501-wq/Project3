'use client';

import { FormEvent, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

function PasswordField({
  value, onChange, visible, onToggle, label, autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  label: string;
  autoComplete: string;
}) {
  const inputId = useId();
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={inputId} className="block">{label}</label>
      <div className="relative mt-2">
        <input id={inputId} type={visible ? 'text' : 'password'} required minLength={12} maxLength={200}
          autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none focus:border-accent" />
        <button type="button" onClick={onToggle} aria-pressed={visible}
          aria-controls={inputId} aria-label={visible ? 'Masquer les caractères saisis' : 'Afficher les caractères saisis'}
          className="absolute inset-y-0 right-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function AuthShell({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link href="/" className="font-heading text-xl font-bold text-primary">✓ MentionCheck</Link>
        <h1 className="mt-8 font-heading text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
        {children}
      </section>
    </main>
  );
}

export function PasswordResetRequestForm({ invalidLink = false }: { invalidLink?: boolean }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? 'Demande indisponible.');
      setMessage(data.message ?? 'Vérifie ta boîte email.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Demande indisponible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Mot de passe oublié ?" description="Reçois un lien sécurisé pour choisir un nouveau mot de passe.">
      {invalidLink && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Ce lien est expiré ou invalide. Demande un nouveau lien.
      </p>}
      <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
        <label className="block text-sm font-semibold">
          Adresse email
          <input type="email" required disabled={busy} value={email} autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-accent" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-50">
          {busy ? 'Envoi en cours…' : 'Envoyer un lien de réinitialisation'}
        </button>
      </form>
      <p className="mt-7 text-center text-sm"><Link href="/login" className="font-semibold text-accent underline">
        Retour à la connexion
      </Link></p>
    </AuthShell>
  );
}

export function PasswordResetUpdateForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || done) return;
    setError('');
    if (password !== repeat) {
      setError('Les deux mots de passe sont différents.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Impossible de modifier le mot de passe.');
      setPassword('');
      setRepeat('');
      setDone(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mise à jour indisponible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Nouveau mot de passe" description="Choisis un mot de passe unique pour sécuriser ton compte.">
      {done ? (
        <div className="mt-7 space-y-5">
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Mot de passe mis à jour. Tu peux maintenant te connecter.
          </p>
          <Link href="/login" className="block rounded-xl bg-accent px-5 py-3 text-center font-bold text-white">
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
          <PasswordField value={password} onChange={setPassword} visible={showPassword}
            onToggle={() => setShowPassword((visible) => !visible)}
            label="Nouveau mot de passe" autoComplete="new-password" />
          <PasswordField value={repeat} onChange={setRepeat} visible={showRepeat}
            onToggle={() => setShowRepeat((visible) => !visible)}
            label="Confirmer le mot de passe" autoComplete="new-password" />
          <p className="text-xs text-slate-600">
            12 caractères minimum, avec une minuscule, une majuscule, un chiffre et un symbole.
          </p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-50">
            {busy ? 'Mise à jour en cours…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      )}
      <p className="mt-7 text-center text-sm"><Link href="/forgot-password" className="font-semibold text-accent underline">
        Demander un autre lien
      </Link></p>
    </AuthShell>
  );
}
