import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SoreStore, validateSoreInput } from '../server/db.ts';
import { approximatePoint, MOUTH_VIEWS, REGION_NAMES } from '../shared/mouth.ts';

const base = { startedOn: '2026-10-01', location: 'Lengua derecha' };

describe('mouth views', () => {
  it('has unique region ids per view and mirrored left/right names', () => {
    for (const view of MOUTH_VIEWS) {
      const ids = view.regions.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(REGION_NAMES).toEqual(expect.arrayContaining(['Lengua derecha', 'Lengua izquierda', 'Triángulo retromolar derecho']));
  });

  it('mirrors right-side regions onto the left', () => {
    const [view] = MOUTH_VIEWS;
    const right = view.regions.find((r) => r.name === 'Lengua derecha')!;
    const left = view.regions.find((r) => r.name === 'Lengua izquierda')!;
    expect(left.anchor).toEqual([view.width - right.anchor[0], right.anchor[1]]);
    expect(left.d.startsWith('M218,262')).toBe(true);
  });

  it('keeps every anchor inside its view', () => {
    for (const view of MOUTH_VIEWS) {
      for (const { anchor } of view.regions) {
        expect(anchor[0]).toBeGreaterThan(0);
        expect(anchor[0]).toBeLessThan(view.width);
        expect(anchor[1]).toBeGreaterThan(0);
        expect(anchor[1]).toBeLessThan(view.height);
      }
    }
  });

  it('approximates only exact region names', () => {
    expect(approximatePoint('Paladar')).toMatchObject({ view: 'boca' });
    expect(approximatePoint('Labio inferior')).toMatchObject({ view: 'boca' });
    expect(approximatePoint('Frenillo')).toBeNull();
    expect(approximatePoint('Detrás dentadura')).toBeNull();
  });
});

describe('point validation', () => {
  it('accepts a point inside a known view', () => {
    const r = validateSoreInput({ ...base, point: { view: 'boca', x: 0.2, y: 0.6 } });
    expect(r.ok && r.value.point).toEqual({ view: 'boca', x: 0.2, y: 0.6 });
  });

  it.each([{ view: 'nariz', x: 0.5, y: 0.5 }, { view: 'lengua', x: 0.5, y: 0.5 }, { view: 'boca', x: 1.5, y: 0.5 }, { view: 'boca', x: '0.5', y: 0.5 }, 'boca'])(
    'rejects %j',
    (point) => {
      expect(validateSoreInput({ ...base, point }).ok).toBe(false);
    },
  );

  it('treats a missing point as none', () => {
    const r = validateSoreInput(base);
    expect(r.ok && r.value.point).toBeNull();
  });
});

describe('migration', () => {
  it('adds the map columns to a database created before them', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'llagas-')), 'old.db');
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE sores (id INTEGER PRIMARY KEY, started_on TEXT NOT NULL, healed_on TEXT, location TEXT NOT NULL,
      pain INTEGER, cause TEXT, treatment TEXT, notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '');
      INSERT INTO sores (started_on, location) VALUES ('2026-01-01', 'Paladar');`);
    old.close();

    const store = new SoreStore(path);
    expect(store.get(1)).toMatchObject({ location: 'Paladar', point: null });
    const updated = store.update(1, { ...store.get(1)!, point: { view: 'boca', x: 0.5, y: 0.5 } });
    expect(updated?.point).toEqual({ view: 'boca', x: 0.5, y: 0.5 });
    store.close();
    new SoreStore(path).close();
  });
});
