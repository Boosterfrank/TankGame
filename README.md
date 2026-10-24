# Unnamed Tank Game

A browser artillery game by **Qubiplex**, inspired by ShellShock Live and the classic
Scorched Earth / Worms lineage. Fully destructible terrain, simultaneous-fire rounds,
**163 weapon families (490 weapons counting mastery tiers)**, bots, hot-seat local
multiplayer for up to 8 tanks, and a persistent profile with levels, unlocks and
weapon mastery. No build step, no dependencies, no image assets apart from the logo:
everything is rendered procedurally on a `<canvas>`.

## Play

```
npm start          # zero-dependency static server on http://localhost:8080
```

Any static file server works (`python3 -m http.server 8080`, GitHub Pages, Netlify…).
The game uses ES modules, so it must be served over HTTP rather than opened from `file://`.

## How it works

- **Everyone aims at once.** Humans aim (passing the keyboard in hot-seat games), bots plan
  their shots, and when the turn timer ends or you press FIRE every shell launches together.
- **Terrain is destructible** down to the pixel: craters, tunnels, dirt walls and buried tanks.
- **Wind** changes every round and pushes shells sideways; lasers ignore it.
- **XP and levels.** Damage you deal earns XP. Each level unlocks new weapon families
  (level 1 starts with 4, everything is unlocked by level 50).
- **Mastery.** Each family levels from Tier I to Tier IV through the damage it deals,
  gaining damage, blast radius and extra shells. Gears (earned per game) can buy a tier early.
- **Items** (repair, shield, teleport, double damage, fuel, ammo) never end your turn.
- **Supply drops** parachute in; drive into them for weapons you may not even have unlocked.
- Deathmatch or Team Battle, 100–300 HP, five wind levels, turn timers, bot difficulty,
  ten map styles and a sandbox mode that unlocks every weapon for one game.

### Controls

| Input | Action |
| --- | --- |
| `←` `→` | Aim the barrel (hold `Shift` for fine control) |
| `↑` `↓` / mouse wheel | Power |
| `A` `D` | Drive (uses fuel) |
| Mouse drag on the battlefield | Aim from your tank toward the pointer |
| `Space` / `Enter` | Fire (lock in your shot) |
| `Tab` / `W` | Weapons grid |
| `E` | Items |
| `Esc` | Close panel / leave game |

## Project layout

```
index.html            page shell (1920x1080 stage scaled to the window)
css/style.css         all UI styling
src/config.js         game name, physics constants, defaults
src/weapons.js        the weapon catalog + tier scaling (data-driven)
src/projectile.js     interprets weapon specs as flight behaviors
src/game.js           round/turn state machine, explosions, spawning, crates, scoring
src/terrain.js        destructible terrain (bitmask + layered canvas rendering)
src/terrain-gen.js    heightmap generators for the map styles
src/ai.js             bot aiming (trajectory search) and loadouts
src/render.js         background, tanks, projectiles, in-world overlays
src/fx.js             particles, explosions, beams, floating text, screen shake
src/audio.js          procedural WebAudio sound effects
src/profile.js        localStorage profile: XP, levels, gears, mastery
src/icons.js          procedural pictogram icons for weapons and items
src/ui/hud.js         bottom HUD, weapons grid, items panel
src/ui/screens.js     title, hub, lobby, armory, help, settings, results
src/app.js            screen flow, input, render loop
assets/               Qubiplex logo + favicon
scripts/              node tests (catalog sanity, headless Playwright smoke/weapon tests)
```

### Adding a weapon

Weapons are plain data in `src/weapons.js`. A family is a projectile *spec* plus a few
metadata fields; the engine composes behaviors from the spec, so most new ideas are one line:

```js
add({ id: 'hopper', name: 'Hopper', cat: 'bounce', unlock: 12, ammo: 1, icon: 'bounce', color: '#fb8c00',
  desc: 'Bounces twice, then splits into three.',
  spec: { bounce: { n: 2, k: 0.7 }, boom: B(24, 16),
          split: { n: 3, pattern: 'up', spread: 60, speed: 300, spec: { boom: B(22, 14) } } } });
```

Available behaviors: `boom`, `dirt`, `heal`, `pierce`, `teleport`, `pull`, `bounce`, `roll`,
`dig`, `phase`, `stick`, `fuse`, `homing`, `thrust`, `wave`, `boomerang`, `ufo`, `laser`,
`skylaser`, and child spawners `apex` / `split` / `sky` / `timed` with patterns `fan`, `up`,
`down`, `ring`, `random`, `rain`, `line`, `ground`, `groundfwd`, `stack`, `v`, `rise`, `aim`.
Three mastery tiers are generated automatically (four if `tiers: 4`).

## Tests

```
npm test                       # catalog + terrain sanity checks (node only)
npm start & node scripts/smoke.mjs --shots     # headless browser: plays rounds, screenshots
node scripts/test-weapons.mjs  # fires every weapon family and tier in a headless game
node scripts/test-flow.mjs     # hot-seat, team mode, items, mouse aiming
```

The browser tests use the Playwright package if it is installed globally or locally.

## Credits

Made by Qubiplex. Inspired by [ShellShock Live](https://store.steampowered.com/app/326460/ShellShock_Live/)
by kChamp Games; this is an original fan-made homage with its own code, art and weapon designs.
