import type { MouthPoint } from './mouth.ts';

export interface Sore {
  id: number;
  startedOn: string;
  healedOn: string | null;
  location: string;
  pain: number | null;
  cause: string | null;
  treatment: string | null;
  notes: string;
  point: MouthPoint | null;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export type SoreInput = Pick<Sore, 'startedOn' | 'healedOn' | 'location' | 'pain' | 'cause' | 'treatment' | 'notes' | 'point'>;

export interface ImmichAsset {
  id: string;
  takenAt: string;
  fileName: string;
}
