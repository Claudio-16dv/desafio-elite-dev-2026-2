'use client';

import { useQuery } from '@tanstack/react-query';
import { Fingerprint, Printer } from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { IntegrityBanner } from '@/features/audit/integrity-banner';
import { LotImage } from '@/features/lots/lot-image';
import { ApiError } from '@/lib/api-client';
import { formatBRL, formatDateTimeLong } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { receiptsApi } from './receipts-api';
import { ShareReceiptButton } from './share-receipt-button';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

/** Comprovante de arremate: público por link, só com pseudônimos. */
export function ReceiptView({ code }: { code: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.receipt(code),
    queryFn: () => receiptsApi.get(code),
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Skeleton className="mx-auto h-[32rem] max-w-2xl" aria-busy="true" />;
  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <ErrorState error={error} title={notFound ? 'Comprovante não encontrado' : 'Não foi possível abrir o comprovante'} onRetry={notFound ? undefined : () => void refetch()} />;
  }

  const { lot } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Comprovante de arremate</h1>
        <div className="flex flex-wrap gap-2">
          <ShareReceiptButton code={data.code} />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-4 border-b bg-muted/40 p-5">
          <LotImage src={lot.imageUrl} alt={lot.title} className="size-24 shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Item arrematado</p>
            <h2 className="line-clamp-2 text-lg leading-snug font-semibold">{lot.title}</h2>
            {lot.subtitle && <p className="truncate text-sm text-muted-foreground">{lot.subtitle}</p>}
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
            <p className="text-sm opacity-80">Valor final</p>
            <p className="text-4xl font-bold tracking-tight tabular-nums">{formatBRL(data.finalPriceCents)}</p>
          </div>

          <dl className="divide-y">
            <Row label="Arrematante">{data.winnerPseudonym}</Row>
            <Row label="Leiloeiro">{data.sellerPseudonym}</Row>
            <Row label="Lances no lote">{data.bidCount}</Row>
            <Row label="Emitido em">{formatDateTimeLong(data.issuedAt)}</Row>
            <Row label="Código do comprovante">
              <span className="font-mono text-xs">{data.code}</span>
            </Row>
            <Row label="Hash final do histórico">
              <span className="font-mono text-xs break-all">{data.chainHeadHash}</span>
            </Row>
          </dl>

          <Separator />
          <IntegrityBanner report={data.integrity} subject="comprovante e o histórico de lances" />

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button asChild variant="outline" size="sm">
              <Link href={`/audit/${data.lotId}`}>
                <Fingerprint /> Auditar o histórico completo
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Os participantes são identificados por pseudônimos; este comprovante não contém dados pessoais. Pagamentos desta plataforma são simulados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
