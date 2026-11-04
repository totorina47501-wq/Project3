import { describe, expect, it } from 'vitest';
import { prepareErasurePlan } from '../../lib/privacy/erasure-plan';
const source={collections:{workspaces:[{id:'team',owner_id:'owner'}],apiKeys:[{id:'key',created_by:'owner'}]},privateFiles:[{bucket:'deal-contracts',path:'owner/contract.pdf'}]};
describe('Préparation effacement sans suppression',()=>{
  it('produit uniquement un plan dry-run et bloque un workspace encore possédé',()=>{
    const plan=prepareErasurePlan('owner',{id:'request',status:'requested'},source);
    expect(plan.dryRun).toBe(true);
    expect(plan.deleted).toBe(false);
    expect(plan.blockers).toContain('owned_workspaces_require_transfer');
    expect(plan.steps.map(step=>step.kind)).toEqual(expect.arrayContaining(['revoke_sessions','revoke_api_keys','private_storage','external_processors','database','auth_user']));
    expect(plan.privateFiles).toEqual(source.privateFiles);
  });
  it('refuse explicitement toute exécution destructive',()=>{
    expect(()=>prepareErasurePlan('owner',{id:'request',status:'requested'},source,{execute:true})).toThrow();
  });
  it('refuse les demandes annulées ou closes',()=>{
    expect(()=>prepareErasurePlan('owner',{id:'request',status:'cancelled'},source)).toThrow();
  });
});
