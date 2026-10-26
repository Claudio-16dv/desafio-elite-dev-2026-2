import type { Metadata } from 'next';
import { RequireAuth } from '@/features/auth/require-auth';
import { NewLotView } from '@/features/seller/new-lot-view';

export const metadata: Metadata = { title: 'Novo lote' };

export default function NewLotPage() {
  return (
    <RequireAuth role="AUCTIONEER">
      <NewLotView />
    </RequireAuth>
  );
}
