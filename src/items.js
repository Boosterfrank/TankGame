// Consumable items usable during the aiming phase (they do not end your turn).
// Every item type comes in three tiers. Players start with two of each type; the tier of each
// starting item is rolled with odds that improve with level, and supply crates hand out more.
export const ITEM_TYPES = [
  { type: 'heal', icon: 'heart', color: '#43a047', tiers: [
    { id: 'heal', name: 'Repair Kit', desc: 'Restore 40 HP instantly.', amount: 40 },
    { id: 'heal2', name: 'Field Repair', desc: 'Restore 70 HP instantly.', amount: 70 },
    { id: 'heal3', name: 'Full Overhaul', desc: 'Restore all HP and gain 25 armor.', amount: Infinity, armor: 25 },
  ] },
  { type: 'shield', icon: 'shield', color: '#1e88e5', tiers: [
    { id: 'shield', name: 'Shield', desc: 'Gain 50 armor that absorbs damage before HP.', amount: 50 },
    { id: 'shield2', name: 'Heavy Shield', desc: 'Gain 75 armor.', amount: 75 },
    { id: 'shield3', name: 'Fortress', desc: 'Armor to the 100 cap and repair 20 HP.', amount: 100, heal: 20 },
  ] },
  { type: 'teleport', icon: 'tele', color: '#8e24aa', tiers: [
    { id: 'teleport', name: 'Teleport', desc: 'Jump to a random spot on the map.', picks: 1 },
    { id: 'teleport2', name: 'Tactical Teleport', desc: 'Jump to a random spot well away from enemies.', picks: 6 },
    { id: 'teleport3', name: 'High Ground', desc: 'Jump to high ground far from enemies.', picks: 10, high: true },
  ] },
  { type: 'double', icon: 'x2', color: '#e53935', tiers: [
    { id: 'double', name: 'Double Damage', desc: 'Your next shot deals double damage.', mult: 2 },
    { id: 'double2', name: 'Heavy Shells', desc: 'Your next shot deals 2.5× damage.', mult: 2.5 },
    { id: 'double3', name: 'Triple Damage', desc: 'Your next shot deals triple damage.', mult: 3, icon: 'x3' },
  ] },
  { type: 'fuel', icon: 'fuel', color: '#fb8c00', tiers: [
    { id: 'fuel', name: 'Fuel Can', desc: 'Refill your fuel tank completely.', cap: 1 },
    { id: 'fuel2', name: 'Reserve Tank', desc: 'Refill, and +50% fuel capacity for the rest of the battle.', cap: 1.5 },
    { id: 'fuel3', name: 'Nitro', desc: 'Refill, double fuel capacity and drive 50% faster for the rest of the battle.', cap: 2, speed: 1.5 },
  ] },
  { type: 'ammo', icon: 'box', color: '#6d4c41', tiers: [
    { id: 'ammo', name: 'Ammo Pack', desc: '+1 ammo for three random weapons you own.', count: 3 },
    { id: 'ammo2', name: 'Ammo Crate', desc: '+1 ammo for six random weapons you own.', count: 6 },
    { id: 'ammo3', name: 'Full Restock', desc: '+1 ammo for every weapon you own.', count: Infinity },
  ] },
];

export const TIER_NAMES = ['I', 'II', 'III'];
export const ITEMS = ITEM_TYPES.flatMap((g) => g.tiers.map((t, i) => ({ icon: g.icon, color: g.color, ...t, type: g.type, tier: i + 1 })));
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const ITEM_TYPE_BY_ID = Object.fromEntries(ITEM_TYPES.map((g) => [g.type, g]));

// Odds of tier I / II / III for a player of the given level (a roll in [0,1) picks one).
export function tierOdds(level) {
  const L = Math.max(1, Math.min(60, level || 1));
  const p3 = 0.08 + (L - 1) * 0.0055;        // 8% at level 1 → ~40% at level 60
  const p2 = Math.min(0.45, 0.22 + (L - 1) * 0.006);
  return [Math.max(0, 1 - p2 - p3), p2, p3];
}

export function rollTier(roll, level) {
  const [p1, p2] = tierOdds(level);
  return roll < p1 ? 1 : roll < p1 + p2 ? 2 : 3;
}

export function itemId(type, tier) { return ITEM_TYPE_BY_ID[type].tiers[Math.max(1, Math.min(3, tier)) - 1].id; }

// Highest-tier item of a type the tank still has (or null).
export function bestItem(tank, type) {
  const g = ITEM_TYPE_BY_ID[type];
  for (let i = g.tiers.length - 1; i >= 0; i--) if (tank.items[g.tiers[i].id] > 0) return g.tiers[i].id;
  return null;
}

export function itemCount(tank, type = null) {
  let n = 0;
  for (const it of ITEMS) if (!type || it.type === type) n += tank.items[it.id] || 0;
  return n;
}
