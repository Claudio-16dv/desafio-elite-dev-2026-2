'use client';

import { ErrorState } from '@/components/shared/error-state';

/** Rede de segurança: um erro inesperado de renderização não derruba o app inteiro. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} onRetry={reset} title="Algo deu errado" />;
}
