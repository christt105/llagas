import { useState } from 'preact/hooks';
import { localToday } from '../../../shared/dates.ts';
import type { Sore } from '../../../shared/types.ts';
import { useConfig } from '../api.ts';
import { SoreRow } from '../components/SoreRow.tsx';

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthTitle(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export function History({ sores }: { sores: Sore[] }) {
  const today = localToday();
  const config = useConfig();
  const [location, setLocation] = useState<string | null>(null);

  const locations = [...new Set(sores.map((s) => s.location))].sort((a, b) => a.localeCompare(b));
  const filtered = location ? sores.filter((s) => s.location === location) : sores;

  const byMonth = new Map<string, Sore[]>();
  for (const sore of filtered) {
    const key = sore.startedOn.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), sore]);
  }

  return (
    <>
      <h1>Historial</h1>
      <div class="chips filter-chips">
        <button class="chip" aria-pressed={location === null} onClick={() => setLocation(null)}>
          Todas ({sores.length})
        </button>
        {locations.map((l) => (
          <button key={l} class="chip" aria-pressed={location === l} onClick={() => setLocation(location === l ? null : l)}>
            {l} ({sores.filter((s) => s.location === l).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p class="empty">No hay llagas registradas.</p>}

      {[...byMonth.entries()].map(([month, items]) => (
        <section key={month}>
          <div class="month-header">
            {monthTitle(month)} · {items.length}
          </div>
          <div class="stack">
            {items.map((s) => (
              <SoreRow key={s.id} sore={s} today={today} showPhotos={!!config?.immich} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
