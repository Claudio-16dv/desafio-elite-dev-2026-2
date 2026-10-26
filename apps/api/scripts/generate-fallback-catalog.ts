/**
 * Gera src/modules/catalog/fallback-catalog.ts a partir da API real.
 *
 * Esse acervo local é o "plano B": se a API externa cair, o leiloeiro ainda consegue
 * montar lotes e o seed continua funcionando. Regenere quando quiser renovar os itens:
 *
 *   npx ts-node --transpile-only scripts/generate-fallback-catalog.ts
 */
import { ConfigService } from '@nestjs/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { CatalogItem } from '../src/modules/catalog/catalog.types';
import { ClevelandClient } from '../src/modules/catalog/cleveland.client';

const PLAN: Array<{ type: string; q: string; take: number }> = [
  { type: 'Painting', q: 'landscape', take: 4 },
  { type: 'Painting', q: 'portrait', take: 3 },
  { type: 'Painting', q: 'still life', take: 2 },
  { type: 'Sculpture', q: 'bronze', take: 3 },
  { type: 'Print', q: 'japanese', take: 3 },
  { type: 'Drawing', q: 'study', take: 2 },
  { type: 'Photograph', q: 'portrait', take: 2 },
];

async function main(): Promise<void> {
  const values: Record<string, string | number> = {
    CATALOG_API_URL: 'https://openaccess-api.clevelandart.org/api',
    CATALOG_TIMEOUT_MS: 15000,
  };
  const config = { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
  const client = new ClevelandClient(config);

  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const step of PLAN) {
    const { items: found } = await client.search({ q: step.q, type: step.type, page: 1, pageSize: 24 });
    let taken = 0;
    for (const item of found) {
      if (taken >= step.take) break;
      if (seen.has(item.externalId)) continue;
      seen.add(item.externalId);
      items.push(item);
      taken++;
    }
  }

  const file = `/* eslint-disable */
// ARQUIVO GERADO por scripts/generate-fallback-catalog.ts. Não edite à mão.
// Fonte: Cleveland Museum of Art Open Access (CC0).
import { CatalogItem } from './catalog.types';

export const FALLBACK_CATALOG: CatalogItem[] = ${JSON.stringify(items, null, 2)};
`;
  writeFileSync(join(__dirname, '../src/modules/catalog/fallback-catalog.ts'), file);
  console.log(`Gerados ${items.length} itens em fallback-catalog.ts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
