import { describe,it,expect } from 'vitest';
import {
  erasureActionSchema,erasureStatusSchema,
  canCancelErasure,requiresErasureCooldown,ACTIVE_ERASURE_STATUSES,
} from '../../lib/privacy/erasure';

describe('Demande d effacement sans suppression automatique',()=>{
  it('exige la confirmation exacte SUPPRIMER',()=>{
    expect(erasureActionSchema.safeParse({
      action:'request',confirmation:'SUPPRIMER',
    }).success).toBe(true);
    expect(erasureActionSchema.safeParse({
      action:'request',confirmation:'supprimer',
    }).success).toBe(false);
    expect(erasureActionSchema.safeParse({
      action:'request',
    }).success).toBe(false);
    expect(erasureActionSchema.safeParse({
      action:'request',confirmation:'SUPPRIMER',user_id:'other',
    }).success).toBe(false);
  });
  it('permet d annuler une demande en attente seulement',()=>{
    expect(canCancelErasure('requested')).toBe(true);
    expect(canCancelErasure('reviewing')).toBe(false);
    expect(canCancelErasure('completed')).toBe(false);
    expect(erasureActionSchema.parse({action:'cancel'}).action).toBe('cancel');
  });
  it('bloque les répétitions immédiates après annulation',()=>{
    const now=Date.parse('2026-11-04T12:00:00Z');
    expect(requiresErasureCooldown('cancelled','2026-11-04T11:59:30Z',now)).toBe(true);
    expect(requiresErasureCooldown('cancelled','2026-11-04T11:58:00Z',now)).toBe(false);
    expect(requiresErasureCooldown('requested','2026-11-04T11:59:30Z',now)).toBe(false);
  });
  it('garde une liste d états autorisés explicite',()=>{
    expect(erasureStatusSchema.safeParse('deleted').success).toBe(false);
    expect(ACTIVE_ERASURE_STATUSES.has('reviewing')).toBe(true);
    expect(ACTIVE_ERASURE_STATUSES.has('cancelled')).toBe(false);
  });
});
