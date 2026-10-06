import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function ticks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!);
  const top = Math.ceil(max / step) * step;
  const result: number[] = [];
  for (let v = 0; v <= top; v += step) result.push(v);
  return result;
}

/** Path for a bar with 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function rowPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

interface TooltipState {
  x: number;
  y: number;
  content: ComponentChildren;
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ComponentChildren }) {
  return (
    <figure class="chart" style="margin:0 0 12px">
      <h2 style="margin:0 0 6px">{title}</h2>
      {subtitle && <p class="subtitle">{subtitle}</p>}
      {children}
    </figure>
  );
}

export interface ColumnDatum {
  label: string;
  value: number;
  tooltip: ComponentChildren;
}

export function ColumnChart({
  data,
  format = (v) => String(v),
  max,
  height = 170,
}: {
  data: ColumnDatum[];
  format?: (v: number) => string;
  max?: number;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const yTicks = ticks(max ?? Math.max(0, ...data.map((d) => d.value)));
  const top = yTicks.at(-1)!;
  const left = 30;
  const bottom = 22;
  const plotW = Math.max(0, width - left);
  const plotH = height - bottom - 16;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, Math.max(4, band - 6));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const labelEvery = band < 26 ? 2 : 1;

  return (
    <div ref={ref} style="position:relative" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {yTicks.map((t) => {
            const y = 16 + plotH - (t / top) * plotH;
            return (
              <g key={t}>
                <line class={t === 0 ? 'baseline' : 'gridline'} x1={left} x2={width} y1={y} y2={y} />
                <text x={left - 6} y={y + 4} text-anchor="end">
                  {format(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / top) * plotH;
            const x = left + i * band + (band - barW) / 2;
            const y = 16 + plotH - h;
            const active = tip !== null && tip.content === d.tooltip;
            return (
              <g key={d.label + i}>
                {h > 0 && <path class={`bar${active ? ' hover' : ''}`} d={columnPath(x, y, barW, h)} />}
                {i === peak && d.value > 0 && (
                  <text class="value" x={x + barW / 2} y={y - 5} text-anchor="middle">
                    {format(d.value)}
                  </text>
                )}
                {i % labelEvery === (data.length - 1) % labelEvery && (
                  <text x={left + i * band + band / 2} y={height - 6} text-anchor="middle">
                    {d.label}
                  </text>
                )}
                <rect
                  class="hit"
                  x={left + i * band}
                  y={0}
                  width={band}
                  height={16 + plotH}
                  onPointerEnter={() => setTip({ x: x + barW / 2, y: Math.min(y, 16 + plotH - 4), content: d.tooltip })}
                  onClick={() => setTip({ x: x + barW / 2, y: Math.min(y, 16 + plotH - 4), content: d.tooltip })}
                />
              </g>
            );
          })}
        </svg>
      )}
      {tip && (
        <div class="tooltip" style={{ left: Math.min(Math.max(tip.x, 70), width - 70), top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}

export interface RowDatum {
  label: string;
  value: number;
  detail: string;
}

export function RowChart({ data }: { data: RowDatum[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rowH = 30;
  const barH = 18;
  const labelW = Math.min(150, Math.max(90, width * 0.36));
  const valueW = 28;
  const plotW = Math.max(0, width - labelW - valueW);
  const max = Math.max(1, ...data.map((d) => d.value));
  const height = data.length * rowH;

  return (
    <div ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img">
          <line class="baseline" x1={labelW} x2={labelW} y1={0} y2={height} />
          {data.map((d, i) => {
            const y = i * rowH + (rowH - barH) / 2;
            const w = (d.value / max) * plotW;
            return (
              <g key={d.label}>
                <title>{`${d.label}: ${d.detail}`}</title>
                <text class="label" x={labelW - 8} y={y + barH / 2 + 4} text-anchor="end">
                  {d.label}
                </text>
                {w > 0 && <path class="bar" d={rowPath(labelW, y, w, barH)} />}
                <text class="value" x={labelW + w + 6} y={y + barH / 2 + 4}>
                  {d.value}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export interface Span {
  id: number;
  start: number;
  end: number;
  active: boolean;
  label: string;
}

/** Gantt-style strip: each sore is a bar over a day axis, packed into as few lanes as possible. */
export function Timeline({
  spans,
  from,
  to,
  monthTicks,
  onSelect,
}: {
  spans: Span[];
  from: number;
  to: number;
  monthTicks: { day: number; label: string }[];
  onSelect: (id: number) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const laneEnds: number[] = [];
  const placed = [...spans]
    .sort((a, b) => a.start - b.start)
    .map((span) => {
      let lane = laneEnds.findIndex((end) => end < span.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = span.end;
      return { ...span, lane };
    });

  const lanes = Math.max(1, laneEnds.length);
  const laneH = 16;
  const gap = 4;
  const axisH = 20;
  const height = lanes * (laneH + gap) + axisH;
  const scale = (day: number) => ((day - from) / (to - from + 1)) * width;
  const tickSpacing = monthTicks.length ? width / monthTicks.length : width;
  const labelEvery = Math.max(1, Math.ceil(44 / tickSpacing));

  return (
    <div ref={ref} style="position:relative" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {monthTicks.map((t, i) => (
            <g key={t.day}>
              <line class="gridline" x1={scale(t.day)} x2={scale(t.day)} y1={0} y2={height - axisH} />
              {(monthTicks.length - 1 - i) % labelEvery === 0 && (
                <text x={scale(t.day) + 3} y={height - 6}>
                  {t.label}
                </text>
              )}
            </g>
          ))}
          <line class="baseline" x1={0} x2={width} y1={height - axisH} y2={height - axisH} />
          {placed.map((s) => {
            const x = scale(Math.max(s.start, from));
            const w = Math.max(4, scale(s.end + 1) - x - 2);
            const y = s.lane * (laneH + gap);
            const show = () => setTip({ x: x + w / 2, y, content: s.label });
            return (
              <rect
                key={s.id}
                class={`bar${s.active ? ' active' : ''}`}
                x={x}
                y={y}
                width={w}
                height={laneH}
                rx={4}
                style="cursor:pointer"
                onPointerEnter={show}
                onClick={() => onSelect(s.id)}
              />
            );
          })}
        </svg>
      )}
      {tip && (
        <div class="tooltip" style={{ left: Math.min(Math.max(tip.x, 80), width - 80), top: tip.y }}>
          {tip.content}
        </div>
      )}
    </div>
  );
}
