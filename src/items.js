// Consumable items usable during the aiming phase (they do not end your turn).
export const ITEMS = [
  { id: 'heal', name: 'Repair Kit', icon: 'heart', color: '#43a047', desc: 'Restore 40 HP instantly.' },
  { id: 'shield', name: 'Shield', icon: 'shield', color: '#1e88e5', desc: 'Gain 50 armor that absorbs damage before HP.' },
  { id: 'teleport', name: 'Teleport', icon: 'tele', color: '#8e24aa', desc: 'Jump to a random spot on the map.' },
  { id: 'double', name: 'Double Damage', icon: 'x2', color: '#e53935', desc: 'Your next shot deals double damage.' },
  { id: 'fuel', name: 'Fuel Can', icon: 'fuel', color: '#fb8c00', desc: 'Refill your fuel tank completely.' },
  { id: 'ammo', name: 'Ammo Pack', icon: 'box', color: '#6d4c41', desc: '+1 ammo for three random weapons you own.' },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
