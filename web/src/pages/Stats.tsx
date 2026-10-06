import { useState } from 'preact/hooks';
import { addDays, formatDate, localToday, monthLabel, toDayNumber } from '../../../shared/dates.ts';
import { computeStats, durationDays, type GroupStat } from '../../../shared/stats.ts';
import type { Sore } from '../../../shared/types.ts';
import { ChartCard, ColumnChart, RowChart, Timeline } from '../components/charts.tsx';
import { Tile } from '../components/Tile.tsx';
import { navigate } from '../router.ts';

const DURATION_BUCKETS = [
  { label: '≤4', min: 0, max: 4 },
  { label: '5-7', min: 5, max: 7 },
  { label: '8-10', min: 8, max: 10 },
  { label: '11-14', min: 11, max: 14 },
  { label: '15+', min: 15, max: Infinity },
];

const RANGES = [
  { months: 6, label: '6 meses' },
  { months: 12, label: '12 meses' },
  { months: 24, label: '2 años' },
];

function fmtDays(value: number | null): string {
  return value === null ? '–' : value.toFixed(1).replace('.0', '');
}

function GroupTable({ rows, empty }: { rows: GroupStat[]; empty: string }) {
  if (!rows.length) return <p class="muted">{empty}</p>;
  return (
    <table>
      <thead>
        <tr>
          <th />
          <th class="num">Llagas</th>
          <th class="num">Duración media</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>{r.key}</td>
            <td class="num">{r.count}</td>
            <td class="num">{r.avgDuration === null ? '–' : `${fmtDays(r.avgDuration)} d`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatsPage({ sores }: { sores: Sore[] }) {
  const today = localToday();
  const [months, setMonths] = useState(12);
  const stats = computeStats(sores, today, months);
  const year = today.slice(0, 4);
  const pctYear = Math.round((stats.yearDaysAffected / stats.yearDaysElapsed) * 100);
  const longest = stats.longest ? sores.find((s) => s.id === stats.longest!.id) : null;

  const rangeStart = `${stats.months[0].month}-01`;
  const inRange = sores.filter((s) => (s.healedOn ?? today) >= rangeStart);
  const healedDurations = sores.filter((s) => s.healedOn).map((s) => durationDays(s, today));

  const monthTicks = stats.months.map((m) => ({
    day: toDayNumber(`${m.month}-01`),
    label: monthLabel(m.month, m.month.endsWith('-01')),
  }));

  return (
    <>
      <h1>Estadísticas</h1>

      <div class="tiles">
        <Tile value={stats.total} label="llagas registradas" />
        <Tile value={stats.thisYear} label={`en ${year}`} />
        <Tile value={stats.active} label={stats.active === 1 ? 'activa ahora' : 'activas ahora'} />
        <Tile value={`${pctYear}%`} label={`días de ${year} con llaga (${stats.yearDaysAffected})`} />
        <Tile value={fmtDays(stats.avgDuration)} unit="días" label={`duración media (mediana ${fmtDays(stats.medianDuration)})`} />
        <Tile value={longest ? stats.longest!.days : '–'} unit="días" label={longest ? `la más larga (${longest.location})` : 'la más larga'} />
        <Tile value={fmtDays(stats.avgGapDays)} unit="días" label="entre una y la siguiente" />
        <Tile value={stats.avgPain === null ? '–' : stats.avgPain.toFixed(1)} unit="/ 5" label="dolor medio" />
      </div>

      <div class="chips" style="margin:24px 0 12px">
        {RANGES.map((r) => (
          <button key={r.months} class="chip" aria-pressed={months === r.months} onClick={() => setMonths(r.months)}>
            {r.label}
          </button>
        ))}
      </div>

      <ChartCard title="Llagas nuevas por mes">
        <ColumnChart
          data={stats.months.map((m) => ({
            label: monthLabel(m.month),
            value: m.started,
            tooltip: `${monthLabel(m.month, true)}: ${m.started} ${m.started === 1 ? 'llaga' : 'llagas'}`,
          }))}
        />
      </ChartCard>

      <ChartCard title="Días con llaga" subtitle="Porcentaje de días del mes con al menos una llaga">
        <ColumnChart
          max={100}
          format={(v) => `${v}%`}
          data={stats.months.map((m) => ({
            label: monthLabel(m.month),
            value: Math.round((m.daysAffected / m.daysInMonth) * 100),
            tooltip: `${monthLabel(m.month, true)}: ${m.daysAffected} de ${m.daysInMonth} días`,
          }))}
        />
        <details class="table-view">
          <summary>Ver tabla</summary>
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th class="num">Nuevas</th>
                <th class="num">Días con llaga</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.months].reverse().map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month, true)}</td>
                  <td class="num">{m.started}</td>
                  <td class="num">
                    {m.daysAffected} / {m.daysInMonth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </ChartCard>

      <ChartCard title="Línea de tiempo" subtitle="Cada barra es una llaga; toca una para abrirla">
        <Timeline
          from={toDayNumber(rangeStart)}
          to={toDayNumber(today)}
          monthTicks={monthTicks}
          onSelect={(id) => navigate(`/llaga/${id}`)}
          spans={inRange.map((s) => ({
            id: s.id,
            start: toDayNumber(s.startedOn),
            end: toDayNumber(s.healedOn ? addDays(s.healedOn, -1) : today),
            active: !s.healedOn,
            label: `${s.location} · ${formatDate(s.startedOn)} · ${durationDays(s, today)} d`,
          }))}
        />
        <div class="legend">
          <span>Curada</span>
          <span class="active">Activa</span>
        </div>
      </ChartCard>

      <ChartCard title="Por ubicación" subtitle="Todo el historial">
        <RowChart
          data={stats.byLocation.map((g) => ({
            label: g.key,
            value: g.count,
            detail: `${g.count} llagas, ${fmtDays(g.avgDuration)} días de media`,
          }))}
        />
        <details class="table-view">
          <summary>Ver tabla</summary>
          <GroupTable rows={stats.byLocation} empty="Sin datos" />
        </details>
      </ChartCard>

      <ChartCard title="Cuánto duran" subtitle="Llagas curadas según los días que tardaron">
        <ColumnChart
          data={DURATION_BUCKETS.map((b) => {
            const count = healedDurations.filter((d) => d >= b.min && d <= b.max).length;
            return { label: `${b.label} d`, value: count, tooltip: `${b.label} días: ${count}` };
          })}
        />
      </ChartCard>

      <ChartCard title="Por causa sospechada">
        <GroupTable rows={stats.byCause} empty="Aún no hay ninguna con causa. Rellénala al registrar para poder compararlas." />
      </ChartCard>

      <ChartCard title="Por tratamiento">
        <GroupTable rows={stats.byTreatment} empty="Aún no hay ninguna con tratamiento registrado." />
      </ChartCard>
    </>
  );
}
