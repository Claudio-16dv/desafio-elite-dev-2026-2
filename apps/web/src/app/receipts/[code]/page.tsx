import type { Metadata } from 'next';
import { ReceiptView } from '@/features/receipts/receipt-view';

export const metadata: Metadata = { title: 'Comprovante de arremate' };

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ReceiptView code={code} />;
}
