// Exercises hot-seat (2 humans), team mode, item use, and measures bot planning time.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const shots = process.argv.includes('--shots');
const outDir = process.env.SHOT_DIR || '/tmp/utg-shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.click('.start-btn');
await page.click('text=HOW TO PLAY'); await page.waitForTimeout(200);
if (shots) await page.screenshot({ path: `${outDir}/10-help.png` });
await page.click('.help-foot button');
await page.click('text=SETTINGS'); await page.waitForTimeout(200);
if (shots) await page.screenshot({ path: `${outDir}/11-settings.png` });
await page.click('.settings-body > button');
await page.click('text=CUSTOM GAME'); await page.waitForTimeout(200);
await page.click('text=+ ADD LOCAL PLAYER');
await page.click('.srow.clickable:has-text("Mode")');   // -> Team Battle
await page.click('.srow.clickable:has-text("Weapons")'); // -> Everything
await page.waitForTimeout(200);
if (shots) await page.screenshot({ path: `${outDir}/12-lobby-team.png` });
await page.click('text=START GAME');
await page.waitForTimeout(1600);
// pass modal should be up for player 1
const passVisible = await page.isVisible('.modal-box');
if (shots) await page.screenshot({ path: `${outDir}/13-pass.png` });
await page.click(".modal-box button");
await page.waitForTimeout(200);
// open items overlay and use shield
await page.keyboard.press('KeyE'); await page.waitForTimeout(200);
if (shots) await page.screenshot({ path: `${outDir}/14-items.png` });
await page.click('.itile:has-text("Shield")');
await page.keyboard.press('Tab'); await page.waitForTimeout(200);
if (shots) await page.screenshot({ path: `${outDir}/15-weapons-all.png` });
await page.keyboard.press('Escape');
// mouse aim: drag on canvas
const box = await page.locator('#game').boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.2); await page.mouse.up();
const aim = await page.evaluate(() => { const t = window.__app.game.current; return { angle: Math.round(t.angle), power: Math.round(t.power), armor: t.armor }; });
const res = await page.evaluate(async () => {
  const g = window.__app.game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = { humans: g.humans, mode: g.settings.mode, teams: [...new Set(g.tanks.map((t) => t.team))].length };
  // measure planning
  const bot = g.tanks.find((t) => t.isBot);
  const { planBotShot } = await import('/src/ai.js');
  const t0 = performance.now(); for (let i = 0; i < 5; i++) planBotShot(g, bot); log.planMs = Math.round((performance.now() - t0) / 5);
  // player 1 fires -> expect pass to player 2
  g.fire();
  await wait(100);
  log.afterFire = { phase: g.phase, waitingPass: g.waitingPass, current: g.current?.name };
  g.confirmPass();
  g.fire();
  await wait(100);
  log.afterSecondFire = { phase: g.phase };
  let guard = 0; while (g.phase === 'fire' && guard++ < 600) await wait(50);
  log.afterVolley = { phase: g.phase, round: g.round, msgs: g.messages.map((m) => m.text) };
  return log;
});
console.log(JSON.stringify({ passVisible, aim, ...res }, null, 1));
await page.evaluate(() => { const g = window.__app.game; if (g.waitingPass) g.confirmPass(); g.skipToEnd(); });
await page.waitForTimeout(1500);
if (shots) await page.screenshot({ path: `${outDir}/16-results-team.png` });
const final = await page.evaluate(() => ({ screen: window.__app.screenName, msgs: window.__app.game?.messages.map((m) => m.text) }));
console.log(JSON.stringify(final));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
