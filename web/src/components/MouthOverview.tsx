import { Fragment } from 'preact';
import { formatDate } from '../../../shared/dates.ts';
import { approximatePoint, MOUTH_VIEWS } from '../../../shared/mouth.ts';
import type { Sore } from '../../../shared/types.ts';
import { navigate } from '../router.ts';
import { MouthMap, type Dot } from './MouthMap.tsx';

export function MouthOverview({ sores }: { sores: Sore[] }) {
  const unplaced: Sore[] = [];
  const dotsByView = new Map<string, Dot[]>();

  for (const sore of sores) {
    const approx = !sore.point;
    const point = sore.point ?? approximatePoint(sore.location);
    if (!point) {
      unplaced.push(sore);
      continue;
    }
    const state = sore.healedOn ? 'healed' : 'active';
    const dots = dotsByView.get(point.view) ?? [];
    dots.push({
      key: sore.id,
      x: point.x,
      y: point.y,
      kind: approx ? `approx-${state}` : state,
      title: `${sore.location} · ${formatDate(sore.startedOn)}`,
      onSelect: () => navigate(`/llaga/${sore.id}`),
    });
    dotsByView.set(point.view, dots);
  }

  for (const dots of dotsByView.values()) spreadOverlaps(dots);

  return (
    <>
      <div class="map-grid">
        {MOUTH_VIEWS.map((view) => (
          <figure key={view.id}>
            <figcaption>
              {view.name} ({dotsByView.get(view.id)?.length ?? 0})
            </figcaption>
            <MouthMap view={view} dots={dotsByView.get(view.id) ?? []} />
          </figure>
        ))}
      </div>
      <div class="legend">
        <span class="dot">Curada</span>
        <span class="active dot">Activa</span>
        <span class="approx">Posición aproximada</span>
      </div>
      {unplaced.length > 0 && (
        <p class="muted" style="font-size:0.85rem">
          Sin situar ({unplaced.length}):{' '}
          {unplaced.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 && ', '}
              <a href={`#/llaga/${s.id}`}>
                {s.location} {formatDate(s.startedOn)}
              </a>
            </Fragment>
          ))}
          . Ábrelas y toca el dibujo para colocarlas.
        </p>
      )}
    </>
  );
}

/** Fans out dots that share the exact same spot (approximate positions) along a small spiral. */
function spreadOverlaps(dots: Dot[]) {
  const groups = new Map<string, Dot[]>();
  for (const dot of dots) {
    const key = `${dot.x.toFixed(3)},${dot.y.toFixed(3)}`;
    groups.set(key, [...(groups.get(key) ?? []), dot]);
  }
  for (const group of groups.values()) {
    group.forEach((dot, i) => {
      if (i === 0) return;
      const radius = 0.035 * Math.sqrt(i);
      const angle = i * 2.4;
      dot.x += Math.cos(angle) * radius;
      dot.y += Math.sin(angle) * radius;
    });
  }
}
