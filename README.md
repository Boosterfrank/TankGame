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

Any static file server works (`python3 -m http.server 8080`, Cloudflare Pages, GitHub Pages…).
The game uses ES modules, so it must be served over HTTP rather than opened from `file://`.

The first start asks for a commander name (changeable later in Settings). QUICK PLAY asks whether
to find a public online room or fight five bots offline; CUSTOM GAME and PLAY ONLINE set everything
up by hand.

## Online play (Cloudflare Workers)

Online rooms run on a tiny Cloudflare Worker with Durable Objects (`worker/`). The Worker only
relays locked-in shots; every client simulates each volley itself from a shared seed, in lockstep
with a fixed timestep, so the relay never runs physics and comfortably fits the free plan.

Deploy it once:

```
cd worker
npm install
npx wrangler login          # opens the browser once
npm run deploy              # prints https://unnamed-tank-game-relay.<account>.workers.dev
```

Then either set `ONLINE_SERVER` in `src/config.js` to that URL before deploying the game, or paste
it into **Settings → Online relay server** in the running game. `npm run dev` inside `worker/`
starts a local relay on `http://localhost:8787` for development.

Rooms are created from **Play Online**: public rooms appear in the browser, private rooms are
joined by their five-character code. The host controls settings and bots; everyone, host included,
clicks READY and the battle starts by itself after a three-second countdown (anyone unreadying
cancels it). Chat works in the lobby and in-game (Enter). If a player disconnects mid-game their
tank is destroyed at the next volley; if the host leaves, the next player becomes host. Supply
crates are picked up the moment you drive into one; the pickup is replayed for everyone at the
next volley.

The relay timestamps its round messages: clients measure the clock offset and show a turn timer
that ends 2.5 s before the relay closes the round, so a shot locked at 0:00 still counts. A match
keeps simulating in a hidden browser tab, so the room never waits on a player who switched tabs.

## Deploying the game to Cloudflare Pages

1. Push the repo to GitHub and in the Cloudflare dashboard choose Workers & Pages → Create →
   Pages → Connect to Git.
2. Framework preset **None**, build command empty, build output directory `/`.
3. Deploy. Every push to the production branch redeploys; the relay Worker is deployed separately
   from `worker/` and its URL goes in `src/config.js` (`ONLINE_SERVER`).

## How it works

- **Move, then fire.** Each round opens with a move phase (8 seconds by default; the lobby's
  **Move Phase** setting offers 5, 8, 12 or off) in which everyone drives at once; DONE MOVING parks
  your tank early. Weapons, items and the aim guide are available in both phases. Then the aim phase
  starts: nobody drives, everyone aims (passing the keyboard in hot-seat games), bots plan their
  shots, and when the turn timer ends or you press FIRE every shell launches together. With the move
  phase off you drive while aiming, as before.
- **Terrain is destructible** down to the pixel: craters, tunnels, dirt walls and buried tanks.
- **Wind** changes every round and pushes shells sideways; lasers ignore it.
- **XP and levels.** Damage you deal earns XP. Each level unlocks new weapon families
  (level 1 starts with 4, everything is unlocked by level 50).
- **Battle loadouts.** You do not bring your whole armory into a fight. Each battle deals you Shot
  plus two random weapons from every category (basic, multi-shot, clusters, bouncers, diggers,
  lasers, air support, guided, jets, heavy ordnance, terrain, oddities), drawn from what you have
  unlocked with weights that favor the weapons you have upgraded (tier I ×1, II ×2.5, III ×4,
  IV ×5.5). Bots draw the same way. Supply drops then hand out weapons you are not carrying. The
  lobby's **Loadout** setting switches back to the full arsenal, and sandbox mode always gives everything.
- **Mastery.** Each family levels from Tier I to Tier IV through the damage it deals,
  gaining damage, blast radius and extra shells. Gears (earned per game) can buy a tier early:
  `(20 + unlockLevel × 3) × {1, 1.6, 2.2}` rounded to 5, so a level-1 weapon costs 25/35/50 and a
  level-50 weapon 170/270/375 (`upgradeCost` in `src/profile.js`).
- **Rewards.** After a battle a full-screen sequence counts up the XP and gears, walks the XP bar
  through each level-up and slides in the weapons unlocked and mastery tiers gained. Click to skip.
- **Shop.** Gears also buy cosmetics (`src/cosmetics.js`): hull paint (stripes, camo, hex, flames…),
  turret accessories (crown, top hat, halo, horns…), shot trails that recolor plain shells (rainbow,
  fire, ice…) and titles shown under your name. Paint, accessories and titles are visible to
  everyone online; bots occasionally dress up too.
- **Flares.** Air-support weapons (Rain, Meteor Shower, Airstrike, Solar Flare and friends) fire a
  marker flare that bounces to a stop; the strike lands exactly where the flare rests.
- **Level balance.** Higher-level tanks deal up to 40% less damage to lower-level ones and
  lower-level tanks deal up to 30% more, scaled by the level gap (lobby setting, on by default).
  The HUD shows your current modifier against the weakest enemy.
- **Aiming guide.** A translucent range circle around your tank with a wedge whose length is your
  power, and a "power, angle" readout under the tank.
- **Items** never end your turn. Six types (repair, shield, teleport, damage boost, fuel, ammo), each
  in three tiers, for example Repair Kit → Field Repair → Full Overhaul, or Double Damage → Heavy
  Shells → Triple Damage. Everyone starts a battle with two of each type; the tier of each copy is
  rolled from the shared seed with odds that improve with level (`tierOdds` in `src/items.js`: about
  8% tier III at level 1, 40% at level 60).
- **Supply drops** parachute in: weapon crates (weapons you are not carrying, possibly not even unlocked), item crates
  (an item, preferring types you have run out of) and repair crates. Their contents are decided when
  they spawn, so online players always agree on what was inside.
- Deathmatch or Team Battle, 100–300 HP, five wind levels, turn timers, bot difficulty,
  ten map styles and a sandbox mode that unlocks every weapon for one game. In an online lobby
  everyone picks their own team and the host (or a developer) can place anyone, bots included;
  teams take effect in Team Battle.

### Controls

| Input | Action |
| --- | --- |
| `←` `→` | Aim: one degree per tap, hold to accelerate up to 80 per second (`Shift` = 5 per step). Aim runs from straight down on one side, over the top, to straight down on the other |
| `↑` `↓` / mouse wheel | Power, one point per step |
| `A` `D` | Drive (uses fuel) |
| Mouse drag on the battlefield | Aim from your tank toward the pointer |
| `Space` | Fire (lock in your shot) |
| `Enter` / `T` / `/` | Chat (online games) |
| `Tab` / `W` | Weapons grid: only weapons with ammo are listed (start typing to search, Enter picks the first match) |
| `E` | Items |
| `Esc` | Close panel / leave game |

## Presentation

- **Intro cutscene.** The first click plays a short cinematic (studio card, two tanks rolling in, a
  slow-motion shell, the hit, the title reveal). Any click or key skips it; Settings can turn it
  off or replay it. `INTRO_STUDIO_CARD` in `src/config.js` controls the studio card.
- **Living menus.** A silent bot battle plays behind every menu screen, with drifting motes,
  shooting stars and a music-reactive glow on the title.
- **Music and visualizer.** `MUSIC_TRACKS` in `src/config.js` lists the tracks (compressed OGG/MP3
  copies of `assets/menu_music.wav` load first). An AnalyserNode drives the spectrum bars along the
  bottom of the menus, the pulsing nebula and the equalizer in the now-playing chip. Music ducks
  during battles. The visualizer keeps running while music is muted (the MUTE button in the
  now-playing chip); the volume slider lives in Settings.
- **Transitions.** The battlefield fades to black and back when the background battle resets, and
  fades in after the start button and when a match begins. The screen stays dark until the tanks have
  dropped onto the terrain, so the fade-in reveals a settled battlefield.

## Developer tools

Developers also get powers in lobbies. Offline, every player row has a level box. Online, the relay
verifies the developer password (sent once per connection, compared as a SHA-256 digest) and then
treats that player as a host: settings, bots, kicks and a forced start all work from any seat, and
each player row gains buttons to add levels, set an exact level, or hand out gears and XP. Grants
are delivered to the target client, applied to its saved profile and re-reported to the room, so
the new level shows up for everyone. The dev panel's ROOM section has bulk versions (everyone +5,
all bots to level 60, force start). Mid-game, the panel's GAME section takes a **target** tank: heal,
kill, full fuel, +5 ammo of any weapon, +1 of everything, the H-Bomb and all items can be given to
anyone, and online they are replayed by every client with your next lock-in so arsenals stay in
lockstep. A verified developer can also grant levels, gears and XP to any human in the match. Note that the password is kept in this browser's localStorage
once entered so the relay can verify later sessions; LOCK in the panel clears it.

A hidden developer console (profile cheats, god mode, infinite ammo, time scale, debug overlays,
bot-aim reveal, a weapon test range and a spectator bot battle) is gated behind a password. The
gate opens after clicking the profile avatar in the top bar five times quickly; the password hash
lives in `src/ui/devtools.js`. Once unlocked, the `` ` `` key or the DEV button toggles the panel.
It also hands out the developer-only Hydrogen Bomb (three times a Mega-Nuke). Online, the actions
that change shared state (heal, kills, crates, wind, terrain, god mode) travel with your next lock-in
so every client applies them in lockstep; ammo and items stay local because shots carry the weapon.

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
src/render.js         sky, fog, tanks, projectiles, aiming guide, in-world overlays
src/tanksprite.js     procedural tank sprite shared by game, intro, HUD and lobby
src/fx.js             particles, explosions, beams, floating text, screen shake
src/audio.js          procedural WebAudio sound effects
src/profile.js        localStorage profile: XP, levels, gears, mastery, cosmetics
src/cosmetics.js      shop catalog (paint, accessories, trails, titles) and trail styles
src/icons.js          procedural pictogram icons for weapons and items
src/music.js          music playback + analyser for the visualizer
src/intro.js          opening cutscene
src/online.js         online session: relay protocol client and game bridge
src/ui/hud.js         bottom HUD, weapons grid, items panel
src/ui/screens.js     title, hub, lobby, armory, settings (with how-to-play), results
src/ui/shop.js        cosmetics shop with live previews
src/ui/rewards.js     post-battle rewards sequence
src/ui/online.js      room browser and online lobby with chat
src/ui/devtools.js    password-gated developer console
src/app.js            screen flow, input, fixed-timestep render loop
worker/               Cloudflare Worker relay (Durable Object rooms + public room directory)
assets/               Qubiplex logo + favicon
scripts/              node tests (catalog sanity, headless Playwright smoke/weapon/online tests)
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
(cd worker && npm run dev) & node scripts/test-relay.mjs    # relay protocol with two sockets
node scripts/test-online.mjs   # two browsers play an online match; checks both stay in lockstep
```

The browser tests use the Playwright package if it is installed globally or locally.

## Credits

Made by Qubiplex. Inspired by [ShellShock Live](https://store.steampowered.com/app/326460/ShellShock_Live/)
by kChamp Games; this is an original fan-made homage with its own code, art and weapon designs.
