export interface MouthPoint {
  view: string;
  x: number;
  y: number;
}

export interface MouthRegion {
  id: string;
  name: string;
  d: string;
  /** Stroke-shaped regions (gum bands) are hit by their stroke, not their fill. */
  stroke?: number;
  tone: Tone;
  anchor: [number, number];
}

export interface MouthDecor {
  d: string;
  className: string;
  stroke?: number;
  dash?: string;
}

export interface MouthView {
  id: string;
  name: string;
  width: number;
  height: number;
  regions: MouthRegion[];
  decor: MouthDecor[];
}

export type Tone = 'lip' | 'gum' | 'palate' | 'tongue' | 'floor' | 'cheek';

const W = 300;

/** Mirrors an absolute-coordinate path (M/L/C/Q/Z with "x,y" pairs) across the vertical axis. */
function mirror(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${W - Number(x)},${y}`);
}

function pair(
  base: Omit<MouthRegion, 'id' | 'name' | 'd' | 'anchor'>,
  id: string,
  [right, left]: [string, string],
  d: string,
  anchor: [number, number],
): MouthRegion[] {
  return [
    { ...base, id: `${id}-r`, name: right, d, anchor },
    { ...base, id: `${id}-l`, name: left, d: mirror(d), anchor: [W - anchor[0], anchor[1]] },
  ];
}

/** Center line of a dental arch, incisors at the top. */
const ARCH = 'M72,300 C66,160 92,58 150,52 C208,58 234,160 228,300';
const ARCH_INNER = 'M100,300 C96,172 114,86 150,82 C186,86 204,172 200,300';
const ARCH_FILL = `${ARCH} Z`;

const CHEEK = 'M0,40 C28,60 42,160 46,320 L0,320 Z';

const labios: MouthView = {
  id: 'labios',
  name: 'Labios y encías',
  width: W,
  height: 250,
  regions: [
    { id: 'labio-sup', name: 'Labio superior', tone: 'lip', d: 'M10,60 C60,8 240,8 290,60 L280,90 C200,70 100,70 20,90 Z', anchor: [150, 50] },
    { id: 'encia-sup', name: 'Encía superior', tone: 'gum', d: 'M20,90 C100,70 200,70 280,90 L270,118 C200,102 100,102 30,118 Z', anchor: [150, 92] },
    { id: 'encia-inf', name: 'Encía inferior', tone: 'gum', d: 'M30,170 C100,182 200,182 270,170 L280,195 C200,212 100,212 20,195 Z', anchor: [150, 192] },
    { id: 'labio-inf', name: 'Labio inferior', tone: 'lip', d: 'M20,195 C100,212 200,212 280,195 L290,205 C240,252 60,252 10,205 Z', anchor: [150, 224] },
    { id: 'frenillo-sup', name: 'Frenillo labial superior', tone: 'gum', d: 'M145,52 L155,52 L153,102 L147,102 Z', anchor: [150, 70] },
    { id: 'frenillo-inf', name: 'Frenillo labial inferior', tone: 'gum', d: 'M147,180 L153,180 L155,232 L145,232 Z', anchor: [150, 214] },
  ],
  decor: [
    { className: 'teeth', d: 'M30,118 C100,102 200,102 270,118 L262,138 C200,126 100,126 38,138 Z' },
    { className: 'teeth-gap', d: 'M150,104 L150,127 M118,105 L119,127 M182,105 L181,127 M88,108 L91,130 M212,108 L209,130 M60,113 L64,134 M240,113 L236,134' },
    { className: 'mouth-dark', d: 'M38,138 C100,126 200,126 262,138 L262,150 C200,162 100,162 38,150 Z' },
    { className: 'teeth', d: 'M38,150 C100,162 200,162 262,150 L270,170 C200,184 100,184 30,170 Z' },
    { className: 'teeth-gap', d: 'M150,160 L150,181 M122,160 L121,181 M178,160 L179,181 M94,157 L91,179 M206,157 L209,179 M66,154 L62,175 M234,154 L238,175' },
  ],
};

const paladar: MouthView = {
  id: 'paladar',
  name: 'Paladar',
  width: W,
  height: 330,
  regions: [
    ...pair({ tone: 'cheek' }, 'mejilla', ['Mejilla derecha', 'Mejilla izquierda'], CHEEK, [22, 200]),
    { id: 'labio-sup', name: 'Labio superior', tone: 'lip', d: 'M62,0 L238,0 C220,22 186,30 150,30 C114,30 80,22 62,0 Z', anchor: [150, 14] },
    { id: 'paladar', name: 'Paladar', tone: 'palate', d: ARCH_FILL, anchor: [150, 190] },
    { id: 'paladar-blando', name: 'Paladar blando', tone: 'palate', d: 'M74,296 L226,296 L226,330 L74,330 Z', anchor: [150, 312] },
    { id: 'encia-sup', name: 'Encía superior', tone: 'gum', d: ARCH, stroke: 46, anchor: [150, 40] },
    { id: 'detras-sup', name: 'Detrás dientes superiores', tone: 'gum', d: ARCH_INNER, stroke: 12, anchor: [150, 82] },
  ],
  decor: [
    { className: 'teeth', d: ARCH, stroke: 24, dash: '16 4' },
    { className: 'raphe', d: 'M150,96 L150,280 M128,110 C138,118 144,116 150,112 C156,116 162,118 172,110 M120,130 C134,140 144,136 150,130 C156,136 166,140 180,130' },
    { className: 'uvula', d: 'M140,314 C140,330 160,330 160,314 Z' },
  ],
};

const lengua: MouthView = {
  id: 'lengua',
  name: 'Lengua',
  width: W,
  height: 320,
  regions: [
    { id: 'centro', name: 'Lengua centro', tone: 'tongue', d: 'M66,320 C56,190 70,58 150,38 C230,58 244,190 234,320 Z', anchor: [150, 200] },
    { id: 'punta', name: 'Lengua punta', tone: 'tongue', d: 'M98,92 C112,56 132,40 150,38 C168,40 188,56 202,92 C182,82 118,82 98,92 Z', anchor: [150, 66] },
    ...pair(
      { tone: 'tongue' },
      'lado',
      ['Lengua derecha', 'Lengua izquierda'],
      'M66,320 C56,190 70,112 98,92 C108,88 112,92 108,102 C92,150 92,240 98,320 Z',
      [84, 200],
    ),
  ],
  decor: [{ className: 'groove', d: 'M150,96 C148,160 152,230 150,290' }],
};

const inferior: MouthView = {
  id: 'inferior',
  name: 'Abajo',
  width: W,
  height: 330,
  regions: [
    ...pair({ tone: 'cheek' }, 'mejilla', ['Mejilla derecha', 'Mejilla izquierda'], CHEEK, [22, 200]),
    { id: 'labio-inf', name: 'Labio inferior', tone: 'lip', d: 'M62,0 L238,0 C220,22 186,30 150,30 C114,30 80,22 62,0 Z', anchor: [150, 14] },
    { id: 'suelo', name: 'Suelo de la boca', tone: 'floor', d: ARCH_FILL, anchor: [116, 150] },
    { id: 'encia-inf', name: 'Encía inferior', tone: 'gum', d: ARCH, stroke: 46, anchor: [150, 40] },
    { id: 'detras-inf', name: 'Detrás dientes inferiores', tone: 'gum', d: ARCH_INNER, stroke: 12, anchor: [150, 82] },
    { id: 'lengua-debajo', name: 'Debajo de la lengua', tone: 'tongue', d: 'M104,320 C100,250 122,206 150,204 C178,206 200,250 196,320 Z', anchor: [150, 262] },
    { id: 'frenillo-lingual', name: 'Frenillo lingual', tone: 'floor', d: 'M146,100 L154,100 L156,210 L144,210 Z', anchor: [150, 150] },
    ...pair(
      { tone: 'gum' },
      'retromolar',
      ['Triángulo retromolar derecho', 'Triángulo retromolar izquierdo'],
      'M54,300 L92,300 L80,330 L64,330 Z',
      [72, 312],
    ),
  ],
  decor: [{ className: 'teeth', d: ARCH, stroke: 24, dash: '16 4' }],
};

export const MOUTH_VIEWS: MouthView[] = [labios, paladar, lengua, inferior];

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
