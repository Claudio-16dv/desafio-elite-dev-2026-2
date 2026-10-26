import { getApiUrl } from './env';
import { tokenStorage } from './token-storage';

/** Erro padronizado da API: `code` para a lógica, `message` já em português para o usuário. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** O AuthProvider registra aqui o que fazer quando a sessão expira (401 com token enviado). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false = não envia o token (rotas públicas). Padrão: envia se houver token. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;
  const token = auth ? tokenStorage.get() : null;

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.',
      0,
      'NETWORK_ERROR',
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const data = (payload ?? {}) as { code?: string; message?: string | string[]; details?: Record<string, unknown> };
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    if (response.status === 401 && token) unauthorizedHandler?.();
    throw new ApiError(
      message ?? 'Algo deu errado. Tente novamente.',
      response.status,
      data.code ?? 'UNKNOWN_ERROR',
      data.details,
    );
  }

  return payload as T;
}

/** Mensagem amigável a partir de qualquer erro capturado. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Algo deu errado. Tente novamente.';
}
