import { hmacHex } from './hash-chain';

export type PseudonymKind = 'bidder' | 'seller';

/**
 * Pseudônimo público de um usuário DENTRO de um lote (ex.: "Licitante 3FA9C2").
 *
 * - Derivado por HMAC com segredo do servidor: não dá para descobrir quem é a pessoa.
 * - Muda de lote para lote: não permite rastrear o mesmo usuário entre leilões.
 * - É estável dentro do lote: o público consegue ver quem cobriu quem.
 */
export function pseudonymFor(
  secret: string,
  kind: PseudonymKind,
  lotId: string,
  userId: string,
): string {
  const digest = hmacHex(secret, `pseudonym|v1|${kind}|${lotId}|${userId}`)
    .slice(0, 6)
    .toUpperCase();
  return `${kind === 'seller' ? 'Leiloeiro' : 'Licitante'} ${digest}`;
}
