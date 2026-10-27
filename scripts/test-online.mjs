// Two browsers play an online match through the relay. Requires the game server on :8080 and
// the Worker on :8787 (RELAY env overrides). Checks lobby flow, chat, lockstep volleys and that
// both clients end the volley with identical tank state.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const relay = process.env.RELAY || 'http://localhost:8787';
const shots = process.argv.includes('--shots');
const outDir = process.env.SHOT_DIR || '/tmp/utg-shots';
if (shots) fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const fails = [];
const check = (c, m) => { if (!c) { fails.push(m); console.error('FAIL', m); } };

async function makeClient(name) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto('http://localhost:8080/', { waitUntil: 'load' });
  await page.evaluate(({ name, relay, devKey }) => {
    const p = { name, level: 12, xp: 0, gears: 0, weaponXp: {}, weaponTier: {}, stats: {}, settings: { sound: false, volume: 0, server: relay, intro: false, music: false, named: true }, cosmetics: { owned: ['pattern:stripes', 'accessory:crown'], equipped: { pattern: 'stripes', accessory: 'crown', trail: 'none', title: 'none' } } };
    localStorage.setItem('utg.profile.v1', JSON.stringify(p));
    if (name === 'Host' && devKey) { localStorage.setItem('utg.dev', '1'); localStorage.setItem('utg.devkey', devKey); }
  }, { name, relay, devKey: process.env.DEV_KEY || '' });
  await page.reload({ waitUntil: 'load' });
  await page.click('.start-btn');
  await page.waitForSelector('.menu-screen', { timeout: 10000 });
  await page.click('text=PLAY ONLINE');
  await page.waitForTimeout(400);
  return page;
}

const host = await makeClient('Host');
const guest = await makeClient('Guest');
if (shots) await host.screenshot({ path: `${outDir}/30-online-browser.png` });
await host.click('text=CREATE ROOM');
await host.waitForSelector('.online-lobby', { timeout: 10000 });
const code = await host.evaluate(() => window.__app.session.code);
check(/^[A-Z0-9]{5}$/.test(code), `room code ${code}`);
await guest.fill('.code-input', code);
await guest.click('.online-right button:has-text("JOIN")');
await guest.waitForSelector('.online-lobby', { timeout: 10000 });
await host.waitForFunction(() => window.__app.session?.lobby?.players.length === 2);
if (process.env.DEV_KEY) { // developer powers: the host is a verified developer and grants the guest levels and gears
  await host.waitForFunction(() => window.__app.session.isDev && document.querySelectorAll('.pl-dev').length === 2, null, { timeout: 8000 });
  check(await host.evaluate(() => !!document.querySelector('.player-row.me .dev-chip')), 'developer chip on the host row');
  const guestRow = host.locator('.player-row:not(.me)').first();
  await guestRow.locator('.pl-dev button[title="+5 levels"]').click();
  await guestRow.locator('.pl-dev button[title="+100 gears"]').click();
  await guest.waitForFunction(() => window.__app.profile.level === 17 && window.__app.profile.gears === 100, null, { timeout: 8000 });
  await host.waitForFunction(() => window.__app.session.lobby.players.find((p) => p.id !== window.__app.session.myId)?.level === 17, null, { timeout: 8000 });
  const saved = await guest.evaluate(() => JSON.parse(localStorage.getItem('utg.profile.v1')).level);
  check(saved === 17, `grant persisted in the guest profile (level ${saved})`);
  if (shots) await host.screenshot({ path: `${outDir}/31b-online-lobby-dev.png` });
} else console.log('DEV_KEY not set: skipping developer lobby checks');
await host.click('text=+ ADD BOT');
await host.waitForFunction(() => window.__app.session?.lobby?.players.length === 3);
await host.click('.srow.clickable:has-text("Turn Time")'); // 30 -> 45
await host.click('.srow.clickable:has-text("Move Phase")'); // 8 -> 5 s
await host.waitForFunction(() => window.__app.session.lobby.settings.moveTime === 5);
// teams: switch to Team Battle, the guest picks its own team, the host places the guest
await host.click('.srow.clickable:has-text("Mode")'); // -> Team Battle
await guest.waitForFunction(() => window.__app.session.lobby.settings.mode === 'team');
const guestTeam0 = await guest.evaluate(() => window.__app.session.lobby.players.find((p) => p.id === window.__app.session.myId).team);
await guest.click('.player-row.me .pl-team button:last-child');
await host.waitForFunction((t0) => window.__app.session.lobby.players.find((p) => p.id !== window.__app.session.myId && !p.bot).team === (t0 % 4) + 1, guestTeam0, { timeout: 5000 });
await host.click('.player-row:not(.me) .pl-team button:last-child');
await guest.waitForFunction((t0) => window.__app.session.lobby.players.find((p) => p.id === window.__app.session.myId).team === ((t0 + 1) % 4) + 1, guestTeam0, { timeout: 5000 });
check(true, 'teams picked by the player and assigned by the host');
await host.click('.srow.clickable:has-text("Mode")'); // back to Deathmatch
await guest.waitForFunction(() => window.__app.session.lobby.settings.mode === 'deathmatch');
await guest.fill('.chat-input', 'hello from guest');
await guest.press('.chat-input', 'Enter');
await host.waitForFunction(() => window.__app.session.chat.some((c) => c.text === 'hello from guest'));
await guest.click('.player-row.me .pl-ready');
await host.waitForFunction(() => window.__app.session.lobby.players.find((p) => !p.bot && p.id !== window.__app.session.hostId)?.ready);
await host.click('.lobby-right button:has-text("READY")');
await host.waitForFunction(() => window.__app.session?.startDeadline != null, null, { timeout: 10000 });
await host.waitForTimeout(300);
if (shots) await host.screenshot({ path: `${outDir}/31-online-lobby.png` });
// move phase first: the guest drives, the host sees it move, then both reach the aim phase together
await host.waitForFunction(() => window.__app.game && window.__app.game.phase === 'move', null, { timeout: 15000 });
await guest.waitForFunction(() => window.__app.game && window.__app.game.phase === 'move', null, { timeout: 15000 });
const seeds = await Promise.all([host, guest].map((p) => p.evaluate(() => ({ seed: window.__app.game.seed, tanks: window.__app.game.tanks.map((t) => [t.name, t.isBot, Math.round(t.x), t.netId]) }))));
check(seeds[0].seed === seeds[1].seed, 'same seed');
check(JSON.stringify(seeds[0].tanks) === JSON.stringify(seeds[1].tanks), 'same tank setup');
const loadouts = await Promise.all([host, guest].map((p) => p.evaluate(() => window.__app.game.tanks.map((t) => [...t.arsenal.keys()].join(',')))));
check(JSON.stringify(loadouts[0]) === JSON.stringify(loadouts[1]) && loadouts[0].every((l) => l.split(',').length < 40), `random loadouts identical on both clients (${loadouts[0].map((l) => l.split(',').length).join('/')} weapons)`);
const cos = await guest.evaluate(() => window.__app.game.tanks.map((t) => t.cosmetics && t.cosmetics.pattern));
check(cos[0] === 'stripes' && cos[1] === 'stripes', `cosmetics travel with players (${JSON.stringify(cos)})`);
await guest.keyboard.press('KeyE'); await guest.waitForTimeout(150);
check(await guest.evaluate(() => window.__app.hud.overlayMode === 'items' && !document.getElementById('hud').classList.contains('inactive')), 'items overlay opens during the move phase');
await guest.keyboard.press('Escape'); await guest.waitForTimeout(100);
await guest.keyboard.press('KeyW'); await guest.waitForTimeout(150);
check(await guest.evaluate(() => window.__app.hud.overlayMode === 'weapons'), 'weapons overlay opens during the move phase');
await guest.keyboard.press('Escape'); await guest.waitForTimeout(100);
const gx0 = await guest.evaluate(() => Math.round(window.__app.game.me.x));
await guest.keyboard.down('KeyD'); await guest.waitForTimeout(500); await guest.keyboard.up('KeyD');
const gx1 = await guest.evaluate(() => Math.round(window.__app.game.me.x));
check(gx1 > gx0, `guest drove during the move phase (${gx0} -> ${gx1})`);
await host.waitForFunction((x) => Math.abs(window.__app.game.tanks.find((t) => t.netId !== window.__app.session.myId && !t.isBot).x - x) < 12, gx1, { timeout: 5000 });
check(await guest.evaluate(() => { const g = window.__app.game; g.fire(); return g.phase === 'move' && !!g.me.moved; }), 'firing in the move phase only parks the tank');
await guest.keyboard.down('KeyD'); await guest.waitForTimeout(250); await guest.keyboard.up('KeyD');
check(await guest.evaluate((x) => Math.round(window.__app.game.me.x) === x, gx1), 'a parked tank no longer drives');
await host.waitForFunction(() => window.__app.game && window.__app.game.phase === 'aim', null, { timeout: 15000 });
await guest.waitForFunction(() => window.__app.game && window.__app.game.phase === 'aim', null, { timeout: 15000 });
check(await guest.evaluate(() => { const g = window.__app.game; const x = g.me.x; g.moveCurrent(1, 0.2); return g.me.x === x; }), 'no driving once the aim phase starts');
// dev-op replication + crate pickup: the guest spawns a weapon crate on itself, picks it up at once,
// and the host replays both the spawn and the pickup at the volley.
await guest.evaluate(() => { const g = window.__app.game; g.devOp({ type: 'crate', x: Math.round(g.me.x), kind: 'weapon' }); });
await guest.waitForFunction(() => (window.__app.game.me.roundCrates || []).length === 1 && window.__app.game.crates.length === 0, null, { timeout: 5000 });
// both lock
await guest.evaluate(() => { const g = window.__app.game; g.current.angle = 120; g.current.power = 75; const sh = ['shield3', 'shield2', 'shield'].find((k) => g.me.items[k] > 0); g.useItem(sh); g.fire(); });
await host.waitForFunction(() => window.__app.game.lockInfo?.count === 1);
await host.evaluate(() => { const g = window.__app.game; g.current.angle = 60; g.current.power = 80; g.fire(); });
await host.waitForFunction(() => window.__app.game.phase === 'fire', null, { timeout: 10000 });
await guest.waitForFunction(() => window.__app.game.phase === 'fire', null, { timeout: 10000 });
await host.waitForTimeout(700);
if (shots) await host.screenshot({ path: `${outDir}/32-online-volley.png` });
// wait for the volley to finish and next aim to begin on both
await host.waitForFunction(() => window.__app.game.phase === 'move' && window.__app.game.round === 2, null, { timeout: 40000 });
await guest.waitForFunction(() => window.__app.game.phase === 'move' && window.__app.game.round === 2, null, { timeout: 40000 });
const state = await Promise.all([host, guest].map((p) => p.evaluate(() => {
  const g = window.__app.game;
  let solid = 0; const m = g.terrain.mask; for (let i = 0; i < m.length; i += 7) solid += m[i];
  return { wind: g.wind, solid, crates: g.crates.length, crateIds: g.crates.map((c) => c.id), crateSeq: g.crateSeq, tanks: g.tanks.map((t) => [t.name, Math.round(t.hp), Math.round(t.armor), Math.round(t.x), Math.round(t.y), t.alive]), msgs: g.messages.map((x) => x.text) };
})));
console.log('host :', JSON.stringify(state[0].tanks), 'solid', state[0].solid, 'wind', state[0].wind);
console.log('guest:', JSON.stringify(state[1].tanks), 'solid', state[1].solid, 'wind', state[1].wind);
check(state[0].wind === state[1].wind, 'same wind after round');
check(JSON.stringify(state[0].tanks) === JSON.stringify(state[1].tanks), 'identical tank state after volley (lockstep)');
check(state[0].solid === state[1].solid, 'identical terrain after volley');
// crate #1 is the dev crate: it must have been spawned (crateSeq >= 1) and claimed (not lying around) on both sides,
// and any natural crate drops since must match exactly.
check(state[0].crateSeq === state[1].crateSeq && state[0].crateSeq >= 1 && !state[0].crateIds.includes(1) && !state[1].crateIds.includes(1) && JSON.stringify(state[0].crateIds) === JSON.stringify(state[1].crateIds), `dev crate replicated and claimed on both (seq ${state[0].crateSeq}/${state[1].crateSeq}, crates ${JSON.stringify(state[0].crateIds)}/${JSON.stringify(state[1].crateIds)})`);
check(state[0].msgs.length > 0, 'host saw messages');
// in-game chat
await guest.keyboard.press('Enter');
await guest.keyboard.type('gg');
await guest.keyboard.press('Enter');
await host.waitForFunction(() => window.__app.game.messages.some((m) => /Guest: gg/.test(m.text)));
// round 2: wait out the move phase, then lock both (turn time 45s is too long to let the deadline fire)
await host.waitForFunction(() => window.__app.game.phase === 'aim' && window.__app.game.round === 2, null, { timeout: 15000 });
await guest.waitForFunction(() => window.__app.game.phase === 'aim' && window.__app.game.round === 2, null, { timeout: 15000 });
await host.evaluate(() => window.__app.game.fire());
await guest.evaluate(() => window.__app.game.fire());
await host.waitForFunction(() => window.__app.game.round === 3 && window.__app.game.phase === 'aim', null, { timeout: 40000 });
// guest leaves mid-game -> host sees tank go offline/killed next volley
await guest.evaluate(() => window.__app.confirmLeave());
await guest.click('.modal-box button:has-text("YES")');
await host.waitForFunction(() => window.__app.game.tanks.some((t) => t.connected === false), null, { timeout: 10000 });
await host.evaluate(() => window.__app.game.fire());
await host.waitForFunction(() => window.__app.game.phase !== 'aim', null, { timeout: 10000 });
await host.waitForTimeout(300);
if (shots) await host.screenshot({ path: `${outDir}/33-online-left.png` });
const left = await host.evaluate(() => window.__app.game.tanks.filter((t) => t.connected === false).map((t) => [t.name, t.alive]));
check(left.length === 1 && left[0][1] === false, `left player destroyed: ${JSON.stringify(left)}`);
// dev tools gate on the guest (now on menu)
await guest.waitForSelector('.menu-screen');
for (let i = 0; i < 5; i++) await guest.click('.profile-bar .avatar', { force: true, noWaitAfter: true }); // quick taps, no per-click stability waits
await guest.waitForSelector('.modal-box.gate');
await guest.fill('.modal-box.gate input', 'wrong');
await guest.press('.modal-box.gate input', 'Enter');
check(await guest.textContent('.gate-error') === 'Access denied.', 'wrong password denied');
await guest.fill('.modal-box.gate input', 'john_mojang_');
await guest.press('.modal-box.gate input', 'Enter');
await guest.waitForSelector('#devpanel:not(.hidden)');
check(await guest.isVisible('.dev-btn'), 'DEV button appears after unlock');
await guest.click('#devpanel button:has-text("WEAPON TEST RANGE")');
await guest.waitForFunction(() => window.__app.game && window.__app.game.phase === 'aim', null, { timeout: 10000 });
await guest.waitForTimeout(400);
if (shots) await guest.screenshot({ path: `${outDir}/34-devtools.png` });
const dev = await guest.evaluate(() => { const g = window.__app.game; return { dummies: g.tanks.filter((t) => t.dummy).length, inf: window.__app.dev.flags.infAmmo, ammo: g.me.arsenal.size }; });
check(dev.dummies === 3 && dev.inf && dev.ammo > 150, `test range: ${JSON.stringify(dev)}`);
console.log('errors:', errors.length ? errors : 'none');
console.log(fails.length ? `${fails.length} failures` : 'online test: all checks passed');
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
