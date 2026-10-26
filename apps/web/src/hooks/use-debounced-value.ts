'use client';

import { useEffect, useState } from 'react';

/** Devolve `value` só depois de `delayMs` sem mudanças (evita uma busca a cada tecla). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
