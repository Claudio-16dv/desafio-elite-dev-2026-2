import { Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBRL, formatTime, shortHash } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicBid } from '@/types/api';

interface BidHistoryProps {
  lotId: string;
  bids: PublicBid[];
  /** Pseudônimo do usuário neste lote, para destacar os próprios lances. */
  myPseudonym?: string;
  leaderPseudonym: string | null;
}

/** Histórico de lances (mais recente primeiro). Identificação só por pseudônimo. */
export function BidHistory({ lotId, bids, myPseudonym, leaderPseudonym }: BidHistoryProps) {
  const ordered = [...bids].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de lances</CardTitle>
        <CardDescription>
          {bids.length === 0 ? 'Nenhum lance ainda.' : `${bids.length} ${bids.length === 1 ? 'lance' : 'lances'} registrados.`}{' '}
          <Link href={`/audit/${lotId}`} className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4">
            <Fingerprint className="size-3.5" aria-hidden /> Auditar integridade
          </Link>
        </CardDescription>
      </CardHeader>
      {ordered.length > 0 && (
        <CardContent>
          <ol className="max-h-96 divide-y overflow-y-auto rounded-2xl border" aria-label="Lances do mais recente ao mais antigo">
            {ordered.map((bid, index) => {
              const mine = myPseudonym !== undefined && bid.bidderPseudonym === myPseudonym;
              const isLeader = index === 0 && bid.bidderPseudonym === leaderPseudonym;
              return (
                <li key={bid.sequence} className={cn('flex items-center justify-between gap-3 px-3 py-2.5 text-sm', isLeader && 'bg-success/10')}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      <span className="truncate">{bid.bidderPseudonym}</span>
                      {mine && <Badge variant="secondary">Você</Badge>}
                      {isLeader && <Badge variant="success">Líder</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{bid.sequence} · {formatTime(bid.placedAt)} ·{' '}
                      <span className="font-mono" title={bid.hash}>
                        {shortHash(bid.hash, 6)}
                      </span>
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatBRL(bid.amountCents)}</p>
                </li>
              );
            })}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}
