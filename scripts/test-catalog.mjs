// Sanity checks for the weapon catalog and terrain generator (node, no browser needed).
import { FAMILIES, TOTAL_WEAPONS, getWeapon, CATEGORIES } from '../src/weapons.js';
import { generateHeights, MAP_STYLES } from '../src/terrain-gen.js';

let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.error('FAIL:', msg); } };

const ids = new Set();
const names = new Set();
for (const f of FAMILIES) {
  check(!ids.has(f.id), `duplicate id ${f.id}`); ids.add(f.id);
  check(!names.has(f.name), `duplicate name ${f.name}`); names.add(f.name);
  check(CATEGORIES.some((c) => c.id === f.cat), `${f.id}: unknown category ${f.cat}`);
  check(f.unlock >= 1 && f.unlock <= 60, `${f.id}: unlock level ${f.unlock}`);
  check(f.tiers.length >= 3, `${f.id}: needs >= 3 tiers`);
  check(typeof f.desc === 'string' && f.desc.length > 8, `${f.id}: description`);
  check(typeof f.icon === 'string', `${f.id}: icon`);
  for (const t of f.tiers) {
    const w = getWeapon(f.id, t.tier);
    check(w && w.spec && w.fire, `${f.id} tier ${t.tier}: resolvable`);
    const s = t.spec;
    const hasEffect = s.boom || s.laser || s.skylaser || s.apex || s.split || s.sky || s.timed || s.ufo || s.teleport;
    check(hasEffect, `${f.id}: tier ${t.tier} has no effect`);
  }
}
console.log(`families: ${FAMILIES.length}, total weapons (with tiers): ${TOTAL_WEAPONS}`);
check(TOTAL_WEAPONS > 300, 'need over 300 weapons');

// unlock distribution
const perLevel = {};
for (const f of FAMILIES) perLevel[f.unlock] = (perLevel[f.unlock] || 0) + 1;
const levels = Object.keys(perLevel).map(Number).sort((a, b) => a - b);
console.log('unlocks per level:', levels.map((l) => `${l}:${perLevel[l]}`).join(' '));
check(perLevel[1] >= 3, 'level 1 should unlock at least 3 families');

// terrain
for (const m of MAP_STYLES) {
  for (let seed = 1; seed <= 5; seed++) {
    const { heights } = generateHeights(m.id, seed, 1920, 920);
    check(heights.length === 1920, `${m.id}: heights length`);
    for (let x = 0; x < heights.length; x++) check(heights[x] >= 70 && heights[x] <= 880 && !Number.isNaN(heights[x]), `${m.id}: height range at ${x}: ${heights[x]}`);
  }
}
console.log(fails ? `${fails} failures` : 'all checks passed');
process.exit(fails ? 1 : 0);
