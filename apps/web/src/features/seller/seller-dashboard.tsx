'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CircleDollarSign, Clock, Fingerprint, Gavel, PackageCheck, PackageX, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LotImage } from '@/features/lots/lot-image';
import { LotStatusBadge } from '@/features/lots/lot-status-badge';
import { errorMessage } from '@/lib/api-client';
import { formatBRL, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { LotSummary } from '@/types/api';
import { sellerApi } from './seller-api';

function SummaryCard({ icon: Icon, label, value, accent }: { icon: typeof Gavel; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={`gap-1 px-5 py-4 ${accent ? 'bg-brand-deep shadow-glow border-transparent text-white' : ''}`}>
      <p className={`flex items-center gap-2 text-xs font-semibold tracking-widest uppercase ${accent ? 'opacity-85' : 'text-muted-foreground'}`}>
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
    </Card>
  );
}

function ResultCell({ lot }: { lot: LotSummary }) {
  if (lot.status === 'CANCELED') return <span className="text-muted-foreground">Cancelado</span>;
  if (lot.status === 'CLOSED') {
    if (!lot.settled) return <span className="text-muted-foreground">Apurando…</span>;
    return lot.result?.sold ? (
      <span>
        <strong className="text-success tabular-nums">Arrematado por {formatBRL(lot.result.finalPriceCents ?? 0)}</strong>
        <span className="block text-xs text-muted-foreground">{lot.result.winnerPseudonym}</span>
      </span>
    ) : (
      <span className="text-muted-foreground">Sem lances (não vendido)</span>
    );
  }
  return lot.currentBidCents !== null ? (
    <span className="tabular-nums">Lance atual {formatBRL(lot.currentBidCents)}</span>
  ) : (
    <span className="text-muted-foreground">Sem lances ainda</span>
  );
}

export function SellerDashboard() {
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: queryKeys.sellerSummary, queryFn: sellerApi.summary, refetchInterval: 10_000 });
  const lots = useQuery({ queryKey: queryKeys.sellerLots, queryFn: sellerApi.lots, refetchInterval: 10_000 });
  const [toCancel, setToCancel] = useState<LotSummary | null>(null);

  const cancel = useMutation({
    mutationFn: (id: string) => sellerApi.cancelLot(id),
    onSuccess: async () => {
      toast.success('Lote cancelado', { description: 'Se havia um líder, o valor reservado foi liberado automaticamente.' });
      setToCancel(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerLots }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lotsAll }),
      ]);
    },
    onError: (error) => {
      toast.error('Não foi possível cancelar', { description: errorMessage(error) });
      setToCancel(null);
    },
  });

  const s = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel do leiloeiro"
        description="Crie lotes a partir do acervo, acompanhe os lances e veja o resultado de cada leilão."
        actions={
          <Button asChild>
            <Link href="/seller/new">
              <Plus /> Novo lote
            </Link>
          </Button>
        }
      />

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard icon={CircleDollarSign} label="Total recebido" value={formatBRL(s.totalReceivedCents)} accent />
          <SummaryCard icon={PackageCheck} label="Vendidos" value={String(s.soldCount)} />
          <SummaryCard icon={PackageX} label="Sem vencedor" value={String(s.unsoldCount)} />
          <SummaryCard icon={Gavel} label="Ao vivo" value={String(s.liveCount)} />
          <SummaryCard icon={Clock} label="Agendados" value={String(s.scheduledCount)} />
          <SummaryCard icon={Ban} label="Cancelados" value={String(s.canceledCount)} />
        </div>
      )}

      <section aria-labelledby="my-lots-title" className="space-y-3">
        <h2 id="my-lots-title" className="text-xl font-semibold">
          Meus lotes
        </h2>

        {lots.isError ? (
          <ErrorState error={lots.error} onRetry={() => void lots.refetch()} />
        ) : lots.isLoading ? (
          <Skeleton className="h-64" />
        ) : lots.data && lots.data.items.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="Você ainda não criou lotes"
            description="Busque um item no acervo e defina lance inicial, incremento e horários."
            action={
              <Button asChild>
                <Link href="/seller/new">
                  <Plus /> Criar primeiro lote
                </Link>
              </Button>
            }
          />
        ) : (
          <Card className="py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Lote</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Lances</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="pr-4 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.data?.items.map((lot) => {
                  const cancelable = lot.status === 'SCHEDULED' || lot.status === 'LIVE';
                  return (
                    <TableRow key={lot.id}>
                      <TableCell className="pl-4">
                        <div className="flex min-w-56 items-center gap-3">
                          <LotImage src={lot.imageUrl} alt="" className="size-12 shrink-0 rounded-xl" />
                          <Link href={`/lots/${lot.id}`} className="line-clamp-2 font-medium hover:underline">
                            {lot.title}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <LotStatusBadge status={lot.status} />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateTime(lot.startsAt)}
                        <br />
                        até {formatDateTime(lot.endsAt)}
                      </TableCell>
                      <TableCell className="tabular-nums">{lot.bidCount}</TableCell>
                      <TableCell className="text-sm">
                        <ResultCell lot={lot} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/audit/${lot.id}`} aria-label={`Auditar ${lot.title}`}>
                              <Fingerprint /> <span className="hidden xl:inline">Auditar</span>
                            </Link>
                          </Button>
                          {cancelable && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToCancel(lot)}>
                              <Ban /> Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <Dialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar este lote?</DialogTitle>
            <DialogDescription>
              “{toCancel?.title}” deixará de aparecer na vitrine.{' '}
              {toCancel && toCancel.bidCount > 0
                ? `Já existem ${toCancel.bidCount} lance(s): o valor reservado do líder será liberado automaticamente (estorno).`
                : 'Ainda não há lances.'}{' '}
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Voltar</Button>
            </DialogClose>
            <Button variant="destructive" disabled={cancel.isPending} onClick={() => toCancel && cancel.mutate(toCancel.id)}>
              Cancelar lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
