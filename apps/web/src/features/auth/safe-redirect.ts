/** Aceita apenas caminhos internos ("/algo"), evitando redirecionamento aberto para outros sites. */
export function safeRedirectPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
