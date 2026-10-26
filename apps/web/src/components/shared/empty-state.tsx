import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-3xl border border-dashed bg-card/50 px-6 py-16 text-center backdrop-blur',
        className,
      )}
    >
      <div aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(circle,black,transparent_70%)]" />
      {Icon && (
        <span className="flex size-14 -rotate-6 items-center justify-center rounded-2xl bg-brand text-white shadow-glow">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
