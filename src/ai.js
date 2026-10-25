// Bot aiming: brute-force search over angle/power using the same physics constants as the engine,
// then degrade the best answer according to difficulty.
import { PHYS, WORLD_W, WORLD_H } from './config.js';
import { bestItem } from './items.js';
import { getWeapon, FAMILIES } from './weapons.js';
import { normSpec } from './projectile.js';
import { rad, clamp } from './util.js';

function simulate(game, tank, angle, power, spec, maxT = 7) {
  const tip = tank.barrelTip();
  const a = rad(angle);
  const v = power * PHYS.launchSpeed * spec.speed;
  let x = tip.x, y = tip.y, vx = Math.cos(a) * v, vy = -Math.sin(a) * v;
  const dt = 1 / 50;
  const T = game.terrain;
  let t = 0;
  while (t < maxT) {
    t += dt;
    vy += PHYS.gravity * spec.g * dt;
    vx += game.wind * PHYS.windAccel * spec.wind * dt;
    if (spec.drag) { const f = Math.max(0, 1 - spec.drag * dt); vx *= f; vy *= f; }
    if (spec.thrust && t < spec.thrust.dur) {
      if (spec.thrust.mode === 'up') vy -= spec.thrust.a * dt;
      else { const sp = Math.hypot(vx, vy) || 1; vx += (vx / sp) * spec.thrust.a * dt; vy += (vy / sp) * spec.thrust.a * dt; }
    }
    const sp = Math.hypot(vx, vy);
    const steps = Math.max(1, Math.ceil((sp * dt) / 4));
    for (let i = 0; i < steps; i++) {
      x += (vx * dt) / steps; y += (vy * dt) / steps;
      if (x < -100 || x > WORLD_W + 100 || y > WORLD_H + 10) return { x, y, t, oob: true };
      for (const o of game.tanks) {
        if (!o.alive) continue;
        if (o === tank && t < 0.25) continue;
        const dx = x - o.x, dy = y - o.cy;
        if (dx * dx + dy * dy < (PHYS.tankRadius + 3) ** 2) return { x, y, t, tank: o };
      }
      if (T.solid(x, y)) return { x, y, t };
    }
  }
  return { x, y, t, timeout: true };
}

function score(game, bot, target, end, blastR) {
  if (end.oob || end.timeout) return -5000;
  let s = 0;
  const d = Math.hypot(end.x - target.x, end.y - target.cy);
  s -= d;
  if (end.tank === target) s += 400;
  if (end.tank && end.tank !== target && end.tank.team === bot.team) s -= 2500;
  for (const o of game.tanks) {
    if (!o.alive) continue;
    const od = Math.hypot(end.x - o.x, end.y - o.cy);
    if (o === bot && od < blastR + PHYS.tankRadius) s -= 2200;
    else if (o.team === bot.team && o !== bot && od < blastR + PHYS.tankRadius) s -= 1200;
    else if (o.team !== bot.team && o !== target && od < blastR) s += 150;
  }
  return s;
}

function pickTarget(game, bot) {
  const enemies = game.tanks.filter((t) => t.alive && t.team !== bot.team);
  if (!enemies.length) return null;
  // Prefer wounded and nearby targets.
  let best = null, bestScore = -Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - bot.x, e.cy - bot.cy);
    const sc = -d * 0.5 - e.hp * 1.5 + Math.random() * 120;
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  return best;
}

function weaponPower(w) {
  const s = w.spec;
  let p = 0;
  if (s.boom) p += s.boom.dmg * (1 + s.boom.r / 60);
  if (s.laser) p += s.laser.dmg * (s.laser.n || 1);
  if (s.skylaser) p += s.skylaser.dmg;
  for (const k of ['apex', 'split', 'sky']) if (s[k] && s[k].spec?.boom) p += s[k].n * s[k].spec.boom.dmg * 0.6;
  if (s.timed && s.timed.spec?.boom) p += s.timed.repeat * s.timed.spec.boom.dmg * 0.5;
  if (s.ufo && s.ufo.bomb?.boom) p += s.ufo.drops * s.ufo.bomb.boom.dmg * 0.5;
  p *= w.fire.n || 1;
  return p;
}

function chooseWeapon(bot, diff) {
  const options = [];
  for (const [id, ammo] of bot.arsenal) {
    if (ammo <= 0) continue;
    const w = getWeapon(id, bot.tier(id));
    if (!w) continue;
    const s = w.spec;
    if (s.heal || s.teleport || s.dirt || w.fam.cat === 'terrain') continue;
    options.push({ w, power: weaponPower(w) });
  }
  if (!options.length) return getWeapon('shot', bot.tier('shot'));
  // Often just use Shot (more so on Easy); otherwise pick randomly, mildly favoring stronger weapons.
  const shotChance = { Easy: 0.6, Normal: 0.4, Hard: 0.3 }[diff] ?? 0.4;
  if (Math.random() < shotChance) return getWeapon('shot', bot.tier('shot'));
  const strong = options.filter((o) => o.w.id !== 'shot');
  if (!strong.length) return options[0].w;
  const weights = strong.map((o) => Math.pow(Math.max(1, o.power), 0.6));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < strong.length; i++) { r -= weights[i]; if (r <= 0) return strong[i].w; }
  return strong[strong.length - 1].w;
}

function losClear(game, bot, target) {
  const tip = bot.barrelTip();
  const dx = target.x - tip.x, dy = target.cy - tip.y;
  const d = Math.hypot(dx, dy);
  const hit = game.terrain.raycast(tip.x, tip.y, dx, dy, d - PHYS.tankRadius, 3);
  return !hit.hit;
}

export function planBotShot(game, bot) {
  const diff = game.settings.difficulty || 'Normal';
  const target = pickTarget(game, bot);
  if (!target) return { weaponId: 'shot', angle: 60, power: 50 };
  let weapon = chooseWeapon(bot, diff);
  // Lasers need line of sight; otherwise fall back to a shell.
  if (weapon.spec.laser) {
    if (losClear(game, bot, target)) {
      const tip = bot.barrelTip();
      let ang = Math.atan2(-(target.cy - tip.y), target.x - tip.x) * 180 / Math.PI;
      if (ang < -90) ang += 360;
      ang = clamp(ang, -90, 270);
      const jitter = diff === 'Hard' ? 1 : diff === 'Normal' ? 3 : 7;
      return { weaponId: weapon.id, angle: ang + (Math.random() - 0.5) * jitter, power: 100 };
    }
    weapon = getWeapon('shot', bot.tier('shot'));
  }
  const spec = normSpec(weapon.spec);
  const blastR = spec.boom?.r || 30;
  const candidates = [];
  const faceRight = target.x > bot.x;
  const aMin = faceRight ? 8 : 92, aMax = faceRight ? 88 : 172;
  for (let angle = aMin; angle <= aMax; angle += 3) {
    for (let power = 22; power <= 100; power += 6) {
      const end = simulate(game, bot, angle, power, spec);
      candidates.push({ angle, power, s: score(game, bot, target, end, blastR) });
    }
  }
  // Also try high lobs over obstacles in the other direction-ish range.
  for (let angle = faceRight ? 60 : 100; faceRight ? angle <= 100 : angle >= 80; angle += faceRight ? 4 : -4) {
    for (let power = 40; power <= 100; power += 8) {
      const end = simulate(game, bot, angle, power, spec);
      candidates.push({ angle, power, s: score(game, bot, target, end, blastR) });
    }
  }
  candidates.sort((a, b) => b.s - a.s);
  let pick;
  let jitterA, jitterP;
  if (diff === 'Hard') { pick = candidates[0]; jitterA = 1.2; jitterP = 1.5; }
  else if (diff === 'Normal') { pick = candidates[Math.floor(Math.random() * Math.min(6, candidates.length))]; jitterA = 2.5; jitterP = 3.5; }
  else { pick = candidates[Math.floor(Math.random() * Math.min(40, candidates.length))]; jitterA = 6; jitterP = 8; }
  return {
    weaponId: weapon.id,
    angle: clamp(pick.angle + (Math.random() - 0.5) * 2 * jitterA, 0, 180),
    power: clamp(pick.power + (Math.random() - 0.5) * 2 * jitterP, 5, 100),
  };
}

// Bots occasionally use items.
export function planBotItems(game, bot) {
  const used = [];
  const heal = bestItem(bot, 'heal'), shield = bestItem(bot, 'shield'), dbl = bestItem(bot, 'double');
  if (heal && bot.hp < bot.maxHp * 0.45) used.push(heal);
  if (shield && bot.hp < bot.maxHp * 0.6 && Math.random() < 0.6) used.push(shield);
  if (dbl && Math.random() < 0.12) used.push(dbl);
  return used;
}

// Give a bot an arsenal appropriate to its level.
export function botArsenal(bot, level, all = false) {
  for (const f of FAMILIES) {
    if (all || f.unlock <= level) {
      bot.arsenal.set(f.id, f.ammo);
      bot.tiers[f.id] = Math.min(f.tiers.length, 1 + Math.floor(Math.max(0, level - f.unlock) / 12));
    }
  }
}
