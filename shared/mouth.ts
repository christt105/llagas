export interface MouthPoint {
  view: string;
  x: number;
  y: number;
}

export interface MouthRegion {
  id: string;
  name: string;
  d: string;
  tone: Tone;
  anchor: [number, number];
}

export interface MouthDecor {
  d: string;
  className: string;
}

export interface MouthView {
  id: string;
  name: string;
  width: number;
  height: number;
  regions: MouthRegion[];
  decor: MouthDecor[];
}

export type Tone = 'lip' | 'gum' | 'palate' | 'velum' | 'tongue' | 'floor' | 'cheek' | 'throat' | 'tonsil';

type Vec = [number, number];

const W = 300;
const H = 400;

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const pt = ([x, y]: Vec) => `${fmt(x)},${fmt(y)}`;

/** Mirrors an absolute-coordinate path (M/L/C/Q/Z with "x,y" pairs) across the vertical axis. */
function mirror(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${fmt(W - Number(x))},${y}`);
}

function pair(
  tone: Tone,
  id: string,
  [right, left]: [string, string],
  d: string,
  anchor: [number, number],
): MouthRegion[] {
  return [
    { tone, id: `${id}-r`, name: right, d, anchor },
    { tone, id: `${id}-l`, name: left, d: mirror(d), anchor: [W - anchor[0], anchor[1]] },
  ];
}

function oval(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  return (
    `M${pt([cx - rx, cy])} C${pt([cx - rx, cy - ry * k])} ${pt([cx - rx * k, cy - ry])} ${pt([cx, cy - ry])} ` +
    `C${pt([cx + rx * k, cy - ry])} ${pt([cx + rx, cy - ry * k])} ${pt([cx + rx, cy])} ` +
    `C${pt([cx + rx, cy + ry * k])} ${pt([cx + rx * k, cy + ry])} ${pt([cx, cy + ry])} ` +
    `C${pt([cx - rx * k, cy + ry])} ${pt([cx - rx, cy + ry * k])} ${pt([cx - rx, cy])} Z`
  );
}

/** Tooth size in millimetres: width along the arch, depth across it. Central incisor first. */
type ToothSpec = [width: number, depth: number, kind: 'incisor' | 'premolar' | 'molar'];

const UPPER_TEETH: ToothSpec[] = [
  [8.5, 7, 'incisor'],
  [6.5, 6, 'incisor'],
  [7.5, 8, 'incisor'],
  [7, 9, 'premolar'],
  [6.5, 9, 'premolar'],
  [10, 11, 'molar'],
  [9, 10.5, 'molar'],
];

const LOWER_TEETH: ToothSpec[] = [
  [5.5, 6, 'incisor'],
  [6, 6, 'incisor'],
  [7, 7.5, 'incisor'],
  [7, 7.5, 'premolar'],
  [7, 8, 'premolar'],
  [11, 10.5, 'molar'],
  [10.5, 10, 'molar'],
];

interface Sample {
  p: Vec;
  /** Unit normal pointing out of the arch, towards the lips and cheeks. */
  n: Vec;
  t: Vec;
  s: number;
}

interface Arch {
  /** Right half, from the midline between the central incisors back to the last molar. */
  samples: Sample[];
  length: number;
  teeth: { s: number; w: number; d: number; kind: ToothSpec[2] }[];
}

/**
 * Lays a dental arch along a cubic curve (midline first) and spaces the teeth so they fill it,
 * keeping their real-world proportions.
 */
function buildArch(curve: [Vec, Vec, Vec, Vec], inside: Vec, specs: ToothSpec[], depthScale: number): Arch {
  const [a, b, c, d] = curve;
  const steps = 60;
  const samples: Sample[] = [];
  let s = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const p: Vec = [
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ];
    const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
    const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    const tan: Vec = [dx / len, dy / len];
    let n: Vec = [tan[1], -tan[0]];
    if (n[0] * (p[0] - inside[0]) + n[1] * (p[1] - inside[1]) < 0) n = [-n[0], -n[1]];
    if (i > 0) s += Math.hypot(p[0] - samples[i - 1].p[0], p[1] - samples[i - 1].p[1]);
    samples.push({ p, n, t: tan, s });
  }

  const gap = 0.3;
  const total = specs.reduce((sum, [w]) => sum + w + gap, 0);
  const scale = s / total;
  let at = gap / 2;
  const teeth = specs.map(([w, dep, kind]) => {
    const tooth = { s: (at + w / 2) * scale, w: w * scale, d: dep * scale * depthScale, kind };
    at += w + gap;
    return tooth;
  });
  return { samples, length: s, teeth };
}

function sampleAt(arch: Arch, s: number): Sample {
  const { samples } = arch;
  const i = Math.max(1, samples.findIndex((x) => x.s >= s));
  const [p, q] = [samples[i - 1], samples[Math.min(i, samples.length - 1)]];
  const f = q.s === p.s ? 0 : (s - p.s) / (q.s - p.s);
  const lerp = (u: Vec, v: Vec): Vec => [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f];
  return { p: lerp(p.p, q.p), n: lerp(p.n, q.n), t: lerp(p.t, q.t), s };
}

/** Half the tooth depth at a point of the arch, interpolated between tooth centres. */
function halfDepth(arch: Arch, s: number): number {
  const { teeth } = arch;
  if (s <= teeth[0].s) return teeth[0].d / 2;
  for (let i = 1; i < teeth.length; i++) {
    if (s <= teeth[i].s) {
      const f = (s - teeth[i - 1].s) / (teeth[i].s - teeth[i - 1].s);
      return (teeth[i - 1].d + (teeth[i].d - teeth[i - 1].d) * f) / 2;
    }
  }
  return teeth[teeth.length - 1].d / 2;
}

/** Offsets the arch by `inner`..`outer` px beyond the teeth edges (negative = towards the inside). */
function offsetLine(arch: Arch, offset: (half: number) => number): Vec[] {
  return arch.samples.map(({ p, n, s }) => {
    const o = offset(halfDepth(arch, s));
    return [p[0] + n[0] * o, p[1] + n[1] * o];
  });
}

/** A full-arch polyline: the left half mirrored, then the right half. */
function fullLine(right: Vec[]): Vec[] {
  return [...right.map(([x, y]): Vec => [W - x, y]).reverse(), ...right.slice(1)];
}

function polyline(points: Vec[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join(' ');
}

/** A horseshoe band between two offsets, with rounded ends behind the last molars. */
function band(arch: Arch, inner: (half: number) => number, outer: (half: number) => number): string {
  const a = fullLine(offsetLine(arch, outer));
  const b = fullLine(offsetLine(arch, inner)).reverse();
  const end = arch.samples[arch.samples.length - 1];
  const cap = (from: Vec, to: Vec, dir: Vec): string => {
    const reach = Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.7;
    return `Q${pt([(from[0] + to[0]) / 2 + dir[0] * reach, (from[1] + to[1]) / 2 + dir[1] * reach])} ${pt(to)}`;
  };
  const rightCap = cap(a[a.length - 1], b[0], end.t);
  const leftCap = cap(b[b.length - 1], a[0], [-end.t[0], end.t[1]]);
  return `${polyline(a)} ${rightCap} ${polyline(b).replace(/^M/, 'L')} ${leftCap} Z`;
}

function toothPaths(arch: Arch): { body: string; lines: string } {
  const body: string[] = [];
  const lines: string[] = [];
  for (const tooth of arch.teeth) {
    const { p, n, t } = sampleAt(arch, tooth.s);
    const w = tooth.w / 2;
    const d = tooth.d / 2;
    const at = (u: number, v: number): string => pt([p[0] + t[0] * u + n[0] * v, p[1] + t[1] * u + n[1] * v]);
    const r = Math.min(w, d) * (tooth.kind === 'incisor' ? 0.45 : 0.6);
    const path =
      `M${at(-w + r, -d)} L${at(w - r, -d)} Q${at(w, -d)} ${at(w, -d + r)} L${at(w, d - r)} ` +
      `Q${at(w, d)} ${at(w - r, d)} L${at(-w + r, d)} Q${at(-w, d)} ${at(-w, d - r)} L${at(-w, -d + r)} ` +
      `Q${at(-w, -d)} ${at(-w + r, -d)} Z`;
    body.push(path, mirror(path));
    if (tooth.kind !== 'incisor') {
      let line = `M${at(-w * 0.45, 0)} Q${at(0, d * 0.15)} ${at(w * 0.45, 0)}`;
      if (tooth.kind === 'molar') line += ` M${at(0, -d * 0.5)} L${at(0, d * 0.5)}`;
      lines.push(line, mirror(line));
    }
  }
  return { body: body.join(' '), lines: lines.join(' ') };
}

const UPPER = buildArch(
  [
    [150, 58],
    [104, 58],
    [66, 92],
    [64, 172],
  ],
  [150, 150],
  UPPER_TEETH,
  0.9,
);

const LOWER = buildArch(
  [
    [150, 348],
    [104, 348],
    [68, 316],
    [66, 240],
  ],
  [150, 260],
  LOWER_TEETH,
  0.9,
);

const upperTeeth = toothPaths(UPPER);
const lowerTeeth = toothPaths(LOWER);

const closed = (arch: Arch, offset: (half: number) => number) => `${polyline(fullLine(offsetLine(arch, offset)))} Z`;

const gumInner = (h: number) => -h - 4;
const gumOuter = (h: number) => h + 7;
const behindInner = (h: number) => -h - 12;

const INNER_HALF = 'M150,40 C98,40 48,66 26,200 C48,334 98,362 150,362 Z';

const TONGUE = 'M82,262 C80,242 110,236 150,236 C190,236 220,242 218,262 C222,300 194,326 150,326 C106,326 78,300 82,262 Z';

const boca: MouthView = {
  id: 'boca',
  name: 'Boca',
  width: W,
  height: H,
  regions: [
    ...pair('cheek', 'mejilla', ['Mejilla derecha', 'Mejilla izquierda'], INNER_HALF, [40, 205]),
    {
      id: 'labio-sup',
      name: 'Labio superior',
      tone: 'lip',
      d: 'M4,200 C30,50 86,14 150,14 C214,14 270,50 296,200 L274,200 C254,64 204,40 150,40 C96,40 46,64 26,200 Z',
      anchor: [150, 27],
    },
    {
      id: 'labio-inf',
      name: 'Labio inferior',
      tone: 'lip',
      d: 'M4,200 C30,350 86,388 150,388 C214,388 270,350 296,200 L274,200 C254,336 204,362 150,362 C96,362 46,336 26,200 Z',
      anchor: [150, 376],
    },
    { id: 'garganta', name: 'Garganta', tone: 'throat', d: 'M84,180 C84,232 112,250 150,250 C188,250 216,232 216,180 Z', anchor: [126, 218] },
    ...pair('tonsil', 'amigdala', ['Amígdala derecha', 'Amígdala izquierda'], oval(100, 222, 9, 14), [100, 222]),
    { id: 'paladar', name: 'Paladar', tone: 'palate', d: closed(UPPER, () => 0), anchor: [150, 120] },
    {
      id: 'paladar-blando',
      name: 'Paladar blando',
      tone: 'velum',
      d:
        'M74,146 C110,136 190,136 226,146 C228,180 224,214 210,242 C204,214 188,196 164,196 ' +
        'C163,226 137,226 136,196 C112,196 96,214 90,242 C76,214 72,180 74,146 Z',
      anchor: [150, 170],
    },
    { id: 'suelo', name: 'Suelo de la boca', tone: 'floor', d: closed(LOWER, () => 0), anchor: [124, 334] },
    { id: 'centro', name: 'Lengua centro', tone: 'tongue', d: TONGUE, anchor: [150, 274] },
    ...pair(
      'tongue',
      'lado',
      ['Lengua derecha', 'Lengua izquierda'],
      'M82,262 C80,246 94,238 108,237 C100,258 100,284 110,308 C92,298 80,282 82,262 Z',
      [94, 272],
    ),
    {
      id: 'punta',
      name: 'Lengua punta',
      tone: 'tongue',
      d: 'M110,308 C128,300 172,300 190,308 C180,320 166,326 150,326 C134,326 120,320 110,308 Z',
      anchor: [150, 315],
    },
    { id: 'frenillo-lingual', name: 'Frenillo lingual', tone: 'floor', d: 'M147,324 L153,324 L155,338 L145,338 Z', anchor: [150, 332] },
    { id: 'detras-sup', name: 'Detrás dientes superiores', tone: 'gum', d: band(UPPER, behindInner, gumInner), anchor: [150, 76] },
    { id: 'detras-inf', name: 'Detrás dientes inferiores', tone: 'gum', d: band(LOWER, behindInner, gumInner), anchor: [150, 328] },
    { id: 'encia-sup', name: 'Encía superior', tone: 'gum', d: band(UPPER, gumInner, gumOuter), anchor: [150, 47] },
    { id: 'encia-inf', name: 'Encía inferior', tone: 'gum', d: band(LOWER, gumInner, gumOuter), anchor: [150, 354] },
    ...pair(
      'gum',
      'retromolar',
      ['Triángulo retromolar derecho', 'Triángulo retromolar izquierdo'],
      'M56,238 C54,224 60,208 68,204 C76,208 80,224 78,238 C72,244 62,244 56,238 Z',
      [68, 226],
    ),
    { id: 'frenillo-sup', name: 'Frenillo labial superior', tone: 'gum', d: 'M147,30 L153,30 L154,48 L146,48 Z', anchor: [150, 39] },
    { id: 'frenillo-inf', name: 'Frenillo labial inferior', tone: 'gum', d: 'M146,352 L154,352 L153,372 L147,372 Z', anchor: [150, 362] },
  ],
  decor: [
    { className: 'raphe', d: 'M150,92 L150,150 M126,100 C138,108 144,106 150,100 C156,106 162,108 174,100 M118,118 C132,128 142,124 150,118 C158,124 168,128 182,118' },
    { className: 'groove', d: 'M150,256 C148,276 152,294 150,312' },
    { className: 'lip-shine', d: 'M108,24 C130,20 170,20 192,24 M110,377 C132,381 168,381 190,377' },
    { className: 'tooth', d: upperTeeth.body },
    { className: 'tooth', d: lowerTeeth.body },
    { className: 'tooth-line', d: `${upperTeeth.lines} ${lowerTeeth.lines}` },
  ],
};

export const MOUTH_VIEWS: MouthView[] = [boca];

export const MOUTH_VIEW_IDS = MOUTH_VIEWS.map((v) => v.id);

export function viewById(id: string): MouthView | undefined {
  return MOUTH_VIEWS.find((v) => v.id === id);
}

/** Every distinct region name, in view order. */
export const REGION_NAMES = [...new Set(MOUTH_VIEWS.flatMap((v) => v.regions.map((r) => r.name)))];

/**
 * Where to draw a sore that has a location but no point. Only exact region names resolve, so an
 * ambiguous legacy location ("Frenillo") stays unplaced rather than guessed.
 */
export function approximatePoint(location: string): MouthPoint | null {
  for (const view of MOUTH_VIEWS) {
    const region = view.regions.find((r) => r.name === location);
    if (region) return { view: view.id, x: region.anchor[0] / view.width, y: region.anchor[1] / view.height };
  }
  return null;
}
