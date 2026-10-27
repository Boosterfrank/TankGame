// Fires every weapon family once in a headless game and reports exceptions, stuck volleys,
// and families that never affect the world. Requires the server on :8080.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.click('.start-btn');
await page.waitForTimeout(300);
if (await page.$('.name-modal')) { await page.fill('.name-modal input', 'Tester'); await page.click('.name-modal .btn'); await page.waitForTimeout(300); }
await page.keyboard.press('Escape');
await page.waitForSelector('.menu-screen', { timeout: 10000 });
await page.waitForTimeout(200);

const report = await page.evaluate(async () => {
  const { FAMILIES } = await import('/src/weapons.js');
  const Game = window.__Game;
  const app = window.__app;
  const out = [];
  for (const fam of FAMILIES) {
    for (const tier of [1, fam.tiers.length]) {
      const r = { id: fam.id, tier, ok: true };
      try {
        const g = new Game({
          settings: { arsenal: 'all', turnTime: 0, moveTime: 0, items: false, crates: false, wind: 'none', map: 'hills', difficulty: 'Normal' },
          players: [{ name: 'Me', isBot: false, team: 1, isProfile: true }, { name: 'Bot', isBot: true, team: 2, level: 1 }, { name: 'Bot2', isBot: true, team: 3, level: 1 }],
          seed: 1234, audio: app.audio,
        });
        g.headless = true;
        g.update(1.3); // intro -> aim
        const me = g.tanks[0];
        me.tiers[fam.id] = tier;
        me.weaponId = fam.id;
        const enemy = g.tanks[1];
        me.angle = enemy.x > me.x ? 50 : 130; me.power = 72;
        g.botsToPlan = [];
        for (const b of g.tanks.slice(1)) { b.shot = { weaponId: 'shot', angle: 90, power: 5 }; b.locked = true; }
        const hpBefore = g.tanks.map((t) => t.hp + t.armor);
        const solidBefore = g.terrain.mask.reduce((a, b) => a + b, 0);
        g.fire();
        let steps = 0, maxProj = 0;
        while (g.phase === 'fire' && steps++ < 2400) { g.update(1 / 60); maxProj = Math.max(maxProj, g.projectiles.length); }
        r.steps = steps; r.maxProj = maxProj; r.phase = g.phase;
        r.terrainDelta = g.terrain.mask.reduce((a, b) => a + b, 0) - solidBefore;
        r.hpDelta = g.tanks.map((t, i) => Math.round(t.hp + t.armor - hpBefore[i]));
        r.stuck = g.phase === 'fire';
        r.noEffect = r.terrainDelta === 0 && r.hpDelta.every((d) => d === 0) && !fam.tiers[0].spec.teleport;
      } catch (e) { r.ok = false; r.error = String(e && e.stack || e); }
      out.push(r);
    }
  }
  return out;
});
const bad = report.filter((r) => !r.ok || r.stuck);
const noEffect = report.filter((r) => r.ok && r.noEffect);
console.log(`tested ${report.length} weapon/tier combos`);
console.log('exceptions/stuck:', bad.length ? bad : 'none');
console.log('no observable effect:', noEffect.map((r) => `${r.id}@${r.tier}`));
console.log('slowest volleys:', report.sort((a, b) => b.steps - a.steps).slice(0, 8).map((r) => `${r.id}@${r.tier}:${r.steps}`).join(' '));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(bad.length || errors.length ? 1 : 0);
