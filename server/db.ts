import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isIsoDate } from '../shared/dates.ts';
import type { Sore, SoreInput } from '../shared/types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sores (
  id          INTEGER PRIMARY KEY,
  started_on  TEXT NOT NULL,
  healed_on   TEXT,
  location    TEXT NOT NULL,
  pain        INTEGER CHECK (pain BETWEEN 1 AND 5),
  cause       TEXT,
  treatment   TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (healed_on IS NULL OR healed_on >= started_on)
);
CREATE TABLE IF NOT EXISTS sore_photos (
  sore_id   INTEGER NOT NULL REFERENCES sores(id) ON DELETE CASCADE,
  asset_id  TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (sore_id, asset_id)
);
`;

interface SoreRow {
  id: number;
  started_on: string;
  healed_on: string | null;
  location: string;
  pain: number | null;
  cause: string | null;
  treatment: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type Validation = { ok: true; value: SoreInput } | { ok: false; error: string };

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function validateSoreInput(body: unknown): Validation {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo inválido' };
  const b = body as Record<string, unknown>;

  if (!isIsoDate(b.startedOn)) return { ok: false, error: 'Fecha de aparición inválida' };
  const healedOn = b.healedOn === null || b.healedOn === undefined || b.healedOn === '' ? null : b.healedOn;
  if (healedOn !== null && !isIsoDate(healedOn)) return { ok: false, error: 'Fecha de curación inválida' };
  if (healedOn !== null && healedOn < b.startedOn) {
    return { ok: false, error: 'La curación no puede ser anterior a la aparición' };
  }

  const location = optionalText(b.location);
  if (!location) return { ok: false, error: 'Falta la ubicación' };

  let pain: number | null = null;
  if (b.pain !== null && b.pain !== undefined && b.pain !== '') {
    pain = Number(b.pain);
    if (!Number.isInteger(pain) || pain < 1 || pain > 5) return { ok: false, error: 'El dolor va de 1 a 5' };
  }

  return {
    ok: true,
    value: {
      startedOn: b.startedOn,
      healedOn,
      location,
      pain,
      cause: optionalText(b.cause),
      treatment: optionalText(b.treatment),
      notes: typeof b.notes === 'string' ? b.notes.trim() : '',
    },
  };
}

export class SoreStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  private photosFor(ids: number[]): Map<number, string[]> {
    const map = new Map<number, string[]>();
    if (!ids.length) return map;
    const rows = this.db
      .prepare(`SELECT sore_id, asset_id FROM sore_photos WHERE sore_id IN (${ids.map(() => '?').join(',')}) ORDER BY position`)
      .all(...ids) as unknown as { sore_id: number; asset_id: string }[];
    for (const row of rows) {
      const list = map.get(row.sore_id) ?? [];
      list.push(row.asset_id);
      map.set(row.sore_id, list);
    }
    return map;
  }

  private toSore(row: SoreRow, photos: string[]): Sore {
    return {
      id: row.id,
      startedOn: row.started_on,
      healedOn: row.healed_on,
      location: row.location,
      pain: row.pain,
      cause: row.cause,
      treatment: row.treatment,
      notes: row.notes,
      photos,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  list(): Sore[] {
    const rows = this.db
      .prepare('SELECT * FROM sores ORDER BY started_on DESC, id DESC')
      .all() as unknown as SoreRow[];
    const photos = this.photosFor(rows.map((r) => r.id));
    return rows.map((r) => this.toSore(r, photos.get(r.id) ?? []));
  }

  get(id: number): Sore | null {
    const row = this.db.prepare('SELECT * FROM sores WHERE id = ?').get(id) as unknown as SoreRow | undefined;
    return row ? this.toSore(row, this.photosFor([id]).get(id) ?? []) : null;
  }

  create(input: SoreInput): Sore {
    const result = this.db
      .prepare(
        `INSERT INTO sores (started_on, healed_on, location, pain, cause, treatment, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.startedOn, input.healedOn, input.location, input.pain, input.cause, input.treatment, input.notes);
    return this.get(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: SoreInput): Sore | null {
    const result = this.db
      .prepare(
        `UPDATE sores SET started_on = ?, healed_on = ?, location = ?, pain = ?, cause = ?, treatment = ?, notes = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      )
      .run(input.startedOn, input.healedOn, input.location, input.pain, input.cause, input.treatment, input.notes, id);
    return result.changes ? this.get(id) : null;
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM sores WHERE id = ?').run(id).changes > 0;
  }

  setPhotos(id: number, assetIds: string[]): Sore | null {
    if (!this.get(id)) return null;
    const unique = [...new Set(assetIds)];
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM sore_photos WHERE sore_id = ?').run(id);
      const insert = this.db.prepare('INSERT INTO sore_photos (sore_id, asset_id, position) VALUES (?, ?, ?)');
      unique.forEach((assetId, i) => insert.run(id, assetId, i));
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return this.get(id);
  }

  findByStartAndLocation(startedOn: string, location: string): Sore | null {
    const row = this.db
      .prepare('SELECT id FROM sores WHERE started_on = ? AND location = ?')
      .get(startedOn, location) as { id: number } | undefined;
    return row ? this.get(row.id) : null;
  }

  close(): void {
    this.db.close();
  }
}
