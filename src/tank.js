import { PHYS } from './config.js';
import { clamp } from './util.js';

let nextId = 1;

export class Tank {
  constructor(def) {
    this.id = nextId++;
    this.name = def.name;
    this.isBot = !!def.isBot;
    this.isProfile = !!def.isProfile; // the local player's saved profile
    this.team = def.team ?? this.id;
    this.level = def.level || 1;
    this.maxHp = def.hp || 100;
    this.hp = this.maxHp;
    this.armor = 0;
    this.fuel = PHYS.maxFuel;
    this.x = def.x || 0; this.y = def.y || 0; this.vy = 0;
    this.angle = def.angle ?? 60;
    this.power = 62;
    this.tilt = 0;
    this.alive = true;
    this.onGround = true;
    this.arsenal = new Map();   // famId -> ammo
    this.tiers = {};            // famId -> tier
    this.weaponId = 'shot';
    this.items = {};            // itemId -> count
    this.locked = false;
    this.shot = null;
    this.doubleDamage = false;
    this.stats = { damage: 0, kills: 0, shots: 0, hits: 0, selfDamage: 0 };
    this.xp = 0;
    this.lastHitBy = null;
    this.deathTime = 0;
    this.ai = null;
    this.netId = null;
    this.connected = true;
    this.roundItems = [];
    this.roundCrates = [];
    this.roundDev = [];
    this.god = false;
    this.dummy = false;
  }

  get cy() { return this.y - 12; }
  // Angle runs from -90 (straight down, facing right) through 90 (up) to 270 (straight down, facing left).
  get facing() { return this.angle > 90 && this.angle <= 270 ? -1 : 1; }
  // Signed angle relative to the facing direction, as ShellShock shows it (-90..90).
  get displayAngle() { return this.facing > 0 ? this.angle : 180 - this.angle; }

  pivot() { return { x: this.x, y: this.y - 23 }; }

  barrelTip() {
    const p = this.pivot();
    const a = (this.angle * Math.PI) / 180;
    return { x: p.x + Math.cos(a) * 28, y: p.y - Math.sin(a) * 28 };
  }

  ammo(id) { return this.arsenal.get(id) ?? 0; }
  tier(id) { return this.tiers[id] || 1; }

  addAmmo(id, n = 1) {
    const cur = this.arsenal.get(id) ?? 0;
    this.arsenal.set(id, cur === Infinity ? Infinity : cur + n);
  }

  takeDamage(amount, pierce = false) {
    if (!this.alive) return 0;
    let left = amount;
    if (!pierce && this.armor > 0) {
      const absorbed = Math.min(this.armor, left);
      this.armor -= absorbed; left -= absorbed;
    }
    const dealt = Math.min(this.hp, left);
    this.hp -= dealt;
    return dealt + (amount - left);
  }

  heal(n) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp - before;
  }

  // Keep the tank on the terrain: fall through air, climb out if buried, tilt with the slope.
  settle(terrain, dt) {
    if (!this.alive) return;
    const x = Math.round(clamp(this.x, 8, terrain.w - 8));
    this.x = x;
    if (terrain.solid(x, this.y - 2)) {
      const air = terrain.airAbove(x, this.y - 2, 160);
      if (air >= 0) { this.y = air + 1; this.vy = 0; }
      else { terrain.carve(x, this.y - 10, 22); }
    }
    const ground = terrain.surfaceY(x, Math.max(0, this.y - 1));
    if (ground > this.y + 0.5) {
      this.onGround = false;
      this.vy += PHYS.gravity * dt;
      this.y = Math.min(ground, this.y + this.vy * dt);
      if (this.y >= ground) { this.y = ground; this.vy = 0; this.onGround = true; }
    } else {
      this.y = ground; this.vy = 0; this.onGround = true;
    }
    const l = terrain.surfaceY(x - 10, Math.max(0, this.y - 30));
    const r = terrain.surfaceY(x + 10, Math.max(0, this.y - 30));
    const target = Math.atan2(clamp(r - l, -24, 24), 20);
    this.tilt += (target - this.tilt) * Math.min(1, dt * 10);
  }

  // Drive left/right. Returns true if moved.
  move(dir, dt, terrain) {
    if (!this.alive || this.fuel <= 0 || !this.onGround) return false;
    const dx = dir * PHYS.tankSpeed * dt;
    const nx = clamp(this.x + dx, 10, terrain.w - 10);
    const ny = terrain.surfaceY(Math.round(nx), Math.max(0, this.y - 16));
    if (this.y - ny > 14) return false; // too steep
    this.x = nx; this.y = ny;
    this.fuel = Math.max(0, this.fuel - Math.abs(dx) * PHYS.fuelPerPx);
    return true;
  }
}
