import { useRef } from 'preact/hooks';
import type { MouthView } from '../../../shared/mouth.ts';

export type DotKind = 'current' | 'other' | 'healed' | 'active' | 'approx-healed' | 'approx-active';

export interface Dot {
  key: string | number;
  x: number;
  y: number;
  kind: DotKind;
  title?: string;
  onSelect?: () => void;
}

const DOT_ORDER: DotKind[] = ['other', 'approx-healed', 'healed', 'approx-active', 'active', 'current'];

interface Props {
  view: MouthView;
  dots: Dot[];
  onPick?: (x: number, y: number, region: string) => void;
}

export function MouthMap({ view, dots, onPick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  function handleClick(e: MouseEvent) {
    if (!onPick || !svgRef.current) return;
    const target = (e.target as Element).closest('[data-region]');
    if (!target) return;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = Math.min(1, Math.max(0, point.x / view.width));
    const y = Math.min(1, Math.max(0, point.y / view.height));
    onPick(x, y, target.getAttribute('data-region')!);
  }

  const ordered = [...dots].sort((a, b) => DOT_ORDER.indexOf(a.kind) - DOT_ORDER.indexOf(b.kind));

  return (
    <svg
      ref={svgRef}
      class={`mouth${onPick ? ' pickable' : ''}`}
      viewBox={`-4 -4 ${view.width + 8} ${view.height + 24}`}
      role="img"
      aria-label={view.name}
      onClick={handleClick}
    >
      {view.regions.map((r) => (
        <path
          key={r.id}
          d={r.d}
          data-region={r.name}
          class={`region tone-${r.tone}${r.stroke ? ' band' : ''}`}
          style={r.stroke ? { strokeWidth: r.stroke } : undefined}
        >
          <title>{r.name}</title>
        </path>
      ))}
      {view.decor.map((d, i) => (
        <path
          key={i}
          d={d.d}
          class={`decor ${d.className}${d.stroke ? ' band' : ''}`}
          style={d.stroke ? { strokeWidth: d.stroke, strokeDasharray: d.dash } : undefined}
        />
      ))}
      <text class="side" x={4} y={view.height + 16}>
        derecha
      </text>
      <text class="side" x={view.width - 4} y={view.height + 16} text-anchor="end">
        izquierda
      </text>
      {ordered.map((dot) => (
        <circle
          key={dot.key}
          class={`dot dot-${dot.kind}${dot.onSelect ? ' selectable' : ''}`}
          cx={dot.x * view.width}
          cy={dot.y * view.height}
          r={dot.kind === 'current' ? 9 : dot.kind === 'other' ? 5 : 7}
          onClick={
            dot.onSelect
              ? (e) => {
                  e.stopPropagation();
                  dot.onSelect!();
                }
              : undefined
          }
        >
          {dot.title && <title>{dot.title}</title>}
        </circle>
      ))}
    </svg>
  );
}
