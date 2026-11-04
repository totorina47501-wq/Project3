import { describe, expect, it } from 'vitest';
import { createEventStream } from '../../lib/sse';

describe('flux SSE interrompu', () => {
  it('ignore les événements tardifs et ferme proprement après annulation', async () => {
    let send: (event: string, data: unknown) => void = () => {};
    let finish = () => {};
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const stream = createEventStream(async (emit) => {
      send = emit;
      await gate;
    });
    const reader = stream.getReader();
    await reader.cancel();
    expect(() => send('scan_text', { status: 'complete' })).not.toThrow();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('émet une erreur française puis termine si le traitement échoue', async () => {
    const stream = createEventStream(async () => { throw new Error('secret fournisseur'); });
    const text = await new Response(stream).text();
    expect(text).toContain('event: error');
    expect(text).toContain('Erreur lors de la vérification.');
    expect(text).not.toContain('secret fournisseur');
  });
});
