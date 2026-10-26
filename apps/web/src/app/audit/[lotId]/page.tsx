import type { Metadata } from 'next';
import { AuditView } from '@/features/audit/audit-view';

export const metadata: Metadata = { title: 'Auditoria do lote' };

export default async function AuditPage({ params }: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await params;
  return <AuditView lotId={lotId} />;
}
