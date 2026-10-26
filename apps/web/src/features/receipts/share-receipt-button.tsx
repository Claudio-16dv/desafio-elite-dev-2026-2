'use client';

import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Copia o link público do comprovante (ou abre o compartilhamento nativo, quando existir). */
export function ShareReceiptButton({ code, size = 'sm' }: { code: string; size?: 'sm' | 'default' }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/receipts/${code}`;
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'Comprovante de arremate', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado', { description: url });
      window.setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // usuário fechou o menu de compartilhar
      toast.error('Não foi possível copiar o link', { description: url });
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={() => void share()}>
      {copied ? <Check /> : <Link2 />} {copied ? 'Copiado!' : 'Compartilhar link'}
    </Button>
  );
}
