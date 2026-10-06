import { useEffect, useState } from 'preact/hooks';
import { addDays } from '../../../shared/dates.ts';
import type { ImmichAsset } from '../../../shared/types.ts';
import { searchImmich, thumbUrl } from '../api.ts';
import { Icon, ICONS } from './icons.tsx';

interface Props {
  from: string;
  to: string;
  selected: string[];
  onCancel: () => void;
  onDone: (assetIds: string[]) => void;
}

function formatTaken(takenAt: string): string {
  const [date, time = ''] = takenAt.split('T');
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)} ${time.slice(0, 5)}`;
}

export function PhotoPicker({ from: initialFrom, to: initialTo, selected, onCancel, onDone }: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [assets, setAssets] = useState<ImmichAsset[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>(selected);

  async function load(page: number) {
    setLoading(true);
    setError(null);
    try {
      const result = await searchImmich(from, to, page);
      setAssets((prev) => (page === 1 ? result.assets : [...prev, ...result.assets]));
      setNextPage(result.nextPage);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (from && to && from <= to) void load(1);
  }, [from, to]);

  function toggle(id: string) {
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function widen() {
    setFrom(addDays(from, -3));
    setTo(addDays(to, 3));
  }

  return (
    <div class="overlay" role="dialog" aria-label="Elegir fotos de Immich">
      <header>
        <button class="back" onClick={onCancel} aria-label="Cancelar">
          <Icon d={ICONS.close} size={24} />
        </button>
        <h2>Fotos de Immich</h2>
      </header>
      <div class="body">
        <div class="range-bar">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.currentTarget.value)} aria-label="Desde" />
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.currentTarget.value)} aria-label="Hasta" />
          <button class="small" onClick={widen}>
            ±3 días
          </button>
        </div>
        {error && <p class="error">{error}</p>}
        {!loading && !error && assets.length === 0 && <p class="empty">No hay fotos en esas fechas.</p>}
        <div class="photo-grid">
          {assets.map((asset) => (
            <button
              key={asset.id}
              class="photo"
              aria-pressed={selection.includes(asset.id)}
              onClick={() => toggle(asset.id)}
            >
              <img src={thumbUrl(asset.id)} alt={asset.fileName} loading="lazy" />
              <span class="check">{selection.includes(asset.id) && <Icon d={ICONS.check} />}</span>
              <span class="time">{formatTaken(asset.takenAt)}</span>
            </button>
          ))}
        </div>
        {loading && <p class="empty">Cargando…</p>}
        {nextPage && !loading && (
          <p style="text-align:center">
            <button onClick={() => load(nextPage)}>Cargar más</button>
          </p>
        )}
      </div>
      <footer>
        <button onClick={onCancel}>Cancelar</button>
        <button class="primary" onClick={() => onDone(selection)}>
          Usar {selection.length} {selection.length === 1 ? 'foto' : 'fotos'}
        </button>
      </footer>
    </div>
  );
}
