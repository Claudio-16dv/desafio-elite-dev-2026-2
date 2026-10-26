const TOKEN_KEY = 'leilao.accessToken';

/**
 * Guarda o JWT no localStorage.
 * Trade-off documentado no README: simples e funciona em origens diferentes (web e API),
 * porém fica exposto a XSS; a API usa tokens de curta duração e o front não renderiza HTML não confiável.
 */
export const tokenStorage = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};
