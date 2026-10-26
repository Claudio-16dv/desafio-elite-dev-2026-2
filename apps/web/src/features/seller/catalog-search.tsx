'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, CloudOff, Search } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { LotImage } from '@/features/lots/lot-image';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { CatalogItem } from '@/types/api';
import { sellerApi } from './seller-api';

const TYPES = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'Painting', label: 'Pinturas' },
  { value: 'Sculpture', label: 'Esculturas' },
  { value: 'Print', label: 'Gravuras' },
  { value: 'Drawing', label: 'Desenhos' },
  { value: 'Photograph', label: 'Fotografias' },
];

interface CatalogSearchProps {
  selectedId: string | null;
  onSelect: (item: CatalogItem) => void;
}

/** Busca no acervo externo (Cleveland Museum of Art) para escolher o item do lote. */
export function CatalogSearch({ selectedId, onSelect }: CatalogSearchProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(text.trim(), 400);

  const params = { q: q || undefined, type: type === 'all' ? undefined : type, page };
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.catalog(params),
    queryFn: () => sellerApi.searchCatalog(params),
    staleTime: 60_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="pointer-events-none absolute top-3 left-4 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar no acervo (ex.: monet, bronze, retrato)"
            aria-label="Buscar item no acervo"
            className="rounded-full pl-10"
          />
        </div>
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Tipo de obra" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data?.degraded && data.notice && (
        <Alert variant="warning">
          <CloudOff />
          <AlertDescription>{data.notice}</AlertDescription>
        </Alert>
      )}

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Não foi possível buscar no acervo" />
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Tente outro termo ou outro tipo de obra." />
      ) : (
        <>
          <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-80')}>
            {data?.items.map((item) => {
              const selected = item.externalId === selectedId;
              return (
                <li key={item.externalId}>
                  <Card className={cn('h-full flex-row gap-0 overflow-hidden py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40', selected && 'border-primary ring-4 ring-primary/25')}>
                    <LotImage src={item.imageUrl} alt="" className="w-24 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm leading-snug font-medium">{item.title}</p>
                        {item.subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}
                      </div>
                      <Button type="button" size="sm" variant={selected ? 'default' : 'outline'} onClick={() => onSelect(item)} aria-pressed={selected}>
                        {selected ? (
                          <>
                            <Check /> Selecionado
                          </>
                        ) : (
                          'Selecionar'
                        )}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Paginação do acervo" className="flex items-center justify-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Próxima <ChevronRight />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
