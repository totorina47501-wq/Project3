'use client';
import type { FormEvent } from 'react';
type Invite = { action: 'invite'; workspaceId: string; email: string; role: 'admin' | 'member' };
type Props = {
  workspaceId: string; actorRole: string; disabled: boolean; email: string; requestedRole: 'admin' | 'member';
  onEmailChange: (email: string) => void;
  onRoleChange: (role: 'admin' | 'member') => void;
  onInvite: (input: Invite) => void;
};
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function StudioInvitationForm(props: Props) {
  if (props.actorRole !== 'owner' && props.actorRole !== 'admin') return null;
  // Un choix provenant d'une autre équipe ne devient jamais une autorisation.
  const role = props.actorRole === 'owner' ? props.requestedRole : 'member';
  function submit(event: FormEvent) {
    event.preventDefault();
    props.onInvite({ action: 'invite', workspaceId: props.workspaceId, email: props.email, role });
  }
  return <form onSubmit={submit}>
    <fieldset disabled={props.disabled} className="space-y-3"><h3 className="font-semibold">Inviter une personne</h3>
      <label className="block text-sm">Email invité<input type="email" required maxLength={320} className={field} value={props.email} onChange={(e) => props.onEmailChange(e.target.value)} /></label>
      <label className="block text-sm">Rôle<select className={field} value={role} onChange={(e) => props.onRoleChange(e.target.value as 'admin' | 'member')}><option value="member">Membre</option>{props.actorRole === 'owner' && <option value="admin">Administrateur</option>}</select></label>
      <button className={button}>Créer le jeton d’invitation</button>
    </fieldset>
  </form>;
}
