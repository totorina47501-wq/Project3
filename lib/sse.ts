// Chemin : lib/sse.ts
export function createEventStream(executor: (
  emit: (event: string, data: unknown) => void,
) => Promise<void>) {
  const encoder = new TextEncoder();
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        // Le navigateur peut fermer le flux avant la fin du traitement.
        if (closed) return;
        controller.enqueue(encoder.encode(
          'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n',
        ));
      };
      void executor(emit).catch(() => {
        emit('error', { message: 'Erreur lors de la vérification.' });
      }).finally(() => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
    },
    cancel() { closed = true; },
  });
}
