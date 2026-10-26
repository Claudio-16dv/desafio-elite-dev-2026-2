import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogItem, CatalogSearchQuery } from './catalog.types';
import { ClevelandArtwork, mapClevelandArtwork } from './cleveland.mapper';

const FIELDS = [
  'id',
  'accession_number',
  'title',
  'creation_date',
  'creators',
  'technique',
  'type',
  'culture',
  'department',
  'measurements',
  'url',
  'images',
  'share_license_status',
].join(',');

export class ClevelandHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * Cliente HTTP da API pública do Cleveland Museum of Art (Open Access, domínio público CC0).
 * https://openaccess-api.clevelandart.org  (sem chave de API)
 * Só faz I/O: cache e plano B ficam no CatalogService.
 */
@Injectable()
export class ClevelandClient {
  private readonly logger = new Logger(ClevelandClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('CATALOG_API_URL').replace(/\/+$/, '');
    this.timeoutMs = config.getOrThrow<number>('CATALOG_TIMEOUT_MS');
  }

  async search(query: CatalogSearchQuery): Promise<{ items: CatalogItem[]; total: number }> {
    const params = new URLSearchParams({
      has_image: '1',
      cc0: '1',
      limit: String(query.pageSize),
      skip: String((query.page - 1) * query.pageSize),
      fields: FIELDS,
    });
    if (query.q) params.set('q', query.q);
    if (query.type) params.set('type', query.type);

    const body = await this.getJson<{ info?: { total?: number }; data?: ClevelandArtwork[] }>(
      `/artworks/?${params.toString()}`,
    );
    const items = (body.data ?? [])
      .map(mapClevelandArtwork)
      .filter((item): item is CatalogItem => item !== null);
    return { items, total: body.info?.total ?? items.length };
  }

  /** Retorna null quando a obra não existe (404). Lança ClevelandHttpError em falhas de rede/servidor. */
  async getById(externalId: string): Promise<CatalogItem | null> {
    try {
      const body = await this.getJson<{ data?: ClevelandArtwork }>(
        `/artworks/${encodeURIComponent(externalId)}?fields=${FIELDS}`,
      );
      return body.data ? mapClevelandArtwork(body.data) : null;
    } catch (error) {
      if (error instanceof ClevelandHttpError && error.status === 404) return null;
      throw error;
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'CasaDeLeiloes/1.0 (desafio tecnico)' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao chamar a API do acervo: ${reason}`);
      throw new ClevelandHttpError(`Falha de rede: ${reason}`);
    }
    if (!response.ok) {
      throw new ClevelandHttpError(`API do acervo respondeu ${response.status}`, response.status);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ClevelandHttpError('Resposta inválida da API do acervo');
    }
  }
}
