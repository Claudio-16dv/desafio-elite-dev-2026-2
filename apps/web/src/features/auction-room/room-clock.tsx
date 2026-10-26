'use client';

import { AlarmClock, Hourglass, Timer, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCountdown } from '@/hooks/use-countdown';
import { formatCountdown, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LotStatus } from '@/types/api';

const FINAL_STRETCH_MS = 2 * 60 * 1000;

interface RoomClockProps {
  status: LotStatus;
  startsAt: string;
  endsAt: string;
  extended: boolean;
  serverOffsetMs: number;
}

/** Contagem regressiva da sala: "começa em" (agendado), "termina em" (ao vivo) ou encerrado. */
export function RoomClock({ status, startsAt, endsAt, extended, serverOffsetMs }: RoomClockProps) {
  const target = status === 'SCHEDULED' ? startsAt : status === 'LIVE' ? endsAt : null;
  const remaining = useCountdown(target, serverOffsetMs);

  if (status === 'CLOSED' || status === 'CANCELED') {
    return (
      <Card className="flex-row items-center gap-4 px-6 py-4">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Timer className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">{status === 'CANCELED' ? 'Lote cancelado' : 'Lote encerrado'}</p>
          <p className="text-sm text-muted-foreground">Fim: {formatDateTime(endsAt)}</p>
        </div>
      </Card>
    );
  }

  const inFinalStretch = status === 'LIVE' && remaining !== null && remaining <= FINAL_STRETCH_MS;
  const totalMs = Date.parse(endsAt) - Date.parse(startsAt);
  // Fração do lote que ainda resta (só faz sentido ao vivo).
  const fraction = status === 'LIVE' && remaining !== null && totalMs > 0 ? Math.min(1, Math.max(0, remaining / totalMs)) : null;

  return (
    <Card
      className={cn(
        'relative gap-3 overflow-hidden px-6 py-5 transition-colors',
        inFinalStretch && 'border-warning/70 bg-warning/10 ring-4 ring-warning/20',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {status === 'SCHEDULED' ? <Hourglass className="size-4" aria-hidden /> : <AlarmClock className="size-4" aria-hidden />}
          {status === 'SCHEDULED' ? 'Começa em' : 'Termina em'}
        </p>
        {extended && status === 'LIVE' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-semibold text-warning-foreground dark:text-warning">
            <Zap className="size-3" aria-hidden /> Prorrogado
          </span>
        )}
      </div>
      <p
        className={cn('font-mono text-5xl font-bold tracking-tighter tabular-nums', inFinalStretch && 'animate-pulse text-warning-foreground dark:text-warning')}
        // O valor muda a cada segundo; leitores de tela não devem narrar tudo (aria-live desligado).
        aria-live="off"
      >
        {remaining === null ? '--:--' : formatCountdown(remaining)}
      </p>
      {fraction !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', inFinalStretch ? 'bg-warning' : 'bg-brand')}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {status === 'SCHEDULED' ? `Abertura: ${formatDateTime(startsAt)}` : `Fim previsto: ${formatDateTime(endsAt)}`}
      </p>
      {inFinalStretch && (
        <p className="text-sm font-semibold" role="status">
          Reta final: um lance agora prorroga o lote em +2 minutos.
        </p>
      )}
      {extended && status === 'LIVE' && <p className="text-xs text-muted-foreground">Este lote já foi prorrogado pelo anti-sniping.</p>}
    </Card>
  );
}
