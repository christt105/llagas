import { useEffect, useState } from 'preact/hooks';
import type { ImmichAsset, Sore, SoreInput } from '../../shared/types.ts';

export interface AppConfig {
  immich: boolean;
  immichPublicUrl: string | null;
  version: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

let sores: Sore[] | null = null;
let soresError: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export async function refreshSores(): Promise<void> {
  try {
    sores = await request<Sore[]>('/api/sores');
    soresError = null;
  } catch (err) {
    soresError = (err as Error).message;
  }
  notify();
}

function upsert(sore: Sore) {
  const rest = (sores ?? []).filter((s) => s.id !== sore.id);
  sores = [sore, ...rest].sort((a, b) => b.startedOn.localeCompare(a.startedOn) || b.id - a.id);
  notify();
  return sore;
}

export function useSores(): { sores: Sore[] | null; error: string | null } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    if (sores === null) void refreshSores();
    return () => void listeners.delete(listener);
  }, []);
  return { sores, error: soresError };
}

export async function createSore(input: SoreInput): Promise<Sore> {
  return upsert(await request<Sore>('/api/sores', { method: 'POST', body: JSON.stringify(input) }));
}

export async function updateSore(id: number, input: SoreInput): Promise<Sore> {
  return upsert(await request<Sore>(`/api/sores/${id}`, { method: 'PUT', body: JSON.stringify(input) }));
}

export async function setSorePhotos(id: number, assetIds: string[]): Promise<Sore> {
  return upsert(await request<Sore>(`/api/sores/${id}/photos`, { method: 'PUT', body: JSON.stringify({ assetIds }) }));
}

export async function deleteSore(id: number): Promise<void> {
  await request<void>(`/api/sores/${id}`, { method: 'DELETE' });
  sores = (sores ?? []).filter((s) => s.id !== id);
  notify();
}

let configPromise: Promise<AppConfig> | null = null;

export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);
  useEffect(() => {
    configPromise ??= request<AppConfig>('/api/config').catch(() => ({ immich: false, immichPublicUrl: null, version: null }));
    void configPromise.then(setConfig);
  }, []);
  return config;
}

export function searchImmich(from: string, to: string, page: number) {
  return request<{ assets: ImmichAsset[]; nextPage: number | null }>(
    `/api/immich/search?from=${from}&to=${to}&page=${page}`,
  );
}

export async function uploadToImmich(file: File): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  form.set('lastModified', String(file.lastModified));
  return (await request<{ id: string }>('/api/immich/upload', { method: 'POST', body: form })).id;
}

export function thumbUrl(assetId: string, size: 'thumbnail' | 'preview' = 'thumbnail'): string {
  return `/api/immich/assets/${assetId}/${size}`;
}
