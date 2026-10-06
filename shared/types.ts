export interface Sore {
  id: number;
  startedOn: string;
  healedOn: string | null;
  location: string;
  pain: number | null;
  cause: string | null;
  treatment: string | null;
  notes: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export type SoreInput = Pick<Sore, 'startedOn' | 'healedOn' | 'location' | 'pain' | 'cause' | 'treatment' | 'notes'>;

export interface ImmichAsset {
  id: string;
  takenAt: string;
  fileName: string;
}
