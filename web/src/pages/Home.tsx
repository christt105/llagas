import { useState } from 'preact/hooks';
import { formatDate, localToday } from '../../../shared/dates.ts';
import { computeStats, durationDays } from '../../../shared/stats.ts';
import type { Sore } from '../../../shared/types.ts';
import { PAIN_LABELS } from '../../../shared/vocab.ts';
import { updateSore, useConfig } from '../api.ts';
import { SoreRow } from '../components/SoreRow.tsx';
import { Tile } from '../components/Tile.tsx';

function ActiveCard({ sore, today }: { sore: Sore; today: string }) {
  const [busy, setBusy] = useState(false);
  const day = durationDays(sore, today) + 1;

  async function healToday() {
    setBusy(true);
    try {
      const { photos: _photos, id: _id, createdAt: _c, updatedAt: _u, ...input } = sore;
      await updateSore(sore.id, { ...input, healedOn: today });
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div class="card active-card">
      <div class="sore">
        <div class="main">
          <div class="title">{sore.location}</div>
          <div class="meta">
            Desde {formatDate(sore.startedOn)}
            {sore.pain ? ` · dolor ${sore.pain} (${PAIN_LABELS[sore.pain].toLowerCase()})` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div class="day">{day}</div>
          <div class="muted" style="font-size:0.8rem">{day === 1 ? 'día' : 'días'}</div>
        </div>
      </div>
      <div class="actions">
        <button class="primary small" onClick={healToday} disabled={busy}>
          Curada hoy
        </button>
        <a class="button small" href={`#/llaga/${sore.id}`}>
          Editar
        </a>
      </div>
    </div>
  );
}

export function Home({ sores }: { sores: Sore[] }) {
  const today = localToday();
  const config = useConfig();
  const stats = computeStats(sores, today);
  const active = sores.filter((s) => !s.healedOn).sort((a, b) => a.startedOn.localeCompare(b.startedOn));
  const recent = sores.filter((s) => s.healedOn).slice(0, 5);
  const pctYear = Math.round((stats.yearDaysAffected / stats.yearDaysElapsed) * 100);

  return (
    <>
      <h1>Llagas</h1>

      {active.length > 0 ? (
        <div class="stack">
          {active.map((s) => (
            <ActiveCard key={s.id} sore={s} today={today} />
          ))}
        </div>
      ) : (
        <div class="card">
          <div class="title" style="font-weight:600">Sin llagas ahora mismo</div>
          <div class="meta muted">
            {stats.daysSinceLastHealed === null
              ? 'Aún no hay ninguna registrada.'
              : `Llevas ${stats.daysSinceLastHealed} ${stats.daysSinceLastHealed === 1 ? 'día' : 'días'} sin ninguna.`}
          </div>
        </div>
      )}

      <h2>Resumen</h2>
      <div class="tiles">
        <Tile value={stats.thisYear} label={`llagas en ${today.slice(0, 4)}`} />
        <Tile value={stats.last30} label="últimos 30 días" />
        <Tile value={stats.avgDuration === null ? '–' : stats.avgDuration.toFixed(1).replace('.0', '')} unit="días" label="duración media" />
        <Tile value={`${pctYear}%`} label={`de los días de ${today.slice(0, 4)} con llaga`} />
      </div>

      {recent.length > 0 && (
        <>
          <h2>Recientes</h2>
          <div class="stack">
            {recent.map((s) => (
              <SoreRow key={s.id} sore={s} today={today} showPhotos={!!config?.immich} />
            ))}
          </div>
          <p style="text-align:center">
            <a class="button small" href="#/historial">
              Ver todas ({sores.length})
            </a>
          </p>
        </>
      )}
    </>
  );
}
