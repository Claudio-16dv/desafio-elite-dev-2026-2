'use client';

import { Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useWallet } from '@/features/wallet/use-wallet';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';
import { BrandMark } from './brand-mark';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { href: '/', label: 'Leilões' },
  { href: '/my-bids', label: 'Meus arremates', roles: ['BIDDER'] },
  { href: '/seller', label: 'Painel do leiloeiro', roles: ['AUCTIONEER'] },
  { href: '/seller/new', label: 'Novo lote', roles: ['AUCTIONEER'] },
  { href: '/wallet', label: 'Carteira', roles: ['BIDDER', 'AUCTIONEER'] },
];

function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  // "/seller" não deve ficar ativo em "/seller/new" (que tem item próprio).
  if (href === '/seller') return pathname === '/seller';
  return pathname.startsWith(href);
}

function WalletBadge() {
  const { data, isLoading } = useWallet();
  if (isLoading) return <Skeleton className="hidden h-9 w-32 rounded-full sm:block" />;
  if (!data) return null;
  return (
    <Link
      href="/wallet"
      className="hidden items-center gap-2 rounded-full border bg-card/70 py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors hover:border-primary/40 sm:flex"
      aria-label={`Saldo disponível ${formatBRL(data.availableCents)}`}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-brand text-white">
        <Wallet className="size-3.5" aria-hidden />
      </span>
      <span className="tabular-nums">{formatBRL(data.availableCents)}</span>
    </Link>
  );
}

function NavLinks({ items, pathname, mobile }: { items: NavItem[]; pathname: string; mobile?: boolean }) {
  return (
    <>
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
              active && 'bg-foreground text-background hover:text-background',
              mobile && 'px-3',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppHeader() {
  const { user, status } = useAuth();
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass shadow-card mx-auto flex h-14 max-w-7xl items-center gap-3 rounded-full border pr-2 pl-3">
        <Link href="/" className="group flex items-center gap-2.5 rounded-full pr-2">
          <BrandMark />
          <span className="hidden font-display text-lg leading-none font-semibold sm:inline">
            Casa de <span className="italic text-brand">Leilões</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="ml-2 hidden items-center gap-1 md:flex">
          <NavLinks items={items} pathname={pathname} />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {status === 'authenticated' && user?.role === 'BIDDER' && <WalletBadge />}
          <ThemeToggle />
          {status === 'loading' ? (
            <Skeleton className="h-9 w-24 rounded-full" />
          ) : user ? (
            <UserMenu />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Criar conta</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navegação móvel: rolagem horizontal logo abaixo do cabeçalho. */}
      <nav
        aria-label="Principal (móvel)"
        className="glass mx-auto mt-2 flex max-w-7xl gap-1 overflow-x-auto rounded-full border p-1 md:hidden"
      >
        <NavLinks items={items} pathname={pathname} mobile />
      </nav>
    </header>
  );
}
