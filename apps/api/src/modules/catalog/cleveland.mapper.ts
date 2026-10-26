import { CATALOG_SOURCE, CatalogItem, ItemAttribute } from './catalog.types';

/** Subconjunto dos campos da API do Cleveland Museum of Art que usamos. */
export interface ClevelandArtwork {
  id: number;
  accession_number?: string | null;
  title?: string | null;
  creation_date?: string | null;
  creators?: Array<{ description?: string | null }> | null;
  technique?: string | null;
  type?: string | null;
  culture?: string[] | null;
  department?: string | null;
  measurements?: string | null;
  url?: string | null;
  share_license_status?: string | null;
  images?: { web?: { url?: string | null } | null } | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

/** Converte um registro da API externa em CatalogItem. Retorna null se não for utilizável (sem imagem/título). */
export function mapClevelandArtwork(raw: ClevelandArtwork): CatalogItem | null {
  const imageUrl = clean(raw.images?.web?.url);
  const title = clean(raw.title);
  if (!raw.id || !imageUrl || !title) return null;

  const artist = clean(raw.creators?.[0]?.description);
  const candidates: Array<[string, string | null]> = [
    ['Artista', artist],
    ['Data', clean(raw.creation_date)],
    ['Técnica', clean(raw.technique)],
    ['Tipo', clean(raw.type)],
    ['Cultura', clean(raw.culture?.join(', '))],
    ['Dimensões', clean(raw.measurements)],
    ['Departamento', clean(raw.department)],
    ['Nº de acervo', clean(raw.accession_number)],
    ['Licença', clean(raw.share_license_status)],
  ];
  const attributes: ItemAttribute[] = candidates
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([label, value]) => ({ label, value }));

  return {
    source: CATALOG_SOURCE,
    externalId: String(raw.id),
    title,
    subtitle: artist,
    imageUrl,
    sourceUrl: clean(raw.url),
    attributes,
  };
}
