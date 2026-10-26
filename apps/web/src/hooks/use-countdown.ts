'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Diferença entre o relógio do servidor e o do navegador, calculada quando uma resposta
 * chega. Assim a contagem regressiva não "mente" mesmo se o relógio do usuário estiver errado.
 */
export function useServerOffset(serverNowIso: string | undefined): number {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula SOMENTE quando chega um novo "agora" do servidor
  return useMemo(() => (serverNowIso ? Date.parse(serverNowIso) - Date.now() : 0), [serverNowIso]);
}

/**
 * Milissegundos restantes até `targetIso` (já corrigidos pelo relógio do servidor).
 * Atualiza a cada 250 ms para o último segundo nunca "pular" na tela.
 * Retorna null enquanto não há data alvo.
 */
export function useCountdown(targetIso: string | null | undefined, serverOffsetMs = 0): number | null {
  const target = targetIso ? Date.parse(targetIso) : null;
  const [remaining, setRemaining] = useState<number | null>(() => (target === null ? null : target - (Date.now() + serverOffsetMs)));

  useEffect(() => {
    if (target === null) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(target - (Date.now() + serverOffsetMs));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [target, serverOffsetMs]);

  return remaining;
}
