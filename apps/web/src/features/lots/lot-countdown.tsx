'use client';

import { useCountdown } from '@/hooks/use-countdown';
import { formatCountdown } from '@/lib/format';

interface LotCountdownProps {
  targetIso: string;
  serverOffsetMs: number;
  className?: string;
}

/** Contagem regressiva compacta (cada instância tem seu próprio relógio). */
export function LotCountdown({ targetIso, serverOffsetMs, className }: LotCountdownProps) {
  const remaining = useCountdown(targetIso, serverOffsetMs);
  if (remaining === null) return null;
  return (
    <time dateTime={targetIso} className={className ?? 'tabular-nums'}>
      {formatCountdown(remaining)}
    </time>
  );
}
