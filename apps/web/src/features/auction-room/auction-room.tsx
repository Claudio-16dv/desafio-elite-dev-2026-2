'use client';

import { ExternalLink, Fingerprint, Radio, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AttributeList } from '@/features/lots/attribute-list';
import { LotImage } from '@/features/lots/lot-image';
import { LotStatusBadge } from '@/features/lots/lot-status-badge';
import { ApiError } from '@/lib/api-client';
import { formatBRL } from '@/lib/format';
import { BidHistory } from './bid-history';
import { BidPanel } from './bid-panel';
import { countBidders } from './lot-room-state';
import { ResultCard } from './result-card';
import { RoomClock } from './room-clock';
import { StandingBanner } from './standing-banner';
import { useLotRoom } from './use-lot-room';

/** Sala do lote ao vivo: tudo se atualiza por WebSocket, sem recarregar a página. */
export function AuctionRoom({ lotId }: { lotId: string }) {
  const { data: lot, isLoading, isError, error, refetch, connected, dataKey } = useLotRoom(lotId);

  if (isLoading) return <RoomSkeleton />;

  if (isError || !lot) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        error={error}
        title={notFound ? 'Lote não encontrado' : 'Não foi possível abrir a sala do lote'}
        onRetry={notFound ? undefined : () => void refetch()}
      />
    );
  }

  const biddersCount = countBidders(lot.bids);
  const isBidder = lot.me?.role === 'BIDDER';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <LotStatusBadge status={lot.status} />
            {lot.status === 'LIVE' && (
              <Badge variant={connected ? 'outline' : 'warning'} title={connected ? 'Recebendo lances em tempo real' : 'Reconectando ao tempo real…'}>
                {connected ? <Radio aria-hidden /> : <WifiOff aria-hidden />}
                {connected ? 'Tempo real ativo' : 'Reconectando…'}
              </Badge>
            )}
          </div>
          <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{lot.title}</h1>
          {lot.subtitle && <p className="text-muted-foreground">{lot.subtitle}</p>}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/audit/${lot.id}`}>
            <Fingerprint /> Auditar histórico
          </Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Coluna de ação: no celular aparece primeiro, para o lance ficar ao alcance. */}
        <div className="order-first space-y-4 lg:order-last">
          <RoomClock
            status={lot.status}
            startsAt={lot.startsAt}
            endsAt={lot.endsAt}
            extended={lot.extended}
            serverOffsetMs={lot.serverOffsetMs}
          />

          {/* Lance atual: cartão no degradê-assinatura; o valor "salta" a cada lance novo. */}
          <section className="bg-brand-deep shadow-glow relative isolate overflow-hidden rounded-3xl px-6 py-6 text-white">
            <div aria-hidden className="bg-grain absolute inset-0 -z-10 opacity-20 mix-blend-overlay" />
            <div aria-hidden className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-white/20 blur-3xl" />
            <p className="text-xs font-semibold tracking-widest uppercase opacity-85">
              {lot.currentBidCents === null ? 'Lance inicial' : 'Lance atual'}
            </p>
            <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums" aria-live="polite">
              <span key={lot.currentBidCents ?? 'inicial'} className="inline-block animate-pop">
                {formatBRL(lot.currentBidCents ?? lot.startingBidCents)}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-white/20 px-2.5 py-1">
                {lot.bidCount} {lot.bidCount === 1 ? 'lance' : 'lances'}
              </span>
              {lot.leaderPseudonym && lot.status !== 'CLOSED' && (
                <span className="rounded-full bg-white/20 px-2.5 py-1">Líder: {lot.leaderPseudonym}</span>
              )}
              <span className="rounded-full bg-white/20 px-2.5 py-1">Incremento mínimo: {formatBRL(lot.minIncrementCents)}</span>
            </div>
          </section>

          <ResultCard lot={lot} />

          <StandingBanner
            me={lot.me}
            status={lot.status}
            currentBidCents={lot.currentBidCents}
            biddersCount={biddersCount}
            lotId={lot.id}
          />

          {isBidder && (
            <BidPanel
              lotId={lot.id}
              dataKey={dataKey}
              status={lot.status}
              minimumNextBidCents={lot.minimumNextBidCents}
              minIncrementCents={lot.minIncrementCents}
              isLeading={lot.me?.isLeading ?? false}
            />
          )}

          <BidHistory lotId={lot.id} bids={lot.bids} myPseudonym={lot.me?.pseudonym} leaderPseudonym={lot.leaderPseudonym} />
        </div>

        <div className="space-y-4">
          {/* "Nicho de galeria": parede escura com holofote e a obra emoldurada no centro. */}
          <div className="relative isolate overflow-hidden rounded-[2rem] border bg-[oklch(0.21_0.008_60)] px-6 py-10 sm:px-12 sm:py-14">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,oklch(1_0_0/14%),transparent_70%)]"
            />
            <div aria-hidden className="bg-grain absolute inset-0 -z-10 opacity-10 mix-blend-overlay" />
            <div className="mx-auto w-fit rounded-md bg-[oklch(0.97_0.01_80)] p-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] sm:p-4">
              <LotImage src={lot.imageUrl} alt={lot.title} priority className="max-h-[28rem] w-auto max-w-full object-contain" />
            </div>
            <div aria-hidden className="mx-auto mt-6 h-3 w-2/3 rounded-full bg-black/50 blur-xl" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sobre o item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lot.description && <p className="text-sm">{lot.description}</p>}
              <AttributeList attributes={lot.attributes} />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm text-muted-foreground">
                <span>Leiloeiro: {lot.sellerPseudonym}</span>
                {lot.sourceUrl && (
                  <a
                    href={lot.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                  >
                    Ver no acervo <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando sala do lote">
      <Skeleton className="h-10 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <Skeleton className="h-96" />
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
