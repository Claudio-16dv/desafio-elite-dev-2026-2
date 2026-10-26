import { CalendarClock, CircleCheck, CircleSlash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LotStatus } from '@/types/api';

const CONFIG: Record<LotStatus, { label: string; className: string }> = {
  LIVE: { label: 'Ao vivo', className: 'border-transparent bg-destructive text-white' },
  SCHEDULED: { label: 'Agendado', className: 'border-transparent bg-warning text-warning-foreground' },
  CLOSED: { label: 'Encerrado', className: '' },
  CANCELED: { label: 'Cancelado', className: 'border-transparent bg-muted text-muted-foreground' },
};

/** Selo de situação do lote. "Ao vivo" tem um ponto pulsante, como um sinal de transmissão. */
export function LotStatusBadge({ status, className }: { status: LotStatus; className?: string }) {
  const { label, className: tone } = CONFIG[status];
  return (
    <Badge variant={status === 'CLOSED' ? 'glass' : 'default'} className={cn(tone, className)}>
      {status === 'LIVE' && (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
      )}
      {status === 'SCHEDULED' && <CalendarClock aria-hidden />}
      {status === 'CLOSED' && <CircleCheck aria-hidden />}
      {status === 'CANCELED' && <CircleSlash aria-hidden />}
      {label}
    </Badge>
  );
}
