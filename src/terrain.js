// Destructible terrain: a Uint8 solidity mask (source of truth for physics) kept in sync with
// an offscreen mask canvas. Rendering layers (glow, body with depth shading) are rebuilt only
// in dirty rectangles, so volleys of craters stay cheap.
import { generateHeights } from './terrain-gen.js';

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const PAL = {
  top: '#dffbff',
  band1: '#8eecff',
  band2: '#4fd8ff',
  grad: ['#3ccdf7', '#22aeea', '#1587c9', '#0d5f9c', '#083f6d'],
  shade: '#02213f',
  glow: '#39d0ff',
};

export class Terrain {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.mask = new Uint8Array(w * h);
    this.canvas = offscreen(w, h);      // alpha mask of solid terrain
    this.mctx = this.canvas.getContext('2d');
    this.body = offscreen(w, h);        // shaded render
    this.bctx = this.body.getContext('2d');
    this.tmp = offscreen(w, h);
    this.tctx = this.tmp.getContext('2d');
    this.glowScale = 4;
    this.glow = offscreen(Math.ceil(w / this.glowScale), Math.ceil(h / this.glowScale));
    this.gctx = this.glow.getContext('2d');
    this.dirtyRect = null;   // {x0,y0,x1,y1}
    this.glowDirty = true;
    this.glowTimer = 0;
    this.heights = null;
    this.styleId = 'random';
  }

  generate(styleId, seed) {
    const { heights, style } = generateHeights(styleId, seed, this.w, this.h);
    this.heights = heights; this.styleId = style;
    const { w, h, mask } = this;
    mask.fill(0);
    const m = this.mctx;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, w, h);
    m.fillStyle = '#fff';
    m.beginPath();
    m.moveTo(0, h);
    for (let x = 0; x < w; x++) {
      const top = Math.round(heights[x]);
      for (let y = top; y < h; y++) mask[y * w + x] = 1;
      m.lineTo(x, top);
    }
    m.lineTo(w, h);
    m.closePath();
    m.fill();
    this.markDirty(0, 0, w, h);
  }

  solid(x, y) {
    x |= 0; y |= 0;
    if (y >= this.h) return true;
    if (y < 0 || x < 0 || x >= this.w) return false;
    return this.mask[y * this.w + x] === 1;
  }

  // First solid y at column x scanning downward from fromY.
  surfaceY(x, fromY = 0) {
    x |= 0;
    if (x < 0 || x >= this.w) return this.h;
    const w = this.w;
    for (let y = Math.max(0, fromY | 0); y < this.h; y++) if (this.mask[y * w + x]) return y;
    return this.h;
  }

  // Scan upward from y to find air (used to unbury things). Returns y of first air cell or -1.
  airAbove(x, y, maxUp = 140) {
    x |= 0;
    for (let yy = y | 0; yy >= Math.max(0, y - maxUp); yy--) if (!this.solid(x, yy)) return yy;
    return -1;
  }

  markDirty(x0, y0, x1, y1) {
    const r = this.dirtyRect;
    if (!r) this.dirtyRect = { x0, y0, x1, y1 };
    else { r.x0 = Math.min(r.x0, x0); r.y0 = Math.min(r.y0, y0); r.x1 = Math.max(r.x1, x1); r.y1 = Math.max(r.y1, y1); }
    this.glowDirty = true;
  }

  carve(cx, cy, r) { this._circle(cx, cy, r, 0); }
  fill(cx, cy, r) { this._circle(cx, cy, r, 1); }

  _circle(cx, cy, r, value) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (r <= 0) return;
    const { w, h, mask } = this;
    const x0 = Math.max(0, cx - r), x1 = Math.min(w - 1, cx + r);
    const y0 = Math.max(0, cy - r), y1 = Math.min(h - 1, cy + r);
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= r2) mask[row + x] = value;
      }
    }
    const m = this.mctx;
    m.globalCompositeOperation = value ? 'source-over' : 'destination-out';
    m.fillStyle = '#fff';
    m.beginPath();
    m.arc(cx, cy, r, 0, Math.PI * 2);
    m.fill();
    m.globalCompositeOperation = 'source-over';
    this.markDirty(x0 - 2, y0 - 2, x1 + 3, y1 + 3);
  }

  // Carve a thick line (lasers, tunnels).
  carveLine(x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / Math.max(2, r * 0.6)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.carve(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r);
    }
  }

  // Approximate surface normal at a point (points away from solid mass).
  normalAt(x, y) {
    let nx = 0, ny = 0;
    for (let dy = -4; dy <= 4; dy += 2) {
      for (let dx = -4; dx <= 4; dx += 2) {
        if (this.solid(x + dx, y + dy)) { nx -= dx; ny -= dy; }
      }
    }
    const l = Math.hypot(nx, ny);
    if (l < 0.001) return { x: 0, y: -1 };
    return { x: nx / l, y: ny / l };
  }

  // Raymarch from (x,y) along (dx,dy) until solid or out of range. Returns end point.
  raycast(x, y, dx, dy, maxLen, step = 2) {
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    let t = 0;
    while (t < maxLen) {
      const px = x + dx * t, py = y + dy * t;
      if (px < -50 || px > this.w + 50 || py < -400) break;
      if (this.solid(px, py)) return { x: px, y: py, hit: true, t };
      t += step;
    }
    return { x: x + dx * t, y: y + dy * t, hit: false, t };
  }

  // Mask tinted with a flat color, computed only inside rect.
  _tinted(color, rect) {
    const t = this.tctx;
    const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
    t.save();
    t.beginPath(); t.rect(rect.x0, rect.y0, rw, rh); t.clip();
    t.globalCompositeOperation = 'source-over';
    t.clearRect(rect.x0, rect.y0, rw, rh);
    t.drawImage(this.canvas, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(rect.x0, rect.y0, rw, rh);
    t.restore();
    return this.tmp;
  }

  // A strip of the given thickness just below every surface (mask minus mask shifted down), tinted.
  _strip(offset, color, rect) {
    const t = this.tctx;
    const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
    t.save();
    t.beginPath(); t.rect(rect.x0, rect.y0, rw, rh); t.clip();
    t.globalCompositeOperation = 'source-over';
    t.clearRect(rect.x0, rect.y0, rw, rh);
    t.drawImage(this.canvas, 0, 0);
    t.globalCompositeOperation = 'destination-out';
    t.drawImage(this.canvas, 0, offset);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(rect.x0, rect.y0, rw, rh);
    t.restore();
    return this.tmp;
  }

  rebuild() {
    const r = this.dirtyRect;
    if (!r) return;
    const pad = 124; // must cover the largest vertical shift used below
    const rect = {
      x0: Math.max(0, r.x0 - pad), y0: Math.max(0, r.y0 - pad),
      x1: Math.min(this.w, r.x1 + pad), y1: Math.min(this.h, r.y1 + pad),
    };
    this.dirtyRect = null;
    const b = this.bctx;
    const { h } = this;
    const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
    b.save();
    b.beginPath(); b.rect(rect.x0, rect.y0, rw, rh); b.clip();
    b.globalCompositeOperation = 'source-over';
    b.clearRect(rect.x0, rect.y0, rw, rh);
    // Base vertical gradient, masked to solid terrain.
    const g = b.createLinearGradient(0, 0, 0, h);
    PAL.grad.forEach((c, i) => g.addColorStop(i / (PAL.grad.length - 1), c));
    b.fillStyle = g;
    b.fillRect(rect.x0, rect.y0, rw, rh);
    b.globalCompositeOperation = 'destination-in';
    b.drawImage(this.canvas, 0, 0);
    // Depth shading: darken everything further than N px below a surface (shifted mask copies).
    b.globalCompositeOperation = 'source-atop';
    const shade = this._tinted(PAL.shade, rect);
    b.globalAlpha = 0.2; b.drawImage(shade, 0, 22);
    b.globalAlpha = 0.2; b.drawImage(shade, 0, 56);
    b.globalAlpha = 0.16; b.drawImage(shade, 0, 112);
    // Bright bands hugging every surface.
    for (const [off, color, alpha] of [[34, PAL.band2, 0.28], [14, PAL.band1, 0.5], [5, PAL.top, 0.92]]) {
      const strip = this._strip(off, color, rect);
      b.globalAlpha = alpha; b.drawImage(strip, 0, 0);
    }
    b.globalAlpha = 1;
    b.restore();
  }

  rebuildGlow() {
    const g = this.gctx, s = this.glowScale;
    g.save();
    g.clearRect(0, 0, this.glow.width, this.glow.height);
    g.globalCompositeOperation = 'source-over';
    g.shadowColor = PAL.glow;
    g.shadowBlur = 9;
    g.globalAlpha = 0.85;
    // Draw the mask offscreen (outside the canvas) so only its shadow lands on it.
    g.drawImage(this.canvas, -this.glow.width * 2, 0, this.glow.width, this.glow.height);
    g.shadowOffsetX = this.glow.width * 2;
    g.drawImage(this.canvas, -this.glow.width * 2, 0, this.glow.width, this.glow.height);
    g.restore();
    this.glowDirty = false;
  }

  update(dt) {
    this.glowTimer -= dt;
    if (this.glowDirty && this.glowTimer <= 0) { this.rebuildGlow(); this.glowTimer = 0.12; }
    if (this.dirtyRect) this.rebuild();
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.glow, 0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.body, 0, 0);
    ctx.restore();
  }

  // Thumbnail of the current heightmap for lobby previews.
  static drawPreview(ctx, heights, w, h, pw, ph, spawns = []) {
    ctx.clearRect(0, 0, pw, ph);
    const g = ctx.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, '#5fe3ff'); g.addColorStop(1, '#0b4f85');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, ph);
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.floor((x / pw) * w));
      ctx.lineTo(x, (heights[sx] / h) * ph);
    }
    ctx.lineTo(pw, ph);
    ctx.closePath();
    ctx.shadowColor = '#39d0ff'; ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe66d';
    for (const sx of spawns) {
      const px = (sx / w) * pw, py = (heights[Math.min(w - 1, sx | 0)] / h) * ph;
      ctx.beginPath(); ctx.arc(px, py - 3, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}
