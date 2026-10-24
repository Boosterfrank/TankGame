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
  await page.evaluate(({ name, relay }) => {
    const p = { name, level: 12, xp: 0, gears: 0, weaponXp: {}, weaponTier: {}, stats: {}, settings: { sound: false, volume: 0, server: relay } };
    localStorage.setItem('utg.profile.v1', JSON.stringify(p));
  }, { name, relay });
  await page.reload({ waitUntil: 'load' });
  await page.click('.start-btn');
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
await host.click('text=+ ADD BOT');
await host.waitForFunction(() => window.__app.session?.lobby?.players.length === 3);
await host.click('.srow.clickable:has-text("Turn Time")'); // 30 -> 45
await guest.fill('.chat-input', 'hello from guest');
await guest.press('.chat-input', 'Enter');
await host.waitForFunction(() => window.__app.session.chat.some((c) => c.text === 'hello from guest'));
await guest.click('.player-row.me .pl-ready');
await host.waitForFunction(() => window.__app.session.lobby.players.find((p) => !p.bot && p.id !== window.__app.session.hostId)?.ready);
await host.waitForTimeout(300);
if (shots) await host.screenshot({ path: `${outDir}/31-online-lobby.png` });
await host.click('text=START GAME');
await host.waitForFunction(() => window.__app.game && window.__app.game.phase === 'aim', null, { timeout: 15000 });
await guest.waitForFunction(() => window.__app.game && window.__app.game.phase === 'aim', null, { timeout: 15000 });
const seeds = await Promise.all([host, guest].map((p) => p.evaluate(() => ({ seed: window.__app.game.seed, tanks: window.__app.game.tanks.map((t) => [t.name, t.isBot, Math.round(t.x), t.netId]) }))));
check(seeds[0].seed === seeds[1].seed, 'same seed');
check(JSON.stringify(seeds[0].tanks) === JSON.stringify(seeds[1].tanks), 'same tank setup');
// guest moves, both lock
await guest.keyboard.down('KeyD'); await guest.waitForTimeout(400); await guest.keyboard.up('KeyD');
await guest.evaluate(() => { const g = window.__app.game; g.current.angle = 120; g.current.power = 75; g.useItem('shield'); g.fire(); });
await host.waitForFunction(() => window.__app.game.lockInfo?.count === 1);
await host.evaluate(() => { const g = window.__app.game; g.current.angle = 60; g.current.power = 80; g.fire(); });
await host.waitForFunction(() => window.__app.game.phase === 'fire', null, { timeout: 10000 });
await guest.waitForFunction(() => window.__app.game.phase === 'fire', null, { timeout: 10000 });
await host.waitForTimeout(700);
if (shots) await host.screenshot({ path: `${outDir}/32-online-volley.png` });
// wait for the volley to finish and next aim to begin on both
await host.waitForFunction(() => window.__app.game.phase === 'aim' && window.__app.game.round === 2, null, { timeout: 40000 });
await guest.waitForFunction(() => window.__app.game.phase === 'aim' && window.__app.game.round === 2, null, { timeout: 40000 });
const state = await Promise.all([host, guest].map((p) => p.evaluate(() => {
  const g = window.__app.game;
  let solid = 0; const m = g.terrain.mask; for (let i = 0; i < m.length; i += 7) solid += m[i];
  return { wind: g.wind, solid, tanks: g.tanks.map((t) => [t.name, Math.round(t.hp), Math.round(t.armor), Math.round(t.x), Math.round(t.y), t.alive]), msgs: g.messages.map((x) => x.text) };
})));
console.log('host :', JSON.stringify(state[0].tanks), 'solid', state[0].solid, 'wind', state[0].wind);
console.log('guest:', JSON.stringify(state[1].tanks), 'solid', state[1].solid, 'wind', state[1].wind);
check(state[0].wind === state[1].wind, 'same wind after round');
check(JSON.stringify(state[0].tanks) === JSON.stringify(state[1].tanks), 'identical tank state after volley (lockstep)');
check(state[0].solid === state[1].solid, 'identical terrain after volley');
check(state[0].msgs.length > 0, 'host saw messages');
// in-game chat
await guest.keyboard.press('Enter');
await guest.keyboard.type('gg');
await guest.keyboard.press('Enter');
await host.waitForFunction(() => window.__app.game.messages.some((m) => /Guest: gg/.test(m.text)));
// round 2: let the deadline fire the volley with only the host locked (guest idle) - turn time 45s is too long, so lock both
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
for (let i = 0; i < 5; i++) await guest.click('.brand-logo');
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
