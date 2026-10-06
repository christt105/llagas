import type { Sore } from '../shared/types.ts';

let nextId = 1;

export function sore(startedOn: string, healedOn: string | null, overrides: Partial<Sore> = {}): Sore {
  return {
    id: nextId++,
    startedOn,
    healedOn,
    location: 'Paladar',
    pain: null,
    cause: null,
    treatment: null,
    notes: '',
    photos: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
