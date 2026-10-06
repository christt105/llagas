import { Hono } from 'hono';
import type { Context } from 'hono';
import { isIsoDate } from '../shared/dates.ts';
import { validateSoreInput, type SoreStore } from './db.ts';
import { ImmichError, type ImmichClient } from './immich.ts';

const ASSET_ID = /^[0-9a-f-]{36}$/i;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface AppOptions {
  store: SoreStore;
  immich: ImmichClient | null;
  immichPublicUrl: string | null;
}

function parseId(c: Context): number | null {
  const id = Number(c.req.param('id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function createApp({ store, immich, immichPublicUrl }: AppOptions): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof ImmichError) return c.json({ error: err.message }, 502);
    console.error(err);
    return c.json({ error: 'Error interno' }, 500);
  });

  app.get('/api/config', (c) => c.json({ immich: immich !== null, immichPublicUrl }));

  app.get('/api/sores', (c) => c.json(store.list()));

  app.post('/api/sores', async (c) => {
    const parsed = validateSoreInput(await c.req.json().catch(() => null));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    return c.json(store.create(parsed.value), 201);
  });

  app.get('/api/sores/:id', (c) => {
    const id = parseId(c);
    const sore = id ? store.get(id) : null;
    return sore ? c.json(sore) : c.json({ error: 'No existe' }, 404);
  });

  app.put('/api/sores/:id', async (c) => {
    const id = parseId(c);
    if (!id) return c.json({ error: 'No existe' }, 404);
    const parsed = validateSoreInput(await c.req.json().catch(() => null));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const sore = store.update(id, parsed.value);
    return sore ? c.json(sore) : c.json({ error: 'No existe' }, 404);
  });

  app.delete('/api/sores/:id', (c) => {
    const id = parseId(c);
    return id && store.delete(id) ? c.body(null, 204) : c.json({ error: 'No existe' }, 404);
  });

  app.put('/api/sores/:id/photos', async (c) => {
    const id = parseId(c);
    if (!id) return c.json({ error: 'No existe' }, 404);
    const body = (await c.req.json().catch(() => null)) as { assetIds?: unknown } | null;
    const assetIds = body?.assetIds;
    if (!Array.isArray(assetIds) || !assetIds.every((a) => typeof a === 'string' && ASSET_ID.test(a))) {
      return c.json({ error: 'assetIds inválidos' }, 400);
    }
    const previous = store.get(id)?.photos ?? [];
    const sore = store.setPhotos(id, assetIds);
    if (!sore) return c.json({ error: 'No existe' }, 404);
    const added = assetIds.filter((a) => !previous.includes(a));
    if (immich && added.length) {
      await immich.addToAlbum(added).catch((err) => console.warn('No se pudo añadir al álbum:', err.message));
    }
    return c.json(sore);
  });

  app.use('/api/immich/*', async (c, next) => {
    if (!immich) return c.json({ error: 'Immich no está configurado' }, 503);
    await next();
  });

  app.get('/api/immich/search', async (c) => {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const page = Number(c.req.query('page') ?? 1);
    if (!isIsoDate(from) || !isIsoDate(to) || to < from || !Number.isInteger(page) || page < 1) {
      return c.json({ error: 'Rango inválido' }, 400);
    }
    return c.json(await immich!.searchByDate(from, to, page));
  });

  app.get('/api/immich/assets/:assetId/:size{thumbnail|preview}', async (c) => {
    const assetId = c.req.param('assetId');
    if (!ASSET_ID.test(assetId)) return c.json({ error: 'Id inválido' }, 400);
    const upstream = await immich!.thumbnail(assetId, c.req.param('size') as 'thumbnail' | 'preview');
    return new Response(upstream.body, {
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'cache-control': 'private, max-age=604800, immutable',
      },
    });
  });

  app.post('/api/immich/upload', async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File) || !file.type.startsWith('image/')) return c.json({ error: 'Falta la imagen' }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'Imagen demasiado grande' }, 413);
    const lastModified = Number(form?.get('lastModified'));
    const date = Number.isFinite(lastModified) && lastModified > 0 ? new Date(lastModified) : new Date();
    const id = await immich!.upload(file, date);
    return c.json({ id }, 201);
  });

  app.all('/api/*', (c) => c.json({ error: 'No existe' }, 404));

  return app;
}
