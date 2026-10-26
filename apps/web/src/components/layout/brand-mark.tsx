import { Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Marca: martelo sobre o degradê-assinatura, levemente inclinado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex size-9 shrink-0 -rotate-6 items-center justify-center rounded-xl bg-brand text-white shadow-glow transition-transform duration-300 group-hover:rotate-6',
        className,
      )}
    >
      <Gavel className="size-4.5" strokeWidth={2.4} />
      <span className="absolute inset-0 rounded-xl ring-1 ring-white/30 ring-inset" />
    </span>
  );
}
