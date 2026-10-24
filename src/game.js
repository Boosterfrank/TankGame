// Game orchestration: simultaneous-fire rounds. Everyone aims (humans hot-seat, bots plan), then
// every locked-in shot launches at once and the round resolves.
import { PHYS, WORLD_W, WORLD_H, DEFAULT_SETTINGS } from './config.js';
import { RNG, clamp, rad, lerp } from './util.js';
import { Terrain } from './terrain.js';
import { spawnColumns } from './terrain-gen.js';
import { Tank } from './tank.js';
import { Projectile, normSpec } from './projectile.js';
import { FX } from './fx.js';
import { getWeapon, FAMILIES } from './weapons.js';
import { ITEMS } from './items.js';
import { planBotShot, planBotItems, botArsenal } from './ai.js';

const WIND_MAX = { none: 0, low: 3, medium: 6, high: 9, crazy: 12 };
const SUDDEN_DEATH_ROUND = 30;

export class Game {
  constructor({ settings, players, seed, audio, online = null, deadline = null }) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.online = online;              // OnlineSession when playing over the relay
    this.deadlineAt = deadline;        // server deadline (ms epoch) for the current aim phase
    this.lockInfo = null;              // { count, needed } from the relay
    this.dev = null;                   // developer-tools flags (see ui/devtools.js)
    this.seed = seed ?? (Math.random() * 2 ** 31) | 0;
    this.rng = new RNG(this.seed);
    this.audio = audio;
    this.terrain = new Terrain(WORLD_W, WORLD_H);
    this.fx = new FX();
    this.tanks = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.skyLasers = [];
    this.markers = [];
    this.crates = [];
    this.tracers = new Map(); // tank id -> path array
    this.messages = [];
    this.time = 0;
    this.round = 0;
    this.wind = 0;
    this.phase = 'intro';
    this.introT = 1.2;
    this.current = null;
    this.waitingPass = false;
    this.turnTimer = 0;
    this.botsToPlan = [];
    this.launchQueue = [];
    this.volleyT = 0; this.settleT = 0;
    this.roundEndT = 0;
    this.overT = 0;
    this.headless = false;
    this.on = {}; // hooks: pass(tank), gameOver(results), toast(text, color), crate(tank, text)
    this.humans = 0;
    this.winners = null;
    this.playerDefs = players;
    this._setup(players);
    if (this.online) this.online.bind(this);
  }

  _setup(players) {
    this.terrain.generate(this.settings.map, this.seed);
    const cols = spawnColumns(players.length, WORLD_W, this.rng);
    players.forEach((def, i) => {
      const t = new Tank({ ...def, hp: this.settings.hp, team: this.settings.mode === 'team' ? def.team : 100 + i });
      t.netId = def.netId || null;
      t.x = cols[i];
      t.y = this.terrain.surfaceY(t.x, 0) - 190; // tanks drop in during the intro
      t.onGround = false;
      t.angle = t.x > WORLD_W / 2 ? 120 : 60;
      if (t.isBot) botArsenal(t, def.level || 10, this.settings.arsenal === 'all');
      else {
        const list = this.settings.arsenal === 'all' ? FAMILIES : FAMILIES.filter((f) => def.unlockedIds?.includes(f.id) || f.id === 'shot');
        for (const f of list) { t.arsenal.set(f.id, f.ammo); t.tiers[f.id] = def.tiers?.[f.id] || 1; }
        this.humans++;
      }
      if (this.settings.items) for (const it of ITEMS) t.items[it.id] = 1;
      if (this.settings.dummies && t.isBot) t.dummy = true; // dev test range: bots never fire
      this.tanks.push(t);
    });
    this.rollWind();
  }

  tankByNet(id) { return this.tanks.find((t) => t.netId === id) || null; }
  get me() { return this.tanks.find((t) => t.isProfile) || null; }

  // ------------------------------------------------------------ helpers
  get viewer() {
    return this.current || this.tanks.find((t) => !t.isBot && t.alive) || this.tanks.find((t) => !t.isBot) || this.tanks[0];
  }
  aliveTanks() { return this.tanks.filter((t) => t.alive); }
  aliveTeams() { return [...new Set(this.aliveTanks().map((t) => t.team))]; }
  humansAlive() { return this.tanks.filter((t) => !t.isBot && t.alive); }

  rollWind() {
    const max = WIND_MAX[this.settings.wind] ?? 3;
    this.wind = max ? Math.round(this.rng.range(-max, max) * 10) / 10 : 0;
  }

  message(text, color = '#fff') {
    this.messages.push({ text, color, until: this.time + 6 });
    if (this.messages.length > 6) this.messages.shift();
  }

  currentWeapon(tank = this.current) {
    if (!tank) return null;
    let id = tank.weaponId;
    if (tank.ammo(id) <= 0) { id = 'shot'; tank.weaponId = id; }
    return getWeapon(id, tank.tier(id));
  }

  nearestEnemy(x, y, owner) {
    let best = null, bd = Infinity;
    for (const t of this.tanks) {
      if (!t.alive || (owner && t.team === owner.team)) continue;
      const d = Math.hypot(t.x - x, t.cy - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ------------------------------------------------------------ phases
  beginAim() {
    this.phase = 'aim';
    for (const t of this.tanks) { t.locked = false; t.shot = null; t.roundItems = []; }
    this.lockInfo = null;
    const o = this.online;
    this.botsToPlan = (o && !o.isHost) || this.settings.dummies ? [] : this.tanks.filter((t) => t.isBot && t.alive);
    this.waitingPass = false;
    if (o) {
      const me = this.me;
      this.current = me && me.alive ? me : null;
      this.turnTimer = this.deadlineAt ? Math.max(0.5, (this.deadlineAt - Date.now()) / 1000) : this.settings.turnTime;
      if (!this.current) { this.planNextBot(true); this.on.lock?.(this.buildLockPayload(null)); }
      this.on.phase?.('aim');
      return;
    }
    const humans = this.humansAlive();
    this.current = humans[0] || null;
    this.turnTimer = this.settings.turnTime;
    if (this.current && this.humans > 1) { this.waitingPass = true; this.on.pass?.(this.current); }
    this.on.phase?.('aim');
  }

  buildLockPayload(t) {
    const payload = { x: t ? Math.round(t.x) : 0, shot: t ? t.shot : null, items: t ? (t.roundItems || []).slice() : [], dead: !t };
    if (this.online?.isHost) {
      payload.bots = {};
      this.tanks.forEach((b, i) => { if (b.isBot && b.alive && b.shot) payload.bots[i] = { shot: b.shot, items: (b.roundItems || []).slice() }; });
    }
    return payload;
  }

  // Server says: new aim phase. Non-hosts snap to the host's end-of-volley snapshot first.
  serverAim(msg) {
    if (this.phase === 'over') return;
    if (this.phase === 'fire') { this.projectiles.length = 0; this.spawnQueue.length = 0; this.skyLasers.length = 0; this.phase = 'waiting'; }
    if (this.phase === 'intro') { this.introT = 0; this.round = 1; this.beginAim(); }
    if (msg.snapshot && !this.online.isHost) this.applySnapshot(msg.snapshot);
    this.deadlineAt = msg.deadline || null;
    this.round = (msg.round || this.round + 1) - 1;
    this.nextRound();
  }

  // Server says: everyone has locked in. Apply positions, items and shots, then fire together.
  applyVolley(msg) {
    const o = this.online;
    if (!o || this.phase === 'over') return;
    if (this.phase === 'intro') { this.introT = 0; this.round = 1; this.beginAim(); }
    if (this.phase !== 'aim') return;
    for (const t of this.tanks) { t.shot = null; t.locked = false; }
    for (const e of msg.entries || []) {
      const t = this.tankByNet(e.id);
      if (!t) continue;
      const mine = e.id === o.myId;
      if (t.alive && !e.dead) {
        if (!mine) {
          t.x = clamp(Math.round(e.x || t.x), 10, WORLD_W - 10);
          t.y = this.terrain.surfaceY(t.x, Math.max(0, t.y - 60));
          t.settle(this.terrain, 1 / 60);
          for (const it of e.items || []) this.useItem(it.id, t, it.payload, true);
        }
        t.shot = e.shot || null; t.locked = true;
        if (e.shot) { t.angle = e.shot.angle; t.power = e.shot.power; }
      }
      if (e.bots) {
        for (const [i, b] of Object.entries(e.bots)) {
          const bt = this.tanks[+i];
          if (!bt || !bt.isBot || !bt.alive) continue;
          if (!mine) for (const it of b.items || []) this.useItem(it.id, bt, it.payload, true);
          bt.shot = b.shot || null; bt.locked = true;
          if (b.shot) { bt.angle = b.shot.angle; bt.power = b.shot.power; }
        }
      }
    }
    for (const id of msg.left || []) { const t = this.tankByNet(id); if (t && t.alive) { t.connected = false; this.killTank(t, null); } }
    this.checkCratePickups();
    this.beginFire();
  }

  setRemoteX(id, x) {
    const t = this.tankByNet(id);
    if (!t || !t.alive || this.phase !== 'aim') return;
    t.x = clamp(Math.round(x), 10, WORLD_W - 10);
    t.y = this.terrain.surfaceY(t.x, Math.max(0, t.y - 60));
  }

  snapshot() {
    return { tanks: this.tanks.map((t) => ({ hp: Math.round(t.hp), armor: Math.round(t.armor), x: Math.round(t.x), y: Math.round(t.y), alive: t.alive, fuel: Math.round(t.fuel) })) };
  }

  applySnapshot(snap) {
    (snap.tanks || []).forEach((d, i) => {
      const t = this.tanks[i];
      if (!t) return;
      if (t.alive && !d.alive) this.killTank(t, null);
      t.hp = d.hp; t.armor = d.armor; t.fuel = d.fuel;
      if (Math.abs(t.x - d.x) > 2 || Math.abs(t.y - d.y) > 6) { t.x = d.x; t.y = d.y; }
    });
  }

  confirmPass() { this.waitingPass = false; }

  planNextBot(all = false) {
    if (!this.botsToPlan.length) return;
    do {
      const bot = this.botsToPlan.shift();
      if (!bot.alive) continue;
      for (const id of planBotItems(this, bot)) this.useItem(id, bot);
      bot.shot = planBotShot(this, bot);
      bot.locked = true;
    } while (all && this.botsToPlan.length);
  }

  // Lock in the current human's shot.
  fire() {
    const t = this.current;
    if (this.phase !== 'aim' || !t || t.locked || this.waitingPass) return;
    const w = this.currentWeapon(t);
    t.shot = { weaponId: w.id, angle: t.angle, power: t.power };
    t.locked = true;
    this.audio.play('lock');
    if (this.online) { this.planNextBot(true); this.on.lock?.(this.buildLockPayload(t)); return; }
    this.advanceAim();
  }

  advanceAim() {
    const next = this.tanks.find((t) => !t.isBot && t.alive && !t.locked);
    if (next) {
      if (next !== this.current) {
        this.current = next;
        this.turnTimer = this.settings.turnTime;
        this.waitingPass = true;
        this.on.pass?.(next);
      }
      return;
    }
    this.current = null;
    this.planNextBot(true);
    this.beginFire();
  }

  beginFire() {
    this.phase = 'fire';
    this.volleyT = 0; this.settleT = 0;
    this.launchQueue = [];
    for (const t of this.tanks) {
      if (!t.alive || !t.shot || t.dummy) continue;
      this.launchQueue.push({ tank: t, shot: t.shot, at: this.rng.range(0, 0.7) });
    }
    this.launchQueue.sort((a, b) => a.at - b.at);
    this.on.phase?.('fire');
  }

  updateVolley(dt) {
    this.volleyT += dt;
    while (this.launchQueue.length && this.launchQueue[0].at <= this.volleyT) {
      const l = this.launchQueue.shift();
      if (l.tank.alive) this.launch(l.tank, l.shot);
    }
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      if (this.spawnQueue[i].at <= this.time) { const q = this.spawnQueue.splice(i, 1)[0]; q.fn(); }
    }
    for (let i = this.skyLasers.length - 1; i >= 0; i--) {
      if (this.skyLasers[i].at <= this.time) { const s = this.skyLasers.splice(i, 1)[0]; this.fireSkyLaser(s); }
    }
    const ps = this.projectiles;
    for (let i = 0; i < ps.length; i++) ps[i].update(dt);
    for (let i = ps.length - 1; i >= 0; i--) if (ps[i].dead) ps.splice(i, 1);
    const quiet = !this.launchQueue.length && !ps.length && !this.spawnQueue.length && !this.skyLasers.length
      && this.tanks.every((t) => !t.alive || t.onGround) && (this.headless || !this.fx.busy);
    if (quiet) { this.settleT += dt; if (this.settleT > 0.8) this.endVolley(); }
    else this.settleT = 0;
    if (this.volleyT > 30) {
      this.projectiles.length = 0; this.spawnQueue.length = 0; this.skyLasers.length = 0;
      this.endVolley();
    }
  }

  endVolley() {
    this.markers.length = 0;
    const over = this.aliveTeams().length <= 1;
    if (this.online) {
      this.phase = 'waiting';
      this.on.volleyDone?.(this.round, this.online.isHost ? this.snapshot() : null, over);
      if (over) this.finish();
      return;
    }
    if (over) { this.finish(); return; }
    this.phase = 'roundend';
    this.roundEndT = 0.5;
  }

  nextRound() {
    this.round++;
    this.rollWind();
    for (const t of this.tanks) if (t.alive) t.fuel = Math.min(PHYS.maxFuel, t.fuel + PHYS.fuelRegen);
    if (this.settings.crates && this.crates.length < 2 && this.rng.chance(0.45)) this.spawnCrate();
    if (this.round > SUDDEN_DEATH_ROUND) {
      this.message('SUDDEN DEATH: everyone takes damage', '#ff5252');
      for (const t of this.aliveTanks()) { this.applyDamage(t, 10, null, null, true); }
      if (this.aliveTeams().length <= 1) { this.finish(); return; }
    }
    for (const t of this.tanks) if (t.alive) t.xp += 5;
    this.beginAim();
  }

  finish() {
    this.phase = 'over';
    this.overT = 1.8;
    const alive = this.aliveTanks();
    const winTeam = alive.length ? alive[0].team : null;
    this.winners = this.tanks.filter((t) => t.team === winTeam && winTeam != null);
    for (const t of this.winners) t.xp += 150;
    for (const t of alive) t.xp += 25;
    if (this.winners.length) this.message(this.settings.mode === 'team' ? `Team ${this.winners[0].team} wins!` : `${this.winners[0].name} wins!`, '#ffd740');
    this.on.phase?.('over');
  }

  results() {
    const order = this.tanks.slice().sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.alive) return b.hp - a.hp;
      return b.deathTime - a.deathTime;
    });
    return order.map((t, i) => ({ rank: i + 1, tank: t, name: t.name, isBot: t.isBot, kills: t.stats.kills, damage: Math.round(t.stats.damage), xp: Math.round(t.xp), alive: t.alive, hp: Math.round(t.hp), winner: this.winners?.includes(t) }));
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.time += dt;
    if (!this.headless) { this.fx.update(dt); this.terrain.update(dt); }
    else if (this.fx.parts.length > 500) { this.fx = new FX(); }
    for (const t of this.tanks) t.settle(this.terrain, dt);
    this.updateCrates(dt);
    while (this.messages.length && this.messages[0].until < this.time) this.messages.shift();
    switch (this.phase) {
      case 'intro':
        this.introT -= dt;
        if (this.introT <= 0) { this.round = 1; this.beginAim(); }
        break;
      case 'aim':
        if (this.waitingPass) break;
        if (this.online) {
          if (this.current && !this.current.locked && this.deadlineAt && !this.dev?.noTimer) {
            this.turnTimer = (this.deadlineAt - Date.now()) / 1000;
            if (this.turnTimer <= 0) { this.turnTimer = 0; this.fire(); }
          }
          this.planNextBot();
          break;
        }
        if (!this.current) { // nobody human left: bots play on
          this.spectateT = (this.spectateT || 0) + dt;
          if (this.spectateT > 0.6) { this.spectateT = 0; this.planNextBot(true); this.beginFire(); }
          break;
        }
        if (this.settings.turnTime > 0 && !this.dev?.noTimer) {
          this.turnTimer -= dt;
          if (this.turnTimer <= 0) { this.turnTimer = 0; this.fire(); }
        }
        this.planNextBot();
        break;
      case 'waiting':
        break;
      case 'fire':
        this.updateVolley(dt);
        break;
      case 'roundend':
        this.roundEndT -= dt;
        if (this.roundEndT <= 0) this.nextRound();
        break;
      case 'over':
        if (this.overT > 0) { this.overT -= dt; if (this.overT <= 0) this.on.gameOver?.(this.results()); }
        break;
    }
  }

  // Fast-forward the rest of a game (used when spectating after the human died).
  skipToEnd() {
    this.headless = true;
    let n = 0;
    while (this.phase !== 'over' && n++ < 40000) {
      if (this.phase === 'aim' && this.waitingPass) this.waitingPass = false;
      this.update(1 / 30);
    }
    this.headless = false;
    this.fx = new FX();
    this.terrain.markDirty(0, 0, WORLD_W, WORLD_H);
    this.terrain.update(1);
    this.overT = 0.01;
  }

  // ------------------------------------------------------------ player actions
  adjustAngle(d) { const t = this.current; if (t && !t.locked) t.angle = clamp(t.angle + d, 0, 180); }
  adjustPower(d) { const t = this.current; if (t && !t.locked) t.power = clamp(t.power + d, 5, 100); }
  setAim(angle, power) { const t = this.current; if (t && !t.locked) { t.angle = clamp(angle, 0, 180); t.power = clamp(power, 5, 100); } }
  moveCurrent(dir, dt) {
    const t = this.current;
    if (!t || t.locked || this.phase !== 'aim' || this.waitingPass) return;
    if (t.move(dir, dt, this.terrain)) {
      this.audio.engine(true);
      if (this.online) this.on.move?.(t.x);
      if (Math.random() < 0.5) this.fx.emit(t.x - dir * 14, t.y - 2, -dir * (20 + Math.random() * 40), -20 - Math.random() * 30, 0.5, '#9fd8ff', 2 + Math.random() * 2, { smoke: true, g: -0.1, grow: 6 });
    }
  }
  selectWeapon(id) {
    const t = this.current;
    if (!t || t.locked) return;
    if (t.ammo(id) > 0) { t.weaponId = id; this.audio.play('click'); }
  }
  cycleWeapon(dir) {
    const t = this.current; if (!t || t.locked) return;
    const ids = [...t.arsenal.keys()].filter((id) => t.ammo(id) > 0).sort((a, b) => getWeapon(a).name.localeCompare(getWeapon(b).name));
    const i = ids.indexOf(t.weaponId);
    t.weaponId = ids[(i + dir + ids.length) % ids.length];
    this.audio.play('click');
  }

  // Items are applied immediately; online, the payload (random choices) is replayed on other clients.
  useItem(id, tank = this.current, payload = null, replay = false) {
    if (!tank || !tank.alive || !(tank.items[id] > 0)) return false;
    if (!replay && tank === this.current && (tank.locked || this.phase !== 'aim')) return false;
    payload = payload || {};
    switch (id) {
      case 'heal': { const h = tank.heal(40); this.fx.explosion(tank.x, tank.cy, 40, '#69f0ae', { heal: true }); this.fx.text(tank.x, tank.cy - 34, `+${h}`, '#69f0ae'); break; }
      case 'shield': tank.armor = Math.min(100, tank.armor + PHYS.maxArmor); this.fx.rings.push({ x: tank.x, y: tank.cy, r0: 10, r1: 40, life: 0.6, max: 0.6, color: '#4fc3ff', w: 4 }); break;
      case 'teleport': {
        if (payload.x == null) {
          let x = 60, tries = 0;
          do { x = 60 + Math.floor(Math.random() * (WORLD_W - 120)); tries++; } while (tries < 30 && this.tanks.some((o) => o !== tank && o.alive && Math.abs(o.x - x) < 90));
          payload.x = x;
        }
        this.teleportTank(tank, payload.x, 0); break;
      }
      case 'double': tank.doubleDamage = true; break;
      case 'fuel': tank.fuel = PHYS.maxFuel; break;
      case 'ammo': {
        if (!payload.ids) {
          const ids = [...tank.arsenal.keys()].filter((k) => tank.arsenal.get(k) !== Infinity);
          payload.ids = [];
          for (let i = 0; i < 3 && ids.length; i++) payload.ids.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
        }
        for (const k of payload.ids) tank.addAmmo(k, 1);
        break;
      }
    }
    tank.items[id]--;
    if (this.online && !replay) (tank.roundItems = tank.roundItems || []).push({ id, payload });
    this.audio.play('item');
    const it = ITEMS.find((i) => i.id === id);
    this.message(`${tank.name} used ${it?.name || id}`, '#ffd740');
    return true;
  }

  teleportTank(tank, x, y) {
    tank.x = clamp(Math.round(x), 20, WORLD_W - 20);
    tank.y = this.terrain.surfaceY(tank.x, Math.max(0, y - 60));
    if (this.terrain.solid(tank.x, tank.y - 2)) tank.y = this.terrain.surfaceY(tank.x, 0);
    tank.vy = 0;
    this.fx.burst(tank.x, tank.cy, 30, 160, '#b39ddb', 0.6, 2.5, { add: true, g: 0 });
    this.audio.play('teleport');
  }

  // ------------------------------------------------------------ firing
  launch(tank, shot) {
    const w = getWeapon(shot.weaponId, tank.tier(shot.weaponId));
    if (!w) return;
    if (tank.ammo(w.id) !== Infinity && !(this.dev?.infAmmo && tank.isProfile)) tank.arsenal.set(w.id, Math.max(0, tank.ammo(w.id) - 1));
    const dmgMul = tank.doubleDamage ? 2 : 1;
    tank.doubleDamage = false;
    tank.stats.shots++;
    tank.recoil = 1;
    if (w.spec.laser) { this.fireLaser(tank, w, shot.angle, dmgMul); return; }
    const f = w.fire, n = f.n || 1;
    for (let i = 0; i < n; i++) {
      const frac = n > 1 ? i / (n - 1) - 0.5 : 0;
      const angle = shot.angle + frac * (f.spread || 0);
      let speedMul = 1;
      if (f.speedSteps) speedMul *= 1 - f.speedSteps * (n > 1 ? i / (n - 1) : 0);
      if (f.speedVar) speedMul *= 1 + (this.rng.next() - 0.5) * 2 * f.speedVar;
      const spec = f.colors ? { ...w.spec, color: f.colors[i % f.colors.length] } : w.spec;
      const make = () => {
        if (!tank.alive) return;
        const tip = tank.barrelTip();
        const v = shot.power * PHYS.launchSpeed * (spec.speed ?? 1) * speedMul;
        const a = rad(angle);
        const p = new Projectile(this, spec, tip.x, tip.y, Math.cos(a) * v, -Math.sin(a) * v, tank, { famId: w.id, dmgMul, index: i });
        this.projectiles.push(p);
        this.fx.burst(tip.x, tip.y, 6, 120, '#ffe082', 0.25, 2, { add: true, g: 0 });
        this.audio.play('fire', { pitch: 0.9 + Math.random() * 0.25, big: (spec.r || 4) > 6 });
        tank.recoil = 1;
      };
      const delay = (f.stagger || 0) * i;
      if (delay > 0) this.spawnQueue.push({ at: this.time + delay, fn: make }); else make();
    }
  }

  fireLaser(tank, w, angle, dmgMul) {
    const L = w.spec.laser, n = L.n || 1;
    const tip = tank.barrelTip();
    for (let i = 0; i < n; i++) {
      const a = rad(angle + (n > 1 ? (i / (n - 1) - 0.5) * (L.spread || 0) : 0));
      const dx = Math.cos(a), dy = -Math.sin(a);
      const end = this.terrain.raycast(tip.x, tip.y, dx, dy, L.len, 2);
      this.damageSegment(tip.x, tip.y, end.x, end.y, L.w / 2 + 2, L.dmg * dmgMul, tank, w.id);
      if (end.hit) {
        this.terrain.carve(end.x, end.y, Math.max(4, L.w * 1.1));
        this.fx.explosion(end.x, end.y, Math.max(10, L.w * 2), w.spec.color, { shake: 0.3 });
      }
      if (L.carve) this.terrain.carveLine(tip.x, tip.y, end.x, end.y, L.carve / 2);
      this.fx.beam(tip.x, tip.y, end.x, end.y, L.w, w.spec.color, 0.55);
    }
    this.audio.play('laser', { big: L.w > 10 });
  }

  fireSkyLaser(s) {
    const x = clamp(s.x, 2, WORLD_W - 2);
    const end = this.terrain.raycast(x, -20, 0, 1, WORLD_H + 40, 2);
    const ey = Math.min(end.y, s.y + 4);
    this.damageSegment(x, -20, x, ey, s.spec.w / 2 + 2, s.spec.dmg * s.dmgMul, s.owner, s.famId);
    this.terrain.carve(x, ey, Math.max(6, s.spec.w * 1.2));
    if (s.spec.carve) this.terrain.carveLine(x, Math.max(0, ey - 60), x, ey, s.spec.carve / 2);
    this.fx.beam(x, -20, x, ey, s.spec.w, s.color || '#ffd180', 0.6);
    this.fx.explosion(x, ey, Math.max(12, s.spec.w * 2), s.color || '#ffd180', { shake: 0.6 });
    this.audio.play('laser', { big: s.spec.w > 10 });
  }

  // Damage every tank near a segment (used by beams).
  damageSegment(x0, y0, x1, y1, radius, dmg, owner, famId) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    for (const t of this.tanks) {
      if (!t.alive || t === owner) continue;
      const u = clamp(((t.x - x0) * dx + (t.cy - y0) * dy) / len2, 0, 1);
      const px = x0 + dx * u, py = y0 + dy * u;
      const d = Math.hypot(t.x - px, t.cy - py);
      if (d < radius + PHYS.tankRadius) this.applyDamage(t, dmg, owner, famId);
    }
  }

  // ------------------------------------------------------------ explosions & spawning
  explode(proj, x, y, opts = {}) {
    const s = proj.spec, b = s.boom;
    const owner = proj.owner, famId = proj.famId;
    if (b && b.r > 0) {
      if (s.dirt) {
        this.terrain.fill(x, y, b.r);
        if (!this.headless) this.fx.explosion(x, y, b.r, s.color, { dirt: true });
        this.audio.play('dirt');
      } else {
        if (!s.nocrater) this.terrain.carve(x, y, b.r);
        if (s.heal) {
          for (const t of this.tanks) {
            if (!t.alive) continue;
            if (Math.hypot(t.x - x, t.cy - y) < b.r + PHYS.tankRadius) {
              const h = t.heal(s.heal);
              if (h > 0) this.fx.text(t.x, t.cy - 34, `+${h}`, '#69f0ae');
            }
          }
          if (!this.headless) this.fx.explosion(x, y, b.r, s.color, { heal: true });
          this.audio.play('item');
        } else {
          if (!this.headless) this.fx.explosion(x, y, b.r, s.color || '#ffb74d', { mushroom: s.mushroom, shake: s.shake });
          this.audio.play(b.r > 70 ? 'bigboom' : b.r > 34 ? 'boom' : 'smallboom');
          if (b.dmg > 0) this.damageArea(x, y, b.r, b.dmg * proj.dmgMul, owner, famId, s.pierce);
        }
        if (s.pull) this.pullTanks(x, y, s.pull);
      }
    }
    if (s.teleport && owner?.alive) this.teleportTank(owner, x, y);
    if (s.skylaser) {
      this.skyLasers.push({ x, y, spec: s.skylaser, owner, famId, at: this.time + (s.skylaser.delay || 0), dmgMul: proj.dmgMul, color: s.color });
      this.markers.push({ x, y, until: this.time + (s.skylaser.delay || 0), color: s.color });
    }
    if (s.marker && s.sky) this.markers.push({ x, y, until: this.time + (s.sky.delay || 0) + 0.2, color: s.color });
    if (opts.keepAlive) return;
    if (s.split) this.spawnChildren(proj, s.split, x, y);
    if (s.sky) this.spawnChildren(proj, s.sky, x, y);
  }

  damageArea(x, y, r, dmg, owner, famId, pierce) {
    const reach = r + PHYS.tankRadius;
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - x, t.cy - y);
      if (d >= reach) continue;
      const inner = r * 0.35;
      const f = d <= inner ? 1 : lerp(1, 0.25, (d - inner) / (reach - inner));
      const amount = Math.max(1, Math.round(dmg * f));
      this.applyDamage(t, amount, owner, famId, false, pierce);
    }
  }

  pullTanks(x, y, R) {
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - x, t.cy - y);
      if (d < R && d > 4) {
        const f = (1 - d / R) * 90;
        t.x = clamp(t.x + ((x - t.x) / d) * f, 10, WORLD_W - 10);
        t.y = this.terrain.surfaceY(Math.round(t.x), Math.max(0, t.y - 80));
      }
    }
  }

  applyDamage(t, amount, owner, famId, environmental = false, pierce = false) {
    if (!t.alive || amount <= 0) return 0;
    if (this.dev?.god && t.isProfile) { this.fx.text(t.x, t.cy - 34, 'GOD', '#ffd740'); return 0; }
    const dealt = t.takeDamage(amount, pierce);
    const hostile = owner && owner !== t && owner.team !== t.team;
    this.fx.text(t.x, t.cy - 34, `-${Math.round(dealt)}`, hostile || environmental ? '#ff5252' : '#ffab40', 22 + Math.min(14, dealt / 5));
    if (owner && owner !== t) t.lastHitBy = owner;
    if (hostile) {
      owner.stats.damage += dealt;
      owner.stats.hits++;
      owner.xp += dealt;
      if (famId) { owner.mastery = owner.mastery || {}; owner.mastery[famId] = (owner.mastery[famId] || 0) + dealt; }
      const w = famId ? getWeapon(famId) : null;
      this.message(`${owner.name} hit ${t.name} for ${Math.round(dealt)}${w ? ` (${w.fam.name})` : ''}`, '#ffffff');
    } else if (owner === t) {
      t.stats.selfDamage += dealt;
      this.message(`${t.name} hit themselves for ${Math.round(dealt)}`, '#ffab40');
    } else if (owner) {
      this.message(`${owner.name} hit teammate ${t.name} for ${Math.round(dealt)}`, '#ffab40');
    }
    this.audio.play('hit');
    if (t.hp <= 0) this.killTank(t, hostile ? owner : (t.lastHitBy && t.lastHitBy.team !== t.team ? t.lastHitBy : null));
    return dealt;
  }

  killTank(t, killer) {
    if (!t.alive) return;
    t.alive = false; t.hp = 0; t.deathTime = this.time;
    if (!this.headless) {
      this.fx.explosion(t.x, t.cy, 48, '#ff7043', { shake: 1 });
      this.fx.burst(t.x, t.cy, 18, 260, '#ff5252', 1.1, 3, { g: 1.2 });
    }
    this.audio.play('death');
    if (killer && killer !== t) { killer.stats.kills++; killer.xp += 40; this.message(`${killer.name} destroyed ${t.name}!`, '#ff5252'); }
    else this.message(`${t.name} was destroyed`, '#ff5252');
    if (!this.headless) {
      for (let i = 0; i < 7; i++) this.fx.emit(t.x, t.cy, (Math.random() - 0.5) * 320, -120 - Math.random() * 260, 1.2 + Math.random(), i % 2 ? '#37474f' : '#546e7a', 3 + Math.random() * 3, { g: 1.3, drag: 0.4 });
    }
    if (t === this.current) { this.current = null; if (!this.online) this.advanceAim(); }
  }

  spawnChildren(parent, sp, x = parent.x, y = parent.y) {
    if (parent.depth >= 4) return;
    const T = this.terrain;
    const pvx = parent.vx, pvy = parent.vy;
    const pdir = Math.atan2(pvy, pvx);
    const fwd = Math.sign(pvx) || parent.launchDir || 1;
    const spawn = () => {
      const n = sp.n;
      for (let i = 0; i < n; i++) {
        const frac = n > 1 ? i / (n - 1) - 0.5 : 0;
        let cx = x, cy = y, vx = 0, vy = 0, ang;
        const rng = this.rng;
        let speed = (sp.speed || 0) * (1 + (sp.speedVar ? (rng.next() - 0.5) * 2 * sp.speedVar : 0));
        let sticky;
        switch (sp.pattern) {
          case 'fan': ang = pdir + rad((sp.tilt || 0) * fwd) + rad(sp.spread || 0) * frac; break;
          case 'up': ang = -Math.PI / 2 + rad(sp.spread || 0) * frac; break;
          case 'down': ang = Math.PI / 2 + rad(sp.spread || 0) * frac; break;
          case 'ring': ang = (i / n) * Math.PI * 2 - Math.PI / 2; break;
          case 'random': ang = rng.next() * Math.PI * 2; speed *= 0.5 + rng.next() * 0.5; break;
          case 'v': ang = pdir + rad(sp.spread || 0) * frac; speed *= 1 + Math.abs(frac) * 0.8; break;
          case 'rain': cx = x + (sp.spread || 0) * frac + (rng.next() - 0.5) * 24; cy = Math.max(-30, y - 440); vy = speed; break;
          case 'line': cx = x + (sp.spread || 0) * frac; vy = speed; break;
          case 'ground': cx = clamp(x + (sp.spread || 0) * frac, 4, WORLD_W - 4); cy = T.surfaceY(cx, Math.max(0, y - 90)) - 3; sticky = (sp.stagger || 0) * i + 0.02; break;
          case 'groundfwd': cx = clamp(x + fwd * (sp.spread || 0) * (i + 1), 4, WORLD_W - 4); cy = T.surfaceY(cx, Math.max(0, y - 90)) - 3; sticky = (sp.stagger || 0) * (i + 1) + 0.02; break;
          case 'stack': cy = y - (sp.spread || 20) * i; sticky = 0.03 * i + 0.01; break;
          case 'rise': cx = x + (sp.spread || 0) * frac; cy = y + 140; vy = -speed; break;
          case 'aim': {
            const e = this.nearestEnemy(x, y, parent.owner);
            if (e) { const dx = e.x - x, dy = e.cy - 10 - y; const d = Math.hypot(dx, dy) || 1; vx = (dx / d) * speed; vy = (dy / d) * speed; }
            else vy = -speed;
            break;
          }
        }
        if (ang !== undefined) { vx = Math.cos(ang) * speed; vy = Math.sin(ang) * speed; }
        if (sp.inherit) { vx += pvx * sp.inherit; vy += pvy * sp.inherit; }
        const p = new Projectile(this, sp.spec, cx, cy, vx, vy, parent.owner, { famId: parent.famId, depth: parent.depth + 1, dmgMul: parent.dmgMul, child: true, index: i });
        if (sticky !== undefined) { p.sticking = true; p.stickT = p.spec.stick || sticky; }
        this.projectiles.push(p);
      }
      if (sp.pattern === 'rain' && !this.headless) this.audio.play('whistle');
    };
    if (sp.delay) this.spawnQueue.push({ at: this.time + sp.delay, fn: spawn }); else spawn();
  }

  onProjectileEnd(p) {
    if (p.depth === 0 && this.settings.tracers && p.path.length > 4) this.tracers.set(p.owner.id, p.path);
  }

  // ------------------------------------------------------------ crates
  // Crates land instantly in the simulation (the parachute descent is purely visual) so that
  // lockstep clients agree on where they are.
  spawnCrate(atX = null, type = null) {
    const x = atX ?? this.rng.int(90, WORLD_W - 90);
    type = type || (this.rng.chance(0.7) ? 'weapon' : 'health');
    const y = this.terrain.surfaceY(x, 0) - 12;
    this.crates.push({ x, y, vy: 0, type, landed: true, drop: 0, t: 0 });
    this.message(type === 'weapon' ? 'Supply drop incoming!' : 'Repair crate incoming!', '#ffd740');
  }

  updateCrates(dt) {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.t += dt;
      c.drop = Math.min(1, c.drop + dt / 1.8);
      if (!c.landed) {
        c.vy += 500 * dt; c.y += c.vy * dt;
        if (this.terrain.solid(c.x, c.y + 12)) { c.landed = true; c.vy = 0; const air = this.terrain.airAbove(c.x, c.y + 12, 40); if (air >= 0) c.y = air - 12; }
        if (c.y > WORLD_H + 40) { this.crates.splice(i, 1); continue; }
      } else if (!this.terrain.solid(c.x, c.y + 14)) { c.landed = false; c.vy = 0; }
    }
    if (!(this.online && this.phase === 'aim')) this.checkCratePickups();
  }

  checkCratePickups() {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (!this.online && c.drop < 1) continue;
      for (const t of this.tanks) {
        if (!t.alive) continue;
        if (Math.abs(t.x - c.x) < 28 && Math.abs(t.cy - c.y) < 34) { this.grabCrate(t, c); this.crates.splice(i, 1); break; }
      }
    }
  }

  grabCrate(t, c) {
    this.audio.play('pickup');
    this.fx.burst(c.x, c.y, 20, 140, '#ffd740', 0.6, 2.5, { add: true, g: 0.3 });
    if (c.type === 'health') {
      const h = t.heal(35);
      this.fx.text(t.x, t.cy - 34, `+${h}`, '#69f0ae');
      this.message(`${t.name} picked up a repair crate`, '#69f0ae');
      this.on.crate?.(t, 'Repair crate: +35 HP');
      return;
    }
    const pool = FAMILIES.filter((f) => f.id !== 'shot');
    const known = pool.filter((f) => t.arsenal.has(f.id));
    const fam = (known.length && this.rng.chance(0.6)) ? this.rng.pick(known) : this.rng.pick(pool);
    if (!t.tiers[fam.id]) t.tiers[fam.id] = 1;
    t.addAmmo(fam.id, 1);
    this.message(`${t.name} found ${fam.name}`, '#ffd740');
    this.on.crate?.(t, `Found: ${fam.name}`);
  }
}
