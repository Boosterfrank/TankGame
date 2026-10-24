// Opening cutscene: studio card, two tanks roll onto a night battlefield, a slow-motion shell,
// a direct hit, and the title reveal. Skippable with any click or key.
import { WORLD_W, WORLD_H, PHYS, INTRO_STUDIO_CARD, STUDIO, GAME_NAME } from './config.js';
import { Terrain } from './terrain.js';
import { FX } from './fx.js';
import { Tank } from './tank.js';
import { Projectile } from './projectile.js';
import { clamp, lerp, rad, smoothstep } from './util.js';

const SEED = 20241024;
const easeInOut = (t) => smoothstep(clamp(t, 0, 1));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export class Intro {
  constructor(app) {
    this.app = app;
    this.audio = app.audio;
    this.t = 0; this.simT = 0;
    this.T0 = INTRO_STUDIO_CARD ? 2.0 : 0;
    this.terrain = new Terrain(WORLD_W, WORLD_H);
    this.terrain.generate('hills', SEED);
    this.fx = new FX();
    this.green = new Tank({ name: 'Commander', team: 1 });
    this.red = new Tank({ name: 'Rook', team: 2 });
    this.green.x = -70; this.red.x = WORLD_W + 70;
    this.green.angle = 18; this.red.angle = 150;
    for (const tk of [this.green, this.red]) { tk.y = this.terrain.surfaceY(clamp(tk.x, 0, WORLD_W - 1), 0); tk.onGround = true; }
    this.greenTarget = 520; this.redTarget = WORLD_W - 470;
    this.shell = null; this.fired = false; this.impact = null; this.impactT = null;
    this.revealT = null; this.done = false; this.finished = false;
    this.logo = new Image(); this.logo.src = 'assets/qubiplex-logo.webp';
    this.shake = 0; this.flash = 0;
    this.sparks = [];
    // Shim so the real projectile engine can fly the shell.
    this.shim = {
      terrain: this.terrain, tanks: [this.red], wind: 0, audio: this.audio, fx: this.fx, headless: false, time: 0,
      explode: (p, x, y) => this.onImpact(x, y), onProjectileEnd: () => {}, spawnChildren: () => {}, nearestEnemy: () => null,
    };
    this.power = this.solvePower();
  }

  // Find the launch power that lands the shell on the red tank from the green tank's firing spot.
  solvePower() {
    const gx = this.greenTarget, gy = this.terrain.surfaceY(gx, 0);
    const rx = this.redTarget, ry = this.terrain.surfaceY(rx, 0) - 12;
    const angle = rad(52);
    let best = 70, bestD = Infinity;
    for (let power = 30; power <= 100; power += 0.5) {
      const v = power * PHYS.launchSpeed;
      let x = gx + Math.cos(angle) * 25, y = gy - 17 - Math.sin(angle) * 25, vx = Math.cos(angle) * v, vy = -Math.sin(angle) * v;
      let hit = null;
      for (let i = 0; i < 600 && !hit; i++) {
        vy += PHYS.gravity / 60; x += vx / 60; y += vy / 60;
        if (Math.hypot(x - rx, y - ry) < 18) hit = { x, y };
        else if (this.terrain.solid(x, y) || x > WORLD_W + 50 || y > WORLD_H) hit = { x, y };
      }
      const d = Math.hypot(hit.x - rx, hit.y - ry);
      if (d < bestD) { bestD = d; best = power; }
    }
    return best;
  }

  get phaseT() { return this.t - this.T0; }

  timeScale() {
    const p = this.phaseT;
    if (this.fired && !this.impact && p > 4.25 && p < 6.0) return 0.28; // slow-motion launch
    return 1;
  }

  camera() {
    const p = this.phaseT;
    const g = this.green, r = this.red;
    const wide = { x: WORLD_W / 2, y: WORLD_H * 0.52, z: 1 };
    if (p < 2.6) return { ...wide, z: 1 + 0.06 * easeInOut(p / 2.6) };
    const closeG = { x: g.x + 90, y: g.y - 60, z: 2.3 };
    if (p < 3.6) { const k = easeInOut((p - 2.6) / 1.0); return { x: lerp(wide.x, closeG.x, k), y: lerp(wide.y, closeG.y, k), z: lerp(1.06, closeG.z, k) }; }
    if (!this.fired || !this.shell) return closeG;
    if (!this.impact) {
      // follow the shell
      const k = easeOut((p - 4.2) / 0.8);
      const s = this.shell;
      const tx = clamp(s.x, 300, WORLD_W - 300), ty = clamp(s.y, 200, WORLD_H - 200);
      const z = lerp(2.3, 1.45, k);
      return { x: lerp(closeG.x, tx, k), y: lerp(closeG.y, ty, k), z };
    }
    const since = this.t - this.impactT;
    const closeR = { x: this.impact.x, y: this.impact.y - 40, z: 1.6 };
    if (since < 0.9) return closeR;
    const k = easeInOut((since - 0.9) / 1.1);
    return { x: lerp(closeR.x, wide.x, k), y: lerp(closeR.y, wide.y, k), z: lerp(closeR.z, 1, k) };
  }

  update(dt) {
    if (this.finished) return;
    this.t += dt;
    const p = this.phaseT;
    const sdt = dt * this.timeScale();
    this.simT += sdt; this.shim.time = this.simT;
    const T = this.terrain;
    // tanks roll in
    if (p > 0 && p < 2.8) {
      const k = easeOut(p / 2.6);
      this.green.x = lerp(-70, this.greenTarget, k);
      this.red.x = lerp(WORLD_W + 70, this.redTarget, k);
      for (const tk of [this.green, this.red]) {
        if (Math.random() < 0.6 && tk.x > 10 && tk.x < WORLD_W - 10) this.fx.emit(tk.x, tk.y - 2, (Math.random() - 0.5) * 50, -20 - Math.random() * 30, 0.6, '#9fd8ff', 2 + Math.random() * 2, { smoke: true, g: -0.1, grow: 8 });
      }
    }
    for (const tk of [this.green, this.red]) {
      if (tk.x > 0 && tk.x < WORLD_W) tk.settle(T, sdt);
      if (tk.recoil) tk.recoil = Math.max(0, tk.recoil - dt * 5);
    }
    // barrel raises
    if (p > 3.4 && p < 4.2) this.green.angle = lerp(18, 52, easeInOut((p - 3.4) / 0.8));
    if (p >= 4.2 && !this.fired) this.fire();
    if (this.shell && !this.shell.dead) {
      this.shell.update(sdt);
      if (this.shell.dead && !this.impact) this.onImpact(this.shell.x, this.shell.y);
    }
    if (this.impact) {
      const since = this.t - this.impactT;
      if (since > 2.2 && this.revealT == null) { this.revealT = this.t; this.audio.play('win'); this.app.music.fadeTo(this.app.music.targetVolume(), 0.5); }
      if (Math.random() < 0.3) this.fx.emit(this.impact.x + (Math.random() - 0.5) * 40, this.impact.y, (Math.random() - 0.5) * 20, -30 - Math.random() * 40, 1.5, '#424242', 5, { smoke: true, g: -0.15, grow: 12, drag: 1 });
    }
    this.fx.update(sdt);
    T.update(dt);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.4);
  }

  fire() {
    this.fired = true;
    const g = this.green;
    g.recoil = 1;
    const tip = g.barrelTip();
    const a = rad(g.angle);
    const v = this.power * PHYS.launchSpeed;
    this.shell = new Projectile(this.shim, { r: 5, color: '#fff59d', trail: 'spark', boom: { r: 80, dmg: 100 } }, tip.x, tip.y, Math.cos(a) * v, -Math.sin(a) * v, g, { famId: 'shot' });
    this.fx.burst(tip.x, tip.y, 14, 200, '#ffe082', 0.3, 3, { add: true, g: 0 });
    this.audio.play('fire', { big: true });
    this.shake = 6;
  }

  onImpact(x, y) {
    if (this.impact) return;
    this.impact = { x, y }; this.impactT = this.t;
    if (this.shell) this.shell.dead = true;
    this.terrain.carve(x, y, 80);
    this.fx.explosion(x, y, 80, '#ffb74d', { shake: 1.2, mushroom: false });
    this.audio.play('bigboom');
    this.shake = 28; this.flash = 0.8;
    const r = this.red;
    if (Math.hypot(r.x - x, r.cy - y) < 140) {
      r.alive = false; r.hp = 0;
      this.fx.burst(r.x, r.cy, 24, 300, '#ff5252', 1.2, 3, { g: 1.2 });
      for (let i = 0; i < 8; i++) this.fx.emit(r.x, r.cy, (Math.random() - 0.5) * 360, -160 - Math.random() * 280, 1.4 + Math.random(), i % 2 ? '#37474f' : '#546e7a', 3 + Math.random() * 3, { g: 1.3, drag: 0.4 });
      this.fx.text(r.x, r.cy - 40, '-100', '#ff5252', 30);
      setTimeout(() => this.audio.play('death'), 120);
    }
  }

  // Any click/key: skip to the menu, or continue once the title is up.
  input() {
    if (this.finished) return;
    this.finished = true;
    this.app.onIntroDone();
  }

  draw(renderer) {
    const ctx = renderer.begin();
    renderer.makeBackground(SEED);
    const cam = this.camera();
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.save();
    ctx.translate(WORLD_W / 2 + sx, WORLD_H / 2 + sy);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(renderer.bg, -40, -20, WORLD_W + 80, WORLD_H + 40);
    this.terrain.draw(ctx);
    for (const tk of [this.green, this.red]) if (tk.x > -60 && tk.x < WORLD_W + 60) renderer.drawTankBody(ctx, tk, tk === this.green ? '#4cff5e' : '#ff4b4b', this.t);
    if (this.shell && !this.shell.dead) this.shell.draw(ctx);
    this.fx.draw(ctx);
    ctx.restore();
    renderer.drawAmbient(ctx, this.t, 1 / 60, null);
    ctx.drawImage(renderer.vignette, 0, 0);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
    // letterbox bars
    const barIn = easeOut(this.t / 0.8);
    const barOut = this.revealT != null ? easeInOut((this.t - this.revealT) / 0.8) : 0;
    const bar = 100 * barIn * (1 - barOut);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WORLD_W, bar); ctx.fillRect(0, WORLD_H - bar, WORLD_W, bar);
    // studio card
    if (INTRO_STUDIO_CARD && this.t < this.T0) {
      const a = Math.min(1, this.t / 0.5, (this.T0 - this.t) / 0.5);
      ctx.fillStyle = `rgba(0,0,0,${0.5 + 0.5 * Math.min(1, (this.T0 - this.t) / 0.6)})`; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      const s = 220 + 10 * Math.sin(this.t);
      if (this.logo.complete && this.logo.naturalWidth) ctx.drawImage(this.logo, WORLD_W / 2 - s / 2, WORLD_H / 2 - s / 2 - 40, s, s);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cfd8e3'; ctx.font = '600 30px Rajdhani, sans-serif';
      ctx.fillText(STUDIO.toUpperCase().split('').join(' '), WORLD_W / 2, WORLD_H / 2 + 120);
      ctx.fillStyle = '#8f9db0'; ctx.font = '500 20px Rajdhani, sans-serif';
      ctx.fillText('presents', WORLD_W / 2, WORLD_H / 2 + 152);
      ctx.restore();
    }
    // title reveal
    if (this.revealT != null) {
      const rt = this.t - this.revealT;
      const k = clamp(rt / 0.6, 0, 1);
      const scale = lerp(2.6, 1, 1 - Math.pow(1 - k, 3)) * (1 + 0.04 * Math.sin(Math.min(1, rt) * Math.PI));
      const alpha = clamp(rt / 0.25, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(WORLD_W / 2, WORLD_H * 0.42);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 118px Rajdhani, "Arial Narrow", sans-serif';
      const words = GAME_NAME.toUpperCase().split(' ');
      const text = words.join(' ');
      ctx.shadowColor = 'rgba(57,208,255,0.9)'; ctx.shadowBlur = 40 + 30 * Math.sin(rt * 3);
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, 0, 0);
      // accent the middle word
      if (words.length === 3) {
        const w0 = ctx.measureText(words[0] + ' ').width, w1 = ctx.measureText(words[1]).width, total = ctx.measureText(text).width;
        ctx.fillStyle = '#39d0ff';
        ctx.textAlign = 'left';
        ctx.fillText(words[1], -total / 2 + w0, 0);
        ctx.textAlign = 'center';
      }
      ctx.shadowBlur = 0;
      if (rt > 0.9) {
        ctx.globalAlpha = clamp((rt - 0.9) / 0.5, 0, 1);
        ctx.font = '600 26px Rajdhani, sans-serif'; ctx.fillStyle = '#b8c7d6';
        ctx.fillText('DESTRUCTIBLE TERRAIN · 490 WEAPONS · ONLINE BATTLES', 0, 84);
      }
      ctx.restore();
      if (rt > 1.5) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(rt * 4);
        ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 28px Rajdhani, sans-serif';
        ctx.fillText('CLICK TO CONTINUE', WORLD_W / 2, WORLD_H * 0.72);
        ctx.restore();
      }
    } else if (this.t > 1) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'right'; ctx.fillStyle = '#9fb4c9'; ctx.font = '600 18px Rajdhani, sans-serif';
      ctx.fillText('CLICK OR PRESS ANY KEY TO SKIP', WORLD_W - 30, WORLD_H - 24);
      ctx.restore();
    }
  }
}
