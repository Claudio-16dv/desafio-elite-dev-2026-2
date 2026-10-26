'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import type { Role } from '@/types/api';
import { useAuth } from './auth-provider';

const ROLE_LABEL: Record<Role, string> = { AUCTIONEER: 'leiloeiros', BIDDER: 'licitantes' };

/**
 * Protege uma tela no cliente. Visitante vai para o login (e volta depois);
 * perfil errado vê uma explicação. A segurança REAL é do back-end (JWT + papéis);
 * isto é só experiência de uso.
 */
export function RequireAuth({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status === 'loading' || status === 'anonymous') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (role && user?.role !== role) {
    return (
      <EmptyState
        icon={Lock}
        title="Área restrita"
        description={`Esta página é exclusiva para ${ROLE_LABEL[role]}. Você está logado como ${user?.role === 'AUCTIONEER' ? 'leiloeiro' : 'licitante'}.`}
        action={
          <Button asChild variant="outline">
            <Link href="/">Voltar para os leilões</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
