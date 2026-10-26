'use client';

import { Gavel, Loader2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';
import { useAuth } from './auth-provider';

const ROLES: Array<{ value: Role; title: string; description: string; icon: typeof Gavel }> = [
  { value: 'BIDDER', title: 'Licitante', description: 'Deposita saldo, dá lances e arremata itens.', icon: UserRound },
  { value: 'AUCTIONEER', title: 'Leiloeiro', description: 'Cria e gerencia lotes. Não pode dar lances.', icon: Gavel },
];

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<Role>('BIDDER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const user = await register({ name, email, password, role });
      router.replace(user.role === 'AUCTIONEER' ? '/seller' : '/wallet');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-3xl">Criar conta</CardTitle>
        <CardDescription>Escolha como você vai usar a plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Perfil</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map(({ value, title, description, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                    role === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4" aria-hidden /> {title}
                  </span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="password-help"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p id="password-help" className="text-xs text-muted-foreground">
              Mínimo de 8 caracteres.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Criar conta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
