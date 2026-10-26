import type { Metadata } from 'next';
import { RequireAuth } from '@/features/auth/require-auth';
import { SellerDashboard } from '@/features/seller/seller-dashboard';

export const metadata: Metadata = { title: 'Painel do leiloeiro' };

export default function SellerPage() {
  return (
    <RequireAuth role="AUCTIONEER">
      <SellerDashboard />
    </RequireAuth>
  );
}
