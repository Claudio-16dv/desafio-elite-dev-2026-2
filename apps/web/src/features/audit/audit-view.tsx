'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Link2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LotImage } from '@/features/lots/lot-image';
import { LotStatusBadge } from '@/features/lots/lot-status-badge';
import { ApiError } from '@/lib/api-client';
import { formatBRL, formatDateTimeLong, shortHash } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { auditApi } from './audit-api';
import { IntegrityBanner } from './integrity-banner';

/** Página PÚBLICA de auditoria: histórico completo de lances + verificação de integridade. */
export function AuditView({ lotId }: { lotId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.audit(lotId),
    queryFn: () => auditApi.lot(lotId),
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <ErrorState error={error} title={notFound ? 'Lote não encontrado' : 'Não foi possível auditar'} onRetry={notFound ? undefined : () => void refetch()} />;
  }

  const { lot, bids, integrity } = data;
  const badSequences = new Set(integrity.issues.flatMap((issue) => (issue.sequence !== undefined ? [issue.sequence] : [])));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/lots/${lot.id}`}>
          <ArrowLeft /> Voltar ao lote
        </Link>
      </Button>

      <PageHeader
        title="Auditoria do lote"
        description="Página pública: qualquer pessoa pode conferir o histórico de lances e se ele foi alterado."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : ''} /> Verificar de novo
          </Button>
        }
      />

      <Card className="flex-row items-center gap-4 p-4">
        <LotImage src={lot.imageUrl} alt={lot.title} className="size-20 shrink-0 rounded-2xl" />
        <div className="min-w-0 space-y-1">
          <LotStatusBadge status={lot.status} />
          <h2 className="truncate font-semibold">{lot.title}</h2>
          <p className="text-sm text-muted-foreground">
            Lance inicial {formatBRL(lot.startingBidCents)} · incremento {formatBRL(lot.minIncrementCents)} · {lot.bidCount} {lot.bidCount === 1 ? 'lance' : 'lances'}
          </p>
        </div>
      </Card>

      <IntegrityBanner report={integrity} />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de lances</CardTitle>
          <CardDescription>
            Licitantes aparecem por pseudônimo (muda a cada lote), sem dados pessoais. Cada linha guarda o hash do lance anterior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bids.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este lote não recebeu lances.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Licitante</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Registrado em</TableHead>
                  <TableHead>Hash anterior</TableHead>
                  <TableHead>Hash do lance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((bid) => (
                  <TableRow key={bid.sequence} className={cn(badSequences.has(bid.sequence) && 'bg-destructive/10')}>
                    <TableCell className="font-medium tabular-nums">{bid.sequence}</TableCell>
                    <TableCell>{bid.bidderPseudonym}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBRL(bid.amountCents)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTimeLong(bid.placedAt)}</TableCell>
                    <TableCell className="font-mono text-xs" title={bid.prevHash}>
                      {shortHash(bid.prevHash, 6)}
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={bid.hash}>
                      {shortHash(bid.hash, 6)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {integrity.headHash && (
            <p className="mt-4 break-all text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Hash da cabeça da cadeia:</span> <span className="font-mono">{integrity.headHash}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" aria-hidden /> Como a verificação funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{integrity.method}</p>
          <p>
            Além dos lances, o resumo do lote (quantidade, último hash, lance atual e líder) é protegido por um selo. Assim, até a remoção dos últimos lances é detectada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
