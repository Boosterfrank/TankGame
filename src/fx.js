// Particles, explosion visuals, beams, floating text and screen shake.
import { rgba } from './util.js';

export class FX {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.fireballs = [];
    this.beams = [];
    this.texts = [];
    this.shake = 0; this.shakeX = 0; this.shakeY = 0;
    this.flash = 0;
    this.time = 0;
  }

  get busy() { return this.parts.length > 30 || this.fireballs.length > 0 || this.beams.length > 0; }

  emit(x, y, vx, vy, life, color, size, opts = {}) {
    this.parts.push({ x, y, vx, vy, life, max: life, color, size, g: opts.g ?? 1, drag: opts.drag ?? 0, add: !!opts.add, grow: opts.grow ?? 0, smoke: !!opts.smoke });
  }

  burst(x, y, n, speed, color, life, size, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s - (opts.up || 0), life * (0.6 + Math.random() * 0.6), color, size * (0.6 + Math.random() * 0.8), opts);
    }
  }

  trail(type, x, y, vx, vy, color) {
    const sp = Math.hypot(vx, vy) || 1;
    const bx = -vx / sp, by = -vy / sp;
    if (type === 'spark') this.emit(x, y, bx * 40 + (Math.random() - 0.5) * 60, by * 40 + (Math.random() - 0.5) * 60, 0.35 + Math.random() * 0.3, color, 1.5 + Math.random() * 1.5, { add: true, g: 0.3 });
    else if (type === 'fire') { this.emit(x, y, bx * 60 + (Math.random() - 0.5) * 40, by * 60 + (Math.random() - 0.5) * 40, 0.3 + Math.random() * 0.25, Math.random() < 0.5 ? '#ffab40' : '#ff5722', 3 + Math.random() * 3, { add: true, g: -0.4, grow: -4 }); if (Math.random() < 0.4) this.emit(x, y, bx * 30, by * 30, 0.9, '#616161', 4, { smoke: true, g: -0.3, grow: 10, drag: 1 }); }
    else if (type === 'smoke') this.emit(x, y, bx * 20 + (Math.random() - 0.5) * 20, by * 20 + (Math.random() - 0.5) * 20, 0.8 + Math.random() * 0.5, '#9e9e9e', 3 + Math.random() * 2, { smoke: true, g: -0.2, grow: 9, drag: 1 });
  }

  explosion(x, y, r, color = '#ffb74d', opts = {}) {
    const big = r >= 70;
    if (opts.dirt) {
      this.burst(x, y, Math.min(60, r), r * 3, '#a1887f', 0.8, 3, { g: 1.2 });
      this.burst(x, y, Math.min(30, r / 2), r * 2, '#6d4c41', 1.0, 4, { g: 1.2 });
      this.rings.push({ x, y, r0: r * 0.3, r1: r * 1.1, life: 0.35, max: 0.35, color: '#bcaaa4', w: 3 });
      return;
    }
    if (opts.heal) {
      for (let i = 0; i < 30; i++) this.emit(x + (Math.random() - 0.5) * r * 1.6, y + (Math.random() - 0.5) * r * 0.8, (Math.random() - 0.5) * 30, -40 - Math.random() * 80, 1 + Math.random() * 0.6, '#69f0ae', 2 + Math.random() * 2, { add: true, g: 0 });
      this.rings.push({ x, y, r0: r * 0.2, r1: r * 1.3, life: 0.6, max: 0.6, color: '#69f0ae', w: 3 });
      return;
    }
    this.fireballs.push({ x, y, r, life: 0.42 + r * 0.002, max: 0.42 + r * 0.002, color });
    this.rings.push({ x, y, r0: r * 0.4, r1: r * 1.9, life: 0.5, max: 0.5, color: '#ffffff', w: 3 });
    const n = Math.max(10, Math.min(70, r * 0.9));
    this.burst(x, y, n, r * 7, Math.random() < 0.5 ? '#ffd54f' : color, 0.7, 2.5, { add: true, g: 1 });
    this.burst(x, y, Math.ceil(n / 3), r * 3.5, '#4fc3f7', 0.9, 3, { g: 1.3 });
    this.burst(x, y, Math.ceil(n / 4), r * 1.5, '#757575', 1.4, r * 0.25, { smoke: true, g: -0.25, grow: r * 0.45, drag: 1.2, up: r * 0.8 });
    this.shake = Math.max(this.shake, Math.min(30, r * 0.25) * (opts.shake ?? 1));
    if (big || opts.mushroom) {
      this.flash = Math.max(this.flash, Math.min(0.75, r / 150));
      for (let i = 0; i < 40; i++) {
        this.emit(x + (Math.random() - 0.5) * r * 0.4, y, (Math.random() - 0.5) * 30, -r * (1.6 + Math.random() * 1.2), 2.2 + Math.random(), i % 3 ? '#8d6e63' : '#ffb74d', r * 0.3, { smoke: true, g: -0.05, grow: r * 0.5, drag: 1.4 });
      }
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        this.emit(x, y - r * 1.2, Math.cos(a) * r * 1.5, -r * 0.6 + Math.sin(a) * r * 0.4, 2.5 + Math.random(), '#ffcc80', r * 0.35, { smoke: true, g: -0.02, grow: r * 0.5, drag: 1.5 });
      }
    }
  }

  beam(x0, y0, x1, y1, w, color, life = 0.5) {
    this.beams.push({ x0, y0, x1, y1, w, color, life, max: life });
    this.shake = Math.max(this.shake, Math.min(14, w));
  }

  text(x, y, str, color = '#fff', size = 22) {
    this.texts.push({ x, y, str, color, size, life: 1.3, max: 1.3, vy: -40 });
  }

  update(dt) {
    this.time += dt;
    const parts = this.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy += 620 * p.g * dt;
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.size = Math.max(0.5, p.size + p.grow * dt);
    }
    for (const list of [this.rings, this.fireballs, this.beams, this.texts]) {
      for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) list.splice(i, 1); }
    }
    for (const t of this.texts) t.y += t.vy * dt;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 40);
      this.shakeX = (Math.random() - 0.5) * this.shake * 2;
      this.shakeY = (Math.random() - 0.5) * this.shake * 2;
    } else { this.shakeX = 0; this.shakeY = 0; }
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  draw(ctx) {
    // beams
    for (const b of this.beams) {
      const a = b.life / b.max;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(b.color, 0.35 * a); ctx.lineWidth = b.w * 2.5 * (0.6 + a * 0.4);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.strokeStyle = rgba(b.color, 0.9 * a); ctx.lineWidth = b.w * (0.5 + a * 0.5);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`; ctx.lineWidth = Math.max(1, b.w * 0.3 * a);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.restore();
    }
    // smoke (normal blend)
    ctx.save();
    for (const p of this.parts) {
      if (!p.smoke) continue;
      const a = (p.life / p.max) * 0.45;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // fireballs + additive sparks
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireballs) {
      const t = 1 - f.life / f.max;
      const r = f.r * (0.5 + t * 0.8);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - t)})`);
      g.addColorStop(0.35, rgba(f.color, 0.8 * (1 - t)));
      g.addColorStop(1, rgba(f.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of this.parts) {
      if (p.smoke) continue;
      const a = p.life / p.max;
      ctx.globalAlpha = p.add ? a : a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      ctx.strokeStyle = rgba(r.color, (1 - t) * 0.7);
      ctx.lineWidth = r.w * (1 - t) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * Math.sqrt(t), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // floating text
    ctx.save();
    ctx.font = 'bold 22px Rajdhani, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / 0.4);
      ctx.globalAlpha = a;
      ctx.font = `bold ${t.size}px Rajdhani, "Arial Narrow", sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }
}
