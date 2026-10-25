// The projectile engine: interprets weapon specs (see weapons.js) as flight behaviors.
import { PHYS, WORLD_W, WORLD_H } from './config.js';
import { rgba } from './util.js';

export const DEFAULT_SPEC = { r: 4, color: '#ffffff', trail: 'dot', speed: 1, g: 1, wind: 1, drag: 0, life: 14 };
export function normSpec(s) { return { ...DEFAULT_SPEC, ...s }; }

let nextId = 1;

export class Projectile {
  constructor(game, spec, x, y, vx, vy, owner, opts = {}) {
    this.game = game;
    this.id = nextId++;
    this.spec = normSpec(spec);
    if (this.spec.colors) this.spec.color = this.spec.colors[(opts.index || 0) % this.spec.colors.length];
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.owner = owner;
    this.famId = opts.famId || null;
    this.depth = opts.depth || 0;
    this.dmgMul = opts.dmgMul || 1;
    this.age = 0; this.dead = false;
    this.pastApex = false; this.prevVy = vy;
    this.launchDir = Math.sign(vx) || 1;
    const s = this.spec;
    this.bouncesLeft = s.bounce ? s.bounce.n : 0;
    this.digLeft = s.dig ? s.dig.len : 0;
    this.digging = false;
    this.rolling = false; this.rollT = 0; this.rollDir = 0; this.hopped = false;
    this.sticking = false; this.stickT = 0;
    this.ufoMode = false; this.ufoDrops = 0; this.ufoT = 0;
    this.timedLeft = s.timed ? (s.timed.repeat || 1) : 0;
    this.nextTimed = s.timed ? s.timed.t : 0;
    this.waveOff = 0;
    this.trail = []; this.path = []; this.trailDist = 0; this.pathDist = 0;
    this.lastX = x; this.lastY = y;
    this.ignoreOwnerUntil = opts.child ? 0 : 0.22;
    this.target = null;
    this.index = opts.index || 0;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  update(dt) {
    if (this.dead) return;
    const s = this.spec, g = this.game, T = g.terrain;
    this.age += dt;
    if (s.timed && this.timedLeft > 0 && this.age >= this.nextTimed) {
      g.spawnChildren(this, s.timed);
      this.nextTimed += s.timed.t; this.timedLeft--;
    }
    if (this.sticking) {
      this.stickT -= dt;
      if (this.stickT <= 0) this.explode();
      return;
    }
    if (s.fuse && this.age >= s.fuse) { this.explode(); return; }
    if (this.age > s.life) { this.die(); return; }
    if (this.ufoMode) { this.updateUfo(dt); return; }
    if (this.rolling) { this.updateRoll(dt); return; }

    if (!this.digging) {
      this.vy += PHYS.gravity * s.g * dt;
      this.vx += g.wind * PHYS.windAccel * s.wind * dt;
      if (s.drag) { const f = Math.max(0, 1 - s.drag * dt); this.vx *= f; this.vy *= f; }
      if (s.thrust && this.age < s.thrust.dur) {
        if (s.thrust.mode === 'up') this.vy -= s.thrust.a * dt;
        else { const sp = this.speed || 1; this.vx += (this.vx / sp) * s.thrust.a * dt; this.vy += (this.vy / sp) * s.thrust.a * dt; }
      }
      if (s.homing) this.steer(dt);
      if (s.boomerang && this.pastApex) this.vx -= this.launchDir * 900 * s.boomerang * dt;
    }

    if (!this.pastApex && this.prevVy < 0 && this.vy >= 0) {
      this.pastApex = true;
      if (s.apex) {
        g.spawnChildren(this, s.apex);
        if (!s.apex.keep) { this.die(); return; }
      }
      if (s.ufo) { this.enterUfo(); return; }
    }
    this.prevVy = this.vy;

    const steps = Math.max(1, Math.ceil((this.speed * dt) / 3));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const px = this.x, py = this.y;
      let dx = this.vx * sdt, dy = this.vy * sdt;
      if (s.wave) {
        const t = this.age - dt + sdt * (i + 1);
        const ph = s.wave.freq * t;
        const off = s.wave.square ? (Math.sin(ph) >= 0 ? 1 : -1) * s.wave.amp : Math.sin(ph) * s.wave.amp;
        const d = off - this.waveOff; this.waveOff = off;
        const sp = this.speed || 1;
        dx += (-this.vy / sp) * d; dy += (this.vx / sp) * d;
      }
      this.x += dx; this.y += dy;
      this.recordTrail();
      if (this.x < -320 || this.x > WORLD_W + 320 || this.y > WORLD_H + 80) { this.die(); return; }
      const hit = this.hitTank();
      if (hit) { this.explode(); return; }
      if (T.solid(this.x, this.y)) {
        if (s.phase && this.age < s.phase) continue;
        if (s.dig && this.digLeft > 0) {
          if (!this.digging) {
            this.digging = true;
            const sp = this.speed || 1, ds = 420;
            this.vx = (this.vx / sp) * ds; this.vy = (this.vy / sp) * ds;
            g.audio.play('dig');
          }
          T.carve(this.x, this.y, s.dig.w);
          this.digLeft -= Math.hypot(dx, dy);
          if (Math.random() < 0.3) g.fx.emit(this.x, this.y, (Math.random() - 0.5) * 80, -60 - Math.random() * 60, 0.5, '#4fc3f7', 2, { g: 1 });
          if (this.digLeft <= 0) { this.explode(); return; }
          continue;
        }
        if (s.roll) { this.startRoll(); return; }
        if (s.bounce && this.bouncesLeft > 0) { this.bounce(px, py); if (this.dead) return; continue; }
        if (s.stick) { this.stick(px, py); return; }
        this.explode(); return;
      } else if (this.digging) {
        this.digging = false;
      }
    }
  }

  hitTank() {
    for (const t of this.game.tanks) {
      if (!t.alive) continue;
      if (t === this.owner && this.age < this.ignoreOwnerUntil) continue;
      const dx = this.x - t.x, dy = this.y - t.cy;
      const rr = PHYS.tankRadius + this.spec.r;
      if (dx * dx + dy * dy < rr * rr) return t;
    }
    return null;
  }

  steer(dt) {
    if (!this.target || !this.target.alive) this.target = this.game.nearestEnemy(this.x, this.y, this.owner);
    if (!this.target) return;
    const dx = this.target.x - this.x, dy = this.target.cy - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = this.speed || 1;
    const a = this.spec.homing * 900 * dt;
    this.vx += (dx / d) * a; this.vy += (dy / d) * a;
    const sp2 = this.speed || 1;
    const want = Math.max(sp, 320);
    this.vx *= want / sp2; this.vy *= want / sp2;
  }

  bounce(px, py) {
    const T = this.game.terrain, b = this.spec.bounce;
    const n = T.normalAt(this.x, this.y);
    this.x = px; this.y = py;
    let k = 0;
    while (T.solid(this.x, this.y) && k++ < 30) { this.x += n.x * 2; this.y += n.y * 2; }
    const dot = this.vx * n.x + this.vy * n.y;
    this.vx = (this.vx - 2 * dot * n.x) * b.k;
    this.vy = (this.vy - 2 * dot * n.y) * b.k;
    this.bouncesLeft--;
    this.prevVy = this.vy;
    this.game.audio.play('bounce');
    this.game.fx.burst(this.x, this.y, 5, 90, '#4fc3f7', 0.4, 2, { g: 1 });
    if (b.boom) this.game.explode(this, this.x, this.y, { keepAlive: true });
    if (this.spec.stick) this.vx *= 0.75; // flares scrub speed on each hop
    if (this.speed < 50) { if (this.spec.stick) this.stick(this.x, this.y); else this.explode(); }
  }

  startRoll() {
    const r = this.spec.roll, T = this.game.terrain;
    if (!this.rollDir) this.rollDir = (r.back ? -1 : 1) * (Math.sign(this.vx) || this.launchDir);
    const air = T.airAbove(this.x, this.y, 60);
    if (air < 0) { this.explode(); return; }
    this.y = air - this.spec.r;
    this.rolling = true;
    this.vx = 0; this.vy = 0;
  }

  updateRoll(dt) {
    const r = this.spec.roll, T = this.game.terrain, rad = this.spec.r;
    this.rollT += dt;
    if (this.rollT >= r.dur) {
      if (r.hop && !this.hopped) {
        this.hopped = true; this.rolling = false;
        this.vy = -540; this.vx = this.rollDir * 160;
        this.spec.homing = Math.max(this.spec.homing || 0, 0.9);
        this.pastApex = false; this.prevVy = this.vy;
        this.game.audio.play('fire', { pitch: 1.6 });
        return;
      }
      this.explode(); return;
    }
    const steps = Math.max(1, Math.ceil((r.speed * dt) / 3));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + this.rollDir * r.speed * sdt;
      const base = this.y + rad;
      let gy = -1;
      for (let yy = Math.floor(base) - 14; yy <= base + 30; yy++) { if (T.solid(nx, yy)) { gy = yy; break; } }
      if (gy < 0) { // rolled off a cliff: fall until we touch ground again
        this.rolling = false; this.x = nx;
        this.vx = this.rollDir * r.speed * 0.7; this.vy = 0; this.prevVy = 0; this.pastApex = true;
        return;
      }
      if (gy < base - 12) { this.explode(); return; } // ran into a wall
      this.x = nx; this.y = gy - rad;
      this.recordTrail();
      if (this.x < -60 || this.x > WORLD_W + 60) { this.die(); return; }
      if (this.hitTank()) { this.explode(); return; }
    }
    if (Math.random() < 0.25) this.game.fx.emit(this.x, this.y + rad, -this.rollDir * 30, -40, 0.4, '#4fc3f7', 1.5, { g: 1 });
  }

  stick(px, py) {
    this.x = px; this.y = py;
    this.sticking = true; this.stickT = this.spec.stick;
    this.vx = 0; this.vy = 0;
    this.game.audio.play('bounce', { pitch: 0.6 });
  }

  enterUfo() {
    const u = this.spec.ufo;
    this.ufoMode = true; this.vy = 0; this.vx = this.launchDir * u.speed;
    this.ufoDrops = u.drops; this.ufoT = u.interval * 0.5;
    this.game.audio.play('ufo');
  }

  updateUfo(dt) {
    const u = this.spec.ufo;
    this.x += this.vx * dt; this.ufoT -= dt;
    this.y += Math.sin(this.age * 6) * 12 * dt;
    this.recordTrail();
    if (this.ufoDrops > 0 && this.ufoT <= 0) {
      this.ufoT = u.interval; this.ufoDrops--;
      this.game.spawnChildren(this, { n: 1, pattern: 'down', speed: 40, inherit: 0.35, spec: u.bomb });
    }
    if (this.ufoDrops <= 0 && this.ufoT < -0.6) { this.die(); return; }
    if (this.x < -120 || this.x > WORLD_W + 120) { this.die(); return; }
    if (this.game.terrain.solid(this.x, this.y) || this.hitTank()) this.explode();
  }

  recordTrail() {
    const d = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    this.trailDist += d; this.pathDist += d;
    this.lastX = this.x; this.lastY = this.y;
    if (this.pathDist >= 16 && this.depth === 0) { this.pathDist = 0; this.path.push(this.x, this.y); }
    const type = this.spec.trail;
    if (type === 'none') return;
    if (type === 'dot') {
      if (this.trailDist >= 14) { this.trailDist = 0; this.trail.push(this.x, this.y); if (this.trail.length > 90) this.trail.splice(0, 2); }
    } else if (type === 'line') {
      if (this.trailDist >= 5) { this.trailDist = 0; this.trail.push(this.x, this.y); if (this.trail.length > 36) this.trail.splice(0, 2); }
    } else if (this.trailDist >= 7) {
      this.trailDist = 0;
      this.game.fx.trail(type, this.x, this.y, this.vx, this.vy, this.spec.color);
      this.trail.push(this.x, this.y); if (this.trail.length > 16) this.trail.splice(0, 2);
    }
  }

  explode() {
    if (this.dead) return;
    this.dead = true;
    this.game.explode(this, this.x, this.y);
    this.game.onProjectileEnd(this);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.game.onProjectileEnd(this);
  }

  draw(ctx) {
    const s = this.spec;
    const tr = this.trail;
    if (tr.length >= 2) {
      if (s.trail === 'dot') {
        ctx.fillStyle = rgba(s.color, 0.7);
        const n = tr.length / 2;
        for (let i = 0; i < n; i++) {
          const a = 0.15 + (i / n) * 0.75;
          if (s.rainbow) ctx.fillStyle = `hsl(${(i * 28 + this.age * 260) % 360}, 100%, 65%)`;
          ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(tr[i * 2], tr[i * 2 + 1], 1.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const n = tr.length / 2;
        for (let i = 1; i < n; i++) {
          const a = (i / n) * 0.9;
          ctx.strokeStyle = rgba(s.color, a);
          ctx.lineWidth = Math.max(1, s.r * 1.4 * (i / n));
          ctx.beginPath(); ctx.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]); ctx.lineTo(tr[i * 2], tr[i * 2 + 1]); ctx.stroke();
        }
        ctx.restore();
      }
    }
    const phased = s.phase && this.age < s.phase && this.game.terrain.solid(this.x, this.y);
    ctx.save();
    if (phased || s.trail === 'none' && s.phase) ctx.globalAlpha = 0.55;
    if (this.ufoMode) {
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y - 3, 6, Math.PI, 0); ctx.fill();
      ctx.restore();
      return;
    }
    // glow + core
    const bodyColor = s.rainbow ? `hsl(${(this.age * 260) % 360}, 100%, 65%)` : s.color;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = s.rainbow ? 'rgba(255,255,255,0.25)' : rgba(s.color, 0.28);
    ctx.beginPath(); ctx.arc(this.x, this.y, s.r * 2.4 + 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(this.x, this.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(this.x - s.r * 0.25, this.y - s.r * 0.25, Math.max(1, s.r * 0.45), 0, Math.PI * 2); ctx.fill();
    if (this.sticking) {
      const p = 0.5 + 0.5 * Math.sin(this.age * 18);
      ctx.strokeStyle = `rgba(255,80,80,${0.4 + p * 0.6})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, s.r + 4 + p * 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
