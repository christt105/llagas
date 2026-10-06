# Llagas

Self-hosted tracker for mouth ulcers: quick logging from the phone, history, statistics, and photos stored in Immich (only asset ids are kept here, nothing is duplicated). Installable as a PWA. The UI is in Spanish.

## Stack

- **Server:** Node 22 (native TypeScript type stripping), [Hono](https://hono.dev), SQLite through the built-in `node:sqlite` (no native dependencies).
- **Web:** Preact + Vite, hand-written SVG charts, service worker for offline shell and cached thumbnails.
- **Shared:** `shared/stats.ts` computes every statistic client-side from the full list of sores.

No authentication: it is meant for the LAN (and Tailscale when away from home).

## Data model

| Field | Notes |
| --- | --- |
| `started_on` / `healed_on` | ISO dates; `healed_on` empty means the sore is still active |
| `location` | free text, suggested from history |
| `pain` | 1-5, optional |
| `cause`, `treatment` | closed vocabularies in `shared/vocab.ts`, optional |
| `notes` | free text |
| `sore_photos` | ordered Immich asset ids |

Duration is always derived (`healed_on - started_on`), never stored.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `8080` | |
| `DATA_DIR` | `data` | SQLite file is `$DATA_DIR/llagas.db` |
| `IMMICH_URL` | | e.g. `http://192.168.1.15:2283`; photos are disabled without it |
| `IMMICH_API_KEY` | | needs `asset.read`, `asset.view`, `asset.upload`, `album.read`, `album.create`, `albumAsset.create` |
| `IMMICH_PUBLIC_URL` | `IMMICH_URL` | used for "open in Immich" links |
| `IMMICH_ALBUM` | `Llagas` | linked and uploaded photos are added to this album |
| `TZ` | | set it so Immich date searches match local days |

## Development

```sh
npm install
npm run dev:server   # API on :8080
npm run dev:web      # Vite on :5173, proxies /api
npm test
npm run typecheck
```

## Importing from Obsidian

Reads every `type: llaga` note in a folder (`fecha_aparicion`, `fecha_desaparicion`, `ubicacion`, `dolor`, `causa_sospechada`, `tratamiento`, note body as notes). Embedded images (`![[IMG_x.jpg]]`) are looked up in Immich by original file name and linked. Idempotent: sores are matched by start date and location, and photos are only linked to sores that have none.

```sh
DB_PATH=path/to/llagas.db IMMICH_URL=... IMMICH_API_KEY=... npm run import:obsidian -- <folder> [--dry-run]
```

## Deployment

```sh
docker build -t llagas:local .
```

Run with a volume on `/data` (the image runs as uid 1000) and the environment above. A compose file only needs the image, a port mapping, `TZ`, the Immich variables and the volume.

### Installing the PWA over plain HTTP

Service workers require a secure context. On a LAN address without HTTPS, enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the phone with the app's origin (e.g. `http://192.168.1.15:8097`) and relaunch Chrome; "Install app" then becomes available.
