import { useState } from 'preact/hooks';
import { approximatePoint, MOUTH_VIEWS, viewById, type MouthPoint } from '../../../shared/mouth.ts';
import type { Sore } from '../../../shared/types.ts';
import { MouthMap, type Dot } from './MouthMap.tsx';

interface Props {
  point: MouthPoint | null;
  location: string;
  others: Sore[];
  onPick: (point: MouthPoint, region: string) => void;
  onClear: () => void;
}

export function MouthPicker({ point, location, others, onPick, onClear }: Props) {
  const [viewId, setViewId] = useState(() => point?.view ?? approximatePoint(location)?.view ?? MOUTH_VIEWS[0].id);
  const view = viewById(viewId)!;

  const dots: Dot[] = others.flatMap((s) => {
    const p = s.point ?? approximatePoint(s.location);
    return p && p.view === viewId ? [{ key: s.id, x: p.x, y: p.y, kind: 'other' as const }] : [];
  });
  if (point && point.view === viewId) dots.push({ key: 'current', x: point.x, y: point.y, kind: 'current' });

  const pointElsewhere = point && point.view !== viewId ? viewById(point.view)?.name : null;

  return (
    <div>
      <div class="chips map-tabs">
        {MOUTH_VIEWS.map((v) => (
          <button type="button" key={v.id} class="chip small" aria-pressed={v.id === viewId} onClick={() => setViewId(v.id)}>
            {v.name}
            {point?.view === v.id ? ' •' : ''}
          </button>
        ))}
      </div>
      <MouthMap view={view} dots={dots} onPick={(x, y, region) => onPick({ view: viewId, x, y }, region)} />
      <div class="picked">
        {point ? (
          <>
            <span>{location}</span>
            {pointElsewhere && <span class="muted">(punto en {pointElsewhere})</span>}
            <span style="flex:1" />
            <button type="button" class="small" onClick={onClear}>
              Quitar punto
            </button>
          </>
        ) : (
          <span class="muted">{location ? `${location} · toca el dibujo para situarla` : 'Toca el dibujo donde está la llaga'}</span>
        )}
      </div>
    </div>
  );
}
