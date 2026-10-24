// Central game configuration. Change the name here and it updates everywhere.
export const GAME_NAME = 'Unnamed Tank Game';
export const STUDIO = 'Qubiplex';
export const VERSION = '0.1.0';

// The whole UI is designed at 1920x1080 and scaled to fit the window.
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
export const HUD_H = 160;
export const WORLD_W = DESIGN_W;
export const WORLD_H = DESIGN_H - HUD_H; // 920

export const PHYS = {
  gravity: 620,        // px/s^2
  launchSpeed: 11.6,   // px/s per power point (power 0..100)
  windAccel: 15,       // px/s^2 per wind unit (wind is -10..10)
  tankRadius: 16,
  tankSpeed: 95,       // px/s when driving
  fuelPerPx: 1.6,
  maxFuel: 500,
  fuelRegen: 60,       // fuel refilled each round
  maxArmor: 50,
};

export const COLORS = {
  self: '#4cff5e',
  ally: '#4fc3ff',
  enemy: '#ff4b4b',
  terrain: '#29b6f6',
};

export const TEAM_NAMES = ['1', '2', '3', '4'];

export const BOT_NAMES = [
  'Rook', 'Nova', 'Bolt', 'Quill', 'Zephyr', 'Maple', 'Astra', 'Kilo', 'Pixel', 'Juno',
  'Vex', 'Orbit', 'Sable', 'Tango', 'Wren', 'Delta', 'Moss', 'Ember', 'Fable', 'Gizmo',
  'Hex', 'Indigo', 'Jinx', 'Krypto', 'Lumen', 'Nimbus', 'Onyx', 'Pepper', 'Quartz', 'Rascal',
];

export const DIFFICULTIES = ['Easy', 'Normal', 'Hard'];

export const DEFAULT_SETTINGS = {
  mode: 'deathmatch',      // 'deathmatch' | 'team'
  hp: 100,                 // 100 | 150 | 200 | 300
  wind: 'low',             // 'none' | 'low' | 'medium' | 'high' | 'crazy'
  turnTime: 30,            // 15 | 30 | 45 | 60 | 0 (unlimited)
  tracers: true,
  items: true,
  map: 'random',
  difficulty: 'Normal',
  arsenal: 'unlocked',     // 'unlocked' | 'all'
  crates: true,
};
