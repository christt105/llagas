import { formatDate } from '../../../shared/dates.ts';
import { durationDays } from '../../../shared/stats.ts';
import type { Sore } from '../../../shared/types.ts';
import { thumbUrl } from '../api.ts';

export function soreMeta(sore: Sore, today: string): string {
  const days = durationDays(sore, today);
  const parts = [
    sore.healedOn ? `${formatDate(sore.startedOn)} → ${formatDate(sore.healedOn)}` : `Desde ${formatDate(sore.startedOn)}`,
    `${days} ${days === 1 ? 'día' : 'días'}`,
  ];
  if (sore.pain) parts.push(`dolor ${sore.pain}`);
  if (sore.cause) parts.push(sore.cause);
  return parts.join(' · ');
}

export function SoreRow({ sore, today, showPhotos }: { sore: Sore; today: string; showPhotos: boolean }) {
  return (
    <a class="card sore" href={`#/llaga/${sore.id}`}>
      <div class="main">
        <div class="title">
          {sore.location} {!sore.healedOn && <span class="badge">Activa</span>}
        </div>
        <div class="meta">{soreMeta(sore, today)}</div>
      </div>
      {showPhotos && sore.photos[0] && <img class="thumb" src={thumbUrl(sore.photos[0])} alt="" loading="lazy" />}
    </a>
  );
}
