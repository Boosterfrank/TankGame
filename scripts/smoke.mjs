// Headless smoke test: boots the game in Chromium, plays a few rounds against bots, and
// reports console errors. Usage: node scripts/smoke.mjs [--shots]  (requires playwright + a running server on :8080)
import fs from 'node:fs';
import { createRequire } from 'node:module';
// Resolve playwright from the global tool install if it isn't a local dependency.
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const shots = process.argv.includes('--shots');
const outDir = process.env.SHOT_DIR || '/tmp/utg-shots';
if (shots) fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
try {
await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.waitForTimeout(500);
if (shots) await page.screenshot({ path: `${outDir}/01-title.png` });
await page.click('.start-btn');
await page.waitForTimeout(300);
if (await page.$('.name-modal')) { await page.fill('.name-modal input', 'Tester'); await page.click('.name-modal .btn'); await page.waitForTimeout(300); }
await page.keyboard.press('Escape');
await page.waitForSelector('.menu-screen', { timeout: 10000 });
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: `${outDir}/02-menu.png` });
const attract = await page.evaluate(() => !!window.__app.attract && window.__app.attract.tanks.length);
if (!attract) errors.push('attract battle not running behind the menu');
await page.click('text=CUSTOM GAME');
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: `${outDir}/03-lobby.png` });
await page.click('.lobby-right button:has-text("BACK")');
await page.click('text=ARMORY');
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: `${outDir}/04-armory.png` });
await page.click('.armory-right > button.btn');
await page.click('text=QUICK PLAY');
await page.click('.choice-buttons button:has-text("VS BOTS")');
await page.waitForTimeout(2200);
if (shots) await page.screenshot({ path: `${outDir}/05-game.png` });
// open weapons grid
await page.keyboard.press('Tab');
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: `${outDir}/06-weapons.png` });
await page.keyboard.press('Escape');
// first volley: fire and capture mid-flight
await page.evaluate(() => { const g = window.__app.game; if (g.phase === 'move') g.endMove(); if (g.current) { g.current.angle = 55; g.current.power = 80; g.fire(); } });
await page.waitForTimeout(1100);
if (shots) await page.screenshot({ path: `${outDir}/06b-volley.png` });
await page.waitForTimeout(900);
if (shots) await page.screenshot({ path: `${outDir}/06c-impact.png` });
// play rounds: fire, wait until next aim phase
const stats = await page.evaluate(async () => {
  const app = window.__app;
  const g = app.game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  for (let round = 0; round < 6 && g.phase !== 'over'; round++) {
    // wait for aim (end our move phase right away)
    let guard = 0;
    while (g.phase !== 'aim' && g.phase !== 'over' && guard++ < 400) { if (g.phase === 'move' && !g.waitingPass) g.endMove(); await wait(50); }
    if (g.phase === 'over') break;
    if (g.current) {
      const ids = [...g.current.arsenal.keys()].filter((id) => g.current.ammo(id) > 0);
      g.current.weaponId = ids[Math.floor(Math.random() * ids.length)];
      g.current.angle = 30 + Math.random() * 120; g.current.power = 50 + Math.random() * 50;
      g.fire();
    }
    guard = 0;
    while (g.phase === 'aim' && guard++ < 400) await wait(50);
    guard = 0;
    while (g.phase === 'fire' && guard++ < 1200) await wait(50);
    log.push({ round: g.round, phase: g.phase, projectiles: g.projectiles.length, alive: g.aliveTanks().length, msgs: g.messages.slice(-3).map((m) => m.text) });
  }
  return log;
});
console.log(JSON.stringify(stats, null, 1));
if (shots) await page.screenshot({ path: `${outDir}/07-after-rounds.png` });
// skip to end to exercise results screen
await page.evaluate(() => { const g = window.__app.game; if (g && g.phase !== 'over') { g.skipToEnd(); } });
await page.waitForTimeout(1500);
if (shots) await page.screenshot({ path: `${outDir}/08-results.png` });
} catch (e) { errors.push('script: ' + e.message); if (shots) await page.screenshot({ path: `${outDir}/99-fail.png` }); }
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
