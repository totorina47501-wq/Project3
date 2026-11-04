// Chemin : components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) {
      router.push('/login');
      router.refresh();
    }
  }
  return (
    <button onClick={logout} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100">
      Déconnexion
    </button>
  );
}
