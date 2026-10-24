// Weapon catalog. Every weapon family is a data spec interpreted by the projectile engine, and each
// family has 3-4 mastery tiers (I-IV) with scaled stats, giving well over 300 weapons in total.
//
// Projectile spec fields (all optional):
//   r, color, trail ('dot'|'line'|'spark'|'fire'|'smoke'|'none'), speed, g, wind, drag, life
//   boom:{r,dmg}  dirt  heal  nocrater  pierce  teleport  pull  mushroom  shake  marker
//   bounce:{n,k,boom}  roll:{dur,speed,back,hop}  dig:{len,w}  phase  stick  fuse
//   homing  thrust:{a,dur,mode}  wave:{amp,freq,square}  boomerang  ufo:{speed,drops,interval,bomb}
//   laser:{len,w,dmg,n,spread,carve}  skylaser:{w,dmg,delay,carve}
//   apex / split / sky / timed: spawn specs
// Spawn spec: { n, pattern, spread, speed, speedVar, inherit, tilt, stagger, delay, keep, spec, t, repeat }
//   patterns: fan, up, down, ring, random, rain, line, ground, groundfwd, stack, v, rise, aim
// Fire spec: { n, spread, stagger, speedVar, speedSteps, colors }

export const CATEGORIES = [
  { id: 'basic', name: 'Basic', color: '#78909c' },
  { id: 'multi', name: 'Multi-Shot', color: '#1e88e5' },
  { id: 'cluster', name: 'Clusters', color: '#d81b60' },
  { id: 'bounce', name: 'Bouncers & Rollers', color: '#fb8c00' },
  { id: 'dig', name: 'Diggers', color: '#8d6e63' },
  { id: 'laser', name: 'Lasers', color: '#e53935' },
  { id: 'air', name: 'Air Support', color: '#039be5' },
  { id: 'guided', name: 'Guided', color: '#8e24aa' },
  { id: 'jet', name: 'Jets & Flyers', color: '#00acc1' },
  { id: 'heavy', name: 'Heavy Ordnance', color: '#fdd835' },
  { id: 'terrain', name: 'Terrain & Utility', color: '#43a047' },
  { id: 'quirky', name: 'Oddities', color: '#f06292' },
];

const RAINBOW = ['#ff5252', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#3f51b5', '#9c27b0'];
const B = (r, dmg) => ({ r, dmg });

const F = [];
function add(o) { F.push(o); }

// ---------------------------------------------------------------- BASIC
add({ id: 'shot', name: 'Shot', cat: 'basic', unlock: 1, ammo: Infinity, icon: 'ball', color: '#90a4ae',
  desc: 'The reliable standard shell. Unlimited ammo, and it grows up with you.',
  tierNames: ['Shot', 'Big Shot', 'Massive Shot', 'Colossal Shot'], tiers: 4,
  spec: { r: 4, boom: B(30, 24) } });
add({ id: 'pebble', name: 'Pebble', cat: 'basic', unlock: 1, ammo: 3, icon: 'dot', color: '#a1887f',
  desc: 'A tiny, quick stone. Three per game, handy for finishing blows.',
  spec: { r: 2.5, speed: 1.15, boom: B(18, 14) } });
add({ id: 'tri', name: 'Tri-Shot', cat: 'multi', unlock: 1, ammo: 2, icon: 'balls3', color: '#1e88e5',
  desc: 'Three shells in a tight spread.', fire: { n: 3, spread: 9 }, spec: { boom: B(24, 16) } });
add({ id: 'shower', name: 'Shower', cat: 'multi', unlock: 1, ammo: 2, icon: 'shower', color: '#42a5f5',
  desc: 'Five light shells in a wide spray.', fire: { n: 5, spread: 24 }, spec: { r: 3, boom: B(18, 11) } });
add({ id: 'heavy', name: 'Heavy Shot', cat: 'basic', unlock: 2, ammo: 1, icon: 'heavy', color: '#607d8b',
  desc: 'Dense and slow-arcing. Hits like a truck.', spec: { r: 6, g: 1.35, boom: B(40, 32) } });
add({ id: 'sniper', name: 'Sniper', cat: 'basic', unlock: 2, ammo: 1, icon: 'needle', color: '#546e7a',
  desc: 'Flat, fast and barely touched by wind. Small blast, big damage.',
  spec: { r: 3, speed: 1.6, g: 0.45, wind: 0.4, trail: 'line', color: '#e0f7fa', boom: B(20, 40) } });
add({ id: 'bouncer', name: 'Bouncer', cat: 'bounce', unlock: 2, ammo: 1, icon: 'bounce', color: '#fb8c00',
  desc: 'Bounces off the terrain three times before detonating.', spec: { bounce: { n: 3, k: 0.6 }, boom: B(30, 22) } });
add({ id: 'ball3', name: '3-Ball', cat: 'cluster', unlock: 2, ammo: 1, icon: 'cluster', color: '#d81b60',
  desc: 'Splits into three at the top of its arc.',
  spec: { apex: { n: 3, pattern: 'fan', spread: 24, inherit: 1, spec: { boom: B(24, 16) } } } });
add({ id: 'needler', name: 'Needler', cat: 'basic', unlock: 3, ammo: 2, icon: 'needle2', color: '#78909c',
  desc: 'A razor-thin dart with a pinpoint blast.',
  spec: { r: 2.5, speed: 1.8, g: 0.35, wind: 0.3, trail: 'line', color: '#b2ebf2', boom: B(14, 30) } });
add({ id: 'mortar', name: 'Mortar', cat: 'basic', unlock: 3, ammo: 1, icon: 'heavy', color: '#8d6e63',
  desc: 'Lobbed high, lands hard.', spec: { g: 1.7, speed: 1.15, boom: B(44, 34) } });
add({ id: 'star', name: 'Shooting Star', cat: 'basic', unlock: 3, ammo: 1, icon: 'star', color: '#ffb300',
  desc: 'A blazing fast shell trailing sparks.',
  spec: { speed: 1.3, g: 0.85, trail: 'spark', color: '#fff59d', boom: B(34, 30) } });
add({ id: 'dirt', name: 'Dirt Ball', cat: 'terrain', unlock: 3, ammo: 2, icon: 'dirt', color: '#6d4c41',
  desc: 'Builds a mound of terrain. Bury enemies or shield yourself.', spec: { dirt: true, color: '#a1887f', boom: B(50, 0) } });
add({ id: 'cannon', name: 'Cannonball', cat: 'basic', unlock: 4, ammo: 1, icon: 'heavy', color: '#455a64',
  desc: 'Old-fashioned iron. Big crater, big hurt.', spec: { r: 8, g: 1.2, boom: B(42, 40) } });
add({ id: 'blunder', name: 'Blunderbuss', cat: 'multi', unlock: 4, ammo: 1, icon: 'fan', color: '#1976d2',
  desc: 'A shotgun blast of nine pellets.', fire: { n: 9, spread: 40, speedVar: 0.25 }, spec: { r: 2.5, boom: B(14, 9) } });
add({ id: 'cluster', name: 'Cluster', cat: 'cluster', unlock: 4, ammo: 1, icon: 'cluster', color: '#c2185b',
  desc: 'Explodes, then throws five bomblets upward.',
  spec: { boom: B(26, 16), split: { n: 5, pattern: 'up', spread: 70, speed: 330, spec: { boom: B(22, 14) } } } });
add({ id: 'twinkler', name: 'Twinkler', cat: 'quirky', unlock: 4, ammo: 1, icon: 'sparkle', color: '#f8bbd0',
  desc: 'Sheds glittering sparks as it flies, then pops.',
  spec: { trail: 'spark', color: '#ffffff', boom: B(34, 26),
    apex: { n: 6, pattern: 'ring', speed: 90, keep: true, spec: { r: 2, trail: 'spark', life: 1.2, boom: B(10, 5) } } } });
add({ id: 'dualneedle', name: 'Dual Needler', cat: 'multi', unlock: 5, ammo: 1, icon: 'needle2', color: '#5c6bc0',
  desc: 'Two darts in quick succession.',
  fire: { n: 2, spread: 3, stagger: 0.1 }, spec: { r: 2.5, speed: 1.8, g: 0.35, wind: 0.3, trail: 'line', color: '#b2ebf2', boom: B(16, 26) } });
add({ id: 'splitter', name: 'Splitter', cat: 'cluster', unlock: 5, ammo: 1, icon: 'split', color: '#ec407a',
  desc: 'Divides into two heavier halves at the apex.',
  spec: { apex: { n: 2, pattern: 'fan', spread: 30, inherit: 1, spec: { boom: B(26, 18) } } } });
add({ id: 'roller', name: 'Roller', cat: 'bounce', unlock: 5, ammo: 1, icon: 'roll', color: '#7cb342',
  desc: 'Rolls along the ground until it finds something to hit.', spec: { roll: { dur: 3, speed: 180 }, boom: B(30, 22) } });
add({ id: 'firework', name: 'Firework', cat: 'cluster', unlock: 5, ammo: 1, icon: 'firework', color: '#ab47bc',
  desc: 'Bursts into a colorful ring of sparks at its peak.',
  spec: { trail: 'spark', apex: { n: 10, pattern: 'ring', speed: 230, spec: { r: 2.5, trail: 'spark', colors: RAINBOW, boom: B(14, 7) } } } });
add({ id: 'gatling', name: 'Gatling Gun', cat: 'multi', unlock: 6, ammo: 1, icon: 'gun', color: '#546e7a',
  desc: 'Eight rounds in a rapid burst.', fire: { n: 8, spread: 5, stagger: 0.07, speedVar: 0.08 }, spec: { r: 2.5, boom: B(16, 9) } });
add({ id: 'artillery', name: 'Artillery', cat: 'basic', unlock: 6, ammo: 1, icon: 'heavy', color: '#5d4037',
  desc: 'Steep, fast and devastating.', spec: { g: 2.2, speed: 1.4, boom: B(46, 42) } });
add({ id: 'ball5', name: '5-Ball', cat: 'cluster', unlock: 6, ammo: 1, icon: 'cluster', color: '#d81b60',
  desc: 'Splits into five at the apex.', spec: { apex: { n: 5, pattern: 'fan', spread: 40, inherit: 1, spec: { boom: B(22, 14) } } } });
add({ id: 'digger', name: 'Digger', cat: 'dig', unlock: 6, ammo: 1, icon: 'dig', color: '#8d6e63',
  desc: 'Burrows through terrain before exploding.', spec: { dig: { len: 140, w: 7 }, boom: B(28, 22) } });
add({ id: 'penta', name: 'Penta Shot', cat: 'multi', unlock: 7, ammo: 1, icon: 'balls5', color: '#1e88e5',
  desc: 'Five shells in a fan.', fire: { n: 5, spread: 14 }, spec: { boom: B(24, 15) } });
add({ id: 'rain', name: 'Rain', cat: 'air', unlock: 7, ammo: 1, icon: 'rain', color: '#039be5',
  desc: 'A flare that skips to a stop, then calls a shower of shells down where it rests.',
  spec: { r: 3, color: '#90caf9', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(12, 4),
    sky: { n: 8, pattern: 'rain', spread: 200, speed: 300, delay: 0.3, spec: { r: 3, color: '#90caf9', boom: B(18, 11) } } } });
add({ id: 'hover', name: 'Hover-Ball', cat: 'bounce', unlock: 7, ammo: 1, icon: 'bubble', color: '#26c6da',
  desc: 'Floaty and bouncy. Drifts far on the wind.', spec: { g: 0.35, bounce: { n: 5, k: 0.8 }, color: '#80deea', boom: B(28, 18) } });
add({ id: 'sparkplug', name: 'Spark Plug', cat: 'cluster', unlock: 7, ammo: 1, icon: 'sparkle', color: '#fdd835',
  desc: 'Fires a ring of fast sparks on impact.',
  spec: { boom: B(20, 12), split: { n: 6, pattern: 'ring', speed: 380, spec: { r: 2, trail: 'line', color: '#fff176', boom: B(12, 8) } } } });
add({ id: 'laser', name: 'Laser', cat: 'laser', unlock: 8, ammo: 1, icon: 'laser', color: '#e53935',
  desc: 'An instant beam. Ignores gravity and wind entirely.', spec: { laser: { len: 2200, w: 5, dmg: 32 }, color: '#ff5252' } });
add({ id: 'blossom', name: 'Blossom', cat: 'cluster', unlock: 8, ammo: 1, icon: 'flower', color: '#f06292',
  desc: 'Blooms into six petals on impact.',
  spec: { boom: B(20, 10), split: { n: 6, pattern: 'up', spread: 100, speed: 260, spec: { r: 3, color: '#f48fb1', boom: B(20, 12) } } } });
add({ id: 'popcorn', name: 'Popcorn', cat: 'bounce', unlock: 8, ammo: 1, icon: 'popcorn', color: '#ffca28',
  desc: 'Pops into bouncing kernels.',
  spec: { split: { n: 6, pattern: 'random', speed: 280, spec: { r: 3, bounce: { n: 2, k: 0.6 }, color: '#fff8e1', boom: B(16, 10) } } } });
add({ id: 'howitzer', name: 'Howitzer', cat: 'heavy', unlock: 8, ammo: 1, icon: 'heavy', color: '#795548',
  desc: 'Siege-grade. Nearly vertical descent.', spec: { r: 7, g: 2.0, speed: 1.5, shake: 0.6, boom: B(55, 48) } });
add({ id: 'shocktrio', name: 'ShockShell Trio', cat: 'multi', unlock: 9, ammo: 1, icon: 'balls3', color: '#00acc1',
  desc: 'Three staggered shells on nearly the same line.',
  fire: { n: 3, spread: 0, stagger: 0.18, speedSteps: 0.1 }, spec: { trail: 'line', color: '#80deea', boom: B(30, 22) } });
add({ id: 'jet', name: 'Jet', cat: 'jet', unlock: 9, ammo: 1, icon: 'jet', color: '#00acc1',
  desc: 'Ignites a rocket motor after launch.', spec: { thrust: { a: 480, dur: 1.2 }, g: 0.6, trail: 'fire', boom: B(30, 24) } });
add({ id: 'chunker', name: 'Chunker', cat: 'bounce', unlock: 9, ammo: 1, icon: 'roll', color: '#8d6e63',
  desc: 'A fat boulder that tumbles a short distance.', spec: { r: 8, g: 1.3, roll: { dur: 1.2, speed: 120 }, boom: B(48, 30) } });
add({ id: 'dynamite', name: 'Dynamite', cat: 'quirky', unlock: 9, ammo: 1, icon: 'dynamite', color: '#e53935',
  desc: 'Sticks where it lands. Short fuse, big bang.', spec: { stick: 1.6, color: '#ef5350', boom: B(44, 40) } });
add({ id: 'fan', name: 'Fan', cat: 'multi', unlock: 10, ammo: 1, icon: 'fan', color: '#1e88e5',
  desc: 'Seven shells across a wide arc.', fire: { n: 7, spread: 55 }, spec: { r: 3, boom: B(18, 11) } });
add({ id: 'seven', name: 'Seven-Bounce', cat: 'bounce', unlock: 10, ammo: 1, icon: 'bounce', color: '#ff9800',
  desc: 'Lucky number seven. Keeps bouncing.', spec: { bounce: { n: 7, k: 0.7 }, boom: B(28, 20) } });
add({ id: 'homing', name: 'Homing Missile', cat: 'guided', unlock: 10, ammo: 1, icon: 'missile', color: '#8e24aa',
  desc: 'Steers toward the nearest enemy.', spec: { homing: 0.7, thrust: { a: 250, dur: 2 }, g: 0.8, trail: 'smoke', boom: B(30, 26) } });
add({ id: 'healing', name: 'Healing Shot', cat: 'terrain', unlock: 10, ammo: 2, icon: 'heart', color: '#43a047',
  desc: 'Restores HP to any tank in the blast. Aim at yourself or a friend.', spec: { heal: 30, nocrater: true, color: '#69f0ae', trail: 'spark', boom: B(50, 0) } });
add({ id: 'boulder', name: 'Boulder', cat: 'heavy', unlock: 11, ammo: 1, icon: 'heavy', color: '#616161',
  desc: 'Slow, enormous, unstoppable.', spec: { r: 11, speed: 0.85, g: 1.3, shake: 0.6, boom: B(58, 46) } });
add({ id: 'spreader', name: 'Spreader', cat: 'cluster', unlock: 11, ammo: 1, icon: 'split', color: '#ad1457',
  desc: 'Fans into five at the apex, keeping its momentum.',
  spec: { apex: { n: 5, pattern: 'fan', spread: 35, inherit: 1, spec: { boom: B(24, 15) } } } });
add({ id: 'seagull', name: 'Seagull', cat: 'air', unlock: 11, ammo: 1, icon: 'bird', color: '#90caf9',
  desc: 'Releases a flock of gliding bombs in a V formation. Intimidating.',
  spec: { apex: { n: 5, pattern: 'v', spread: 70, speed: 220, spec: { g: 0.35, thrust: { a: 200, dur: 1.2 }, r: 3, color: '#ffffff', trail: 'line', boom: B(22, 15) } } } });
add({ id: 'bubble', name: 'Bubble', cat: 'quirky', unlock: 11, ammo: 1, icon: 'bubble', color: '#4dd0e1',
  desc: 'Drifts slowly on the breeze and pops hard.', spec: { r: 8, g: 0.25, drag: 0.5, speed: 0.9, trail: 'none', color: '#b2ebf2', boom: B(40, 30) } });
add({ id: 'rainbow', name: 'Rainbow', cat: 'multi', unlock: 12, ammo: 1, icon: 'wave', color: '#ab47bc',
  desc: 'Seven colors, seven shells.', fire: { n: 7, spread: 16, colors: RAINBOW }, spec: { r: 3.5, boom: B(20, 12) } });
add({ id: 'excavation', name: 'Excavation', cat: 'dig', unlock: 12, ammo: 1, icon: 'hole', color: '#6d4c41',
  desc: 'Light damage, enormous crater. Reshape the battlefield.', spec: { shake: 0.5, boom: B(95, 16) } });
add({ id: 'teleport', name: 'Teleport Shot', cat: 'terrain', unlock: 12, ammo: 1, icon: 'tele', color: '#7e57c2',
  desc: 'Wherever it lands, you appear.', spec: { teleport: true, nocrater: true, trail: 'spark', color: '#b39ddb', boom: B(0, 0) } });
add({ id: 'sprinkler', name: 'Sprinkler', cat: 'cluster', unlock: 12, ammo: 1, icon: 'shower', color: '#29b6f6',
  desc: 'Sprays nine droplets at the apex.',
  spec: { apex: { n: 9, pattern: 'fan', spread: 110, speed: 170, speedVar: 0.4, spec: { r: 3, color: '#4fc3f7', boom: B(18, 11) } } } });
add({ id: 'ball10', name: '10-Ball', cat: 'cluster', unlock: 13, ammo: 1, icon: 'cluster10', color: '#d81b60',
  desc: 'Ten bomblets at the apex.', spec: { apex: { n: 10, pattern: 'fan', spread: 70, inherit: 1, spec: { r: 3, boom: B(18, 10) } } } });
add({ id: 'crackler', name: 'Crackler', cat: 'quirky', unlock: 13, ammo: 1, icon: 'firework', color: '#ffa726',
  desc: 'Drops a trail of mini bombs along its whole flight.',
  spec: { boom: B(24, 16), timed: { t: 0.15, repeat: 8, n: 1, pattern: 'down', speed: 60, spec: { r: 2.5, color: '#ffcc80', boom: B(16, 9) } } } });
add({ id: 'airstrike', name: 'Airstrike', cat: 'air', unlock: 13, ammo: 1, icon: 'rain', color: '#0288d1',
  desc: 'A marker flare bounces to a stop and calls in five bombs from above.',
  spec: { r: 3.5, color: '#ffab40', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(14, 6), sky: { n: 5, pattern: 'rain', spread: 160, speed: 380, delay: 0.35, spec: { r: 4, boom: B(28, 18) } } } });
add({ id: 'sine', name: 'Sine Wave', cat: 'jet', unlock: 13, ammo: 1, icon: 'wave', color: '#26a69a',
  desc: 'Undulates through the air. Hard to predict, harder to dodge.', spec: { wave: { amp: 55, freq: 4 }, color: '#80cbc4', boom: B(28, 22) } });
add({ id: 'plasma', name: 'Plasma Bolt', cat: 'basic', unlock: 14, ammo: 1, icon: 'needle', color: '#7e57c2',
  desc: 'A straight-line bolt of energy. Nearly no drop.', spec: { r: 5, speed: 1.5, g: 0.08, wind: 0.1, trail: 'line', color: '#b388ff', boom: B(28, 34) } });
add({ id: 'heavyroller', name: 'Heavy Roller', cat: 'bounce', unlock: 14, ammo: 1, icon: 'roll', color: '#558b2f',
  desc: 'A bigger, longer roll.', spec: { r: 7, roll: { dur: 4, speed: 160 }, boom: B(46, 38) } });
add({ id: 'rocket', name: 'Rocket', cat: 'jet', unlock: 14, ammo: 1, icon: 'missile', color: '#00838f',
  desc: 'Climbs under power before arcing down.', spec: { thrust: { a: 300, dur: 2, mode: 'up' }, speed: 0.9, trail: 'smoke', boom: B(40, 32) } });
add({ id: 'ghostshell', name: 'Ghost Shell', cat: 'jet', unlock: 14, ammo: 1, icon: 'ghost', color: '#80cbc4',
  desc: 'Phases through terrain for a moment. Shoot through hills.', spec: { phase: 1.4, color: '#b2dfdb', trail: 'none', boom: B(32, 26) } });
add({ id: 'crazycluster', name: 'Crazy Cluster', cat: 'cluster', unlock: 15, ammo: 1, icon: 'popcorn', color: '#e91e63',
  desc: 'Eight bouncing bomblets in every direction.',
  spec: { boom: B(20, 12), split: { n: 8, pattern: 'random', speed: 320, spec: { bounce: { n: 1, k: 0.5 }, boom: B(22, 13) } } } });
add({ id: 'tunneler', name: 'Tunneler', cat: 'dig', unlock: 15, ammo: 1, icon: 'dig', color: '#795548',
  desc: 'Digs a long tunnel to reach buried or shielded tanks.', spec: { dig: { len: 320, w: 8 }, boom: B(30, 24) } });
add({ id: 'funnel', name: 'Funnel', cat: 'multi', unlock: 15, ammo: 1, icon: 'funnel', color: '#1565c0',
  desc: 'Six shells at stepped speeds. They land in a line.', fire: { n: 6, spread: 0, speedSteps: 0.22, stagger: 0.05 }, spec: { boom: B(22, 14) } });
add({ id: 'boomerang', name: 'Boomerang', cat: 'jet', unlock: 15, ammo: 1, icon: 'boomerang', color: '#ffb300',
  desc: 'Curves back toward you after the apex. Hits what is behind cover.', spec: { boomerang: 1, g: 0.6, color: '#ffe082', boom: B(30, 24) } });
add({ id: 'sticky', name: 'Sticky Bomb', cat: 'quirky', unlock: 15, ammo: 1, icon: 'bomb', color: '#8bc34a',
  desc: 'Clings to the terrain, then detonates.', spec: { stick: 1.0, color: '#c5e1a5', boom: B(36, 44) } });
add({ id: 'clover', name: 'Four Leaf Clover', cat: 'cluster', unlock: 16, ammo: 1, icon: 'flower', color: '#2e7d32',
  desc: 'Four lucky leaves spread at the apex.', spec: { apex: { n: 4, pattern: 'ring', speed: 220, spec: { color: '#69f0ae', boom: B(28, 20) } } } });
add({ id: 'snake', name: 'Snake', cat: 'bounce', unlock: 16, ammo: 1, icon: 'snake', color: '#9ccc65',
  desc: 'Slithers a very long way along the ground.', spec: { r: 3, roll: { dur: 7, speed: 240 }, trail: 'line', color: '#aed581', boom: B(26, 20) } });
add({ id: 'flyingv', name: 'Flying-V', cat: 'jet', unlock: 16, ammo: 1, icon: 'v', color: '#00acc1',
  desc: 'Three jets in formation.', fire: { n: 3, spread: 30 }, spec: { thrust: { a: 350, dur: 1.5 }, g: 0.5, trail: 'fire', boom: B(24, 18) } });
add({ id: 'breakerchain', name: 'BreakerChain', cat: 'terrain', unlock: 16, ammo: 1, icon: 'chain', color: '#388e3c',
  desc: 'A chain of explosions marching forward along the ground.',
  spec: { boom: B(24, 14), split: { n: 6, pattern: 'groundfwd', spread: 55, stagger: 0.07, spec: { boom: B(28, 16) } } } });
add({ id: 'blast', name: 'Blast Charge', cat: 'heavy', unlock: 16, ammo: 1, icon: 'bomb', color: '#f9a825',
  desc: 'A straightforward, oversized explosive.', spec: { r: 6, boom: B(60, 44) } });
add({ id: 'minigun', name: 'Minigun', cat: 'multi', unlock: 17, ammo: 1, icon: 'gun', color: '#37474f',
  desc: 'Fourteen rounds. Brrrt.', fire: { n: 14, spread: 7, stagger: 0.05, speedVar: 0.1 }, spec: { r: 2, boom: B(12, 7) } });
add({ id: 'mountain', name: 'Mountain Builder', cat: 'terrain', unlock: 17, ammo: 1, icon: 'mountain', color: '#5d4037',
  desc: 'Raises a mountain. Great for cover or entombing a rival.', spec: { dirt: true, color: '#a1887f', boom: B(110, 0) } });
add({ id: 'saltpepper', name: 'Salt and Pepper', cat: 'air', unlock: 17, ammo: 1, icon: 'rain', color: '#9e9e9e',
  desc: 'A flare lands, and the target gets seasoned from above.',
  spec: { r: 3, color: '#eeeeee', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(12, 4), sky: { n: 10, pattern: 'rain', spread: 240, speed: 420, delay: 0.3, spec: { r: 2.5, colors: ['#ffffff', '#424242'], boom: B(16, 9) } } } });
add({ id: 'magic', name: 'Magic Shower', cat: 'cluster', unlock: 18, ammo: 1, icon: 'sparkle', color: '#ba68c8',
  desc: 'Fourteen sparkles shimmer down from the apex.',
  spec: { trail: 'spark', apex: { n: 14, pattern: 'fan', spread: 150, speed: 180, speedVar: 0.5, spec: { r: 2.5, trail: 'spark', color: '#e1bee7', boom: B(14, 8) } } } });
add({ id: 'bounsplode', name: 'Triple-Bounsplode', cat: 'bounce', unlock: 18, ammo: 1, icon: 'bounce', color: '#ef6c00',
  desc: 'Three bounces, then a three-way burst.',
  spec: { bounce: { n: 3, k: 0.6 }, boom: B(24, 16), split: { n: 3, pattern: 'up', spread: 60, speed: 300, spec: { boom: B(22, 14) } } } });
add({ id: 'zipper', name: 'Zipper', cat: 'jet', unlock: 18, ammo: 1, icon: 'zigzag', color: '#26c6da',
  desc: 'Zig-zags sharply through the air.', spec: { wave: { amp: 28, freq: 14, square: true }, boom: B(28, 22) } });
add({ id: 'cactus', name: 'Cactus Strike', cat: 'quirky', unlock: 18, ammo: 1, icon: 'cactus', color: '#689f38',
  desc: 'Erupts into a fan of fast spines.',
  spec: { boom: B(22, 14), split: { n: 7, pattern: 'up', spread: 36, speed: 560, spec: { r: 2, trail: 'line', color: '#9ccc65', g: 1.4, boom: B(12, 10) } } } });
add({ id: 'bouquet', name: 'Bouquet', cat: 'cluster', unlock: 19, ammo: 1, icon: 'flower', color: '#ec407a',
  desc: 'Twelve colorful blooms on impact.',
  spec: { boom: B(24, 12), split: { n: 12, pattern: 'up', spread: 130, speed: 300, speedVar: 0.3, spec: { r: 3, colors: RAINBOW, boom: B(18, 11) } } } });
add({ id: 'earthquake', name: 'Earthquake', cat: 'dig', unlock: 19, ammo: 1, icon: 'quake', color: '#8d6e63',
  desc: 'Ripples the ground with a line of blasts.',
  spec: { boom: B(24, 12), shake: 0.8, split: { n: 5, pattern: 'ground', spread: 260, stagger: 0.08, spec: { boom: B(34, 16) } } } });
add({ id: 'domino', name: 'Domino', cat: 'multi', unlock: 19, ammo: 1, icon: 'balls5', color: '#0d47a1',
  desc: 'Five shells falling in a neat row.', fire: { n: 5, spread: 0, speedSteps: 0.3 }, spec: { boom: B(26, 16) } });
add({ id: 'twinlaser', name: 'Twin Laser', cat: 'laser', unlock: 20, ammo: 1, icon: 'laser2', color: '#d32f2f',
  desc: 'Two parallel beams.', spec: { laser: { len: 2200, w: 4, dmg: 26, n: 2, spread: 5 }, color: '#ff5252' } });
add({ id: 'widefan', name: 'Wide Fan', cat: 'multi', unlock: 20, ammo: 1, icon: 'fan', color: '#1976d2',
  desc: 'Eleven shells across nearly a quarter circle.', fire: { n: 11, spread: 95 }, spec: { r: 3, boom: B(18, 10) } });
add({ id: 'inferno', name: 'Inferno', cat: 'heavy', unlock: 20, ammo: 1, icon: 'fire', color: '#ff7043',
  desc: 'Splashes burning embers in every direction.',
  spec: { trail: 'fire', boom: B(30, 18), split: { n: 8, pattern: 'up', spread: 150, speed: 320, spec: { trail: 'fire', r: 3, color: '#ff7043', boom: B(20, 13) } } } });
add({ id: 'burntpop', name: 'Burnt Popcorn', cat: 'bounce', unlock: 20, ammo: 1, icon: 'popcorn', color: '#5d4037',
  desc: 'Ten charred kernels that bounce everywhere.',
  spec: { boom: B(24, 14), split: { n: 10, pattern: 'random', speed: 340, spec: { r: 3, bounce: { n: 3, k: 0.6 }, color: '#8d6e63', boom: B(18, 11) } } } });
add({ id: 'shieldbreaker', name: 'Shield Breaker', cat: 'terrain', unlock: 20, ammo: 1, icon: 'shield', color: '#fbc02d',
  desc: 'Ignores armor completely.', spec: { pierce: true, color: '#ffee58', boom: B(30, 36) } });
add({ id: 'octagon', name: 'Octagon', cat: 'cluster', unlock: 21, ammo: 1, icon: 'ring', color: '#c2185b',
  desc: 'Eight bomblets in a perfect ring.',
  spec: { boom: B(22, 14), split: { n: 8, pattern: 'ring', speed: 260, spec: { boom: B(24, 16) } } } });
add({ id: 'backgroller', name: 'Back-Groller', cat: 'bounce', unlock: 21, ammo: 1, icon: 'roll', color: '#827717',
  desc: 'Lands, then rolls back the way it came.', spec: { roll: { dur: 3.5, speed: 200, back: true }, boom: B(36, 28) } });
add({ id: 'hail', name: 'Hailstorm', cat: 'air', unlock: 21, ammo: 1, icon: 'snow', color: '#4fc3f7',
  desc: 'Mark the target with a flare; twenty icy pellets fall fast and hard on it.',
  spec: { r: 3, color: '#b3e5fc', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(12, 4),
    sky: { n: 20, pattern: 'rain', spread: 300, speed: 500, delay: 0.3, spec: { r: 2, g: 1.5, color: '#b3e5fc', boom: B(12, 8) } } } });
add({ id: 'wall', name: 'Wall', cat: 'terrain', unlock: 21, ammo: 1, icon: 'wall', color: '#6d4c41',
  desc: 'Raises a vertical wall of dirt.',
  spec: { nocrater: true, trail: 'none', boom: B(0, 0), split: { n: 6, pattern: 'stack', spread: 22, spec: { dirt: true, color: '#a1887f', boom: B(22, 0) } } } });
add({ id: 'railgun', name: 'Railgun', cat: 'basic', unlock: 22, ammo: 1, icon: 'needle', color: '#0277bd',
  desc: 'Hypervelocity slug. Almost perfectly straight.', spec: { r: 4, speed: 2.1, g: 0.15, wind: 0, trail: 'line', color: '#80d8ff', boom: B(22, 62) } });
add({ id: 'jumper', name: 'Triple-Jumper', cat: 'bounce', unlock: 22, ammo: 1, icon: 'bounce', color: '#f57c00',
  desc: 'Explodes at every bounce.', spec: { bounce: { n: 3, k: 0.75, boom: true }, boom: B(26, 18) } });
add({ id: 'wiggler', name: 'Wiggler', cat: 'guided', unlock: 22, ammo: 1, icon: 'wave', color: '#7b1fa2',
  desc: 'Wobbles toward its target.', spec: { wave: { amp: 14, freq: 18 }, homing: 0.4, boom: B(26, 20) } });
add({ id: 'balloon', name: 'Balloon Bombs', cat: 'air', unlock: 22, ammo: 1, icon: 'balloon', color: '#f06292',
  desc: 'Releases floating bombs that drift up before bursting.',
  spec: { apex: { n: 4, pattern: 'fan', spread: 60, speed: 100, spec: { g: -0.12, drag: 0.3, fuse: 1.6, r: 5, color: '#ff80ab', boom: B(30, 22) } } } });
add({ id: 'area', name: 'Area Attack', cat: 'cluster', unlock: 23, ammo: 1, icon: 'area', color: '#ad1457',
  desc: 'Seven shells spread evenly across a wide zone.',
  spec: { apex: { n: 7, pattern: 'line', spread: 420, speed: 60, spec: { boom: B(28, 18) } } } });
add({ id: 'stickyrain', name: 'Sticky Rain', cat: 'air', unlock: 23, ammo: 1, icon: 'rain', color: '#7cb342',
  desc: 'A flare marks the spot; the rain that follows clings and then detonates.',
  spec: { r: 3, color: '#c5e1a5', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(12, 4),
    sky: { n: 10, pattern: 'rain', spread: 260, speed: 320, delay: 0.3, spec: { r: 3, stick: 0.9, color: '#c5e1a5', boom: B(20, 13) } } } });
add({ id: 'triplepalm', name: 'Triple Palm', cat: 'cluster', unlock: 23, ammo: 1, icon: 'split', color: '#2e7d32',
  desc: 'Three trunks that each burst into fronds.',
  spec: { boom: B(20, 12), split: { n: 3, pattern: 'up', spread: 24, speed: 420, spec: { color: '#a5d6a7',
    apex: { n: 5, pattern: 'fan', spread: 120, speed: 150, spec: { r: 3, color: '#a5d6a7', boom: B(18, 11) } } } } } });
add({ id: 'splitchain', name: 'SplitterChain', cat: 'cluster', unlock: 24, ammo: 1, icon: 'split', color: '#e91e63',
  desc: 'Splits, climbs, and splits again.',
  spec: { apex: { n: 2, pattern: 'up', spread: 70, speed: 260, spec: { apex: { n: 2, pattern: 'up', spread: 60, speed: 220, spec: { boom: B(22, 15) } } } } } });
add({ id: 'driller', name: 'Driller', cat: 'dig', unlock: 24, ammo: 1, icon: 'dig', color: '#6d4c41',
  desc: 'Fast drill with a heavy charge at the end.', spec: { speed: 1.2, dig: { len: 220, w: 6 }, boom: B(42, 38) } });
add({ id: 'seeker', name: 'Seeker', cat: 'guided', unlock: 24, ammo: 1, icon: 'crosshair', color: '#9c27b0',
  desc: 'Aggressively hunts the nearest enemy.', spec: { homing: 1.4, g: 0.3, trail: 'line', color: '#ce93d8', boom: B(26, 24) } });
add({ id: 'ghostlets', name: 'Ghostlets', cat: 'jet', unlock: 24, ammo: 1, icon: 'ghost', color: '#4db6ac',
  desc: 'Spirits that sink into the ground and burst from within.',
  spec: { trail: 'none', color: '#b2dfdb', nocrater: true, boom: B(0, 0), split: { n: 3, pattern: 'fan', spread: 50, inherit: 0.8, speed: 150, spec: { phase: 2.5, fuse: 1.2, trail: 'none', color: '#b2dfdb', boom: B(26, 20) } } } });
add({ id: 'heavyhover', name: 'Heavy Hover-Ball', cat: 'bounce', unlock: 25, ammo: 1, icon: 'bubble', color: '#0097a7',
  desc: 'A heavier floater with a serious payload.', spec: { r: 7, g: 0.5, bounce: { n: 4, k: 0.7 }, color: '#80deea', boom: B(46, 36) } });
add({ id: 'carpet', name: 'Carpet Bomb', cat: 'air', unlock: 25, ammo: 1, icon: 'rain', color: '#01579b',
  desc: 'A marker flare, then nine bombs across a wide strip around it.',
  spec: { r: 3.5, color: '#ffab40', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(14, 6), sky: { n: 9, pattern: 'rain', spread: 400, speed: 380, delay: 0.35, spec: { boom: B(28, 18) } } } });
add({ id: 'comet', name: 'Comet', cat: 'basic', unlock: 25, ammo: 1, icon: 'comet', color: '#ff8f00',
  desc: 'A burning rock from deep space.', spec: { r: 7, speed: 1.25, g: 0.8, trail: 'fire', color: '#ffcc80', boom: B(50, 46) } });
add({ id: 'mudpie', name: 'Mud Pie', cat: 'terrain', unlock: 25, ammo: 1, icon: 'dirt', color: '#4e342e',
  desc: 'Splatters dirt in every direction.',
  spec: { dirt: true, color: '#a1887f', boom: B(44, 0), split: { n: 4, pattern: 'up', spread: 80, speed: 260, spec: { dirt: true, color: '#a1887f', boom: B(26, 0) } } } });
add({ id: 'pyro', name: 'Pyrotechnics', cat: 'cluster', unlock: 26, ammo: 1, icon: 'firework', color: '#ff4081',
  desc: 'A firework that bursts, then bursts again.',
  spec: { trail: 'spark', apex: { n: 6, pattern: 'up', spread: 120, speed: 260, spec: { fuse: 0.6, trail: 'spark', boom: B(16, 9),
    split: { n: 5, pattern: 'ring', speed: 200, spec: { r: 2.5, trail: 'spark', colors: RAINBOW, boom: B(12, 7) } } } } } });
add({ id: 'snowstorm', name: 'Snowstorm', cat: 'air', unlock: 26, ammo: 1, icon: 'snow', color: '#b3e5fc',
  desc: 'A flare lands, and a blizzard of sixteen flakes drifts down on it.',
  spec: { r: 3, color: '#ffffff', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.45, marker: true, boom: B(12, 4),
    sky: { n: 16, pattern: 'rain', spread: 320, speed: 200, speedVar: 0.5, delay: 0.3, spec: { r: 2.5, drag: 0.3, color: '#ffffff', boom: B(14, 8) } } } });
add({ id: 'volcano', name: 'Volcano', cat: 'heavy', unlock: 26, ammo: 1, icon: 'mountain', color: '#d84315',
  desc: 'Erupts a column of molten rock straight up.',
  spec: { trail: 'fire', boom: B(30, 16), split: { n: 10, pattern: 'up', spread: 50, speed: 520, speedVar: 0.4, spec: { trail: 'fire', r: 3, g: 1.3, color: '#ff8a65', boom: B(22, 14) } } } });
add({ id: 'grenadestorm', name: 'Grenade Storm', cat: 'cluster', unlock: 27, ammo: 1, icon: 'bomb', color: '#558b2f',
  desc: 'Six bouncing grenades.',
  spec: { boom: B(20, 12), split: { n: 6, pattern: 'up', spread: 90, speed: 300, spec: { bounce: { n: 2, k: 0.55 }, color: '#aed581', boom: B(24, 16) } } } });
add({ id: 'sinkhole', name: 'Sinkhole', cat: 'dig', unlock: 27, ammo: 1, icon: 'hole', color: '#4e342e',
  desc: 'Drills straight down on impact and opens the earth.',
  spec: { boom: B(26, 10), split: { n: 1, pattern: 'down', speed: 300, spec: { dig: { len: 320, w: 16 }, boom: B(50, 34) } } } });
add({ id: 'heavyjet', name: 'Heavy Jet', cat: 'jet', unlock: 27, ammo: 1, icon: 'jet', color: '#006064',
  desc: 'A long burn and a heavy warhead.', spec: { r: 6, thrust: { a: 400, dur: 2 }, g: 0.7, trail: 'fire', boom: B(44, 38) } });
add({ id: 'ball25', name: 'TwentyFive-Ball', cat: 'cluster', unlock: 28, ammo: 1, icon: 'grid', color: '#d81b60',
  desc: 'Twenty-five bomblets. Saturation.',
  spec: { apex: { n: 25, pattern: 'fan', spread: 120, inherit: 1, speedVar: 0.3, spec: { r: 2.5, boom: B(14, 7) } } } });
add({ id: 'meteor', name: 'Meteor Shower', cat: 'air', unlock: 28, ammo: 1, icon: 'meteor', color: '#ff7043',
  desc: 'A burning flare bounces to rest, then five flaming meteors crash down on it.',
  spec: { r: 4, trail: 'fire', color: '#ff8a65', bounce: { n: 2, k: 0.4 }, stick: 0.5, marker: true, boom: B(14, 6),
    sky: { n: 5, pattern: 'rain', spread: 260, speed: 520, delay: 0.4, spec: { r: 5, trail: 'fire', color: '#ff8a65', boom: B(32, 24) } } } });
add({ id: 'chainreaction', name: 'Chain Reaction', cat: 'terrain', unlock: 28, ammo: 1, icon: 'chain', color: '#2e7d32',
  desc: 'Each blast seeds the next.',
  spec: { boom: B(26, 16), split: { n: 3, pattern: 'fan', tilt: -40, spread: 40, inherit: 0.6, speed: 120, spec: { boom: B(24, 15),
    split: { n: 3, pattern: 'up', spread: 90, speed: 220, spec: { boom: B(20, 12) } } } } } });
add({ id: 'cobra', name: 'Cobra', cat: 'bounce', unlock: 29, ammo: 1, icon: 'snake', color: '#33691e',
  desc: 'Slithers in, then rears up and strikes.', spec: { roll: { dur: 2.2, speed: 220, hop: true }, color: '#c5e1a5', boom: B(30, 24) } });
add({ id: 'lividbirds', name: 'Livid Birds', cat: 'air', unlock: 29, ammo: 1, icon: 'bird3', color: '#e53935',
  desc: 'Five angry birds that home in on enemies.',
  spec: { apex: { n: 5, pattern: 'fan', spread: 80, speed: 200, spec: { homing: 1.0, r: 3, trail: 'line', color: '#ef5350', boom: B(22, 16) } } } });
add({ id: 'rave', name: 'Rave', cat: 'cluster', unlock: 29, ammo: 1, icon: 'firework', color: '#aa00ff',
  desc: 'Five rainbow shells, each bursting at its apex.',
  fire: { n: 5, spread: 22, colors: RAINBOW }, spec: { trail: 'spark', boom: B(20, 12), apex: { n: 4, pattern: 'ring', speed: 200, keep: true, spec: { r: 2.5, trail: 'spark', colors: RAINBOW, boom: B(14, 8) } } } });
add({ id: 'nuke', name: 'Nuke', cat: 'heavy', unlock: 30, ammo: 1, icon: 'nuke', color: '#fdd835',
  desc: 'A proper mushroom cloud. Keep your distance.', spec: { r: 7, shake: 1, mushroom: true, color: '#fff176', boom: B(85, 70) } });
add({ id: 'solarflare', name: 'Solar Flare', cat: 'laser', unlock: 30, ammo: 1, icon: 'sun', color: '#ffa000',
  desc: 'A flare settles, then a beam of sunlight comes straight down on it.', spec: { r: 3.5, bounce: { n: 2, k: 0.4 }, stick: 0.3, boom: B(14, 6), skylaser: { w: 10, dmg: 48, delay: 0.3 }, color: '#ffe082', trail: 'spark' } });
add({ id: 'manyminions', name: 'Many-Minions', cat: 'bounce', unlock: 30, ammo: 1, icon: 'popcorn', color: '#ff8a65',
  desc: 'Six hopping minions scatter across the field.',
  spec: { boom: B(20, 12), split: { n: 6, pattern: 'up', spread: 100, speed: 260, spec: { r: 3, bounce: { n: 4, k: 0.7 }, color: '#ffab91', boom: B(18, 12) } } } });
add({ id: 'megaquake', name: 'Mega-Quake', cat: 'dig', unlock: 31, ammo: 1, icon: 'quake', color: '#5d4037',
  desc: 'Nine ground-shaking blasts across the map.',
  spec: { boom: B(30, 14), shake: 1.2, split: { n: 9, pattern: 'ground', spread: 520, stagger: 0.07, spec: { boom: B(44, 20) } } } });
add({ id: 'attractoids', name: 'Attractoids', cat: 'guided', unlock: 31, ammo: 1, icon: 'drone', color: '#8e24aa',
  desc: 'Six seekers released at the apex.',
  spec: { apex: { n: 6, pattern: 'ring', speed: 150, spec: { homing: 1.1, r: 3, trail: 'line', color: '#ce93d8', boom: B(20, 14) } } } });
add({ id: 'riot', name: 'Riot', cat: 'heavy', unlock: 31, ammo: 1, icon: 'firework', color: '#f4511e',
  desc: 'Twelve bouncing charges in all directions.',
  spec: { boom: B(30, 18), split: { n: 12, pattern: 'ring', speed: 300, spec: { bounce: { n: 2, k: 0.6 }, boom: B(20, 13) } } } });
add({ id: 'beaconator', name: 'Beaconator', cat: 'air', unlock: 32, ammo: 1, icon: 'beacon', color: '#00c853',
  desc: 'Plants a beacon. A moment later, six heavy bombs answer.',
  spec: { nocrater: true, marker: true, color: '#69f0ae', trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.3, boom: B(0, 0), sky: { n: 6, pattern: 'rain', spread: 60, speed: 480, delay: 1.0, spec: { r: 5, color: '#69f0ae', boom: B(36, 28) } } } });
add({ id: 'apache', name: 'Apache', cat: 'air', unlock: 32, ammo: 1, icon: 'heli', color: '#37474f',
  desc: 'Levels out at the apex and strafes with rockets.',
  spec: { ufo: { speed: 220, drops: 6, interval: 0.14, bomb: { r: 3, trail: 'line', color: '#ffab91', boom: B(22, 15) } } } });
add({ id: 'megarainbow', name: 'MegaRainbow', cat: 'multi', unlock: 33, ammo: 1, icon: 'wave', color: '#7b1fa2',
  desc: 'A wider, heavier rainbow.', fire: { n: 7, spread: 34, colors: RAINBOW }, spec: { r: 4, boom: B(30, 20) } });
add({ id: 'deadriser', name: 'Dead Riser', cat: 'air', unlock: 33, ammo: 1, icon: 'skull', color: '#5e35b1',
  desc: 'Where it lands, five shells rise from the grave.',
  spec: { nocrater: true, color: '#b39ddb', boom: B(0, 0), split: { n: 5, pattern: 'rise', spread: 120, speed: 520, spec: { phase: 0.7, r: 4, trail: 'line', color: '#b39ddb', boom: B(28, 20) } } } });
add({ id: 'firestorm', name: 'FireStorm', cat: 'heavy', unlock: 34, ammo: 1, icon: 'fire', color: '#e64a19',
  desc: 'Splashes fire on impact, then rains more down on the same spot.',
  spec: { trail: 'fire', boom: B(34, 22), sky: { n: 10, pattern: 'rain', spread: 280, speed: 380, delay: 0.4, spec: { trail: 'fire', r: 3, color: '#ff7043', boom: B(22, 15) } },
    split: { n: 6, pattern: 'up', spread: 140, speed: 280, spec: { trail: 'fire', r: 3, color: '#ff7043', boom: B(18, 12) } } } });
add({ id: 'moles', name: 'Moles', cat: 'dig', unlock: 34, ammo: 1, icon: 'mole', color: '#795548',
  desc: 'Three moles tunnel toward enemies from below.',
  spec: { nocrater: true, boom: B(0, 0), split: { n: 3, pattern: 'down', spread: 60, speed: 240, spec: { dig: { len: 700, w: 7 }, homing: 1.2, r: 3, color: '#8d6e63', boom: B(28, 24) } } } });
add({ id: 'tsunami', name: 'Tsunami', cat: 'bounce', unlock: 35, ammo: 1, icon: 'wave', color: '#0288d1',
  desc: 'A wall of water surging along the ground.', spec: { r: 9, roll: { dur: 4, speed: 260 }, trail: 'line', color: '#4fc3f7', boom: B(70, 26) } });
add({ id: 'bigboomerang', name: 'BigBoomerang', cat: 'jet', unlock: 35, ammo: 1, icon: 'boomerang', color: '#ff8f00',
  desc: 'A heavier boomerang with a wider return.', spec: { r: 7, boomerang: 1.3, g: 0.55, color: '#ffe082', boom: B(46, 38) } });
add({ id: 'siege', name: 'Siege Cannon', cat: 'heavy', unlock: 35, ammo: 1, icon: 'heavy', color: '#3e2723',
  desc: 'Fortress-cracking caliber.', spec: { r: 9, speed: 1.2, g: 1.3, shake: 0.8, boom: B(70, 62) } });
add({ id: 'megatunneler', name: 'MegaTunneler', cat: 'dig', unlock: 36, ammo: 1, icon: 'dig', color: '#4e342e',
  desc: 'Bores clean through mountains.', spec: { r: 6, dig: { len: 800, w: 13 }, boom: B(40, 34) } });
add({ id: 'guided', name: 'Guided Rocket', cat: 'guided', unlock: 36, ammo: 1, icon: 'missile', color: '#6a1b9a',
  desc: 'Long burn, steady tracking.', spec: { homing: 0.9, thrust: { a: 220, dur: 3.5 }, g: 0.6, trail: 'smoke', boom: B(40, 36) } });
add({ id: 'ufo', name: 'UFO', cat: 'air', unlock: 37, ammo: 1, icon: 'ufo', color: '#00e676',
  desc: 'Hovers across the map dropping bombs.',
  spec: { color: '#69f0ae', ufo: { speed: 180, drops: 7, interval: 0.25, bomb: { r: 4, color: '#69f0ae', boom: B(26, 18) } } } });
add({ id: 'superspiker', name: 'Super Spiker', cat: 'quirky', unlock: 37, ammo: 1, icon: 'spike', color: '#558b2f',
  desc: 'Twelve spines in a half circle.',
  spec: { boom: B(28, 16), split: { n: 12, pattern: 'up', spread: 170, speed: 520, spec: { r: 2, trail: 'line', g: 1.3, color: '#9ccc65', boom: B(14, 11) } } } });
add({ id: 'megalaser', name: 'Mega Laser', cat: 'laser', unlock: 38, ammo: 1, icon: 'laser', color: '#c62828',
  desc: 'A thick beam that carves the terrain.', spec: { laser: { len: 2200, w: 14, dmg: 58, carve: 10 }, color: '#ff1744' } });
add({ id: 'atom', name: 'Atom Bomb', cat: 'heavy', unlock: 38, ammo: 1, icon: 'mushroom', color: '#ffeb3b',
  desc: 'Between a nuke and a mega-nuke. Nothing survives the center.', spec: { r: 8, g: 1.1, shake: 1.2, mushroom: true, color: '#fff59d', boom: B(100, 82) } });
add({ id: 'corkscrew', name: 'Corkscrew', cat: 'jet', unlock: 38, ammo: 1, icon: 'spiral', color: '#00bcd4',
  desc: 'Spirals under power.', spec: { wave: { amp: 40, freq: 8 }, thrust: { a: 150, dur: 2 }, g: 0.5, trail: 'line', color: '#84ffff', boom: B(30, 26) } });
add({ id: 'mamaseagull', name: 'Mama Seagull', cat: 'air', unlock: 39, ammo: 1, icon: 'bird3', color: '#64b5f6',
  desc: 'A bigger flock, and every bird brings chicks.',
  spec: { apex: { n: 7, pattern: 'v', spread: 90, speed: 240, spec: { g: 0.35, thrust: { a: 220, dur: 1.4 }, r: 4, color: '#ffffff', trail: 'line', boom: B(26, 18),
    apex: { n: 3, pattern: 'v', spread: 50, speed: 180, spec: { g: 0.4, r: 2.5, color: '#ffffff', boom: B(16, 10) } } } } } });
add({ id: 'asteroid', name: 'Asteroid Storm', cat: 'air', unlock: 40, ammo: 1, icon: 'meteor', color: '#bf360c',
  desc: 'A flare calls eight heavy asteroids down on a wide area around it.',
  spec: { r: 4, trail: 'fire', color: '#ff8a65', bounce: { n: 2, k: 0.4 }, stick: 0.5, marker: true, boom: B(14, 6),
    sky: { n: 8, pattern: 'rain', spread: 400, speed: 560, delay: 0.4, spec: { r: 6, g: 1.5, trail: 'fire', color: '#ff8a65', boom: B(38, 28) } } } });
add({ id: 'turretmob', name: 'TurretMob', cat: 'guided', unlock: 40, ammo: 1, icon: 'turret', color: '#455a64',
  desc: 'Deploys three turrets that each fire at the nearest enemy.',
  spec: { boom: B(14, 6), split: { n: 3, pattern: 'ground', spread: 160, spec: { stick: 2.0, r: 5, color: '#90a4ae', boom: B(12, 4),
    timed: { t: 0.4, repeat: 3, n: 1, pattern: 'aim', speed: 520, spec: { r: 2.5, g: 0.5, trail: 'line', color: '#cfd8dc', boom: B(18, 14) } } } } } });
add({ id: 'phantom', name: 'Phantom', cat: 'guided', unlock: 41, ammo: 1, icon: 'ghost', color: '#26a69a',
  desc: 'A ghost that hunts. Passes through everything but tanks.', spec: { phase: 3.0, homing: 1.0, g: 0.4, trail: 'none', color: '#b2dfdb', boom: B(32, 30) } });
add({ id: 'heatseeker', name: 'Heat Seeker', cat: 'guided', unlock: 42, ammo: 1, icon: 'missile', color: '#d50000',
  desc: 'Relentless tracking and a hot warhead.', spec: { homing: 2.2, drag: 0.2, thrust: { a: 300, dur: 3 }, g: 0.5, trail: 'fire', boom: B(34, 40) } });
add({ id: 'cutter', name: 'Cutter', cat: 'laser', unlock: 42, ammo: 1, icon: 'laser3', color: '#b71c1c',
  desc: 'Three beams fanned out.', spec: { laser: { len: 2200, w: 6, dmg: 30, n: 3, spread: 10 }, color: '#ff5252' } });
add({ id: 'drone', name: 'Kamikaze Drone', cat: 'guided', unlock: 43, ammo: 1, icon: 'drone', color: '#4a148c',
  desc: 'Flies itself into the target.', spec: { homing: 1.6, thrust: { a: 320, dur: 4 }, g: 0.2, trail: 'line', color: '#ea80fc', boom: B(30, 50) } });
add({ id: 'orbital', name: 'Orbital Strike', cat: 'laser', unlock: 44, ammo: 1, icon: 'sun', color: '#ff6f00',
  desc: 'A targeting flare bounces to rest and paints the spot for a devastating beam from orbit.', spec: { r: 3.5, nocrater: true, marker: true, trail: 'spark', bounce: { n: 2, k: 0.4 }, stick: 0.3, color: '#ffd180', boom: B(0, 0), skylaser: { w: 24, dmg: 80, delay: 0.9, carve: 14 } } });
add({ id: 'meganuke', name: 'Mega-Nuke', cat: 'heavy', unlock: 45, ammo: 1, icon: 'nuke', color: '#ffc107',
  desc: 'The ever-powerful endgame. Reshapes the map and everyone on it.', spec: { r: 9, shake: 1.6, mushroom: true, color: '#ffe57f', boom: B(125, 100) } });
add({ id: 'blackhole', name: 'Black Hole', cat: 'quirky', unlock: 46, ammo: 1, icon: 'hole', color: '#311b92',
  desc: 'Drags nearby tanks toward the singularity.', spec: { r: 6, pull: 220, color: '#7c4dff', trail: 'spark', boom: B(60, 30) } });
add({ id: 'deathray', name: 'Death Ray', cat: 'laser', unlock: 50, ammo: 1, icon: 'laser', color: '#880e4f',
  desc: 'The last word in beam weapons.', spec: { laser: { len: 2200, w: 22, dmg: 85, carve: 16 }, color: '#ff4081' } });

// ---------------------------------------------------------------- Extra variety
add({ id: 'spikeball', name: 'Spike Ball', cat: 'quirky', unlock: 6, ammo: 1, icon: 'spike', color: '#9e9d24',
  desc: 'Bursts into spines on impact.',
  spec: { boom: B(22, 14), split: { n: 6, pattern: 'ring', speed: 420, spec: { r: 2, trail: 'line', color: '#dce775', g: 1.2, boom: B(12, 9) } } } });
add({ id: 'mine', name: 'Land Mine', cat: 'quirky', unlock: 14, ammo: 1, icon: 'bomb', color: '#424242',
  desc: 'Sits quietly on the ground and waits a long time.', spec: { stick: 4.0, color: '#9e9e9e', boom: B(40, 42) } });
add({ id: 'grasshopper', name: 'Grasshopper', cat: 'bounce', unlock: 12, ammo: 1, icon: 'bounce', color: '#7cb342',
  desc: 'Long, lazy hops across the map.', spec: { bounce: { n: 4, k: 0.9 }, g: 0.8, color: '#c5e1a5', boom: B(26, 20) } });
add({ id: 'skipper', name: 'Skipper', cat: 'bounce', unlock: 17, ammo: 1, icon: 'bounce', color: '#ffa726',
  desc: 'Skips flat and fast like a stone on water.', spec: { bounce: { n: 5, k: 0.85 }, speed: 1.2, g: 1.4, boom: B(24, 20) } });
add({ id: 'thumper', name: 'Thumper', cat: 'dig', unlock: 9, ammo: 1, icon: 'dig', color: '#a1887f',
  desc: 'A short, wide dig and a heavy thump.', spec: { r: 6, dig: { len: 80, w: 12 }, shake: 0.4, boom: B(40, 30) } });
add({ id: 'wormhole', name: 'Wormhole', cat: 'dig', unlock: 41, ammo: 1, icon: 'spiral', color: '#4527a0',
  desc: 'Tunnels, then throws seekers out the far end.',
  spec: { dig: { len: 400, w: 9 }, color: '#b388ff', boom: B(24, 16), split: { n: 4, pattern: 'up', spread: 120, speed: 300, spec: { homing: 0.8, r: 3, color: '#b388ff', boom: B(22, 16) } } } });
add({ id: 'lightning', name: 'Lightning', cat: 'laser', unlock: 26, ammo: 1, icon: 'zigzag', color: '#ffd600',
  desc: 'A jagged bolt from the heavens strikes where the rod comes to rest.', spec: { r: 3, bounce: { n: 2, k: 0.4 }, stick: 0.3, boom: B(12, 5), skylaser: { w: 6, dmg: 40, delay: 0.1 }, color: '#ffff8d', trail: 'spark' } });
add({ id: 'tornado', name: 'Tornado', cat: 'quirky', unlock: 36, ammo: 1, icon: 'spiral', color: '#90a4ae',
  desc: 'A spinning column that flings bomblets up as it travels.',
  spec: { roll: { dur: 3, speed: 150 }, color: '#cfd8dc', boom: B(26, 14), timed: { t: 0.35, repeat: 6, n: 1, pattern: 'up', spread: 40, speed: 300, spec: { r: 3, boom: B(18, 11), color: '#cfd8dc' } } } });
add({ id: 'octopus', name: 'Octopus', cat: 'quirky', unlock: 33, ammo: 1, icon: 'ring', color: '#ad1457',
  desc: 'Eight wiggling tentacles.',
  spec: { boom: B(22, 12), split: { n: 8, pattern: 'ring', speed: 240, spec: { wave: { amp: 16, freq: 14 }, r: 3, color: '#f48fb1', boom: B(20, 13) } } } });
add({ id: 'confetti', name: 'Confetti', cat: 'cluster', unlock: 10, ammo: 1, icon: 'grid', color: '#ff80ab',
  desc: 'A festive burst of forty tiny pieces.',
  spec: { apex: { n: 40, pattern: 'random', speed: 180, spec: { r: 1.8, drag: 0.2, colors: RAINBOW, boom: B(8, 3) } } } });
add({ id: 'scatter', name: 'Scatter Shot', cat: 'multi', unlock: 3, ammo: 1, icon: 'shower', color: '#1565c0',
  desc: 'Four shells at random speeds.', fire: { n: 4, spread: 10, speedVar: 0.3 }, spec: { boom: B(22, 14) } });
add({ id: 'cannonade', name: 'Cannonade', cat: 'heavy', unlock: 24, ammo: 1, icon: 'balls3', color: '#4e342e',
  desc: 'Three cannonballs, one after another.', fire: { n: 3, spread: 4, stagger: 0.25 }, spec: { r: 7, g: 1.2, boom: B(38, 32) } });
add({ id: 'ricochet', name: 'Ricochet', cat: 'bounce', unlock: 31, ammo: 1, icon: 'zigzag', color: '#ff6f00',
  desc: 'Ten fast bounces that never lose speed.', spec: { bounce: { n: 10, k: 1.0 }, speed: 1.1, trail: 'line', color: '#ffe0b2', boom: B(26, 24) } });
add({ id: 'hydra', name: 'Hydra', cat: 'guided', unlock: 47, ammo: 1, icon: 'drone', color: '#1b5e20',
  desc: 'Three heads, each one hunting.',
  fire: { n: 3, spread: 20 }, spec: { homing: 1.0, thrust: { a: 200, dur: 2.5 }, g: 0.5, trail: 'smoke', color: '#a5d6a7', boom: B(26, 22) } });
add({ id: 'avalanche', name: 'Avalanche', cat: 'terrain', unlock: 39, ammo: 1, icon: 'mountain', color: '#78909c',
  desc: 'Buries a wide area under rolling dirt.',
  spec: { dirt: true, color: '#cfd8dc', boom: B(60, 0), split: { n: 5, pattern: 'fan', spread: 90, speed: 200, inherit: 0.5, spec: { dirt: true, color: '#cfd8dc', roll: { dur: 1.0, speed: 120 }, boom: B(30, 0) } } } });
add({ id: 'pinball', name: 'Pinball', cat: 'bounce', unlock: 43, ammo: 1, icon: 'bounce', color: '#e0e0e0',
  desc: 'Bounces wildly and explodes on every hit.', spec: { bounce: { n: 6, k: 0.9, boom: true }, speed: 1.1, trail: 'line', color: '#ffffff', boom: B(22, 16) } });
add({ id: 'doomsday', name: 'Doomsday', cat: 'heavy', unlock: 48, ammo: 1, icon: 'skull', color: '#212121',
  desc: 'A nuke that rains more nukes.',
  spec: { r: 8, shake: 1.4, mushroom: true, color: '#ff1744', boom: B(80, 60), sky: { n: 3, pattern: 'rain', spread: 500, speed: 450, delay: 0.6, spec: { r: 6, mushroom: true, shake: 1, color: '#ff1744', boom: B(60, 45) } } } });
add({ id: 'sunburst', name: 'Sunburst', cat: 'laser', unlock: 49, ammo: 1, icon: 'sun', color: '#ff9100',
  desc: 'Eight beams radiate from the point of impact.',
  spec: { boom: B(24, 14), color: '#ffd180', trail: 'spark', split: { n: 8, pattern: 'ring', speed: 700, spec: { r: 2.5, g: 0, wind: 0, trail: 'line', color: '#ffd180', life: 0.8, boom: B(20, 18) } } } });

// Developer-only weapon: never unlocks, never drops, never handed to bots. Three times the Mega-Nuke.
add({ id: 'hbomb', name: 'Hydrogen Bomb', cat: 'heavy', unlock: 999, ammo: 1, icon: 'mushroom', color: '#d50000', dev: true, tiers: 1,
  desc: 'Developer only. Three times the size of a Mega-Nuke, with a crater to match.',
  spec: { r: 12, shake: 3, mushroom: true, color: '#ff8a80', trail: 'fire', boom: B(375, 300) } });

export const ALL_FAMILIES = F;
export const FAMILIES = F.filter((f) => !f.dev);

// ---------------------------------------------------------------- Tier building
const DM = [1, 1.25, 1.5, 1.8];
const RM = [1, 1.1, 1.22, 1.35];

function scaleSpec(s, k) {
  if (!s) return s;
  const o = { ...s };
  if (s.boom) o.boom = { ...s.boom, r: Math.round(s.boom.r * RM[k]), dmg: Math.round(s.boom.dmg * DM[k]) };
  if (s.laser) o.laser = { ...s.laser, dmg: Math.round(s.laser.dmg * DM[k]), w: Math.round(s.laser.w * (1 + 0.2 * k)) };
  if (s.skylaser) o.skylaser = { ...s.skylaser, dmg: Math.round(s.skylaser.dmg * DM[k]), w: Math.round(s.skylaser.w * (1 + 0.2 * k)) };
  if (s.dig) o.dig = { ...s.dig, len: Math.round(s.dig.len * (1 + 0.3 * k)) };
  if (s.heal) o.heal = Math.round(s.heal * DM[k]);
  if (s.pull) o.pull = Math.round(s.pull * (1 + 0.15 * k));
  if (s.bounce) o.bounce = { ...s.bounce, n: s.bounce.n + k };
  if (s.roll) o.roll = { ...s.roll, dur: +(s.roll.dur * (1 + 0.15 * k)).toFixed(2) };
  if (s.ufo) o.ufo = { ...s.ufo, drops: s.ufo.drops + k, bomb: scaleSpec(s.ufo.bomb, k) };
  for (const key of ['apex', 'split', 'sky', 'timed']) {
    if (s[key]) {
      const sp = s[key];
      o[key] = { ...sp, n: sp.n + (sp.n >= 3 ? k : 0), spec: scaleSpec(sp.spec, k) };
      if (key === 'timed') o[key].repeat = (sp.repeat || 1) + k;
    }
  }
  return o;
}

function scaleFire(f, k) {
  const base = { n: 1, spread: 0, stagger: 0, ...(f || {}) };
  if (base.n >= 3) base.n += k;
  return base;
}

for (const fam of F) {
  const nTiers = typeof fam.tiers === 'number' ? fam.tiers : 3;
  fam.tiers = [];
  for (let k = 0; k < nTiers; k++) {
    fam.tiers.push({
      tier: k + 1,
      name: fam.tierNames?.[k] || fam.name,
      spec: scaleSpec(fam.spec, k),
      fire: scaleFire(fam.fire, k),
    });
  }
}

export const FAMILY_BY_ID = Object.fromEntries(F.map((f) => [f.id, f]));
export const TOTAL_WEAPONS = FAMILIES.reduce((s, f) => s + f.tiers.length, 0);

export function getFamily(id) { return FAMILY_BY_ID[id]; }

// Resolve a concrete weapon (family + tier) for a tank.
export function getWeapon(id, tier = 1) {
  const fam = FAMILY_BY_ID[id];
  if (!fam) return null;
  const t = fam.tiers[Math.min(fam.tiers.length, Math.max(1, tier)) - 1];
  return { id, fam, tier: t.tier, name: t.name, spec: t.spec, fire: t.fire, icon: fam.icon, color: fam.color, ammo: fam.ammo };
}

export function familiesUnlockedAt(level) {
  return F.filter((f) => f.unlock <= level);
}

// Mastery XP needed to reach each tier (index = tier-1).
export const MASTERY_XP = [0, 150, 450, 900];

export function tierForMastery(xp, fam) {
  let t = 1;
  for (let i = 1; i < fam.tiers.length; i++) if (xp >= MASTERY_XP[i]) t = i + 1;
  return t;
}

// Rough "power" summary of a spec for the armory screen.
export function describeSpec(spec, fire) {
  const bits = [];
  const count = (fire?.n || 1);
  if (count > 1) bits.push(`${count} shells`);
  if (spec.laser) bits.push(`beam ${spec.laser.dmg} dmg` + (spec.laser.n > 1 ? ` x${spec.laser.n}` : ''));
  if (spec.boom && spec.boom.dmg > 0) bits.push(`${spec.boom.dmg} dmg, ${spec.boom.r}px blast`);
  if (spec.boom && spec.dirt) bits.push(`builds ${spec.boom.r}px dirt`);
  if (spec.heal) bits.push(`heals ${spec.heal}`);
  if (spec.skylaser) bits.push(`sky beam ${spec.skylaser.dmg} dmg`);
  for (const key of ['apex', 'split', 'sky']) {
    const sp = spec[key];
    if (sp) {
      const child = sp.spec;
      const where = key === 'apex' ? 'at apex' : key === 'sky' ? 'from the sky' : 'on impact';
      const cd = child.boom && child.boom.dmg ? `${child.boom.dmg} dmg each` : child.dirt ? 'dirt' : child.laser ? 'beams' : '';
      bits.push(`${sp.n} ${where}${cd ? ` (${cd})` : ''}`);
    }
  }
  if (spec.timed) bits.push(`${spec.timed.repeat} drops in flight`);
  if (spec.bounce) bits.push(`${spec.bounce.n} bounces`);
  if (spec.roll) bits.push(`rolls ${spec.roll.dur}s`);
  if (spec.dig) bits.push(`digs ${spec.dig.len}px`);
  if (spec.homing) bits.push('homing');
  if (spec.phase) bits.push('phases through terrain');
  if (spec.thrust) bits.push('powered flight');
  if (spec.pierce) bits.push('ignores armor');
  if (spec.ufo) bits.push(`${spec.ufo.drops} bombs while hovering`);
  return bits.join(' · ');
}
