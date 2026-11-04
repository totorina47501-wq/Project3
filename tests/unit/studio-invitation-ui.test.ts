import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StudioInvitationForm } from '../../components/StudioInvitationForm';

const base = { workspaceId: 'team-b', email: 'invite@example.test', requestedRole: 'admin' as const,
  disabled: false, onEmailChange: () => {}, onRoleChange: () => {}, onInvite: vi.fn() };

describe('Studio rôle effectivement envoyé par le formulaire invitation', () => {
  it('abaisse le choix précédent owner/admin au passage sur une équipe administrée', () => {
    const onInvite = vi.fn();
    const props = { ...base, actorRole: 'admin', onInvite };
    const html = renderToStaticMarkup(createElement(StudioInvitationForm, props));
    expect(html).not.toContain('value="admin"');
    expect(html).toContain('value="member" selected');
    const form = StudioInvitationForm(props);
    const preventDefault = vi.fn();
    form?.props.onSubmit({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onInvite).toHaveBeenCalledWith({ action: 'invite', workspaceId: 'team-b', email: 'invite@example.test', role: 'member' });
  });
  it('permet au propriétaire de proposer un administrateur', () => {
    const onInvite = vi.fn();
    const props = { ...base, actorRole: 'owner', onInvite };
    expect(renderToStaticMarkup(createElement(StudioInvitationForm, props))).toContain('value="admin" selected');
    StudioInvitationForm(props)?.props.onSubmit({ preventDefault() {} });
    expect(onInvite).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });
  it('n’affiche aucune invitation pour un membre ordinaire', () => {
    expect(renderToStaticMarkup(createElement(StudioInvitationForm, { ...base, actorRole: 'member' }))).toBe('');
    expect(base.onInvite).not.toHaveBeenCalled();
  });
});
