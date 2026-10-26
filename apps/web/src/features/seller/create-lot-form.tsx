'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { MoneyInput } from '@/components/shared/money-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AttributeList } from '@/features/lots/attribute-list';
import { LotImage } from '@/features/lots/lot-image';
import { errorMessage } from '@/lib/api-client';
import { formatBRL, toLocalInputValue } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { CatalogItem } from '@/types/api';
import { sellerApi } from './seller-api';

const DURATIONS = [
  { label: '10 min', minutes: 10 },
  { label: '1 hora', minutes: 60 },
  { label: '24 horas', minutes: 24 * 60 },
  { label: '3 dias', minutes: 3 * 24 * 60 },
];

/** Formulário do lote: o servidor grava o snapshot do item; aqui o leiloeiro define regras e horários. */
export function CreateLotForm({ item }: { item: CatalogItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [startNow, setStartNow] = useState(true);
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60_000)));
  const [endsAt, setEndsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 24 * 60 * 60_000)));
  const [startingBidCents, setStartingBidCents] = useState(100_000);
  const [minIncrementCents, setMinIncrementCents] = useState(10_000);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: sellerApi.createLot,
    onSuccess: async (lot) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerLots }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lotsAll }),
      ]);
      toast.success('Lote criado', { description: lot.title });
      router.push(`/lots/${lot.id}`);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function applyDuration(minutes: number) {
    const base = startNow ? new Date() : new Date(startsAt);
    if (Number.isNaN(base.getTime())) return;
    setEndsAt(toLocalInputValue(new Date(base.getTime() + minutes * 60_000)));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const start = startNow ? new Date() : new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Informe datas de início e fim válidas.');
      return;
    }
    if (end.getTime() - start.getTime() < 60_000) {
      setError('O fim precisa ser pelo menos 1 minuto depois do início.');
      return;
    }

    create.mutate({
      externalId: item.externalId,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      startingBidCents,
      minIncrementCents,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar o lote</CardTitle>
        <CardDescription>Defina as regras do leilão para o item selecionado.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex items-center gap-4 rounded-2xl border bg-muted/40 p-3">
          <LotImage src={item.imageUrl} alt="" className="size-20 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium">{item.title}</p>
            {item.subtitle && <p className="line-clamp-1 text-sm text-muted-foreground">{item.subtitle}</p>}
          </div>
        </div>
        {item.attributes.length > 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-medium">Atributos do item (copiados para o lote)</p>
            <AttributeList attributes={item.attributes} />
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="starting-bid">Lance inicial</Label>
              <MoneyInput id="starting-bid" valueCents={startingBidCents} onChangeCents={setStartingBidCents} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="increment">Incremento mínimo</Label>
              <MoneyInput id="increment" valueCents={minIncrementCents} onChangeCents={setMinIncrementCents} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            O primeiro lance deve ser de no mínimo {formatBRL(startingBidCents)}; os seguintes, o lance atual + {formatBRL(minIncrementCents)}.
          </p>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium">Horário</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Começar assim que eu publicar
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {!startNow && (
                <div className="space-y-2">
                  <Label htmlFor="starts-at">Início</Label>
                  <Input id="starts-at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
              )}
              <div className={`space-y-2 ${startNow ? 'sm:col-span-2' : ''}`}>
                <Label htmlFor="ends-at">Fim</Label>
                <Input id="ends-at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Duração rápida:</span>
              {DURATIONS.map((d) => (
                <Button key={d.minutes} type="button" variant="outline" size="sm" onClick={() => applyDuration(d.minutes)}>
                  {d.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Anti-sniping: um lance aceito nos últimos 2 minutos prorroga o fim do lote em +2 minutos.
            </p>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="title">Título (opcional)</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={item.title} maxLength={140} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Observações (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
              placeholder="Condições, procedência, estado de conservação…"
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />} Publicar lote
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
