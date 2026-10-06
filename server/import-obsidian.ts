import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from './config.ts';
import { SoreStore, validateSoreInput } from './db.ts';
import { ImmichClient } from './immich.ts';
import type { SoreInput } from '../shared/types.ts';

export interface ParsedNote {
  file: string;
  input: SoreInput;
  images: string[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const EMBED = /!\[\[([^\]|]+?\.(?:jpe?g|png|webp|heic))(?:\|[^\]]*)?\]\]/gi;

function asDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Parses a `type: llaga` note; returns null for any other note. Throws on an invalid llaga. */
export function parseNote(file: string, content: string): ParsedNote | null {
  const match = FRONTMATTER.exec(content);
  if (!match) return null;
  const fm = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  if (fm.type !== 'llaga') return null;

  const body = match[2];
  const images = [...body.matchAll(EMBED)].map((m) => m[1].trim());
  const notes = body.replace(EMBED, '').trim();

  const parsed = validateSoreInput({
    startedOn: asDate(fm.fecha_aparicion),
    healedOn: asDate(fm.fecha_desaparicion),
    location: fm.ubicacion,
    pain: fm.dolor ?? null,
    cause: fm.causa_sospechada ?? null,
    treatment: fm.tratamiento ?? null,
    notes,
  });
  if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
  return { file, input: parsed.value, images };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'dry-run': { type: 'boolean', default: false } },
  });
  const dir = positionals[0];
  if (!dir) {
    console.error('Uso: npm run import:obsidian -- <carpeta-de-llagas> [--dry-run]');
    process.exit(1);
  }

  const notes = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseNote(f, readFileSync(join(dir, f), 'utf8')))
    .filter((n): n is ParsedNote => n !== null);

  const config = loadConfig();
  const immich =
    config.immichUrl && config.immichApiKey
      ? new ImmichClient(config.immichUrl, config.immichApiKey, config.immichAlbum)
      : null;
  const store = values['dry-run'] ? null : new SoreStore(config.dbPath);

  let created = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const note of notes) {
    const existing = store?.findByStartAndLocation(note.input.startedOn, note.input.location) ?? null;
    if (existing) skipped++;
    else created++;
    const sore = store ? (existing ?? store.create(note.input)) : null;

    const assetIds: string[] = [];
    for (const image of note.images) {
      const found = immich ? await immich.findByFileName(image) : [];
      if (found.length) assetIds.push(found[0].id);
      else unmatched.push(`${note.file}: ${image}`);
    }
    if (sore && assetIds.length && sore.photos.length === 0) {
      store!.setPhotos(sore.id, assetIds);
      await immich!.addToAlbum(assetIds);
    }
    console.log(`${existing ? '=' : '+'} ${note.input.startedOn} ${note.input.location} (${assetIds.length}/${note.images.length} fotos)`);
  }

  console.log(`\n${notes.length} llagas leídas: ${created} nuevas, ${skipped} ya existían${values['dry-run'] ? ' (dry run)' : ''}`);
  if (!immich) console.log('Immich no configurado: las fotos no se han enlazado.');
  if (unmatched.length) console.log(`Fotos sin encontrar en Immich:\n  ${unmatched.join('\n  ')}`);
  store?.close();
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
