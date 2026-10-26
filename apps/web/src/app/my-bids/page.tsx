import type { Metadata } from 'next';
import { RequireAuth } from '@/features/auth/require-auth';
import { MyBidsView } from '@/features/bids/my-bids-view';

export const metadata: Metadata = { title: 'Meus arremates' };

export default function MyBidsPage() {
  return (
    <RequireAuth role="BIDDER">
      <MyBidsView />
    </RequireAuth>
  );
}
