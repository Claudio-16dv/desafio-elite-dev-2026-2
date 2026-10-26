import { Suspense } from 'react';
import { Showcase } from '@/features/lots/showcase';

export default function HomePage() {
  // Showcase usa useSearchParams (estado dos filtros na URL), que exige Suspense.
  return (
    <Suspense>
      <Showcase />
    </Suspense>
  );
}
