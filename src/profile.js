// Local player profile: level, XP, gears, weapon mastery. Persisted in localStorage.
import { FAMILIES, FAMILY_BY_ID, MASTERY_XP, tierForMastery } from './weapons.js';
import { defaultCosmetics, cosmeticItem, ownsCosmetic } from './cosmetics.js';

const KEY = 'utg.profile.v1';

export function defaultProfile() {
  return {
    name: 'Commander',
    level: 1, xp: 0, gears: 0,
    weaponXp: {}, weaponTier: {},
    stats: { games: 0, wins: 0, kills: 0, damage: 0, shots: 0 },
    settings: { sound: true, volume: 0.7, music: true, musicVolume: 0.6, intro: true, named: false },
    cosmetics: defaultCosmetics(),
    created: Date.now(),
  };
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = { ...defaultProfile(), ...JSON.parse(raw) };
    p.stats = { ...defaultProfile().stats, ...(p.stats || {}) };
    p.settings = { ...defaultProfile().settings, ...(p.settings || {}) };
    p.cosmetics = { ...defaultCosmetics(), ...(p.cosmetics || {}) };
    p.cosmetics.equipped = { ...defaultCosmetics().equipped, ...(p.cosmetics.equipped || {}) };
    return p;
  } catch (e) { return defaultProfile(); }
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
}

export function resetProfile() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } return defaultProfile(); }

export const MAX_LEVEL = 99;

// XP needed to go from level L to L+1.
export function xpForLevel(L) {
  return Math.round((100 + 60 * Math.pow(L - 1, 1.4)) / 10) * 10;
}

export function unlockedFamilies(p) { return FAMILIES.filter((f) => f.unlock <= p.level); }
export function unlockedIds(p) { return unlockedFamilies(p).map((f) => f.id); }

export function weaponTier(p, famId) {
  const fam = FAMILY_BY_ID[famId];
  if (!fam) return 1;
  const mastery = tierForMastery(p.weaponXp[famId] || 0, fam);
  return Math.min(fam.tiers.length, Math.max(mastery, p.weaponTier[famId] || 1));
}

export function allTiers(p) {
  const out = {};
  for (const f of FAMILIES) out[f.id] = weaponTier(p, f.id);
  return out;
}

export function nextMasteryXp(p, famId) {
  const fam = FAMILY_BY_ID[famId];
  const t = weaponTier(p, famId);
  if (t >= fam.tiers.length) return null;
  return MASTERY_XP[t];
}

// Tier upgrades cost more for weapons that unlock later and for higher tiers:
// a level-1 weapon runs 25/35/50 gears, a level-50 weapon 170/270/375.
export function upgradeCost(p, famId) {
  const t = weaponTier(p, famId);
  const fam = FAMILY_BY_ID[famId];
  if (t >= fam.tiers.length) return null;
  const base = 20 + fam.unlock * 3;
  const mult = [1, 1.6, 2.2][t - 1] || 2.2;
  return Math.round((base * mult) / 5) * 5;
}

export function buyCosmetic(p, slot, id) {
  const item = cosmeticItem(slot, id);
  if (!item || ownsCosmetic(p, slot, id) || p.gears < item.price) return false;
  p.gears -= item.price;
  p.cosmetics.owned.push(`${slot}:${id}`);
  p.cosmetics.equipped[slot] = id;
  saveProfile(p);
  return true;
}

export function equipCosmetic(p, slot, id) {
  if (!ownsCosmetic(p, slot, id)) return false;
  p.cosmetics.equipped[slot] = id;
  saveProfile(p);
  return true;
}

export function buyUpgrade(p, famId) {
  const cost = upgradeCost(p, famId);
  if (cost == null || p.gears < cost) return false;
  p.gears -= cost;
  p.weaponTier[famId] = weaponTier(p, famId) + 1;
  saveProfile(p);
  return true;
}

// Apply a finished game's results for the profile player. Returns a summary for the results screen.
export function applyGameResults(p, { xp, kills, damage, shots, won, mastery }) {
  const summary = { xp, gears: 0, levelUps: [], unlocks: [], masteryUps: [], before: p.level, beforeXp: p.xp };
  p.stats.games++; if (won) p.stats.wins++;
  p.stats.kills += kills; p.stats.damage += Math.round(damage); p.stats.shots += shots;
  const gears = 8 + kills * 3 + (won ? 12 : 0) + Math.round(damage / 30);
  p.gears += gears; summary.gears = gears;
  p.xp += Math.round(xp);
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    summary.levelUps.push(p.level);
    for (const f of FAMILIES) if (f.unlock === p.level) summary.unlocks.push(f.id);
  }
  for (const [famId, dmg] of Object.entries(mastery || {})) {
    const fam = FAMILY_BY_ID[famId];
    if (!fam) continue;
    const before = weaponTier(p, famId);
    p.weaponXp[famId] = (p.weaponXp[famId] || 0) + Math.round(dmg);
    const after = weaponTier(p, famId);
    if (after > before) summary.masteryUps.push({ id: famId, tier: after });
  }
  saveProfile(p);
  return summary;
}
