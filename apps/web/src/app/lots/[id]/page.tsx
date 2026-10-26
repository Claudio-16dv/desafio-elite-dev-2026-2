import type { Metadata } from 'next';
import { AuctionRoom } from '@/features/auction-room/auction-room';

export const metadata: Metadata = { title: 'Sala do lote' };

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuctionRoom lotId={id} />;
}
