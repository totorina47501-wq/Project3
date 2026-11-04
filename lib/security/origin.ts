// Les écritures authentifiées par cookies doivent présenter une origine explicite.
// Une origine absente n'est pas une preuve de requête same-origin.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin && origin === new URL(origin).origin;
  } catch {
    return false;
  }
}
