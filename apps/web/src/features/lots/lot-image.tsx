'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LotImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Carregar já (imagem principal da página). Por padrão, carrega sob demanda. */
  priority?: boolean;
}

/**
 * Imagem do item. Se o servidor de imagens do acervo estiver fora do ar,
 * mostra um espaço reservado em vez de um ícone quebrado.
 */
export function LotImage({ src, alt, className, priority = false }: LotImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} (imagem indisponível)`}
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-1/15 via-brand-2/10 to-brand-3/15 text-muted-foreground',
          className,
        )}
      >
        <ImageOff className="size-[min(2rem,40%)]" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagens externas do acervo, sem otimização do Next
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('bg-muted object-cover', className)}
    />
  );
}
