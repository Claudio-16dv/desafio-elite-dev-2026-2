'use client';

import { useQuery } from '@tanstack/react-query';
import { Gavel, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LotImage } from '@/features/lots/lot-image';
import { ShareReceiptButton } from '@/features/receipts/share-receipt-button';
import { formatBRL } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Participation, ParticipationStatus } from '@/types/api';
import { bidsApi } from './bids-api';

const STATUS: Record<ParticipationStatus, { label: string; variant: 'success' | 'destructive' | 'secondary' | 'warning' }> = {
  LEADING: { label: 'Ganhando', variant: 'success' },
  OUTBID: { label: 'Superado', variant: 'destructive' },
  WON: { label: 'Arrematado', variant: 'success' },
  LOST: { label: 'Não arrematado', variant: 'secondary' },
  CANCELED: { label: 'Lote cancelado', variant: 'warning' },
};

function ParticipationRow({ item }: { item: Participation }) {
  const { lot } = item;
  const status = STATUS[item.status];
  const finalPrice = lot.result?.finalPriceCents ?? null;

  return (
    <Card className="flex-row items-stretch gap-0 overflow-hidden py-0">
      <LotImage src={lot.imageUrl} alt={lot.title} className="hidden w-32 shrink-0 sm:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Badge variant={status.variant}>{status.label}</Badge>
          <h3 className="truncate font-semibold">
            <Link href={`/lots/${lot.id}`} className="hover:underline">
              {lot.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">
            Seu maior lance: <strong className="text-foreground tabular-nums">{formatBRL(item.myHighestBidCents)}</strong>
            {item.status === 'WON' && finalPrice !== null ? (
              <>
                {' · '}Pago: <strong className="text-foreground tabular-nums">{formatBRL(finalPrice)}</strong>
              </>
            ) : lot.currentBidCents !== null && item.status !== 'CANCELED' ? (
              <>
                {' · '}Lance {lot.settled ? 'final' : 'atual'}: <strong className="text-foreground tabular-nums">{formatBRL(lot.currentBidCents)}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/lots/${lot.id}`}>
              <Gavel /> {item.status === 'LEADING' || item.status === 'OUTBID' ? 'Ir para a sala' : 'Ver lote'}
            </Link>
          </Button>
          {item.status === 'WON' && item.receiptCode && (
            <>
              <Button asChild size="sm">
                <Link href={`/receipts/${item.receiptCode}`}>
                  <ReceiptText /> Comprovante
                </Link>
              </Button>
              <ShareReceiptButton code={item.receiptCode} />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function List({ items, empty }: { items: Participation[]; empty: string }) {
  if (items.length === 0) return <EmptyState icon={Gavel} title={empty} />;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ParticipationRow key={item.lot.id} item={item} />
      ))}
    </div>
  );
}

export function MyBidsView() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.participations,
    queryFn: bidsApi.participations,
    refetchInterval: 15_000,
  });

  const items = data?.items ?? [];
  const active = items.filter((i) => i.status === 'LEADING' || i.status === 'OUTBID');
  const won = items.filter((i) => i.status === 'WON');
  const other = items.filter((i) => i.status === 'LOST' || i.status === 'CANCELED');

  return (
    <div>
      <PageHeader title="Meus arremates" description="Lotes em que você deu lances e os que você venceu, com o comprovante e o link para compartilhar." />

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={active.length > 0 || won.length === 0 ? 'active' : 'won'}>
          <TabsList>
            <TabsTrigger value="active">Em disputa ({active.length})</TabsTrigger>
            <TabsTrigger value="won">Arrematados ({won.length})</TabsTrigger>
            <TabsTrigger value="other">Outros ({other.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="pt-4">
            <List items={active} empty="Você não tem lances em lotes em andamento." />
          </TabsContent>
          <TabsContent value="won" className="pt-4">
            <List items={won} empty="Você ainda não arrematou nenhum lote." />
          </TabsContent>
          <TabsContent value="other" className="pt-4">
            <List items={other} empty="Nada por aqui." />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
