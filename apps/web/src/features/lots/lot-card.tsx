import { ArrowUpRight, Gavel, Timer } from 'lucide-react';
import Link from 'next/link';
import { formatBRL, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LotSummary } from '@/types/api';
import { LotCountdown } from './lot-countdown';
import { LotImage } from './lot-image';
import { LotStatusBadge } from './lot-status-badge';

interface LotCardProps {
  lot: LotSummary;
  serverOffsetMs: number;
}

function Price({ lot }: { lot: LotSummary }) {
  let label = 'Lance inicial';
  let value = formatBRL(lot.startingBidCents);
  let muted = false;
  if (lot.status === 'CLOSED' && lot.result) {
    label = lot.result.sold ? 'Arrematado por' : 'Resultado';
    value = lot.result.sold ? formatBRL(lot.result.finalPriceCents ?? 0) : 'Sem lances';
    muted = !lot.result.sold;
  } else if (lot.currentBidCents !== null) {
    label = 'Lance atual';
    value = formatBRL(lot.currentBidCents);
  }
  return (
    <div className="min-w-0">
      <p className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn('truncate text-xl font-bold tracking-tight tabular-nums', muted && 'text-muted-foreground')}>{value}</p>
    </div>
  );
}

/** Chip de tempo sobre a imagem: contagem para ao vivo/agendado, data para encerrado. */
function TimeChip({ lot, serverOffsetMs }: LotCardProps) {
  const base = 'glass inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold';
  if (lot.status === 'LIVE' || lot.status === 'SCHEDULED') {
    return (
      <span className={base}>
        <Timer className="size-3.5" aria-hidden />
        <span className="font-medium text-muted-foreground">{lot.status === 'LIVE' ? 'Termina em' : 'Começa em'}</span>
        <LotCountdown
          targetIso={lot.status === 'LIVE' ? lot.endsAt : lot.startsAt}
          serverOffsetMs={serverOffsetMs}
          className="tabular-nums"
        />
      </span>
    );
  }
  return <span className={base}>Encerrado em {formatDateTime(lot.endsAt)}</span>;
}

export function LotCard({ lot, serverOffsetMs }: LotCardProps) {
  return (
    <article className="group ring-brand-hover shadow-card relative flex flex-col rounded-3xl border bg-card/85 p-2 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
      {/* "Moldura": a obra fica num passe-partout arredondado dentro do card. */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-muted">
        <LotImage
          src={lot.imageUrl}
          alt=""
          className="size-full transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/20" />
        <LotStatusBadge status={lot.status} className="absolute top-3 left-3" />
        <span className="glass absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold">
          <Gavel className="size-3.5" aria-hidden />
          {lot.bidCount} <span className="sr-only">{lot.bidCount === 1 ? 'lance' : 'lances'}</span>
        </span>
        <div className="absolute inset-x-3 bottom-3">
          <TimeChip lot={lot} serverOffsetMs={serverOffsetMs} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 pt-4 pb-3">
        <div className="space-y-1">
          <h3 className="font-display line-clamp-2 text-lg leading-snug font-semibold">
            {/* O link cobre o card inteiro (::after), mas o nome acessível é só o título. */}
            <Link href={`/lots/${lot.id}`} className="outline-none after:absolute after:inset-0 after:z-[2] after:rounded-3xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60">
              {lot.title}
            </Link>
          </h3>
          {lot.subtitle && <p className="line-clamp-1 text-sm text-muted-foreground">{lot.subtitle}</p>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <Price lot={lot} />
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background/60 transition-all duration-300 group-hover:rotate-45 group-hover:border-transparent group-hover:bg-brand group-hover:text-white"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

export function LotCardSkeleton() {
  return (
    <div className="shadow-card rounded-3xl border bg-card/85 p-2" aria-hidden>
      <div className="aspect-[4/5] animate-shimmer rounded-[1.25rem] bg-[linear-gradient(90deg,var(--muted)_0%,var(--accent)_50%,var(--muted)_100%)] bg-[length:200%_100%]" />
      <div className="space-y-3 px-3 pt-4 pb-3">
        <div className="h-5 w-3/4 rounded-full bg-muted" />
        <div className="h-4 w-1/2 rounded-full bg-muted" />
        <div className="h-7 w-1/3 rounded-full bg-muted" />
      </div>
    </div>
  );
}
