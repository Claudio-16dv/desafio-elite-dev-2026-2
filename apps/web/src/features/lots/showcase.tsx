'use client';

import { ChevronLeft, ChevronRight, PackageOpen, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useServerOffset } from '@/hooks/use-countdown';
import { LotCard, LotCardSkeleton } from './lot-card';
import { ShowcaseHero } from './showcase-hero';
import { type LotSort, type ShowcaseStatus } from './lots-api';
import { useLots } from './use-lots';

const TABS: Array<{ value: ShowcaseStatus; label: string; empty: string }> = [
  { value: 'live', label: 'Ao vivo', empty: 'Nenhum lote ao vivo agora.' },
  { value: 'scheduled', label: 'Agendados', empty: 'Nenhum lote agendado.' },
  { value: 'closed', label: 'Encerrados', empty: 'Nenhum lote encerrado ainda.' },
];

const SORTS: Array<{ value: LotSort | 'default'; label: string }> = [
  { value: 'default', label: 'Ordem padrão' },
  { value: 'ending_soon', label: 'Terminam primeiro' },
  { value: 'most_bids', label: 'Mais disputados' },
  { value: 'newest', label: 'Mais recentes' },
];

const PAGE_SIZE = 12;

const isStatus = (value: string | null): value is ShowcaseStatus => value === 'live' || value === 'scheduled' || value === 'closed';
const isSort = (value: string | null): value is LotSort => value === 'ending_soon' || value === 'newest' || value === 'most_bids';

/** Vitrine de lotes: abas por situação, busca, ordenação e paginação (estado guardado na URL). */
export function Showcase() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tabParam = params.get('tab');
  const sortParam = params.get('sort');
  const status: ShowcaseStatus = isStatus(tabParam) ? tabParam : 'live';
  const sort: LotSort | undefined = isSort(sortParam) ? sortParam : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const urlQuery = params.get('q') ?? '';

  const [search, setSearch] = useState(urlQuery);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    const qs = merged.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Aplica a busca (já com debounce) na URL e volta para a página 1.
  useEffect(() => {
    if (debouncedSearch !== urlQuery) update({ q: debouncedSearch || undefined, page: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao texto digitado
  }, [debouncedSearch]);

  const { data, isLoading, isError, error, refetch, isFetching } = useLots({
    status,
    q: urlQuery || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });
  const serverOffsetMs = useServerOffset(data?.serverNow);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const tab = TABS.find((t) => t.value === status)!;

  return (
    <div className="space-y-8">
      <ShowcaseHero />

      <Tabs value={status} onValueChange={(value) => update({ tab: value === 'live' ? undefined : value, page: undefined })}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Vitrine</p>
            <h2 className="font-display text-3xl font-semibold">Lotes em destaque</h2>
          </div>
          {data && (
            <p className="hidden text-sm text-muted-foreground sm:block">
              {data.total} {data.total === 1 ? 'lote' : 'lotes'}
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Situação dos lotes">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search className="pointer-events-none absolute top-3 left-4 size-4 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título ou artista"
                aria-label="Buscar lotes"
                className="rounded-full pl-10"
              />
            </div>
            <Select value={sort ?? 'default'} onValueChange={(value) => update({ sort: value === 'default' ? undefined : value, page: undefined })}>
              <SelectTrigger aria-label="Ordenar lotes" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Tabs>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Não foi possível carregar os lotes" />
      ) : isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Carregando lotes">
          {Array.from({ length: 8 }, (_, i) => (
            <LotCardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={urlQuery ? 'Nenhum lote encontrado' : tab.empty}
          description={urlQuery ? `Nada corresponde a “${urlQuery}” nesta aba. Tente outro termo.` : 'Volte em instantes ou explore as outras abas.'}
        />
      ) : (
        <>
          <p className="sr-only" role="status" aria-live="polite">
            {data?.total} lotes encontrados
          </p>
          <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${isFetching ? 'opacity-90' : ''}`}>
            {data?.items.map((lot) => <LotCard key={lot.id} lot={lot} serverOffsetMs={serverOffsetMs} />)}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Paginação" className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: page > 2 ? String(page - 1) : undefined })}>
                <ChevronLeft /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
                Próxima <ChevronRight />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
