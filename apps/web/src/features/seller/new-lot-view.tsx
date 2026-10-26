'use client';

import { MousePointerClick } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CatalogItem } from '@/types/api';
import { CatalogSearch } from './catalog-search';
import { CreateLotForm } from './create-lot-form';

/** Novo lote: 1) escolher o item no acervo externo; 2) definir regras e horários. */
export function NewLotView() {
  const [item, setItem] = useState<CatalogItem | null>(null);

  return (
    <div>
      <PageHeader
        title="Novo lote"
        description="Escolha um item do acervo do Cleveland Museum of Art (domínio público) e configure o leilão. Os dados do item são copiados para o lote."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section aria-labelledby="step-1">
          <h2 id="step-1" className="mb-3 text-lg font-semibold">
            1. Escolha o item
          </h2>
          <CatalogSearch selectedId={item?.externalId ?? null} onSelect={setItem} />
        </section>

        <section aria-labelledby="step-2" className="xl:sticky xl:top-24 xl:self-start">
          <h2 id="step-2" className="mb-3 text-lg font-semibold">
            2. Defina o leilão
          </h2>
          {item ? (
            <CreateLotForm key={item.externalId} item={item} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MousePointerClick className="size-5" aria-hidden /> Selecione um item
                </CardTitle>
                <CardDescription>Escolha uma obra na lista ao lado para configurar lance inicial, incremento e horários.</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
