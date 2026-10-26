'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/env';
import { formatBRL } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { OutbidEvent, Wallet, WalletSummary } from '@/types/api';
import { useAuth } from '@/features/auth/auth-provider';

const SocketContext = createContext<Socket | null>(null);

/** Socket do namespace /realtime (null até conectar ou se o ambiente não suportar). */
export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

/**
 * Mantém UMA conexão Socket.IO por sessão. Com login, a conexão entra na sala privada do usuário
 * e recebe: atualização de carteira e aviso de "você foi superado". Os eventos de cada lote
 * são tratados pela sala do lote (useLotRoom), que entra/sai da sala do lote.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    const instance = io(`${getApiUrl()}/realtime`, {
      // WebSocket primeiro; se algum proxy/rede bloquear, cai para long-polling (a API roda em 1 instância).
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
      reconnectionDelayMax: 5000,
    });

    instance.on('wallet:updated', (summary: WalletSummary) => {
      queryClient.setQueryData<Wallet>(queryKeys.wallet, (old) => (old ? { ...old, ...summary } : old));
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    });

    instance.on('bid:outbid', (event: OutbidEvent) => {
      toast.warning('Você foi superado!', {
        description: (
          <span>
            {event.lotTitle}: novo lance de {formatBRL(event.newAmountCents)}.{' '}
            <Link href={`/lots/${event.lotId}`} className="font-medium underline">
              Dar outro lance
            </Link>
          </span>
        ),
        duration: 10_000,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.participations });
    });

    setSocket(instance);
    return () => {
      instance.removeAllListeners();
      instance.close();
      setSocket(null);
    };
  }, [token, status, queryClient]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
