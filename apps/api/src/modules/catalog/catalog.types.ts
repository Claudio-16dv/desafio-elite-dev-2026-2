/** Atributo descritivo de um item (rótulo + valor), exibido no lote. */
export interface ItemAttribute {
  label: string;
  value: string;
}

/**
 * Item do acervo já normalizado, independente do formato da API externa.
 * É esta estrutura que vira o "snapshot" gravado no lote.
 */
export interface CatalogItem {
  source: string;
  externalId: string;
  title: string;
  /** Normalmente o artista/autor. */
  subtitle: string | null;
  imageUrl: string;
  sourceUrl: string | null;
  attributes: ItemAttribute[];
}

export interface CatalogSearchQuery {
  q?: string;
  type?: string;
  page: number;
  pageSize: number;
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  /** true quando a API externa falhou e a resposta veio de cache/acervo local. */
  degraded: boolean;
  notice: string | null;
}

/** Tipos de obra aceitos no filtro (valores da API do Cleveland Museum of Art). */
export const CATALOG_TYPES = ['Painting', 'Sculpture', 'Print', 'Drawing', 'Photograph'] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export const CATALOG_SOURCE = 'clevelandart';
