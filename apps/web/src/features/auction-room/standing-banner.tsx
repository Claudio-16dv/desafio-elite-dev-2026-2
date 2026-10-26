import { Crown, Info, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LotStatus, LotViewerState } from '@/types/api';

interface StandingBannerProps {
  me: LotViewerState | null;
  status: LotStatus;
  currentBidCents: number | null;
  biddersCount: number;
  lotId: string;
}

/**
 * Indicador claro de "você está ganhando" / "você foi superado".
 * `aria-live` faz leitores de tela anunciarem a mudança quando chega um novo lance.
 */
export function StandingBanner({ me, status, currentBidCents, biddersCount, lotId }: StandingBannerProps) {
  if (!me) {
    return (
      <Banner tone="neutral" icon={<Info className="size-5" />} title="Entre para participar">
        <p className="text-sm text-muted-foreground">Faça login como licitante para dar lances neste lote.</p>
        <Button asChild size="sm" className="mt-2">
          <Link href={`/login?next=${encodeURIComponent(`/lots/${lotId}`)}`}>Entrar</Link>
        </Button>
      </Banner>
    );
  }

  if (me.role === 'AUCTIONEER') {
    return (
      <Banner tone="neutral" icon={<Info className="size-5" />} title={me.isOwner ? 'Você é o leiloeiro deste lote' : 'Perfil de leiloeiro'}>
        <p className="text-sm text-muted-foreground">Leiloeiros acompanham os lances, mas não podem dar lances.</p>
      </Banner>
    );
  }

  const finished = status === 'CLOSED' || status === 'CANCELED';

  if (me.isLeading) {
    return (
      <Banner
        tone="success"
        icon={<Crown className="size-5" />}
        title={finished && status === 'CLOSED' ? 'Você tinha o maior lance' : 'Você está ganhando!'}
      >
        <p className="text-sm">
          Seu lance de <strong className="tabular-nums">{formatBRL(me.highestBidCents ?? currentBidCents ?? 0)}</strong> é o maior.
          {!finished && ' Esse valor fica reservado no seu saldo até alguém cobrir.'}
        </p>
        <PositionLine position={me.position ?? 1} biddersCount={biddersCount} />
      </Banner>
    );
  }

  if (me.highestBidCents !== null) {
    return (
      <Banner tone="danger" icon={<TrendingDown className="size-5" />} title="Você foi superado">
        <p className="text-sm">
          Seu melhor lance foi <strong className="tabular-nums">{formatBRL(me.highestBidCents)}</strong>
          {currentBidCents !== null && (
            <>
              ; o lance atual é <strong className="tabular-nums">{formatBRL(currentBidCents)}</strong>
            </>
          )}
          .
        </p>
        {me.position !== null && <PositionLine position={me.position} biddersCount={biddersCount} />}
      </Banner>
    );
  }

  return (
    <Banner tone="neutral" icon={<Info className="size-5" />} title="Você ainda não deu lances">
      <p className="text-sm text-muted-foreground">
        {biddersCount > 0 ? `${biddersCount} ${biddersCount === 1 ? 'licitante já deu' : 'licitantes já deram'} lances.` : 'Seja o primeiro a dar um lance.'}
      </p>
    </Banner>
  );
}

/** Posição do usuário no ranking de licitantes do lote (pelo maior lance de cada um). */
function PositionLine({ position, biddersCount }: { position: number; biddersCount: number }) {
  const total = Math.max(biddersCount, position);
  return (
    <p className="text-sm text-muted-foreground">
      Sua posição: <strong className="tabular-nums">{position}º</strong> de {total} {total === 1 ? 'licitante' : 'licitantes'}.
    </p>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'success' | 'danger' | 'neutral';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'shadow-card flex gap-4 rounded-3xl border px-5 py-4 backdrop-blur-xl',
        tone === 'success' && 'border-success/40 bg-success/10 [&_p]:text-foreground',
        tone === 'danger' && 'border-destructive/40 bg-destructive/10 [&_p]:text-foreground',
        tone === 'neutral' && 'bg-card/85',
      )}
    >
      <span
        // A chave muda com a situação ("ganhando" <-> "superado") e reinicia a animação do ícone,
        // sem recriar a região aria-live (assim o leitor de tela continua anunciando a mudança).
        key={tone}
        className={cn(
          'flex size-11 shrink-0 animate-pop items-center justify-center rounded-2xl',
          tone === 'success' && 'bg-success/15 text-success',
          tone === 'danger' && 'bg-destructive/15 text-destructive',
          tone === 'neutral' && 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="font-display text-lg leading-tight font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}
