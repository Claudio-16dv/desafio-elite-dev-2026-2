/**
 * Configuração em tempo de execução, injetada pelo servidor num script inline do <head>
 * (veja `src/lib/runtime-config.ts` e `src/app/layout.tsx`).
 */
declare global {
  interface Window {
    __APP_CONFIG__?: { apiUrl?: string };
  }
}

const DEFAULT_API_URL = 'http://localhost:4000';

/**
 * Endereço da API visto pelo NAVEGADOR, em ordem de prioridade:
 *  1. `API_URL` do servidor, lido a CADA requisição (vale para qualquer ambiente, sem rebuild);
 *  2. `NEXT_PUBLIC_API_URL`, embutida no build (usada pelo docker-compose local);
 *  3. http://localhost:4000.
 *
 * Por que isso importa: em plataformas como a Northflank o endereço público da API só é
 * conhecido DEPOIS de criar o serviço. Com a configuração em runtime, a imagem do front
 * é a mesma em todo lugar e basta definir `API_URL` no serviço (sem refazer o build).
 *
 * Chame sempre como função (não guarde em constante no topo do módulo).
 */
export function getApiUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiUrl : undefined;
  return (runtime || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}
