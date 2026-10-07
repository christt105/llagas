import { join } from 'node:path';

export interface Config {
  port: number;
  dbPath: string;
  staticDir: string;
  immichUrl: string | null;
  immichApiKey: string | null;
  immichPublicUrl: string | null;
  immichAlbum: string;
  version: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const immichUrl = env.IMMICH_URL?.trim() || null;
  return {
    port: Number(env.PORT ?? 8080),
    dbPath: env.DB_PATH ?? join(env.DATA_DIR ?? 'data', 'llagas.db'),
    staticDir: env.STATIC_DIR ?? 'dist',
    immichUrl,
    immichApiKey: env.IMMICH_API_KEY?.trim() || null,
    immichPublicUrl: env.IMMICH_PUBLIC_URL?.trim() || immichUrl,
    immichAlbum: env.IMMICH_ALBUM?.trim() || 'Llagas',
    version: env.APP_VERSION?.trim() || 'dev',
  };
}
