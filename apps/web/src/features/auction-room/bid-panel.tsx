'use client';

import { Gavel, Loader2, OctagonAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MoneyInput } from '@/components/shared/money-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-provider';
import { useWallet } from '@/features/wallet/use-wallet';
import { ApiError, errorMessage } from '@/lib/api-client';
import { formatBRL } from '@/lib/format';
import type { LotStatus } from '@/types/api';
import { usePlaceBid } from './use-lot-room';

interface BidPanelProps {
  lotId: string;
  dataKey: readonly unknown[];
  status: LotStatus;
  minimumNextBidCents: number;
  minIncrementCents: number;
  isLeading: boolean;
}

const STATUS_HINT: Partial<Record<LotStatus, string>> = {
  SCHEDULED: 'Este lote ainda não começou: os lances abrem no horário de início.',
  CLOSED: 'Este lote já foi encerrado.',
  CANCELED: 'Este lote foi cancelado.',
};

/**
 * Formulário de lance. O botão fica habilitado em qualquer situação para o licitante:
 * se a regra do servidor recusar (abaixo do mínimo, saldo insuficiente, já está ganhando,
 * lote não iniciado/encerrado), a mensagem exata do motivo aparece logo abaixo.
 */
export function BidPanel({ lotId, dataKey, status, minimumNextBidCents, minIncrementCents, isLeading }: BidPanelProps) {
  const { user } = useAuth();
  const wallet = useWallet();
  const placeBid = usePlaceBid(lotId, dataKey);

  const [amountCents, setAmountCents] = useState(minimumNextBidCents);
  const [rejection, setRejection] = useState<{ code: string; message: string } | null>(null);
  const edited = useRef(false);

  // Enquanto o usuário não mexeu no campo, ele acompanha o menor lance aceito.
  useEffect(() => {
    if (!edited.current) setAmountCents(minimumNextBidCents);
  }, [minimumNextBidCents]);

  if (user?.role !== 'BIDDER') return null;

  const presets = [
    { label: 'Mínimo', value: minimumNextBidCents },
    { label: '+2 incrementos', value: minimumNextBidCents + minIncrementCents * 2 },
    { label: '+5 incrementos', value: minimumNextBidCents + minIncrementCents * 5 },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setRejection(null);
    try {
      const result = await placeBid.mutateAsync(amountCents);
      edited.current = false;
      setAmountCents(result.lot.minimumNextBidCents);
      toast.success('Lance registrado', { description: `Você está ganhando com ${formatBRL(result.bid.amountCents)}.` });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
      const message = errorMessage(error);
      setRejection({ code, message });
      toast.error('Lance recusado', { description: message });
    }
  }

  const hint = STATUS_HINT[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="size-5" aria-hidden /> Dar um lance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Menor lance aceito</dt>
              <dd className="font-semibold tabular-nums">{formatBRL(minimumNextBidCents)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Saldo disponível</dt>
              <dd className="font-semibold tabular-nums">{wallet.data ? formatBRL(wallet.data.availableCents) : '…'}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Label htmlFor="bid-amount">Seu lance</Label>
            <MoneyInput
              id="bid-amount"
              valueCents={amountCents}
              onChangeCents={(cents) => {
                edited.current = true;
                setAmountCents(cents);
                setRejection(null);
              }}
              aria-invalid={rejection !== null}
              aria-describedby={rejection ? 'bid-error' : undefined}
              className="h-12 text-xl font-semibold"
            />
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    edited.current = true;
                    setAmountCents(preset.value);
                    setRejection(null);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {rejection && (
            <Alert id="bid-error" variant="destructive">
              <OctagonAlert />
              <AlertTitle>Lance recusado</AlertTitle>
              <AlertDescription>
                <p>{rejection.message}</p>
                {rejection.code === 'INSUFFICIENT_BALANCE' && (
                  <Link href="/wallet" className="font-medium underline">
                    Depositar saldo
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={placeBid.isPending || amountCents <= 0}>
            {placeBid.isPending ? <Loader2 className="animate-spin" /> : <Gavel />}
            {isLeading ? 'Dar outro lance' : `Dar lance de ${formatBRL(amountCents)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
