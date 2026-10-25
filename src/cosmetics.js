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
    { id: 'dots', name: 'Polka Dots', price: 60, desc: 'Cheerful and a little silly.' },
    { id: 'plaid', name: 'Plaid', price: 70, desc: 'Lumberjack approved.' },
    { id: 'waves', name: 'Waves', price: 80, desc: 'Surf is up.' },
    { id: 'zebra', name: 'Zebra', price: 90, desc: 'Confuses predators. Not shells.' },
    { id: 'tiger', name: 'Tiger', price: 100, desc: 'Earn your stripes.' },
    { id: 'digital', name: 'Digital Camo', price: 110, desc: 'Pixel-perfect concealment.' },
    { id: 'rust', name: 'Rust Bucket', price: 110, desc: 'Been through some things.' },
    { id: 'stars', name: 'Starry', price: 120, desc: 'Five-star armor rating.' },
    { id: 'leopard', name: 'Leopard', price: 130, desc: 'Fast, fierce and fabulous.' },
    { id: 'racing', name: 'Race Number', price: 140, desc: 'Lucky number seven.' },
    { id: 'target', name: 'Bullseye', price: 160, desc: 'Dares them to try.' },
    { id: 'galaxy', name: 'Galaxy', price: 200, desc: 'Painted with the night sky.' },
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
    { id: 'headband', name: 'Headband', price: 50, desc: 'Ready to rumble.' },
    { id: 'bow', name: 'Pink Bow', price: 60, desc: 'Cute and deadly.' },
    { id: 'flower', name: 'Flower', price: 60, desc: 'Peace, love and artillery.' },
    { id: 'party', name: 'Party Hat', price: 70, desc: 'It is always someone\'s birthday.' },
    { id: 'beanie', name: 'Beanie', price: 80, desc: 'Cozy under fire.' },
    { id: 'catears', name: 'Cat Ears', price: 90, desc: 'Nine lives would help.' },
    { id: 'bunny', name: 'Bunny Ears', price: 90, desc: 'Hops right over the crater.' },
    { id: 'headphones', name: 'Headphones', price: 100, desc: 'Tuned in to the menu theme.' },
    { id: 'chef', name: 'Chef Hat', price: 110, desc: 'Cooking up something big.' },
    { id: 'santa', name: 'Santa Hat', price: 120, desc: 'Ho ho hold still.' },
    { id: 'cowboy', name: 'Cowboy Hat', price: 130, desc: 'This battlefield ain\'t big enough.' },
    { id: 'pirate', name: 'Pirate Hat', price: 150, desc: 'Yo ho ho and a barrel of shells.' },
    { id: 'viking', name: 'Viking Helmet', price: 160, desc: 'Historically inaccurate, tactically superior.' },
    { id: 'sombrero', name: 'Sombrero', price: 170, desc: 'Shade for the whole turret.' },
    { id: 'wizard', name: 'Wizard Hat', price: 190, desc: 'You shall not pass.' },
  ],
  trail: [
    { id: 'none', name: 'Standard Trail', price: 0, desc: 'Plain white dots.' },
    { id: 'shadow', name: 'Shadow Trail', price: 80, desc: 'Dark smoke follows your shells.' },
    { id: 'ice', name: 'Ice Trail', price: 100, desc: 'Frosty blue sparks.' },
    { id: 'toxic', name: 'Toxic Trail', price: 100, desc: 'Radioactive green sparks.' },
    { id: 'fire', name: 'Fire Trail', price: 120, desc: 'Every shell is a comet.' },
    { id: 'rainbow', name: 'Rainbow Trail', price: 160, desc: 'Taste the spectrum.' },
    { id: 'gold', name: 'Gold Sparkle', price: 180, desc: 'Expensive-looking shells.' },
    { id: 'pink', name: 'Bubblegum Trail', price: 80, desc: 'Sweet pink dots.' },
    { id: 'lime', name: 'Lime Trail', price: 90, desc: 'Zesty green sparks.' },
    { id: 'violet', name: 'Violet Trail', price: 100, desc: 'Deep purple sparks.' },
    { id: 'ghost', name: 'Ghost Trail', price: 110, desc: 'Pale wisps of smoke.' },
    { id: 'crimson', name: 'Crimson Streak', price: 120, desc: 'A sharp red line.' },
    { id: 'cyan', name: 'Neon Streak', price: 120, desc: 'A bright cyan line.' },
    { id: 'ember', name: 'Ember Trail', price: 140, desc: 'Red-hot embers.' },
    { id: 'plasma', name: 'Plasma Streak', price: 160, desc: 'Magenta energy line.' },
    { id: 'confetti', name: 'Confetti Trail', price: 200, desc: 'A party in every arc.' },
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
    { id: 'dirtdigger', name: 'Dirt Digger', price: 40, desc: 'Tunnels are a lifestyle.' },
    { id: 'luckyshot', name: 'Lucky Shot', price: 40, desc: 'Totally meant that.' },
    { id: 'boomop', name: 'Boom Operator', price: 60, desc: 'Handles the big ones.' },
    { id: 'cratermaker', name: 'Crater Maker', price: 70, desc: 'Redecorates the map.' },
    { id: 'windwhisperer', name: 'Wind Whisperer', price: 80, desc: 'Reads the gauge like a book.' },
    { id: 'skypirate', name: 'Sky Pirate', price: 90, desc: 'Air support enthusiast.' },
    { id: 'glasscannon', name: 'Glass Cannon', price: 100, desc: 'Hits hard. Breaks easy.' },
    { id: 'thewall', name: 'The Wall', price: 100, desc: 'Shields on shields.' },
    { id: 'madscientist', name: 'Mad Scientist', price: 120, desc: 'For science, obviously.' },
    { id: 'menace', name: 'Certified Menace', price: 130, desc: 'The lobby groans.' },
    { id: 'untouchable', name: 'Untouchable', price: 150, desc: 'Never gets hit. Allegedly.' },
    { id: 'topgun', name: 'Top Gun', price: 160, desc: 'Feels the need for speed.' },
    { id: 'warlord', name: 'Warlord', price: 180, desc: 'Commands the field.' },
    { id: 'grandmarshal', name: 'Grand Marshal', price: 250, desc: 'The highest honor.' },
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
  pink: { trail: 'dot', color: '#ff80ab' },
  lime: { trail: 'spark', color: '#c6ff00' },
  violet: { trail: 'spark', color: '#b388ff' },
  ghost: { trail: 'smoke', color: '#eceff1' },
  crimson: { trail: 'line', color: '#ff1744' },
  cyan: { trail: 'line', color: '#18ffff' },
  ember: { trail: 'fire', color: '#ff5722' },
  plasma: { trail: 'line', color: '#e040fb' },
  confetti: { trail: 'spark', rainbow: true },
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
