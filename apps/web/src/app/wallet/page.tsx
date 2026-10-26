import type { Metadata } from 'next';
import { RequireAuth } from '@/features/auth/require-auth';
import { WalletView } from '@/features/wallet/wallet-view';

export const metadata: Metadata = { title: 'Carteira' };

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletView />
    </RequireAuth>
  );
}
