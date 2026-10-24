// Pure heightmap generation (no DOM) so it can be unit-tested and used for lobby previews.
import { RNG, clamp, lerp, smoothstep } from './util.js';

export const MAP_STYLES = [
  { id: 'random', name: 'Random Map', desc: 'A surprise every game.' },
  { id: 'hills', name: 'Rolling Hills', desc: 'Gentle slopes, open sightlines.' },
  { id: 'peaks', name: 'High Peaks', desc: 'Jagged mountains block direct shots.' },
  { id: 'skyline', name: 'Skyline', desc: 'Towering pillars and deep gaps.' },
  { id: 'canyon', name: 'The Canyon', desc: 'High walls, low valley floor.' },
  { id: 'nest', name: "Sniper's Nest", desc: 'Two fortified cliffs, a bumpy valley between.' },
  { id: 'flats', name: 'Flatlands', desc: 'Nowhere to hide.' },
  { id: 'crater', name: 'Crater Lake', desc: 'One enormous bowl.' },
  { id: 'pits', name: 'Pitfalls', desc: 'Flat ground riddled with deep pits.' },
  { id: 'mesa', name: 'Mesa', desc: 'Stepped plateaus and sheer cliffs.' },
];

function makeNoise(rng, period) {
  const pts = [];
  for (let i = 0; i < 64; i++) pts.push(rng.range(-1, 1));
  return (x) => {
    const t = x / period;
    const i = Math.floor(t);
    const f = smoothstep(t - i);
    const a = pts[((i % 64) + 64) % 64], b = pts[(((i + 1) % 64) + 64) % 64];
    return lerp(a, b, f);
  };
}

function octaves(rng, periods, weights) {
  const fns = periods.map((p) => makeNoise(rng, p));
  return (x) => fns.reduce((s, f, i) => s + f(x) * weights[i], 0);
}

export function generateHeights(styleId, seed, w, h) {
  const rng = new RNG(seed);
  if (styleId === 'random' || !MAP_STYLES.some((m) => m.id === styleId)) {
    const pool = MAP_STYLES.filter((m) => m.id !== 'random');
    styleId = rng.pick(pool).id;
  }
  const H = new Float32Array(w);
  const base = h * 0.6;
  switch (styleId) {
    case 'hills': {
      const n = octaves(rng, [420, 190, 90, 45], [1, 0.5, 0.22, 0.1]);
      for (let x = 0; x < w; x++) H[x] = base + n(x) * 190;
      break;
    }
    case 'peaks': {
      const n = octaves(rng, [520, 240, 110], [1, 0.5, 0.25]);
      const m = octaves(rng, [160, 70], [1, 0.4]);
      for (let x = 0; x < w; x++) {
        const ridge = 1 - Math.abs(n(x));
        H[x] = h * 0.78 - ridge * 420 + m(x) * 40;
      }
      break;
    }
    case 'skyline': {
      let x = 0;
      let last = base;
      while (x < w) {
        const width = rng.int(50, 230);
        let top = clamp(base + rng.range(-330, 260), 90, h - 60);
        if (rng.chance(0.25)) top = clamp(last + rng.range(-120, 120), 90, h - 60);
        const slope = rng.chance(0.3) ? rng.range(-0.25, 0.25) : 0;
        for (let i = 0; i < width && x + i < w; i++) H[x + i] = top + slope * i;
        last = top;
        x += width;
      }
      break;
    }
    case 'canyon': {
      const n = octaves(rng, [300, 120, 50], [1, 0.4, 0.15]);
      for (let x = 0; x < w; x++) {
        const t = x / w;
        const edge = Math.min(smoothstep(clamp(t / 0.3, 0, 1)), smoothstep(clamp((1 - t) / 0.3, 0, 1)));
        H[x] = lerp(h * 0.32, h * 0.76, edge) + n(x) * 45;
      }
      break;
    }
    case 'nest': {
      const n = octaves(rng, [140, 60], [1, 0.4]);
      for (let x = 0; x < w; x++) {
        const t = x / w;
        let y;
        if (t < 0.17) y = h * 0.3 + n(x) * 12;
        else if (t > 0.83) y = h * 0.3 + n(x) * 12;
        else {
          const inner = Math.min(smoothstep(clamp((t - 0.17) / 0.08, 0, 1)), smoothstep(clamp((0.83 - t) / 0.08, 0, 1)));
          y = lerp(h * 0.3, h * 0.7, inner) + n(x) * 55 * inner;
        }
        H[x] = y;
      }
      // a few small spires in the valley
      const spires = rng.int(1, 3);
      for (let s = 0; s < spires; s++) {
        const cx = rng.int(w * 0.3, w * 0.7), hw = rng.int(14, 40), top = h * 0.7 - rng.range(120, 260);
        for (let x = cx - hw; x < cx + hw; x++) if (x >= 0 && x < w) H[x] = Math.min(H[x], top);
      }
      break;
    }
    case 'flats': {
      const n = octaves(rng, [600, 150], [1, 0.3]);
      for (let x = 0; x < w; x++) H[x] = h * 0.64 + n(x) * 28;
      break;
    }
    case 'crater': {
      const n = octaves(rng, [220, 80], [1, 0.4]);
      const cx = w * rng.range(0.4, 0.6);
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x - cx) / (w * 0.5);
        H[x] = lerp(h * 0.8, h * 0.36, smoothstep(clamp(d, 0, 1))) + n(x) * 35;
      }
      break;
    }
    case 'pits': {
      const n = octaves(rng, [500, 120], [1, 0.3]);
      for (let x = 0; x < w; x++) H[x] = h * 0.58 + n(x) * 30;
      const pits = rng.int(3, 6);
      for (let p = 0; p < pits; p++) {
        const cx = rng.int(80, w - 80), hw = rng.int(22, 55), depth = rng.range(h * 0.82, h * 0.94);
        for (let x = cx - hw; x < cx + hw; x++) if (x >= 0 && x < w) H[x] = Math.max(H[x], depth);
      }
      break;
    }
    case 'mesa': {
      const n = octaves(rng, [380, 160], [1, 0.5]);
      const step = h * 0.13;
      for (let x = 0; x < w; x++) {
        const raw = base + n(x) * 260;
        H[x] = Math.round(raw / step) * step;
      }
      // soften cliff edges by a couple of pixels
      for (let x = 1; x < w - 1; x++) if (Math.abs(H[x + 1] - H[x - 1]) > step * 0.5) H[x] = (H[x - 1] + H[x + 1]) / 2;
      break;
    }
  }
  for (let x = 0; x < w; x++) H[x] = clamp(H[x], 70, h - 40);
  return { heights: H, style: styleId };
}

// Evenly spaced spawn columns with jitter.
export function spawnColumns(n, w, rng) {
  const margin = 110;
  const spacing = (w - margin * 2) / n;
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(Math.round(margin + spacing * (i + 0.5) + rng.range(-spacing * 0.22, spacing * 0.22)));
  return rng.shuffle(xs);
}
