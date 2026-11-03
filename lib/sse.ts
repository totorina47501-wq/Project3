// Chemin : lib/sse.ts
export function createEventStream(executor: (
  emit: (event: string, data: unknown) => void,
) => Promise<void>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(
          'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n',
        ));
      };
      void executor(emit).catch(() => {
        emit('error', { message: 'Erreur lors de la vérification.' });
      }).finally(() => controller.close());
    },
  });
}
