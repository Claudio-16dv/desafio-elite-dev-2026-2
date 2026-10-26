'use client';

import { Fingerprint, Radio, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LotSummary } from '@/types/api';
import { LotImage } from './lot-image';
import { useLots } from './use-lots';

/** Posição e inclinação de cada "quadro" da colagem. */
const FRAMES = [
  { className: 'right-[38%] top-10 w-40 sm:w-44', tilt: '-8deg', delay: '0s' },
  { className: 'right-[6%] top-2 w-48 sm:w-52 z-10', tilt: '5deg', delay: '-3s' },
  { className: 'right-[22%] bottom-0 w-36 sm:w-40', tilt: '-2deg', delay: '-6s' },
];

function FloatingFrame({ lot, index }: { lot: LotSummary; index: number }) {
  const frame = FRAMES[index];
  return (
    <Link
      href={`/lots/${lot.id}`}
      tabIndex={-1}
      aria-hidden
      className={cn('absolute animate-float hover:z-20', frame.className)}
      style={{ ['--tilt' as string]: frame.tilt, animationDelay: frame.delay }}
    >
      <div className="rounded-2xl bg-white/10 p-1.5 shadow-2xl ring-1 ring-white/20 backdrop-blur">
        <LotImage src={lot.imageUrl} alt="" className="aspect-[4/5] w-full rounded-xl" />
        <div className="flex items-center justify-between gap-2 px-1.5 pt-1.5 pb-0.5 text-[0.7rem] text-white">
          <span className="truncate font-medium opacity-80">{lot.title}</span>
          <span className="shrink-0 font-bold tabular-nums">{formatBRL(lot.currentBidCents ?? lot.startingBidCents)}</span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Destaque da vitrine. Sempre escuro (como uma sala de galeria à noite), com a
 * assinatura em degradê e uma colagem flutuante das obras que estão ao vivo agora.
 */
export function ShowcaseHero() {
  // Mesma consulta da aba "Ao vivo" padrão: o TanStack Query reaproveita, sem requisição extra.
  const live = useLots({ status: 'live', page: 1, pageSize: 12 });
  const featured = (live.data?.items ?? []).slice(0, 3);
  const liveCount = live.data?.total;

  return (
    <section className="dark relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.2_0.008_60)] text-foreground">
      {/* Aurora + textura */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-20 size-[26rem] animate-aurora rounded-full bg-brand-3/15 blur-[100px]" />
        <div className="absolute -right-10 -bottom-32 size-[24rem] animate-aurora rounded-full bg-brand-2/10 blur-[100px] [animation-delay:-7s]" />
        <div className="bg-grain absolute inset-0 opacity-[0.12] mix-blend-overlay" />
      </div>

      <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur">
            <Sparkles className="size-3.5 text-brand-3" aria-hidden />
            Acervo de museu · domínio público
          </p>
          <h1 className="font-display text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
            Obras raras,
            <br />
            <span className="text-brand italic">lances ao vivo.</span>
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Dispute em tempo real, saiba na hora se está ganhando e confira, sem login, que nenhum lance foi alterado.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-medium">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-destructive" />
              </span>
              {liveCount === undefined ? 'Lotes ao vivo' : `${liveCount} ${liveCount === 1 ? 'lote ao vivo' : 'lotes ao vivo'}`}
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-medium">
              <Radio className="size-4 text-brand-3" aria-hidden /> Sem recarregar a página
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-medium">
              <ShieldCheck className="size-4 text-success" aria-hidden /> Histórico à prova de adulteração
            </li>
          </ul>
        </div>

        {/* Colagem flutuante (decorativa; os mesmos lotes estão na grade abaixo). */}
        <div className="relative hidden h-80 lg:block" aria-hidden>
          {featured.length > 0 ? (
            featured.map((lot, index) => <FloatingFrame key={lot.id} lot={lot} index={index} />)
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-40 animate-float items-center justify-center rounded-[2rem] bg-brand shadow-glow">
                <Fingerprint className="size-16 text-white/90" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
