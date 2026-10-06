import type { ImmichAsset } from '../shared/types.ts';

export class ImmichError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface AssetDto {
  id: string;
  originalFileName: string;
  localDateTime: string;
  fileCreatedAt: string;
}

export interface SearchPage {
  assets: ImmichAsset[];
  nextPage: number | null;
}

export class ImmichClient {
  private albumId: string | null = null;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly albumName: string;

  constructor(baseUrl: string, apiKey: string, albumName: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.albumName = albumName;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('x-api-key', this.apiKey);
    const response = await fetch(`${this.baseUrl}/api${path}`, { ...init, headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      let message = body;
      try {
        message = JSON.parse(body).message ?? body;
      } catch {}
      throw new ImmichError(response.status, `Immich ${response.status}: ${message || response.statusText}`);
    }
    return response;
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
    return (await this.request(path, { ...init, headers })).json() as Promise<T>;
  }

  /** Images taken between two local dates (inclusive), oldest first. */
  async searchByDate(from: string, to: string, page = 1, size = 60): Promise<SearchPage> {
    const takenAfter = new Date(`${from}T00:00:00`).toISOString();
    const takenBefore = new Date(`${to}T23:59:59.999`).toISOString();
    const result = await this.json<{ assets: { items: AssetDto[]; nextPage: string | null } }>('/search/metadata', {
      method: 'POST',
      body: JSON.stringify({ takenAfter, takenBefore, type: 'IMAGE', order: 'asc', page, size }),
    });
    return {
      assets: result.assets.items.map(toAsset),
      nextPage: result.assets.nextPage ? Number(result.assets.nextPage) : null,
    };
  }

  async findByFileName(fileName: string): Promise<ImmichAsset[]> {
    const result = await this.json<{ assets: { items: AssetDto[] } }>('/search/metadata', {
      method: 'POST',
      body: JSON.stringify({ originalFileName: fileName, size: 10 }),
    });
    return result.assets.items.filter((a) => a.originalFileName === fileName).map(toAsset);
  }

  async thumbnail(id: string, size: 'thumbnail' | 'preview'): Promise<Response> {
    return this.request(`/assets/${encodeURIComponent(id)}/thumbnail?size=${size}`);
  }

  async upload(file: File, lastModified: Date): Promise<string> {
    const form = new FormData();
    form.set('assetData', file, file.name);
    form.set('filename', file.name);
    form.set('fileCreatedAt', lastModified.toISOString());
    form.set('fileModifiedAt', lastModified.toISOString());
    const result = await this.json<{ id: string; status: string }>('/assets', { method: 'POST', body: form });
    return result.id;
  }

  private async ensureAlbum(): Promise<string> {
    if (this.albumId) return this.albumId;
    const albums = await this.json<{ id: string; albumName: string }[]>('/albums');
    const existing = albums.find((a) => a.albumName === this.albumName);
    const id =
      existing?.id ??
      (await this.json<{ id: string }>('/albums', { method: 'POST', body: JSON.stringify({ albumName: this.albumName }) })).id;
    this.albumId = id;
    return id;
  }

  async addToAlbum(assetIds: string[]): Promise<void> {
    if (!assetIds.length) return;
    const albumId = await this.ensureAlbum();
    await this.json(`/albums/${albumId}/assets`, { method: 'PUT', body: JSON.stringify({ ids: assetIds }) });
  }
}

function toAsset(dto: AssetDto): ImmichAsset {
  return { id: dto.id, takenAt: dto.localDateTime ?? dto.fileCreatedAt, fileName: dto.originalFileName };
}
