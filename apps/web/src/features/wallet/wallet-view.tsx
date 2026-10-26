'use client';

import { ArrowDownLeft, ArrowUpRight, Banknote, Loader2, Lock, PiggyBank, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/shared/error-state';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { errorMessage } from '@/lib/api-client';
import { formatBRL, formatDateTime } from '@/lib/format';
import type { WalletTransactionType } from '@/types/api';
import { useDeposit, useWallet } from './use-wallet';

const TRANSACTION_LABEL: Record<WalletTransactionType, string> = {
  DEPOSIT: 'Depósito simulado',
  PURCHASE_DEBIT: 'Arremate (débito)',
  SALE_CREDIT: 'Venda (crédito)',
};

const PRESETS = [10_000, 50_000, 100_000, 500_000];

function BalanceCard({
  icon: Icon,
  label,
  value,
  hint,
  featured,
}: {
  icon: typeof Wallet;
  label: string;
  value: number;
  hint: string;
  featured?: boolean;
}) {
  if (featured) {
    return (
      <section className="bg-brand-deep shadow-glow relative isolate gap-2 overflow-hidden rounded-3xl px-6 py-5 text-white">
        <div aria-hidden className="bg-grain absolute inset-0 -z-10 opacity-20 mix-blend-overlay" />
        <Icon aria-hidden className="absolute -right-4 -bottom-6 -z-10 size-32 rotate-12 opacity-15" />
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase opacity-85">
          <Icon className="size-4" aria-hidden /> {label}
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{formatBRL(value)}</p>
        <p className="mt-1 text-xs opacity-85">{hint}</p>
      </section>
    );
  }
  return (
    <Card className="gap-2 px-6 py-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        <span className="flex size-7 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </p>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{formatBRL(value)}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function DepositForm() {
  const deposit = useDeposit();
  const [amountCents, setAmountCents] = useState(100_000);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await deposit.mutateAsync(amountCents);
      toast.success('Depósito realizado', { description: `${formatBRL(amountCents)} adicionados ao seu saldo.` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="size-5" aria-hidden /> Depositar saldo
        </CardTitle>
        <CardDescription>Depósito simulado: nenhum pagamento real é feito.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Valor</Label>
            <MoneyInput id="deposit-amount" valueCents={amountCents} onChangeCents={setAmountCents} maxCents={100_000_000} className="h-11 text-lg" />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button key={preset} type="button" variant="outline" size="sm" onClick={() => setAmountCents(preset)}>
                  {formatBRL(preset)}
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={deposit.isPending || amountCents < 100}>
            {deposit.isPending && <Loader2 className="animate-spin" />} Depositar {formatBRL(amountCents)}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function WalletView() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useWallet();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carteira"
        description={
          user?.role === 'AUCTIONEER'
            ? 'Acompanhe o que você recebeu com as vendas dos seus lotes.'
            : 'Saldo total = disponível + comprometido. O valor comprometido é o dos lances em que você está ganhando; se alguém cobrir, ele volta ao disponível na hora.'
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <BalanceCard icon={Wallet} label="Saldo total" value={data.balanceCents} hint="Tudo o que está na carteira." />
            <BalanceCard icon={Lock} label="Comprometido" value={data.committedCents} hint="Reservado nos lances em que você lidera." />
            <BalanceCard icon={PiggyBank} label="Disponível" value={data.availableCents} hint="Pode ser usado em novos lances." featured />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {user?.role === 'BIDDER' && <DepositForm />}

            <Card className={user?.role === 'BIDDER' ? '' : 'lg:col-span-2'}>
              <CardHeader>
                <CardTitle>Movimentações</CardTitle>
                <CardDescription>As 30 mais recentes.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-2xl border bg-background/40">
                    {data.transactions.map((tx) => {
                      const incoming = tx.amountCents > 0;
                      return (
                        <li key={tx.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${incoming ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                              {incoming ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium">{TRANSACTION_LABEL[tx.type]}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(tx.createdAt)}
                                {tx.lotId && (
                                  <>
                                    {' · '}
                                    <Link href={`/lots/${tx.lotId}`} className="underline underline-offset-2">
                                      ver lote
                                    </Link>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-semibold tabular-nums ${incoming ? 'text-success' : 'text-destructive'}`}>
                              {incoming ? '+' : '−'} {formatBRL(Math.abs(tx.amountCents))}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">Saldo {formatBRL(tx.balanceAfterCents)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
