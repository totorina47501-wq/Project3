import { describe, expect, it } from 'vitest';
import { createLocalEmailTransport, createEmailSimulation } from '../../lib/email/simulation';
import { emailPreviews, type EmailInput } from '../../lib/email/templates';
const welcome:EmailInput={kind:'welcome',name:'<Camille>',siteOrigin:'https://local.test'};
describe('Outbox locale des quatre emails',()=>{
  it('injecte uniquement un transport local et garde les quatre rendus existants',async()=>{
    const transport=createLocalEmailTransport();const outbox=createEmailSimulation(transport);
    const id='3a83817f-dadc-478c-889e-2a3721525a76';
    const messages:EmailInput[]=[welcome,{kind:'report-ready',verificationId:id,siteOrigin:'https://local.test'},{kind:'quota-warning',used:2,limit:3,periodEnd:'2026-12-01',siteOrigin:'https://local.test'},{kind:'erasure-received',requestId:id,siteOrigin:'https://local.test'}];
    for(const [index,input] of messages.entries()){
      outbox.enqueue({key:'local_'+index,recipientId:'fixture_owner',input});
      expect((await outbox.dispatch('local_'+index)).status).toBe('simulated');
    }
    expect(transport.deliveries()).toHaveLength(emailPreviews('https://local.test').length);
    expect(transport.deliveries()[0]?.email.html).toContain('&lt;Camille&gt;');
    expect(transport.deliveries()[0]?.email.html).not.toContain('<Camille>');
    expect(()=>createEmailSimulation({mode:'local-simulation',deliver:()=>{throw new Error('provider');}} as never)).toThrow();
  });
  it('déduplique, refuse les collisions et ne reçoit aucun email réel',async()=>{
    const transport=createLocalEmailTransport();const outbox=createEmailSimulation(transport);
    const command={key:'welcome_owner',recipientId:'fixture_owner',input:welcome};
    outbox.enqueue(command);outbox.enqueue(command);
    await Promise.all([outbox.dispatch(command.key),outbox.dispatch(command.key)]);
    expect(transport.deliveries()).toHaveLength(1);
    expect(()=>outbox.enqueue({...command,input:{...welcome,name:'Autre'}})).toThrow(/identifiant/i);
    expect(()=>outbox.enqueue({...command,key:'other',recipientId:'real@example.com'})).toThrow();
  });
  it('reprend après panne simulée et déduplique un accusé perdu',async()=>{
    const transport=createLocalEmailTransport({failuresBeforeRecord:1,failuresAfterRecord:1});
    const outbox=createEmailSimulation(transport);
    outbox.enqueue({key:'retry_local',recipientId:'fixture_owner',input:welcome});
    expect((await outbox.dispatch('retry_local')).status).toBe('failed');expect(transport.deliveries()).toHaveLength(0);
    expect((await outbox.dispatch('retry_local')).status).toBe('failed');expect(transport.deliveries()).toHaveLength(1);
    const result=await outbox.dispatch('retry_local');expect(result.status).toBe('simulated');expect(result.attempts).toBe(3);
    expect(transport.deliveries()).toHaveLength(1);
  });
  it('borne les reprises et ne laisse pas le consommateur modifier l’outbox',async()=>{
    const transport=createLocalEmailTransport({failuresBeforeRecord:4});const outbox=createEmailSimulation(transport,{maxAttempts:2});
    const row=outbox.enqueue({key:'bounded',recipientId:'fixture_owner',input:welcome});
    row.email.subject='mutated';
    await outbox.dispatch('bounded');await outbox.dispatch('bounded');await outbox.dispatch('bounded');
    expect(outbox.get('bounded')?.attempts).toBe(2);expect(outbox.get('bounded')?.email.subject).toBe('Bienvenue sur MentionCheck');
  });
});
