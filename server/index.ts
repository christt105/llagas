import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { SoreStore } from './db.ts';
import { ImmichClient } from './immich.ts';

const config = loadConfig();
const store = new SoreStore(config.dbPath);
const immich =
  config.immichUrl && config.immichApiKey
    ? new ImmichClient(config.immichUrl, config.immichApiKey, config.immichAlbum)
    : null;

const app = createApp({
  store,
  immich,
  immichPublicUrl: immich ? config.immichPublicUrl : null,
  version: config.version,
});

app.use(
  '/*',
  serveStatic({
    root: config.staticDir,
    onFound: (path, c) => {
      const hashed = path.includes('/assets/');
      c.header('cache-control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }),
);
app.get('*', serveStatic({ path: `${config.staticDir}/index.html` }));

const server = serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`llagas ${config.version} escuchando en :${port} (Immich ${immich ? 'activado' : 'desactivado'})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    store.close();
    process.exit(0);
  });
}
