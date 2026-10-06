import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImmichClient, ImmichError } from '../server/immich.ts';

interface Call {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

function mockFetch(responder: (call: Call) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call = { url, method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body };
    calls.push(call);
    const result = responder(call);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const client = () => new ImmichClient('http://immich:2283/', 'secret', 'Llagas');

describe('ImmichClient', () => {
  it('searches images by local date range and maps assets', async () => {
    const calls = mockFetch(() => ({
      assets: {
        items: [{ id: 'a', originalFileName: 'IMG.jpg', localDateTime: '2026-01-20T21:17:34.000Z', fileCreatedAt: 'x' }],
        nextPage: '2',
      },
    }));
    const page = await client().searchByDate('2026-01-19', '2026-01-21');
    expect(calls[0].url).toBe('http://immich:2283/api/search/metadata');
    expect(calls[0].headers.get('x-api-key')).toBe('secret');
    const body = JSON.parse(calls[0].body as string);
    expect(body).toMatchObject({ type: 'IMAGE', order: 'asc', page: 1 });
    expect(new Date(body.takenAfter) < new Date(body.takenBefore)).toBe(true);
    expect(page).toEqual({ assets: [{ id: 'a', takenAt: '2026-01-20T21:17:34.000Z', fileName: 'IMG.jpg' }], nextPage: 2 });
  });

  it('uploads with the fields Immich v3 requires', async () => {
    const calls = mockFetch(() => ({ id: 'new', status: 'created' }));
    const id = await client().upload(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }), new Date('2026-10-06T10:00:00Z'));
    expect(id).toBe('new');
    const form = calls[0].body as FormData;
    expect(calls[0].url).toBe('http://immich:2283/api/assets');
    expect(form.get('fileCreatedAt')).toBe('2026-10-06T10:00:00.000Z');
    expect(form.get('fileModifiedAt')).toBe('2026-10-06T10:00:00.000Z');
    expect((form.get('assetData') as File).name).toBe('foto.jpg');
    expect(calls[0].headers.get('content-type')).toBeNull();
  });

  it('creates the album once and reuses it', async () => {
    const calls = mockFetch((call) => {
      if (call.method === 'GET') return [{ id: 'other', albumName: 'Viajes' }];
      if (call.url.endsWith('/albums')) return { id: 'alb' };
      return [];
    });
    const c = client();
    await c.addToAlbum(['a']);
    await c.addToAlbum(['b']);
    expect(calls.map((x) => `${x.method} ${x.url.replace('http://immich:2283/api', '')}`)).toEqual([
      'GET /albums',
      'POST /albums',
      'PUT /albums/alb/assets',
      'PUT /albums/alb/assets',
    ]);
    expect(JSON.parse(calls[1].body as string)).toEqual({ albumName: 'Llagas' });
  });

  it('surfaces Immich error messages', async () => {
    mockFetch(() => new Response(JSON.stringify({ message: 'Missing required permission: asset.upload' }), { status: 403 }));
    await expect(client().upload(new File(['x'], 'a.jpg'), new Date())).rejects.toThrow(ImmichError);
    await expect(client().upload(new File(['x'], 'a.jpg'), new Date())).rejects.toThrow('asset.upload');
  });
});
