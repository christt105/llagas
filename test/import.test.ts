import { describe, expect, it } from 'vitest';
import { parseNote } from '../server/import-obsidian.ts';

describe('parseNote', () => {
  it('maps vault frontmatter and embedded images', () => {
    const note = `---
type: llaga
fecha_aparicion: 2026-01-16
fecha_desaparicion: 2026-01-23
ubicacion: Labio inferior
dolor:
causa_sospechada:
tratamiento:
---

![[IMG_20260120_211742.jpg]]
`;
    expect(parseNote('a.md', note)).toEqual({
      file: 'a.md',
      input: {
        startedOn: '2026-01-16',
        healedOn: '2026-01-23',
        location: 'Labio inferior',
        pain: null,
        cause: null,
        treatment: null,
        notes: '',
      },
      images: ['IMG_20260120_211742.jpg'],
    });
  });

  it('keeps free text as notes and treats an empty end date as active', () => {
    const note = '---\ntype: llaga\nfecha_aparicion: 2026-09-24\nfecha_desaparicion:\nubicacion: Labio superior\ndolor: 3\n---\nMe mordí comiendo.\n';
    const parsed = parseNote('b.md', note)!;
    expect(parsed.input).toMatchObject({ healedOn: null, pain: 3, notes: 'Me mordí comiendo.' });
  });

  it('ignores notes of other types and rejects broken llagas', () => {
    expect(parseNote('c.md', '---\ntype: task\n---\n')).toBeNull();
    expect(() => parseNote('d.md', '---\ntype: llaga\nubicacion: Paladar\n---\n')).toThrow('d.md');
  });
});
