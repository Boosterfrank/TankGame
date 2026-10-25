// World rendering: background, terrain, tanks, projectiles, effects and in-world overlays.
import { WORLD_W, WORLD_H, COLORS, PHYS } from './config.js';
import { rgba, fmtTime, rad, RNG, hexToRgb } from './util.js';
import { getWeapon } from './weapons.js';
import { normSpec } from './projectile.js';
import { drawTankSprite } from './tanksprite.js';
import { titleName } from './cosmetics.js';

const THEMES = [
  ['#6a1b9a', '#b71c1c', '#f9a825', '#1a237e', '#4a148c'],
  ['#006064', '#1a237e', '#4a148c', '#00695c', '#0d47a1'],
  ['#bf360c', '#880e4f', '#4a148c', '#ff6f00', '#6a1b9a'],
  ['#1b5e20', '#006064', '#311b92', '#00897b', '#01579b'],
];

function shade(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1; this.dpr = 1;
    this.bg = null; this.bgSeed = null;
    this.vignette = null;
    this.banner = null;
    this.time = 0;
    this.motes = null;
    this.shooting = []; this.shootT = 1.5;
    this.fade = 0; this.fadeTarget = 0; this.fadeRate = 1;
    this.makeVignette();
  }

  resize(scale, dpr) {
    this.scale = scale; this.dpr = dpr;
    const w = Math.max(1, Math.round(WORLD_W * scale * dpr));
    const h = Math.max(1, Math.round(WORLD_H * scale * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  makeVignette() {
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = WORLD_H;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.45, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = g; x.fillRect(0, 0, WORLD_W, WORLD_H);
    this.vignette = c;
  }

  // Subdued, smoky sky: dark desaturated gradient, low-poly mountain silhouettes, faint stars.
  makeBackground(seed) {
    if (this.bgSeed === seed && this.bg) return;
    this.bgSeed = seed;
    const rng = new RNG(seed * 7919 + 13);
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = WORLD_H;
    const x = c.getContext('2d');
    const hue = rng.pick([205, 212, 198, 224]);
    const g = x.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, `hsl(${hue}, 18%, 5%)`); g.addColorStop(0.55, `hsl(${hue}, 16%, 10%)`); g.addColorStop(1, `hsl(${hue}, 14%, 8%)`);
    x.fillStyle = g; x.fillRect(0, 0, WORLD_W, WORLD_H);
    for (let i = 0; i < 90; i++) {
      x.fillStyle = `rgba(255,255,255,${rng.range(0.08, 0.35)})`;
      x.beginPath(); x.arc(rng.range(0, WORLD_W), rng.range(0, WORLD_H * 0.8), rng.range(0.4, 1.3), 0, Math.PI * 2); x.fill();
    }
    for (let layer = 0; layer < 3; layer++) {
      const baseY = WORLD_H * (0.4 + layer * 0.14);
      const amp = 320 - layer * 70;
      x.fillStyle = `hsla(${hue}, ${22 + layer * 4}%, ${13 + layer * 4}%, ${0.55 - layer * 0.1})`;
      x.beginPath(); x.moveTo(-220, WORLD_H + 10);
      let px = -220;
      x.lineTo(px, baseY);
      while (px < WORLD_W + 220) {
        const w = rng.range(170, 440);
        const peakY = baseY - rng.range(amp * 0.25, amp);
        x.lineTo(px + w * rng.range(0.35, 0.65), peakY);
        px += w;
        x.lineTo(px, baseY + rng.range(-30, 40));
      }
      x.lineTo(WORLD_W + 220, WORLD_H + 10);
      x.closePath(); x.fill();
    }
    const hz = x.createRadialGradient(WORLD_W / 2, WORLD_H * 0.92, 50, WORLD_W / 2, WORLD_H * 0.92, WORLD_W * 0.7);
    hz.addColorStop(0, `hsla(${hue}, 45%, 35%, 0.16)`); hz.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hz; x.fillRect(0, 0, WORLD_W, WORLD_H);
    x.globalAlpha = 0.04;
    for (let i = 0; i < 3000; i++) { x.fillStyle = rng.chance(0.5) ? '#000' : '#fff'; x.fillRect(rng.range(0, WORLD_W), rng.range(0, WORLD_H), 2, 2); }
    x.globalAlpha = 1;
    this.bg = c;
    if (!this.fog) this.makeFog();
  }

  // Two seamless fog tiles that drift at different speeds.
  makeFog() {
    this.fog = [0, 1].map((i) => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const x = c.getContext('2d');
      const rng = new RNG(99 + i * 7);
      for (let k = 0; k < 16; k++) {
        const cx = rng.range(0, 1024), cy = rng.range(60, 452), r = rng.range(120, 300);
        const a = rng.range(0.05, 0.11);
        for (const off of [0, cx < 512 ? 1024 : -1024]) {
          const g = x.createRadialGradient(cx + off, cy, 0, cx + off, cy, r);
          g.addColorStop(0, `rgba(170,185,200,${a})`); g.addColorStop(1, 'rgba(170,185,200,0)');
          x.fillStyle = g; x.fillRect(cx - r + off, cy - r, r * 2, r * 2);
        }
      }
      return c;
    });
  }

  // Background plus drifting fog, optionally offset/scaled (menu parallax, intro camera).
  drawSky(ctx, t, ox = 0, oy = 0, scale = 1) {
    ctx.drawImage(this.bg, ox, oy, WORLD_W * scale, WORLD_H * scale);
    if (!this.fog) this.makeFog();
    ctx.save();
    ctx.globalAlpha = 0.55;
    const layers = [{ img: this.fog[0], speed: 10, y: -80, h: 640, sx: 2.0 }, { img: this.fog[1], speed: 19, y: 180, h: 560, sx: 2.2 }];
    for (const L of layers) {
      const w = 1024 * L.sx * scale;
      const shift = (((t * L.speed) % w) + w) % w;
      for (let k = -1; k <= Math.ceil((WORLD_W * scale) / w); k++) ctx.drawImage(L.img, ox + k * w - shift, oy + L.y * scale, w, L.h * scale);
    }
    ctx.restore();
  }

  // Black overlay used for scene transitions (0 = clear, 1 = black).
  fadeTo(target, duration = 1) { this.fadeTarget = target; this.fadeRate = Math.abs(target - this.fade) / Math.max(0.05, duration); }
  updateFade(dt) {
    if (this.fade === this.fadeTarget) return;
    const d = this.fadeTarget - this.fade, step = this.fadeRate * dt;
    this.fade = Math.abs(d) <= step ? this.fadeTarget : this.fade + Math.sign(d) * step;
  }
  drawFade(ctx) {
    if (this.fade <= 0.001) return;
    ctx.save();
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
    ctx.globalAlpha = Math.min(1, this.fade);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
    return ctx;
  }

  drawMenu(t, dt = 1 / 60, opts = {}) {
    const ctx = this.begin();
    this.makeBackground(this.bgSeed ?? 42);
    // slow parallax drift of the nebula
    const ox = -24 + Math.sin(t * 0.07) * 20, oy = -14 + Math.cos(t * 0.05) * 12;
    this.drawSky(ctx, t, ox, oy, 1.04);
    if (opts.music) this.drawBassPulse(ctx, opts.music);
    // slow drifting sheen
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const x = (t * 40) % (WORLD_W + 600) - 300;
    const g = ctx.createLinearGradient(x, 0, x + 300, 0);
    g.addColorStop(0, 'rgba(80,160,255,0)'); g.addColorStop(0.5, 'rgba(80,160,255,0.05)'); g.addColorStop(1, 'rgba(80,160,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, 300, WORLD_H);
    ctx.restore();
    this.drawAmbient(ctx, t, dt, opts.music);
    ctx.drawImage(this.vignette, 0, 0);
    this.drawFade(ctx);
  }

  // Nebula brightens with the music's bass.
  drawBassPulse(ctx, music) {
    if (!music.active || music.bass < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.14, music.bass * 0.16);
    ctx.drawImage(this.bg, 0, 0);
    ctx.restore();
  }

  // Floating motes, occasional shooting stars and the music visualizer.
  drawAmbient(ctx, t, dt, music) {
    if (!this.motes) {
      this.motes = [];
      for (let i = 0; i < 70; i++) this.motes.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, vx: 6 + Math.random() * 14, vy: -8 - Math.random() * 16, s: 0.8 + Math.random() * 1.8, ph: Math.random() * 6.28 });
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y < -10) { m.y = WORLD_H + 10; m.x = Math.random() * WORLD_W; }
      if (m.x > WORLD_W + 10) m.x = -10;
      const a = 0.18 + 0.18 * Math.sin(t * 1.3 + m.ph);
      ctx.fillStyle = `rgba(160,220,255,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2); ctx.fill();
    }
    this.shootT -= dt;
    if (this.shootT <= 0) {
      this.shootT = 2.5 + Math.random() * 6;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.shooting.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H * 0.35, vx: dir * (900 + Math.random() * 600), vy: 350 + Math.random() * 300, life: 0.55, max: 0.55 });
    }
    for (let i = this.shooting.length - 1; i >= 0; i--) {
      const s = this.shooting[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) { this.shooting.splice(i, 1); continue; }
      const a = Math.min(1, s.life / 0.2) * 0.9;
      const tx = s.x - s.vx * 0.11, ty = s.y - s.vy * 0.11;
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
    }
    ctx.restore();
    if (music) this.drawVisualizer(ctx, music, t);
  }

  // Spectrum bars along the bottom edge plus a soft glow that follows the music.
  drawVisualizer(ctx, music, t) {
    if (!music.active) return;
    const data = music.data;
    const n = 56, bw = WORLD_W / n;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createLinearGradient(0, WORLD_H - 260, 0, WORLD_H);
    glow.addColorStop(0, 'rgba(57,208,255,0)'); glow.addColorStop(1, `rgba(57,208,255,${0.05 + music.level * 0.25})`);
    ctx.fillStyle = glow; ctx.fillRect(0, WORLD_H - 260, WORLD_W, 260);
    for (let i = 0; i < n; i++) {
      const v = data[i + 1] / 255;
      const h = 3 + v * v * 240 * (1 + music.bass * 0.35);
      const hue = 188 + (i / n) * 120;
      const x = i * bw + 3, w = bw - 6;
      const g = ctx.createLinearGradient(0, WORLD_H - h, 0, WORLD_H);
      g.addColorStop(0, `hsla(${hue}, 100%, 72%, 0.85)`); g.addColorStop(1, `hsla(${hue}, 100%, 55%, 0.08)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, WORLD_H - h, w, h);
      ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.95)`;
      ctx.fillRect(x, WORLD_H - h - 3, w, 3);
    }
    ctx.restore();
  }

  drawAttractOverlay(ctx, t, dt, music) {
    ctx.fillStyle = 'rgba(3,5,10,0.5)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    this.drawAmbient(ctx, t, dt, music);
    ctx.drawImage(this.vignette, 0, 0);
  }

  relationColor(game, t) {
    const v = game.viewer;
    if (!v) return COLORS.enemy;
    if (t === v) return COLORS.self;
    if (t.team === v.team) return COLORS.ally;
    return COLORS.enemy;
  }

  drawGame(game, t, dt, opts = {}) {
    const ctx = this.begin();
    this.time = t;
    this.makeBackground(game.seed);
    ctx.save();
    ctx.translate(game.fx.shakeX, game.fx.shakeY);
    this.drawSky(ctx, t);
    if (opts.music) this.drawBassPulse(ctx, opts.music);
    // tracers
    if (game.settings.tracers) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (const path of game.tracers.values()) {
        for (let i = 0; i < path.length; i += 2) { ctx.beginPath(); ctx.arc(path[i], path[i + 1], 1.5, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    game.terrain.draw(ctx);
    for (const c of game.crates) this.drawCrate(ctx, c, t);
    for (const tank of game.tanks) {
      if (tank.recoil) tank.recoil = Math.max(0, tank.recoil - dt * 5);
      this.drawTank(ctx, tank, game, t);
    }
    for (const p of game.projectiles) p.draw(ctx);
    game.fx.draw(ctx);
    for (const m of game.markers) {
      const p = 0.5 + 0.5 * Math.sin(t * 12);
      ctx.strokeStyle = rgba(m.color || '#ffd180', 0.5 + p * 0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 14 + p * 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x - 24, m.y); ctx.lineTo(m.x + 24, m.y); ctx.moveTo(m.x, m.y - 24); ctx.lineTo(m.x, m.y + 24); ctx.stroke();
    }
    if (!opts.attract) {
      for (const tank of game.tanks) if (tank.alive) this.drawTag(ctx, tank, game, t);
      const cur = game.current;
      if (game.phase === 'aim' && cur && !cur.locked && !game.waitingPass) this.drawAim(ctx, cur, game, t);
      if (game.dev?.revealAims) for (const tk of game.tanks) if (tk.isBot && tk.alive && tk.shot) this.drawTrajectory(ctx, tk, tk.shot, game, 'rgba(255,82,82,0.8)');
      if (game.dev?.hitboxes || game.dev?.debug) this.drawDebug(ctx, game);
    }
    ctx.restore();
    if (opts.attract) { this.drawAttractOverlay(ctx, t, dt, opts.music); this.drawFade(ctx); return; }
    this.drawOverlay(ctx, game, t);
    this.drawFade(ctx);
  }

  drawTrajectory(ctx, tk, shot, game, color) {
    const w = getWeapon(shot.weaponId, tk.tier(shot.weaponId));
    if (!w) return;
    const spec = normSpec(w.spec);
    const tip = tk.barrelTip();
    const a = rad(shot.angle);
    ctx.save();
    ctx.fillStyle = color;
    if (spec.laser) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + Math.cos(a) * 2000, tip.y - Math.sin(a) * 2000); ctx.stroke();
    } else {
      const v = shot.power * PHYS.launchSpeed * spec.speed;
      let x = tip.x, y = tip.y, vx = Math.cos(a) * v, vy = -Math.sin(a) * v;
      const dt = 1 / 30;
      for (let i = 0; i < 240; i++) {
        vy += PHYS.gravity * spec.g * dt; vx += game.wind * PHYS.windAccel * spec.wind * dt;
        x += vx * dt; y += vy * dt;
        if (game.terrain.solid(x, y) || y > WORLD_H || x < -50 || x > WORLD_W + 50) break;
        if (i % 2 === 0) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.restore();
  }

  drawDebug(ctx, game) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const tk of game.tanks) {
      if (!tk.alive) continue;
      ctx.strokeStyle = 'rgba(0,255,120,0.8)';
      ctx.beginPath(); ctx.arc(tk.x, tk.cy, PHYS.tankRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#0f0'; ctx.fillRect(tk.x - 1, tk.y - 1, 3, 3);
    }
    for (const p of game.projectiles) {
      ctx.strokeStyle = 'rgba(255,255,0,0.8)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.spec.r + 1, 0, Math.PI * 2); ctx.stroke();
      if (p.spec.boom?.r) { ctx.strokeStyle = 'rgba(255,120,0,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.spec.boom.r, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const c of game.crates) { ctx.strokeStyle = 'rgba(255,215,0,0.8)'; ctx.strokeRect(c.x - 28, c.y - 34, 56, 68); }
    if (game.dev?.debug) {
      ctx.font = '12px monospace'; ctx.fillStyle = '#9f9';
      for (const tk of game.tanks) if (tk.alive) ctx.fillText(`${Math.round(tk.x)},${Math.round(tk.y)} hp${Math.round(tk.hp)}${tk.shot ? ` ${tk.shot.weaponId} ${Math.round(tk.shot.angle)}°/${Math.round(tk.shot.power)}` : ''}`, tk.x + 20, tk.y - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, WORLD_H - 70, 420, 60);
      ctx.fillStyle = '#9f9';
      ctx.fillText(`phase ${game.phase}  round ${game.round}  wind ${game.wind}  t ${game.time.toFixed(2)}`, 18, WORLD_H - 50);
      ctx.fillText(`projectiles ${game.projectiles.length}  queued ${game.spawnQueue.length}  parts ${game.fx.parts.length}  dirty ${game.terrain.dirtyRect ? 'yes' : 'no'}`, 18, WORLD_H - 32);
      ctx.fillText(`seed ${game.seed}  map ${game.terrain.styleId}  online ${game.online ? (game.online.isHost ? 'host' : 'guest') : 'no'}`, 18, WORLD_H - 14);
    }
    ctx.restore();
  }

  drawCrate(ctx, c, t) {
    ctx.save();
    const dropping = c.landed && c.drop < 1;
    const ease = 1 - Math.pow(1 - c.drop, 2);
    ctx.translate(c.x, dropping ? c.y - 460 * (1 - ease) : c.y);
    if (dropping) {
      const sway = Math.sin(t * 2 + c.x) * 0.08;
      ctx.rotate(sway);
      ctx.fillStyle = c.type === 'weapon' ? 'rgba(255,183,77,0.85)' : 'rgba(105,240,174,0.85)';
      ctx.beginPath(); ctx.arc(0, -40, 26, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-26, -40); ctx.lineTo(-10, -12); ctx.moveTo(26, -40); ctx.lineTo(10, -12); ctx.moveTo(0, -40); ctx.lineTo(0, -12); ctx.stroke();
    }
    const w = 24, h = 20;
    ctx.fillStyle = c.type === 'weapon' ? '#ffb300' : '#eceff1';
    roundRect(ctx, -w / 2, -h / 2, w, h, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
    roundRect(ctx, -w / 2, -h / 2, w, h, 3); ctx.stroke();
    if (c.type === 'weapon') {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
    } else {
      ctx.fillStyle = '#43a047';
      ctx.fillRect(-2.5, -7, 5, 14); ctx.fillRect(-7, -2.5, 14, 5);
    }
    // glow pulse so it's easy to spot
    const p = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.strokeStyle = c.type === 'weapon' ? `rgba(255,214,0,${0.2 + p * 0.4})` : `rgba(105,240,174,${0.2 + p * 0.4})`;
    ctx.lineWidth = 2;
    roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 5); ctx.stroke();
    ctx.restore();
  }

  drawTank(ctx, tk, game, t) {
    this.drawTankBody(ctx, tk, tk.alive ? this.relationColor(game, tk) : '#37474f', t);
  }

  // Draws any tank-like object (used by the game, the intro and previews).
  // Draws any tank-like object (used by the game, the intro and previews).
  drawTankBody(ctx, tk, color, t) {
    drawTankSprite(ctx, { x: tk.x, y: tk.y, color, tilt: tk.tilt, facing: tk.facing, angle: tk.angle, recoil: tk.recoil || 0, alive: tk.alive, skin: tk.cosmetics });
    if (!tk.alive) {
      const f = 0.5 + 0.5 * Math.sin(t * 9 + tk.id);
      ctx.fillStyle = `rgba(255,120,40,${0.3 + f * 0.4})`;
      ctx.beginPath(); ctx.arc(tk.x + 4, tk.y - 21, 3 + f * 2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (tk.armor > 0) {
      ctx.strokeStyle = `rgba(79,195,255,${0.35 + 0.2 * Math.sin(t * 5)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tk.x, tk.y - 13, 28, 0, Math.PI * 2); ctx.stroke();
    }
    if (tk.doubleDamage) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 13px Rajdhani, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('x2', tk.x + 27, tk.y - 25);
    }
  }

  drawTag(ctx, tk, game, t) {
    const y0 = tk.y - 50;
    const w = 48, x0 = tk.x - w / 2;
    ctx.save();
    ctx.font = 'bold 15px Rajdhani, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(tk.name, tk.x, y0 - 4);
    ctx.fillStyle = tk.locked && game.phase === 'aim' ? '#9e9e9e' : tk.connected === false ? '#ff8a80' : '#fff';
    ctx.fillText(tk.name, tk.x, y0 - 4);
    const title = tk.cosmetics ? titleName(tk.cosmetics.title) : '';
    if (title) { ctx.font = 'italic 600 11px Rajdhani, sans-serif'; ctx.lineWidth = 2; ctx.strokeText(title.toUpperCase(), tk.x, y0 + 17); ctx.fillStyle = '#ffd740'; ctx.fillText(title.toUpperCase(), tk.x, y0 + 17); }
    // hp
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x0 - 1, y0 + 1, w + 2, 6);
    ctx.fillStyle = tk.hp / tk.maxHp > 0.5 ? '#43d14a' : tk.hp / tk.maxHp > 0.25 ? '#ffb300' : '#ff5252';
    ctx.fillRect(x0, y0 + 2, (w * tk.hp) / tk.maxHp, 4);
    if (tk.armor > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x0 - 1, y0 - 4 + 1 + 3, w + 2, 3);
      ctx.fillStyle = '#4fc3ff'; ctx.fillRect(x0, y0 + 0, (w * Math.min(1, tk.armor / 100)), 2);
    }
    if (tk === game.current && game.phase === 'aim') {
      const bob = Math.sin(t * 5) * 3;
      ctx.fillStyle = '#4fc3ff';
      ctx.beginPath(); ctx.moveTo(tk.x - 7, y0 - 32 + bob); ctx.lineTo(tk.x + 7, y0 - 32 + bob); ctx.lineTo(tk.x, y0 - 23 + bob); ctx.closePath(); ctx.fill();
    } else if (tk.locked && game.phase === 'aim') {
      ctx.fillStyle = '#9e9e9e'; ctx.font = 'bold 11px Rajdhani, sans-serif';
      ctx.fillText('LOCKED', tk.x, y0 - 22);
    } else if (tk.connected === false) {
      ctx.fillStyle = '#ff8a80'; ctx.font = 'bold 11px Rajdhani, sans-serif';
      ctx.fillText('OFFLINE', tk.x, y0 - 22);
    }
    ctx.restore();
  }

  // Aiming guide: translucent range circle, a wedge whose length is the power, and a
  // "power, angle" readout under the tank.
  drawAim(ctx, tk, game, t) {
    const p = tk.pivot();
    const R = 230;
    const a = rad(tk.angle);
    const dx = Math.cos(a), dy = -Math.sin(a);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x - R, p.y); ctx.lineTo(p.x + R, p.y); ctx.moveTo(p.x, p.y - R); ctx.lineTo(p.x, p.y + R); ctx.stroke();
    const L = 34 + (R - 34) * (tk.power / 100);
    const bx = p.x + dx * 30, by = p.y + dy * 30;
    const ex = p.x + dx * L, ey = p.y + dy * L;
    const nx = -dy, ny = dx;
    const w0 = 1.6, w1 = 4 + 6 * (tk.power / 100);
    const g = ctx.createLinearGradient(bx, by, ex, ey);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx + nx * w0, by + ny * w0); ctx.lineTo(ex + nx * w1, ey + ny * w1);
    ctx.lineTo(ex - nx * w1, ey - ny * w1); ctx.lineTo(bx - nx * w0, by - ny * w0);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '700 17px Rajdhani, "Arial Narrow", sans-serif'; ctx.textAlign = 'center';
    const text = `${Math.round(tk.power)}, ${Math.round(tk.displayAngle)}`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(text, tk.x, tk.y + 24);
    ctx.fillStyle = '#fff'; ctx.fillText(text, tk.x, tk.y + 24);
    ctx.restore();
  }

  drawOverlay(ctx, game, t) {
    ctx.drawImage(this.vignette, 0, 0);
    if (game.fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.fx.flash})`; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
    ctx.save();
    ctx.font = '700 16px Rajdhani, "Arial Narrow", sans-serif';
    // wind
    const cx = WORLD_W / 2, cy = 26;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, cx - 130, cy - 16, 260, 34, 8); ctx.fill();
    ctx.fillStyle = '#90a4ae'; ctx.fillText('WIND', cx - 95, cy + 6);
    const mag = Math.abs(game.wind);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - 60, cy - 4, 120, 8);
    ctx.fillStyle = '#fff'; ctx.font = '700 16px Rajdhani, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(mag.toFixed(1), cx + 70, cy + 6);
    if (mag > 0.05) {
      const len = (mag / 12) * 60;
      const dir = Math.sign(game.wind);
      ctx.fillStyle = mag > 7 ? '#ff5252' : mag > 4 ? '#ffb300' : '#4fc3ff';
      ctx.fillRect(dir > 0 ? cx : cx - len, cy - 4, len, 8);
      ctx.beginPath();
      const ax = cx + dir * len + dir * Math.sin(t * 6) * 2;
      ctx.moveTo(ax, cy - 9); ctx.lineTo(ax + dir * 10, cy); ctx.lineTo(ax, cy + 9); ctx.closePath(); ctx.fill();
    } else { ctx.fillStyle = '#90a4ae'; ctx.textAlign = 'center'; ctx.fillText('NONE', cx, cy + 6); }
    // round + timer
    ctx.font = '700 22px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, WORLD_W - 262, 10, 250, 40, 8); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfd8dc'; ctx.fillText(`ROUND ${game.round || 1}`, WORLD_W - 248, 38);
    ctx.textAlign = 'right';
    if (game.phase === 'aim' && game.current && game.settings.turnTime > 0) {
      const tt = game.turnTimer;
      ctx.fillStyle = tt < 6 ? '#ff5252' : '#fff';
      ctx.font = '700 26px Rajdhani, sans-serif';
      ctx.fillText(fmtTime(tt), WORLD_W - 26, 40);
    } else if (game.phase === 'aim' && game.current) {
      ctx.fillStyle = '#90a4ae'; ctx.font = '700 18px Rajdhani, sans-serif';
      ctx.fillText('AIM', WORLD_W - 26, 37);
    } else if (game.phase === 'fire') {
      ctx.fillStyle = '#ff7043'; ctx.font = '700 18px Rajdhani, sans-serif';
      ctx.fillText('INCOMING', WORLD_W - 26, 37);
    }
    // messages
    ctx.textAlign = 'left';
    ctx.font = '600 17px Rajdhani, sans-serif';
    let my = 30;
    for (const m of game.messages) {
      const a = Math.min(1, (m.until - game.time) / 1.2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(m.text, 18, my);
      ctx.fillStyle = m.color; ctx.fillText(m.text, 18, my);
      my += 22;
    }
    ctx.globalAlpha = 1;
    // banner
    if (this.banner) {
      const b = this.banner;
      const age = t - b.start;
      const life = b.dur;
      if (age > life) this.banner = null;
      else {
        const a = Math.min(1, age / 0.25, (life - age) / 0.4);
        ctx.globalAlpha = Math.max(0, a);
        ctx.textAlign = 'center';
        ctx.font = '700 64px Rajdhani, "Arial Narrow", sans-serif';
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(b.text, WORLD_W / 2, WORLD_H * 0.36);
        ctx.fillStyle = b.color || '#fff';
        ctx.shadowColor = b.color || '#fff'; ctx.shadowBlur = 24;
        ctx.fillText(b.text, WORLD_W / 2, WORLD_H * 0.36);
        ctx.shadowBlur = 0;
        if (b.sub) {
          ctx.font = '600 24px Rajdhani, sans-serif';
          ctx.lineWidth = 5; ctx.strokeText(b.sub, WORLD_W / 2, WORLD_H * 0.36 + 40);
          ctx.fillStyle = '#e0e0e0'; ctx.fillText(b.sub, WORLD_W / 2, WORLD_H * 0.36 + 40);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  showBanner(text, sub = '', color = '#fff', dur = 2.2) {
    this.banner = { text, sub, color, dur, start: this.time };
  }
}
