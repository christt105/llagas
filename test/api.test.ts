import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { SoreStore } from '../server/db.ts';

let store: SoreStore;
let app: ReturnType<typeof createApp>;

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const valid = { startedOn: '2026-10-01', healedOn: null, location: 'Paladar', pain: 3, cause: 'estrés', treatment: '', notes: '' };
const ASSET = '3d5481bd-7f30-43a8-85d5-3c97bcbc50cc';

beforeEach(() => {
  store = new SoreStore(':memory:');
  app = createApp({ store, immich: null, immichPublicUrl: null, version: 'v1.2.3' });
});

afterEach(() => store.close());

describe('sores API', () => {
  it('creates, reads, updates and deletes a sore', async () => {
    const created = await app.request('/api/sores', json('POST', valid));
    expect(created.status).toBe(201);
    const sore = await created.json();
    expect(sore).toMatchObject({ startedOn: '2026-10-01', healedOn: null, pain: 3, cause: 'estrés', treatment: null });

    const updated = await app.request(`/api/sores/${sore.id}`, json('PUT', { ...valid, healedOn: '2026-10-05' }));
    expect((await updated.json()).healedOn).toBe('2026-10-05');

    const list = await (await app.request('/api/sores')).json();
    expect(list).toHaveLength(1);

    expect((await app.request(`/api/sores/${sore.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await app.request(`/api/sores/${sore.id}`)).status).toBe(404);
  });

  it.each([
    [{ ...valid, startedOn: '2026-02-30' }, 'aparición'],
    [{ ...valid, healedOn: '2026-09-01' }, 'anterior'],
    [{ ...valid, location: '  ' }, 'ubicación'],
    [{ ...valid, pain: 6 }, 'dolor'],
  ])('rejects invalid input %#', async (body, message) => {
    const res = await app.request('/api/sores', json('POST', body));
    expect(res.status).toBe(400);
    expect((await res.json()).error.toLowerCase()).toContain(message.toLowerCase());
  });

  it('replaces photos keeping order and dropping duplicates', async () => {
    const sore = await (await app.request('/api/sores', json('POST', valid))).json();
    const other = ASSET.replace('3d', '4e');
    const res = await app.request(`/api/sores/${sore.id}/photos`, json('PUT', { assetIds: [other, ASSET, other] }));
    expect((await res.json()).photos).toEqual([other, ASSET]);

    const bad = await app.request(`/api/sores/${sore.id}/photos`, json('PUT', { assetIds: ['../etc'] }));
    expect(bad.status).toBe(400);
  });

  it('deletes photos with their sore', async () => {
    const sore = await (await app.request('/api/sores', json('POST', valid))).json();
    await app.request(`/api/sores/${sore.id}/photos`, json('PUT', { assetIds: [ASSET] }));
    await app.request(`/api/sores/${sore.id}`, { method: 'DELETE' });
    const rows = store.db.prepare('SELECT COUNT(*) AS n FROM sore_photos').get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it('reports the version and Immich as unavailable when not configured', async () => {
    expect(await (await app.request('/api/config')).json()).toEqual({ immich: false, immichPublicUrl: null, version: 'v1.2.3' });
    expect((await app.request('/api/immich/search?from=2026-10-01&to=2026-10-02')).status).toBe(503);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
  });
});
