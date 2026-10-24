// Menu screens built with plain DOM: title, hub, lobby, armory, help, settings, results, modals.
import { el, roman, fmt, escapeHtml, RNG } from '../util.js';
import { GAME_NAME, STUDIO, VERSION, BOT_NAMES, DEFAULT_SETTINGS, WORLD_W, WORLD_H } from '../config.js';
import { iconURL } from '../icons.js';
import { FAMILIES, FAMILY_BY_ID, CATEGORIES, TOTAL_WEAPONS, getWeapon, describeSpec, MASTERY_XP } from '../weapons.js';
import { MAP_STYLES, generateHeights, spawnColumns } from '../terrain-gen.js';
import { Terrain } from '../terrain.js';
import { xpForLevel, unlockedFamilies, weaponTier, upgradeCost, buyUpgrade, nextMasteryXp, resetProfile, saveProfile } from '../profile.js';
import { drawTankSprite } from '../tanksprite.js';

const TIPS = [
  'Hold Shift while using the arrow keys for fine aiming.',
  'Click and drag anywhere on the battlefield to aim with the mouse.',
  'Dirt Ball can bury an enemy. Tunnelers can dig them back out.',
  'Lasers ignore wind and gravity but need a clear line of sight.',
  'Supply drops contain weapons you may not have unlocked yet.',
  'Damage you deal with a weapon levels it up. Tier IV weapons hit much harder.',
  'Your own explosions hurt you too. Mind the blast radius of a Nuke.',
  'Items never end your turn. Shield up before a big volley lands.',
  'Everyone fires at once. Lock in your shot before the timer runs out.',
  'Rollers follow the ground. Fire them low along a slope.',
];

// Top-bar brand (game name only).
export function brandEl(app) {
  return el('div.brand', {}, [el('span', { text: GAME_NAME }), app.dev.unlocked ? el('button.mini.dev-btn', { text: 'DEV', onclick: () => app.dev.toggle() }) : null]);
}

// Minimal boot screen: one click unlocks audio and starts the intro.
export function bootScreen(app) {
  const tank = el('canvas.boot-tank', { width: 180, height: 100 });
  drawMiniTank(tank, '#4cff5e', 2.4);
  const s = el('div.screen.boot-screen', {}, [
    el('div.boot-inner', {}, [
      tank,
      el('button.btn.btn-primary.btn-big.start-btn', { text: 'CLICK TO START' }),
      el('div.boot-hint', { text: app.profile.settings.intro === false ? 'Sound on' : 'Sound on · any key skips the intro' }),
    ]),
    el('div.footer', { text: `v${VERSION}` }),
  ]);
  let used = false;
  const go = (e) => { if (used) return; used = true; e?.stopPropagation?.(); app.beginSession(); };
  s.querySelector('.start-btn').addEventListener('click', go);
  s.addEventListener('click', go);
  return s;
}
export const titleScreen = bootScreen;

export function profileBar(app) {
  const p = app.profile;
  const need = xpForLevel(p.level);
  return el('div.profile-bar', {}, [
    el('div.avatar.secret', { text: p.name.slice(0, 2).toUpperCase(), title: p.name, onclick: () => app.dev.secretClick() }),
    el('div.pb-name', { text: p.name }),
    el('div.pb-level', {}, [el('small', { text: 'LEVEL' }), el('b', { text: p.level })]),
    el('div.pb-xp', {}, [el('div.pb-xp-fill', { style: { width: `${Math.min(100, (p.xp / need) * 100)}%` } }), el('span', { text: `${fmt(p.xp)} / ${fmt(need)} XP` })]),
    el('div.pb-gears', { html: `${fmt(p.gears)} <i class="gear"></i>` }),
  ]);
}

export function menuScreen(app) {
  const s = el('div.screen.menu-screen', {}, [
    el('div.topbar', {}, [brandEl(app), profileBar(app)]),
    el('div.menu-body', {}, [
      el('div.menu-left', {}, [
        el('h1.hub-title', { html: GAME_NAME.split(' ').map((w) => `<span>${escapeHtml(w)}</span>`).join(' ') }),
        el('div.menu-buttons', { style: { '--n': 6 } }, [
          el('button.btn.btn-primary.btn-big', { text: 'QUICK PLAY', onclick: () => app.quickPlay() }),
          el('button.btn.btn-big', { text: 'CUSTOM GAME', onclick: () => app.show('lobby') }),
          el('button.btn.btn-big.btn-online', { html: 'PLAY ONLINE <small>beta</small>', onclick: () => app.show('online') }),
          el('button.btn.btn-big', { text: 'ARMORY', onclick: () => app.show('armory') }),
          el('button.btn.btn-big', { text: 'HOW TO PLAY', onclick: () => app.show('help') }),
          el('button.btn.btn-big', { text: 'SETTINGS', onclick: () => app.show('settings') }),
        ]),
      ]),
      el('div.menu-right', {}, [statsCard(app), tipCard()]),
    ]),
    el('div.footer', { text: `v${VERSION} · ${FAMILIES.length} weapon families, ${TOTAL_WEAPONS} weapons` }),
  ]);
  return s;
}

function statsCard(app) {
  const p = app.profile, st = p.stats;
  const unlocked = unlockedFamilies(p).length;
  return el('div.card.stats-card', {}, [
    el('h3', { text: 'SERVICE RECORD' }),
    el('div.stat-grid', {}, [
      ['Games', st.games], ['Wins', st.wins], ['Kills', st.kills], ['Damage', fmt(st.damage)], ['Shots', st.shots],
      ['Weapons', `${unlocked} / ${FAMILIES.length}`],
    ].map(([k, v]) => el('div.stat', {}, [el('b', { text: v }), el('small', { text: k })]))),
  ]);
}

function tipCard() {
  return el('div.card.tip-card', {}, [el('h3', { text: 'FIELD MANUAL' }), el('p', { text: TIPS[Math.floor(Math.random() * TIPS.length)] })]);
}

// ---------------------------------------------------------------- Lobby
export const SETTING_DEFS = [
  { key: 'mode', label: 'Mode', values: [['deathmatch', 'Deathmatch'], ['team', 'Team Battle']] },
  { key: 'hp', label: 'HP', values: [[100, '100'], [150, '150'], [200, '200'], [300, '300']] },
  { key: 'wind', label: 'Wind', values: [['none', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['crazy', 'Crazy']] },
  { key: 'turnTime', label: 'Turn Time', values: [[15, '15'], [30, '30'], [45, '45'], [60, '60'], [0, 'Unlimited']] },
  { key: 'tracers', label: 'Shot Tracers', values: [[true, 'On'], [false, 'Off']] },
  { key: 'items', label: 'Items', values: [[true, 'On'], [false, 'Off']] },
  { key: 'crates', label: 'Supply Drops', values: [[true, 'On'], [false, 'Off']] },
  { key: 'difficulty', label: 'Bot Skill', values: [['Easy', 'Easy'], ['Normal', 'Normal'], ['Hard', 'Hard']] },
  { key: 'arsenal', label: 'Weapons', values: [['unlocked', 'Unlocked only'], ['all', 'Everything']] },
  { key: 'balance', label: 'Level Balance', values: [[true, 'On'], [false, 'Off']] },
];

export function newLobby(app) {
  const p = app.profile;
  const rng = new RNG(Date.now());
  const names = rng.shuffle(BOT_NAMES);
  return {
    settings: { ...DEFAULT_SETTINGS },
    seed: rng.int(1, 1e9),
    players: [
      { name: p.name, isBot: false, team: 1, isProfile: true },
      ...[0, 1, 2].map((i) => ({ name: names[i], isBot: true, team: 2 + (i % 3), level: Math.max(1, p.level + rng.int(-3, 6)) })),
    ],
    nextNames: names.slice(3),
  };
}

export function lobbyScreen(app) {
  if (!app.lobby) app.lobby = newLobby(app);
  const L = app.lobby;
  const s = el('div.screen.lobby-screen');
  const render = () => {
    s.innerHTML = '';
    const teamMode = L.settings.mode === 'team';
    const list = el('div.player-list');
    L.players.forEach((pl, i) => {
      const row = el('div.player-row', { class: `player-row${pl.isBot ? ' bot' : ' human'}`, style: { '--i': i } });
      row.append(el('div.pl-level', {}, [el('small', { text: pl.isBot ? 'BOT' : pl.isProfile ? 'YOU' : 'P' + (i + 1) }), el('b', { text: pl.isProfile ? app.profile.level : (pl.level || '-') })]));
      row.append(el('div.pl-avatar', { text: pl.name.slice(0, 2).toUpperCase() }));
      const nameWrap = el('div.pl-name');
      if (pl.isProfile) nameWrap.append(el('b', { text: pl.name }), el('small', { text: 'Host' }));
      else {
        const inp = el('input', { type: 'text', value: pl.name, maxlength: 14 });
        inp.addEventListener('change', () => { pl.name = inp.value.trim() || pl.name; });
        nameWrap.append(inp);
        const typeBtn = el('button.mini', { text: pl.isBot ? 'BOT' : 'HUMAN', title: 'Toggle human / bot', onclick: () => { pl.isBot = !pl.isBot; render(); } });
        nameWrap.append(typeBtn);
      }
      row.append(nameWrap);
      if (pl.isBot) {
        const lvl = el('div.pl-botlvl', {}, [
          el('button.mini', { text: '−', onclick: () => { pl.level = Math.max(1, (pl.level || 1) - 5); render(); } }),
          el('span', { text: `Lvl ${pl.level || 1}` }),
          el('button.mini', { text: '+', onclick: () => { pl.level = Math.min(60, (pl.level || 1) + 5); render(); } }),
        ]);
        row.append(lvl);
      } else row.append(el('div.pl-botlvl.ghost', { text: pl.isProfile ? `${app.profile.gears} gears` : 'Guest' }));
      const team = el('div.pl-team', { class: `pl-team${teamMode ? '' : ' off'}` }, [
        el('small', { text: 'TEAM' }),
        el('button.mini', { text: '◀', onclick: () => { pl.team = ((pl.team - 2 + 4) % 4) + 1; render(); } }),
        el('b', { text: teamMode ? pl.team : '?' }),
        el('button.mini', { text: '▶', onclick: () => { pl.team = (pl.team % 4) + 1; render(); } }),
      ]);
      row.append(team);
      const tankPrev = el('canvas.pl-tank', { width: 70, height: 40 });
      drawMiniTank(tankPrev, teamMode ? ['#4cff5e', '#4fc3ff', '#ff4b4b', '#ffd740'][pl.team - 1] : (pl.isProfile ? '#4cff5e' : '#ff4b4b'));
      row.append(tankPrev);
      row.append(el('div.pl-ready', { html: '&#10004;' }));
      if (!pl.isProfile) row.append(el('button.kick', { text: 'KICK', onclick: () => { L.players.splice(i, 1); render(); } }));
      else row.append(el('div.kick.ghost'));
      list.append(row);
    });
    const addRow = el('div.add-row');
    if (L.players.length < 8) {
      addRow.append(
        el('button.btn.btn-small', { text: '+ ADD BOT', onclick: () => { const nm = L.nextNames.shift() || `Bot ${L.players.length}`; L.players.push({ name: nm, isBot: true, team: (L.players.length % 4) + 1, level: Math.max(1, app.profile.level + Math.floor(Math.random() * 8) - 2) }); render(); } }),
        el('button.btn.btn-small', { text: '+ ADD LOCAL PLAYER', onclick: () => { const n = L.players.filter((p) => !p.isBot).length + 1; L.players.push({ name: `Player ${n}`, isBot: false, team: (L.players.length % 4) + 1 }); render(); } }),
      );
    } else addRow.append(el('span.muted', { text: 'Lobby full (8 players)' }));

    // right column
    const preview = el('canvas.map-preview', { width: 420, height: 180 });
    const { heights, style } = generateHeights(L.settings.map, L.seed, WORLD_W, WORLD_H);
    const cols = spawnColumns(L.players.length, WORLD_W, new RNG(L.seed));
    Terrain.drawPreview(preview.getContext('2d'), heights, WORLD_W, WORLD_H, 420, 180, cols);
    const mapName = MAP_STYLES.find((m) => m.id === L.settings.map);
    const mapCard = el('div.card.map-card', {}, [
      el('div.map-head', {}, [
        el('button.mini', { text: '◀', onclick: () => { cycleMap(-1); } }),
        el('b', { text: mapName?.name || 'Random Map' }),
        el('button.mini', { text: '▶', onclick: () => { cycleMap(1); } }),
        el('button.mini.reroll', { text: '⟳ NEW SEED', title: 'Regenerate terrain', onclick: () => { L.seed = Math.floor(Math.random() * 1e9); render(); } }),
      ]),
      preview,
      el('small.map-desc', { text: (L.settings.map === 'random' ? `Random: this seed rolled "${MAP_STYLES.find((m) => m.id === style)?.name}"` : mapName?.desc) }),
    ]);
    const cycleMap = (d) => {
      const idx = MAP_STYLES.findIndex((m) => m.id === L.settings.map);
      L.settings.map = MAP_STYLES[(idx + d + MAP_STYLES.length) % MAP_STYLES.length].id;
      render();
    };
    const table = el('div.settings-table');
    table.append(el('div.srow', {}, [el('span', { text: 'Players' }), el('b', { text: L.players.length })]));
    for (const def of SETTING_DEFS) {
      const idx = Math.max(0, def.values.findIndex((v) => v[0] === L.settings[def.key]));
      const row = el('div.srow.clickable', { title: 'Click to change' }, [el('span', { text: def.label }), el('b', { text: def.values[idx][1] })]);
      row.addEventListener('click', () => { L.settings[def.key] = def.values[(idx + 1) % def.values.length][0]; render(); });
      table.append(row);
    }
    const humans = L.players.filter((p) => !p.isBot).length;
    const warn = humans > 1 ? el('div.hotseat-note', { text: `${humans} local players: you will pass the keyboard between turns.` }) : null;
    const right = el('div.lobby-right', {}, [mapCard, table, warn,
      el('button.btn.btn-primary.btn-big.wide', { text: 'START GAME', onclick: () => app.startFromLobby() }),
      el('button.btn.wide', { text: 'BACK', onclick: () => app.show('menu') }),
    ]);
    s.append(
      el('div.topbar', {}, [brandEl(app), profileBar(app)]),
      el('div.lobby-body', {}, [
        el('div.lobby-left', {}, [
          el('h2.lobby-title', { text: `${app.profile.name}'s Game` }),
          list, addRow,
          el('div.card.tip-card.lobby-tip', {}, [el('h3', { text: 'FIELD MANUAL' }), el('p', { text: TIPS[Math.floor(Math.random() * TIPS.length)] })]),
        ]),
        right,
      ]),
    );
  };
  render();
  return s;
}

export function drawMiniTank(c, color, scale = 1.1) {
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  drawTankSprite(x, { x: c.width / 2, y: c.height - 3, color, angle: 22, scale });
}

// ---------------------------------------------------------------- Armory
export function armoryScreen(app) {
  const p = app.profile;
  let cat = 'all';
  let selected = 'shot';
  let query = '';
  const s = el('div.screen.armory-screen');
  const render = () => {
    s.innerHTML = '';
    const unlocked = unlockedFamilies(p);
    const fams = FAMILIES.filter((f) => (cat === 'all' || f.cat === cat) && (!query || f.name.toLowerCase().includes(query)));
    fams.sort((a, b) => a.unlock - b.unlock || a.name.localeCompare(b.name));
    const tabs = el('div.tabs', {}, [el('button.tab', { class: `tab${cat === 'all' ? ' active' : ''}`, text: 'ALL', onclick: () => { cat = 'all'; render(); } }),
      ...CATEGORIES.map((c) => el('button.tab', { class: `tab${cat === c.id ? ' active' : ''}`, text: c.name.toUpperCase(), style: { '--tab': c.color }, onclick: () => { cat = c.id; render(); } }))]);
    const search = el('input.search', { type: 'search', placeholder: 'Search weapons…', value: query });
    search.addEventListener('input', () => { query = search.value.toLowerCase(); render(); s.querySelector('.search').focus(); });
    const grid = el('div.agrid');
    fams.forEach((f, i) => {
      const isUnlocked = f.unlock <= p.level;
      const tier = weaponTier(p, f.id);
      const tile = el('button.wtile.atile', { class: `wtile atile${selected === f.id ? ' selected' : ''}${isUnlocked ? '' : ' locked'}`, style: { '--i': Math.min(i, 40) } }, [
        el('img', { src: iconURL(f.icon, isUnlocked ? f.color : '#37474f', 40), alt: '' }),
        el('span.wname', { text: f.name }),
        el('span.wtier', { text: isUnlocked ? roman(tier) : `LVL ${f.unlock}` }),
      ]);
      tile.addEventListener('click', () => { selected = f.id; render(); });
      grid.append(tile);
    });
    const detail = armoryDetail(app, selected, render);
    s.append(
      el('div.topbar', {}, [brandEl(app), profileBar(app)]),
      el('div.armory-body', {}, [
        el('div.armory-left', {}, [
          el('div.armory-head', {}, [el('h2', { text: 'ARMORY' }), el('span.muted', { text: `${unlocked.length} / ${FAMILIES.length} families unlocked · ${TOTAL_WEAPONS} weapons` }), search]),
          tabs, grid,
        ]),
        el('div.armory-right', {}, [detail, el('button.btn.wide', { text: 'BACK', onclick: () => app.show('menu') })]),
      ]),
    );
  };
  render();
  return s;
}

function armoryDetail(app, famId, rerender) {
  const p = app.profile;
  const f = FAMILY_BY_ID[famId];
  const isUnlocked = f.unlock <= p.level;
  const tier = weaponTier(p, famId);
  const w = getWeapon(famId, tier);
  const catName = CATEGORIES.find((c) => c.id === f.cat)?.name;
  const xp = p.weaponXp[famId] || 0;
  const nextXp = nextMasteryXp(p, famId);
  const cost = upgradeCost(p, famId);
  const box = el('div.card.detail', {}, [
    el('div.detail-head', {}, [
      el('img', { src: iconURL(f.icon, isUnlocked ? f.color : '#37474f', 72), alt: '' }),
      el('div', {}, [
        el('h2', { text: w.name }),
        el('div.muted', { text: `${catName} · Tier ${roman(tier)} of ${roman(f.tiers.length)} · ${f.ammo === Infinity ? 'Unlimited' : f.ammo + ' per game'}` }),
      ]),
    ]),
    el('p.desc', { text: f.desc }),
    el('div.detail-stats', {}, [el('small', { text: 'CURRENT TIER' }), el('div', { text: describeSpec(w.spec, w.fire) })]),
  ]);
  if (!isUnlocked) {
    box.append(el('div.locked-note', { text: `Unlocks at level ${f.unlock}` }));
  } else {
    if (nextXp != null) {
      const nw = getWeapon(famId, tier + 1);
      box.append(
        el('div.detail-stats.next', {}, [el('small', { text: `NEXT: ${nw.name} ${roman(tier + 1)}` }), el('div', { text: describeSpec(nw.spec, nw.fire) })]),
        el('div.mastery', {}, [
          el('small', { text: `MASTERY ${fmt(xp)} / ${fmt(nextXp)} damage dealt` }),
          el('div.mbar', {}, [el('div.mfill', { style: { width: `${Math.min(100, (xp / nextXp) * 100)}%` } })]),
        ]),
        el('button.btn.btn-warn.wide', {
          html: `UPGRADE NOW &middot; ${cost} <i class="gear"></i>`,
          disabled: p.gears < cost,
          onclick: () => { if (buyUpgrade(p, famId)) { app.audio.play('levelup'); rerender(); } },
        }),
      );
    } else box.append(el('div.locked-note.max', { text: 'MASTERED — maximum tier' }));
  }
  return box;
}

// ---------------------------------------------------------------- Help / Settings
export function helpScreen(app) {
  const keys = [
    ['← →', 'Aim barrel (hold Shift for fine control)'], ['↑ ↓', 'Power'], ['A / D', 'Drive (uses fuel)'],
    ['Space / Enter', 'Fire (lock in your shot)'], ['Tab / W', 'Weapons list'], ['E', 'Items'], ['Mouse drag', 'Aim from your tank toward the pointer'],
    ['Mouse wheel', 'Fine power'], ['Esc', 'Close panel / leave game'],
  ];
  return el('div.screen.help-screen', {}, [
    el('div.topbar', {}, [brandEl(app), profileBar(app)]),
    el('div.help-body', {}, [
      el('div.card', {}, [el('h3', { text: 'HOW IT WORKS' }), el('ul', {}, [
        'Everyone aims at the same time. When the timer ends or you press FIRE, every shot launches at once.',
        'Terrain is fully destructible. Blow holes, dig tunnels, bury opponents, build walls.',
        'Wind pushes shells sideways. Watch the gauge at the top of the screen each round.',
        'Deal damage to earn XP and level up. Every level unlocks new weapons for your arsenal.',
        'Each weapon you use gains mastery from the damage it deals, climbing from Tier I to Tier IV. Gears can buy an upgrade early.',
        'Supply drops land on the map. Drive into them for extra ammo or repairs.',
        'Last tank (or team) standing wins. After round 30 everyone takes sudden-death damage.',
      ].map((t) => el('li', { text: t })))]),
      el('div.card', {}, [el('h3', { text: 'CONTROLS' }), el('table.keys', {}, keys.map(([k, v]) => el('tr', {}, [el('td', {}, [el('kbd', { text: k })]), el('td', { text: v })])))]),
    ]),
    el('div.help-foot', {}, [el('button.btn.btn-primary', { text: 'BACK', onclick: () => app.show('menu') })]),
  ]);
}

export function settingsScreen(app) {
  const p = app.profile;
  const name = el('input', { type: 'text', value: p.name, maxlength: 14 });
  const sound = el('input', { type: 'checkbox', checked: p.settings.sound });
  const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: p.settings.volume });
  const server = el('input.server-input', { type: 'text', value: p.settings.server || '', placeholder: 'https://your-relay.workers.dev', spellcheck: false });
  const mvol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: p.settings.musicVolume ?? 0.6 });
  const intro = el('input', { type: 'checkbox', checked: p.settings.intro !== false });
  const save = () => {
    p.name = name.value.trim() || 'Commander';
    p.settings.sound = sound.checked; p.settings.volume = +vol.value;
    p.settings.musicVolume = +mvol.value; p.settings.intro = intro.checked;
    p.settings.server = server.value.trim().replace(/\/+$/, '');
    app.applyAudioSettings();
    saveProfile(p);
    if (app.lobby) { const me = app.lobby.players.find((x) => x.isProfile); if (me) me.name = p.name; }
  };
  for (const i of [name, sound, vol, server, mvol, intro]) i.addEventListener('change', save);
  vol.addEventListener('input', () => { p.settings.volume = +vol.value; app.applyAudioSettings(); });
  mvol.addEventListener('input', () => { p.settings.musicVolume = +mvol.value; app.applyAudioSettings(); });
  return el('div.screen.settings-screen', {}, [
    el('div.topbar', {}, [brandEl(app), profileBar(app)]),
    el('div.settings-body', {}, [
      el('div.card', {}, [
        el('h3', { text: 'SETTINGS' }),
        el('label.srow', {}, [el('span', { text: 'Commander name' }), name]),
        el('label.srow', {}, [el('span', { text: 'Sound effects' }), sound]),
        el('label.srow', {}, [el('span', { text: 'Volume' }), vol]),
        el('label.srow', {}, [el('span', { text: 'Music volume' }), mvol]),
        el('label.srow', {}, [el('span', { text: 'Play intro at startup' }), intro]),
        el('label.srow', {}, [el('span', { text: 'Online relay server' }), server]),
        el('div.srow', {}, [el('span', { text: 'Progress' }), el('button.btn.btn-danger.btn-small', { text: 'RESET PROFILE', onclick: () => app.confirm('Erase all progress, levels and unlocks?', () => { app.profile = resetProfile(); app.lobby = null; app.applyAudioSettings(); app.show('settings'); }) })]),
        el('div.srow', {}, [el('span', { text: 'Intro' }), el('button.btn.btn-small', { text: 'REPLAY INTRO', onclick: () => { save(); app.startIntro(); } })]),
        el('p.muted', { text: 'Progress is stored in this browser (localStorage).' }),
      ]),
      el('button.btn.btn-primary', { text: 'BACK', onclick: () => { save(); app.show('menu'); } }),
    ]),
  ]);
}

// ---------------------------------------------------------------- Results
export function resultsScreen(app, results, summary) {
  const me = results.find((r) => r.tank.isProfile);
  const won = !!me?.winner;
  const rows = results.map((r, i) => el('div.rrow', { class: `rrow${r.tank.isProfile ? ' me' : ''}${r.winner ? ' winner' : ''}`, style: { '--i': i } }, [
    el('b.rank', { text: `#${r.rank}` }),
    el('span.rname', { text: r.name + (r.tank.isBot ? '' : r.tank.isProfile ? ' (you)' : ' (local)') }),
    el('span', { text: r.alive ? `${r.hp} HP` : 'destroyed' }),
    el('span', { text: `${r.kills} kills` }),
    el('span', { text: `${fmt(r.damage)} dmg` }),
    el('span.rxp', { text: r.tank.isBot ? '' : `+${fmt(r.xp)} XP` }),
  ]));
  const sumBox = el('div.card.summary');
  if (summary) {
    sumBox.append(el('h3', { text: 'REWARDS' }));
    sumBox.append(el('div.reward-line', { html: `<b>+${fmt(summary.xp)}</b> XP &nbsp; <b>+${summary.gears}</b> <i class="gear"></i>` }));
    if (summary.levelUps.length) {
      sumBox.append(el('div.levelup', { text: `LEVEL UP! You are now level ${summary.levelUps[summary.levelUps.length - 1]}` }));
    }
    if (summary.unlocks.length) {
      sumBox.append(el('small', { text: 'NEW WEAPONS UNLOCKED' }));
      sumBox.append(el('div.unlock-row', {}, summary.unlocks.map((id) => { const f = FAMILY_BY_ID[id]; return el('div.unlock', { title: f.desc }, [el('img', { src: iconURL(f.icon, f.color, 40), alt: '' }), el('span', { text: f.name })]); })));
    }
    if (summary.masteryUps.length) {
      sumBox.append(el('small', { text: 'WEAPON MASTERY' }));
      sumBox.append(el('div.unlock-row', {}, summary.masteryUps.map((m) => { const f = FAMILY_BY_ID[m.id]; return el('div.unlock', {}, [el('img', { src: iconURL(f.icon, f.color, 40), alt: '' }), el('span', { text: `${f.name} → ${roman(m.tier)}` })]); })));
    }
    const need = xpForLevel(app.profile.level);
    sumBox.append(el('div.pb-xp.big', {}, [el('div.pb-xp-fill', { style: { width: `${Math.min(100, (app.profile.xp / need) * 100)}%` } }), el('span', { text: `Level ${app.profile.level} · ${fmt(app.profile.xp)} / ${fmt(need)} XP` })]));
  }
  const confetti = won ? el('div.confetti', {}, Array.from({ length: 70 }, (_, i) => el('i', { style: { left: `${Math.random() * 100}%`, background: ['#ffd740', '#4cff5e', '#4fc3ff', '#ff4b4b', '#e040fb', '#fff'][i % 6], animationDelay: `${Math.random() * 2.5}s`, animationDuration: `${3 + Math.random() * 2.5}s`, transform: `rotate(${Math.random() * 360}deg)` } }))) : null;
  return el('div.screen.results-screen', {}, [
    confetti,
    el('div.results-inner', {}, [
      el('h1', { class: `result-title ${won ? 'win' : 'lose'}`, text: me ? (won ? 'VICTORY' : me.alive ? 'DRAW' : 'DEFEATED') : 'GAME OVER' }),
      el('div.muted.big', { text: results.find((r) => r.winner) ? `${results.filter((r) => r.winner).map((r) => r.name).join(' & ')} ${results.filter((r) => r.winner).length > 1 ? 'win' : 'wins'} the battle` : 'No survivors' }),
      el('div.results-cols', {}, [el('div.card.standings', {}, [el('h3', { text: 'STANDINGS' }), ...rows]), sumBox]),
      app.session
        ? el('div.results-buttons', {}, [
          el('button.btn.btn-primary.btn-big', { text: 'BACK TO ROOM', onclick: () => { if (app.session.isHost) app.session.backToLobby(); app.show('onlineLobby'); } }),
          el('button.btn.btn-big', { text: 'LEAVE', onclick: () => { app.session.leave(); app.session = null; app.show('menu'); } }),
        ])
        : el('div.results-buttons', {}, [
          el('button.btn.btn-primary.btn-big', { text: 'REMATCH', onclick: () => app.rematch() }),
          el('button.btn.btn-big', { text: 'LOBBY', onclick: () => app.show('lobby') }),
          el('button.btn.btn-big', { text: 'MAIN MENU', onclick: () => app.show('menu') }),
        ]),
    ]),
  ]);
}

// ---------------------------------------------------------------- Modals
export function passModal(app, tank, onReady) {
  return el('div.modal-box', {}, [
    el('h2', { text: 'PASS THE CONTROLS' }),
    el('p', { html: `It's <b>${escapeHtml(tank.name)}</b>'s turn to aim. Other players, look away!` }),
    el('button.btn.btn-primary.btn-big', { text: "I'M READY", onclick: onReady }),
  ]);
}

export function confirmModal(text, onYes, onNo) {
  return el('div.modal-box', {}, [
    el('p', { text }),
    el('div.modal-buttons', {}, [
      el('button.btn.btn-danger', { text: 'YES', onclick: onYes }),
      el('button.btn', { text: 'NO', onclick: onNo }),
    ]),
  ]);
}

export function spectateBar(app, online = false) {
  return el('div.spectate-bar', {}, [
    el('span', { text: online ? 'You were destroyed. Spectating until the battle ends…' : 'You were destroyed. Spectating the bots…' }),
    online ? null : el('button.btn.btn-small', { text: 'SKIP TO RESULTS', onclick: () => app.skipToEnd() }),
  ]);
}
