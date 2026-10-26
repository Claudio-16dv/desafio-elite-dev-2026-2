import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import { CatalogItem, CatalogSearchQuery, CatalogSearchResult } from './catalog.types';
import { ClevelandClient, ClevelandHttpError } from './cleveland.client';
import { FALLBACK_CATALOG } from './fallback-catalog';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

interface CachedSearch {
  at: number;
  items: CatalogItem[];
  total: number;
}

/**
 * Orquestra a busca de itens para o leiloeiro com resiliência:
 *   1. cache em memória (5 min);
 *   2. API externa (com timeout);
 *   3. se falhar: último resultado em cache (mesmo vencido);
 *   4. se não houver: acervo local reduzido (fallback-catalog.ts).
 *
 * Só a CRIAÇÃO de lotes depende deste serviço. Vitrine, sala, auditoria e comprovante
 * leem apenas o snapshot gravado no banco e continuam funcionando com a API fora do ar.
 */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly searchCache = new Map<string, CachedSearch>();
  private readonly itemCache = new Map<string, CatalogItem>();

  constructor(private readonly client: ClevelandClient) {}

  async search(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
    const key = JSON.stringify([query.q ?? '', query.type ?? '', query.page, query.pageSize]);
    const cached = this.searchCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return this.result(cached.items, cached.total, query, false, null);
    }

    try {
      const { items, total } = await this.client.search(query);
      this.remember(key, { at: Date.now(), items, total });
      items.forEach((item) => this.itemCache.set(item.externalId, item));
      return this.result(items, total, query, false, null);
    } catch (error) {
      this.logger.warn(`Busca no acervo falhou; usando plano B. Motivo: ${(error as Error).message}`);
      if (cached) {
        return this.result(
          cached.items,
          cached.total,
          query,
          true,
          'A API do acervo está instável. Exibindo o último resultado salvo.',
        );
      }
      const local = this.searchFallback(query);
      return this.result(
        local.items,
        local.total,
        query,
        true,
        'A API do acervo está indisponível no momento. Exibindo um acervo local reduzido.',
      );
    }
  }

  /**
   * Busca UM item pelo id externo para montar o snapshot do lote.
   * Os dados nunca vêm do cliente: o servidor decide o que é gravado.
   */
  async getItem(externalId: string): Promise<CatalogItem> {
    const known = this.itemCache.get(externalId);
    if (known) return known;

    const local = FALLBACK_CATALOG.find((item) => item.externalId === externalId);
    if (local) return local;

    try {
      const item = await this.client.getById(externalId);
      if (!item) {
        throw new DomainException(
          'CATALOG_ITEM_NOT_FOUND',
          'Item não encontrado no acervo (ou sem imagem utilizável).',
          HttpStatus.NOT_FOUND,
        );
      }
      this.itemCache.set(item.externalId, item);
      return item;
    } catch (error) {
      if (error instanceof DomainException) throw error;
      if (error instanceof ClevelandHttpError) {
        throw new DomainException(
          'CATALOG_UNAVAILABLE',
          'A API do acervo está indisponível agora. Tente novamente em instantes ou escolha um item da lista local.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }

  private searchFallback(query: CatalogSearchQuery): { items: CatalogItem[]; total: number } {
    const needle = query.q?.trim().toLowerCase();
    const filtered = FALLBACK_CATALOG.filter((item) => {
      if (query.type && !item.attributes.some((a) => a.label === 'Tipo' && a.value === query.type)) {
        return false;
      }
      if (!needle) return true;
      return `${item.title} ${item.subtitle ?? ''}`.toLowerCase().includes(needle);
    });
    const start = (query.page - 1) * query.pageSize;
    return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
  }

  private remember(key: string, entry: CachedSearch): void {
    if (this.searchCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.searchCache.keys().next().value;
      if (oldest !== undefined) this.searchCache.delete(oldest);
    }
    this.searchCache.set(key, entry);
  }

  private result(
    items: CatalogItem[],
    total: number,
    query: CatalogSearchQuery,
    degraded: boolean,
    notice: string | null,
  ): CatalogSearchResult {
    return { items, total, page: query.page, pageSize: query.pageSize, degraded, notice };
  }
}
