import { Ban, Loader2, PartyPopper, ReceiptText, SearchX } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/format';
import type { LotDetail } from '@/types/api';

/** Resultado do lote encerrado/cancelado, com acesso ao comprovante para o vencedor. */
export function ResultCard({ lot }: { lot: LotDetail }) {
  if (lot.status === 'CANCELED') {
    return (
      <Alert variant="warning">
        <Ban />
        <AlertTitle>Lote cancelado</AlertTitle>
        <AlertDescription>
          <p>O leiloeiro cancelou este lote. Valores reservados em lances foram liberados automaticamente.</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (lot.status !== 'CLOSED') return null;

  if (!lot.settled || !lot.result) {
    return (
      <Alert>
        <Loader2 className="animate-spin" />
        <AlertTitle>Apurando o resultado…</AlertTitle>
        <AlertDescription>
          <p>O tempo acabou. Estamos liquidando o lote; isso leva só alguns segundos.</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!lot.result.sold) {
    return (
      <Alert>
        <SearchX />
        <AlertTitle>Encerrado sem lances</AlertTitle>
        <AlertDescription>
          <p>Nenhum lance foi dado, então o lote foi fechado sem vencedor.</p>
        </AlertDescription>
      </Alert>
    );
  }

  const iWon = lot.me?.receiptCode != null;
  return (
    <Alert variant={iWon ? 'success' : 'default'}>
      {iWon ? <PartyPopper /> : <ReceiptText />}
      <AlertTitle>{iWon ? 'Parabéns, você arrematou este lote!' : 'Lote arrematado'}</AlertTitle>
      <AlertDescription>
        <p>
          Vencedor: <strong>{lot.result.winnerPseudonym}</strong> por <strong className="tabular-nums">{formatBRL(lot.result.finalPriceCents ?? 0)}</strong>.
        </p>
        {iWon && lot.me?.receiptCode && (
          <Button asChild size="sm" className="mt-2">
            <Link href={`/receipts/${lot.me.receiptCode}`}>
              <ReceiptText /> Ver comprovante de arremate
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
