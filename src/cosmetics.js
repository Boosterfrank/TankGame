// Cosmetic items sold for gears: hull paint patterns, turret accessories, shot trails and titles.
// Patterns are drawn in shades of the tank's team color so friend/foe stays readable.
export const SLOTS = [
  { id: 'pattern', name: 'Paint' },
  { id: 'accessory', name: 'Accessories' },
  { id: 'trail', name: 'Trails' },
  { id: 'title', name: 'Titles' },
];

export const COSMETICS = {
  pattern: [
    { id: 'none', name: 'Factory Paint', price: 0, desc: 'Clean and simple.' },
    { id: 'stripes', name: 'Racing Stripes', price: 60, desc: 'Two bold stripes across the hull.' },
    { id: 'checker', name: 'Checkered', price: 70, desc: 'Finish-line flag livery.' },
    { id: 'chevron', name: 'Chevrons', price: 80, desc: 'Pointing the way forward.' },
    { id: 'camo', name: 'Camo', price: 90, desc: 'Blends in. Sort of.' },
    { id: 'hex', name: 'Hex Plating', price: 120, desc: 'Honeycomb armor plates.' },
    { id: 'bolt', name: 'Lightning', price: 130, desc: 'A bright bolt down the side.' },
    { id: 'carbon', name: 'Carbon Fiber', price: 140, desc: 'Lightweight and expensive-looking.' },
    { id: 'flames', name: 'Hot Rod Flames', price: 150, desc: 'Flames make everything faster.' },
  ],
  accessory: [
    { id: 'none', name: 'No Accessory', price: 0, desc: 'Stock turret.' },
    { id: 'antenna', name: 'Antenna Flag', price: 40, desc: 'A little flag on a whip antenna.' },
    { id: 'mohawk', name: 'Mohawk', price: 90, desc: 'Punk rock turret.' },
    { id: 'spikes', name: 'Turret Spikes', price: 100, desc: 'Menacing steel spikes.' },
    { id: 'horns', name: 'Devil Horns', price: 110, desc: 'Up to no good.' },
    { id: 'tophat', name: 'Top Hat', price: 120, desc: 'Dapper under fire.' },
    { id: 'propeller', name: 'Propeller Cap', price: 130, desc: 'Does not actually fly.' },
    { id: 'halo', name: 'Halo', price: 160, desc: 'Too good for this battlefield.' },
    { id: 'crown', name: 'Crown', price: 200, desc: 'Royalty on treads.' },
  ],
  trail: [
    { id: 'none', name: 'Standard Trail', price: 0, desc: 'Plain white dots.' },
    { id: 'shadow', name: 'Shadow Trail', price: 80, desc: 'Dark smoke follows your shells.' },
    { id: 'ice', name: 'Ice Trail', price: 100, desc: 'Frosty blue sparks.' },
    { id: 'toxic', name: 'Toxic Trail', price: 100, desc: 'Radioactive green sparks.' },
    { id: 'fire', name: 'Fire Trail', price: 120, desc: 'Every shell is a comet.' },
    { id: 'rainbow', name: 'Rainbow Trail', price: 160, desc: 'Taste the spectrum.' },
    { id: 'gold', name: 'Gold Sparkle', price: 180, desc: 'Expensive-looking shells.' },
  ],
  title: [
    { id: 'none', name: 'No Title', price: 0, desc: 'Just your name.' },
    { id: 'rookie', name: 'Rookie', price: 30, desc: 'Everyone starts somewhere.' },
    { id: 'pacifist', name: 'Pacifist', price: 50, desc: 'Ironically.' },
    { id: 'ace', name: 'Ace', price: 60, desc: 'Precision incarnate.' },
    { id: 'sharpshooter', name: 'Sharpshooter', price: 90, desc: 'Never misses. Allegedly.' },
    { id: 'demolitions', name: 'Demolitions', price: 90, desc: 'Big craters, bigger smile.' },
    { id: 'nukeenjoyer', name: 'Nuke Enjoyer', price: 120, desc: 'Self-explanatory.' },
    { id: 'bigboss', name: 'Big Boss', price: 150, desc: 'Runs the lobby.' },
    { id: 'legend', name: 'Legend', price: 200, desc: 'Spoken of in hushed tones.' },
  ],
};

// How equipped trails restyle plain shells (special weapons keep their own look).
export const TRAIL_STYLES = {
  rainbow: { trail: 'dot', rainbow: true },
  fire: { trail: 'fire', color: '#ffb74d' },
  ice: { trail: 'spark', color: '#80d8ff' },
  toxic: { trail: 'spark', color: '#76ff03' },
  gold: { trail: 'spark', color: '#ffd740' },
  shadow: { trail: 'smoke', color: '#546e7a' },
};

export function defaultCosmetics() {
  return { owned: [], equipped: { pattern: 'none', accessory: 'none', trail: 'none', title: 'none' } };
}

export function cosmeticsOf(p) {
  return { ...defaultCosmetics().equipped, ...((p && p.cosmetics && p.cosmetics.equipped) || {}) };
}

export function ownsCosmetic(p, slot, id) {
  return id === 'none' || ((p.cosmetics && p.cosmetics.owned) || []).includes(`${slot}:${id}`);
}

export function cosmeticItem(slot, id) { return (COSMETICS[slot] || []).find((c) => c.id === id) || null; }
export function titleName(id) { const t = cosmeticItem('title', id); return t && t.id !== 'none' ? t.name : ''; }

// Sanitize cosmetics received from the network.
export function cleanCosmetics(c) {
  const out = defaultCosmetics().equipped;
  if (!c || typeof c !== 'object') return out;
  for (const slot of SLOTS) if (cosmeticItem(slot.id, c[slot.id])) out[slot.id] = c[slot.id];
  return out;
}
