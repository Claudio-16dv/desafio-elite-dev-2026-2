/**
 * Script inline com a configuração de runtime, escrito no <head> a cada requisição:
 *   window.__APP_CONFIG__={"apiUrl":"https://..."};
 *
 * Por que inline (e não um arquivo .js): ele roda de forma SÍNCRONA durante a leitura do HTML,
 * então a configuração já existe antes de o React hidratar e de qualquer chamada à API.
 * Só leva o endereço público da API: nenhum segredo passa por aqui.
 *
 * Roda no servidor (lê `API_URL` do ambiente do contêiner). O layout raiz é `force-dynamic`,
 * então o valor é lido a cada requisição, não congelado no build.
 */
export function runtimeConfigScript(env: Record<string, string | undefined> = process.env): string {
  const apiUrl = env.API_URL?.trim() ?? '';
  // JSON.stringify + escape de "<" impedem que o valor feche a tag <script> de forma inesperada.
  const json = JSON.stringify({ apiUrl }).replace(/</g, '\\u003c');
  return `window.__APP_CONFIG__=${json};`;
}
