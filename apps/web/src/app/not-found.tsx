import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Página não encontrada"
      description="O endereço não existe ou foi movido."
      action={
        <Button asChild>
          <Link href="/">Voltar para os leilões</Link>
        </Button>
      }
    />
  );
}
