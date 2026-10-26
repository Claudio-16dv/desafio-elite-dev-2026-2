'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth-provider';
import { lotsApi } from '@/features/lots/lots-api';
import { useSocket } from '@/features/realtime/realtime-provider';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { LotBidEvent, LotCanceledEvent, LotClosedEvent, Wallet } from '@/types/api';
import {
  applyBidEvent,
  applyCanceledEvent,
  applyClosedEvent,
  type BidAppliedEvent,
  type LotRoomData,
} from './lot-room-state';
import { roomApi } from './room-api';

/**
 * Estado da sala do lote: carrega o detalhe por HTTP e o mantém vivo por WebSocket
 * (novos lances, prorrogação, encerramento, cancelamento), sem recarregar a página.
 *
 * Resiliência:
 *  - ao (re)conectar o socket, refaz a leitura por HTTP para não perder eventos;
 *  - se o WebSocket falhar, uma leitura periódica mantém a tela correta;
 *  - nas viradas de status (início/fim), busca o novo estado no instante certo.
 */
export function useLotRoom(lotId: string) {
  const { token, status: authStatus } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const key = queryKeys.lot(lotId);
  const [connected, setConnected] = useState(false);

  const query = useQuery<LotRoomData>({
    // O token entra na chave: ao logar/sair, a sala é relida com (ou sem) a situação do usuário.
    queryKey: [...key, token ?? 'anon'],
    enabled: authStatus !== 'loading',
    queryFn: async () => {
      const detail = await lotsApi.detail(lotId);
      return { ...detail, serverOffsetMs: Date.parse(detail.serverNow) - Date.now() };
    },
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data?.status === 'CLOSED' && !data.settled) return 1_000; // aguardando a liquidação
      return connected ? 30_000 : 5_000; // sem WebSocket, lê com mais frequência
    },
  });

  const dataKey = [...key, token ?? 'anon'];
  const { refetch } = query;

  // Assina os eventos do lote.
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('lot:join', lotId);
    const onConnect = () => {
      setConnected(true);
      join();
      void refetch(); // ressincroniza o que pode ter ocorrido durante uma queda
    };
    const onDisconnect = () => setConnected(false);

    const onBid = (event: LotBidEvent) => {
      if (event.lotId !== lotId) return;
      queryClient.setQueryData<LotRoomData>(dataKey, (prev) => (prev ? applyBidEvent(prev, event) : prev));
      if (event.extended) {
        toast.info('Lote prorrogado', { description: 'Um lance nos últimos 2 minutos estendeu o fim do lote em +2 minutos.' });
      }
    };
    const onClosed = (event: LotClosedEvent) => {
      if (event.lotId !== lotId) return;
      queryClient.setQueryData<LotRoomData>(dataKey, (prev) => (prev ? applyClosedEvent(prev, event) : prev));
      void refetch(); // traz o código do comprovante e a situação final do usuário
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: queryKeys.participations });
    };
    const onCanceled = (event: LotCanceledEvent) => {
      if (event.lotId !== lotId) return;
      queryClient.setQueryData<LotRoomData>(dataKey, (prev) => (prev ? applyCanceledEvent(prev, event) : prev));
      toast.warning('Este lote foi cancelado pelo leiloeiro.');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lot:bid', onBid);
    socket.on('lot:closed', onClosed);
    socket.on('lot:canceled', onCanceled);
    if (socket.connected) {
      setConnected(true);
      join();
    }

    return () => {
      socket.emit('lot:leave', lotId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lot:bid', onBid);
      socket.off('lot:closed', onClosed);
      socket.off('lot:canceled', onCanceled);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataKey é derivado de lotId/token
  }, [socket, lotId, token, queryClient, refetch]);

  // Busca o novo estado exatamente quando o lote vira (agendado -> ao vivo -> encerrado).
  const data = query.data;
  useEffect(() => {
    if (!data || (data.status !== 'SCHEDULED' && data.status !== 'LIVE')) return;
    const target = Date.parse(data.status === 'SCHEDULED' ? data.startsAt : data.endsAt);
    const delay = target - (Date.now() + data.serverOffsetMs) + 400;
    const id = window.setTimeout(() => void refetch(), Math.max(delay, 400));
    return () => window.clearTimeout(id);
  }, [data?.status, data?.startsAt, data?.endsAt, data?.serverOffsetMs, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...query, connected, dataKey };
}

/** Dar lance: atualiza a sala e a carteira na hora com a resposta (o WebSocket confirma em seguida). */
export function usePlaceBid(lotId: string, dataKey: readonly unknown[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amountCents: number) => roomApi.placeBid(lotId, amountCents),
    onSuccess: (result) => {
      const event: BidAppliedEvent = {
        lotId,
        bid: result.bid,
        currentBidCents: result.lot.currentBidCents,
        bidCount: result.lot.bidCount,
        minimumNextBidCents: result.lot.minimumNextBidCents,
        leaderPseudonym: result.lot.leaderPseudonym,
        endsAt: result.lot.endsAt,
        extended: result.lot.extended,
      };
      queryClient.setQueryData<LotRoomData>(dataKey, (prev) => (prev ? applyBidEvent(prev, event) : prev));
      queryClient.setQueryData<Wallet>(queryKeys.wallet, (old) => (old ? { ...old, ...result.wallet } : old));
      void queryClient.invalidateQueries({ queryKey: queryKeys.participations });
    },
    onError: (error) => {
      // Recusas por regra (ex.: alguém cobriu antes) deixam a tela defasada: relê o lote e a carteira.
      if (error instanceof ApiError && error.status === 422) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.lot(lotId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      }
    },
  });
}
