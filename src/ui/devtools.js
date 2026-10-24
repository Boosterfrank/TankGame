// Developer tools: hidden behind a password gate (SHA-256 compared, never stored in plaintext).
// Open the gate by clicking the profile avatar in the top bar five times quickly; once unlocked,
// the ` key or the DEV button toggles the panel.
import { el, sha256, clamp, fmt } from '../util.js';
import { FAMILIES, ALL_FAMILIES, FAMILY_BY_ID, getWeapon } from '../weapons.js';
import { saveProfile, resetProfile, MAX_LEVEL } from '../profile.js';
import { MAP_STYLES } from '../terrain-gen.js';
import { DEFAULT_SETTINGS, BOT_NAMES, WORLD_W, PHYS } from '../config.js';

const GATE_HASH = 'd1058ab19b2ff61646e7f6f08aecef7337b7da90c6d3f8e18a93d2b35f62735d';
const KEY = 'utg.dev';

export class DevTools {
  constructor(app) {
    this.app = app;
    this.flags = { god: false, infAmmo: false, infFuel: false, noTimer: false, debug: false, revealAims: false, hitboxes: false, timeScale: 1 };
    this.unlocked = false;
    try { this.unlocked = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }
    this.panel = document.getElementById('devpanel');
    this.open = false;
    this.clicks = [];
    this.fps = 0; this.frames = 0; this.fpsT = 0; this.statT = 0;
    this.log = [];
  }

  logoClick() { this.secretClick(); }

  // Five quick clicks on the profile avatar open the gate.
  secretClick() {
    const now = performance.now();
    this.clicks = this.clicks.filter((t) => now - t < 2500);
    this.clicks.push(now);
    if (this.clicks.length >= 5) {
      this.clicks = [];
      if (this.unlocked) this.toggle(true); else this.gate();
    }
  }

  gate() {
    const app = this.app;
    const input = el('input', { type: 'password', placeholder: 'Password', autocomplete: 'off' });
    const err = el('div.gate-error');
    const tryIt = () => {
      if (sha256(input.value) === GATE_HASH) { app.closeModal(); this.unlock(); }
      else { err.textContent = 'Access denied.'; input.value = ''; input.focus(); this.panelShake(err); }
    };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') tryIt(); if (e.key === 'Escape') app.closeModal(); });
    app.modal.innerHTML = '';
    app.modal.classList.remove('hidden');
    app.modal.append(el('div.modal-box.gate', {}, [
      el('h2', { text: 'RESTRICTED' }),
      el('p', { text: 'Developer tools are locked.' }),
      input, err,
      el('div.modal-buttons', {}, [el('button.btn.btn-primary', { text: 'UNLOCK', onclick: tryIt }), el('button.btn', { text: 'CANCEL', onclick: () => app.closeModal() })]),
    ]));
    input.focus();
  }

  panelShake(node) { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }

  unlock() {
    this.unlocked = true;
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    this.app.audio.play('levelup');
    this.app.toast('Developer tools unlocked', '#ea80fc');
    if (this.app.screenName) this.app.show(this.app.screenName);
    this.toggle(true);
  }

  lock() {
    this.unlocked = false; this.open = false;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    Object.assign(this.flags, { god: false, infAmmo: false, infFuel: false, noTimer: false, debug: false, revealAims: false, hitboxes: false, timeScale: 1 });
    this.panel.classList.add('hidden');
    this.panel.innerHTML = '';
    if (this.app.screenName) this.app.show(this.app.screenName);
    this.app.toast('Developer tools locked');
  }

  toggle(force) {
    if (!this.unlocked) return;
    this.open = force ?? !this.open;
    this.panel.classList.toggle('hidden', !this.open);
    if (this.open) this.render();
  }

  onScreen() { if (this.open) this.render(); }

  note(text) { this.log.unshift(`${new Date().toLocaleTimeString()} ${text}`); this.log = this.log.slice(0, 8); }

  update(game, dt) {
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    if (this.flags.infFuel && game?.me) game.me.fuel = PHYS.maxFuel;
    if (game?.me && game.me.god !== !!this.flags.god) game.me.god = !!this.flags.god;
    if (!this.open) return;
    this.statT += dt;
    if (this.statT > 0.25) { this.statT = 0; this.refreshStats(game); }
  }

  refreshStats(game) {
    const st = this.panel.querySelector('.dev-stats');
    if (!st) return;
    const lines = [`FPS ${this.fps}`];
    if (game) {
      lines.push(`phase ${game.phase} · round ${game.round} · t ${game.time.toFixed(1)}s`);
      lines.push(`projectiles ${game.projectiles.length} · queued ${game.spawnQueue.length} · particles ${game.fx.parts.length}`);
      lines.push(`tanks alive ${game.aliveTanks().length}/${game.tanks.length} · wind ${game.wind} · crates ${game.crates.length}`);
      if (game.online) lines.push(`online room ${game.online.code} · ${game.online.isHost ? 'host' : 'guest'} · ping ${game.online.latency ?? '?'}ms · locks ${game.lockInfo ? `${game.lockInfo.count}/${game.lockInfo.needed}` : '-'}`);
      const me = game.me;
      if (me) lines.push(`me x${Math.round(me.x)} y${Math.round(me.y)} hp${Math.round(me.hp)} armor${Math.round(me.armor)} fuel${Math.round(me.fuel)} angle${Math.round(me.angle)} power${Math.round(me.power)}`);
    } else lines.push(`screen ${this.app.screenName}`);
    st.textContent = lines.join('\n');
  }

  render() {
    const app = this.app, p = app.profile, g = app.game;
    const panel = this.panel;
    panel.innerHTML = '';
    const section = (title, children) => el('div.dev-section', {}, [el('h4', { text: title }), ...children]);
    const toggle = (key, label) => {
      const cb = el('input', { type: 'checkbox', checked: this.flags[key] });
      cb.addEventListener('change', () => { this.flags[key] = cb.checked; this.note(`${label}: ${cb.checked ? 'on' : 'off'}`); });
      return el('label.dev-toggle', {}, [cb, el('span', { text: label })]);
    };
    const btn = (label, fn, cls = '') => el('button.mini', { class: `mini ${cls}`, text: label, onclick: () => { fn(); this.render(); } });
    const num = (value, min, max, step = 1) => el('input.dev-num', { type: 'number', value, min, max, step });

    panel.append(el('div.dev-head', {}, [
      el('b', { text: 'DEVELOPER TOOLS' }),
      el('span.muted', { text: '` to toggle' }),
      el('button.mini', { text: 'LOCK', onclick: () => this.lock() }),
      el('button.mini', { text: '✕', onclick: () => this.toggle(false) }),
    ]));
    panel.append(el('pre.dev-stats', { text: '…' }));

    // profile cheats
    const lvl = num(p.level, 1, MAX_LEVEL);
    panel.append(section('PROFILE', [
      el('div.dev-row', {}, [el('span', { text: 'Level' }), lvl, btn('SET', () => { p.level = clamp(+lvl.value || 1, 1, MAX_LEVEL); p.xp = 0; saveProfile(p); this.note(`level set to ${p.level}`); app.show(app.screenName); })]),
      el('div.dev-row', {}, [
        btn('+1000 XP', () => { p.xp += 1000; saveProfile(p); }),
        btn('+500 GEARS', () => { p.gears += 500; saveProfile(p); app.show(app.screenName); }),
        btn('UNLOCK ALL', () => { p.level = 50; saveProfile(p); app.show(app.screenName); }),
        btn('MAX MASTERY', () => { for (const f of FAMILIES) p.weaponTier[f.id] = f.tiers.length; saveProfile(p); app.show(app.screenName); }),
        btn('RESET', () => { app.profile = resetProfile(); app.lobby = null; app.show('menu'); }, 'danger'),
      ]),
    ]));

    // game cheats
    const gameControls = [
      el('div.dev-grid', {}, [toggle('god', 'God mode'), toggle('infAmmo', 'Infinite ammo'), toggle('infFuel', 'Infinite fuel'), g?.online ? null : toggle('noTimer', 'Freeze turn timer'), toggle('debug', 'Debug overlay'), toggle('hitboxes', 'Hitboxes'), toggle('revealAims', 'Reveal bot aims')]),
    ];
    const ts = el('input', { type: 'range', min: 0.1, max: 4, step: 0.1, value: this.flags.timeScale });
    const tsLabel = el('span', { text: `${this.flags.timeScale.toFixed(1)}x` });
    ts.addEventListener('input', () => { this.flags.timeScale = +ts.value; tsLabel.textContent = `${this.flags.timeScale.toFixed(1)}x`; });
    gameControls.push(el('div.dev-row', {}, [el('span', { text: 'Time scale' }), ts, tsLabel, btn('1x', () => { this.flags.timeScale = 1; })]));
    if (g) {
      const me = g.me;
      const windIn = num(g.wind, -12, 12, 0.5);
      const online = !!g.online;
      const wepSel = el('select.dev-select', {}, ALL_FAMILIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map((f) => el('option', { value: f.id, text: f.dev ? `${f.name} (dev)` : f.name })));
      const mapSel = el('select.dev-select', {}, MAP_STYLES.map((m) => el('option', { value: m.id, text: m.name, selected: m.id === g.terrain.styleId })));
      gameControls.push(
        el('div.dev-row', {}, [
          btn('HEAL ME', () => g.devOp({ type: 'heal' })),
          btn('KILL ENEMIES', () => g.devOp({ type: 'kill' })),
          btn('WIN NOW', () => { g.devOp({ type: 'kill' }); if (!online && g.phase === 'aim') { g.projectiles.length = 0; g.finish(); } }),
          online ? null : btn('END VOLLEY', () => { if (g.phase === 'fire') { g.projectiles.length = 0; g.spawnQueue.length = 0; g.skyLasers.length = 0; } }),
          online ? null : btn('SKIP TURN', () => { if (g.phase === 'aim') { for (const t of g.tanks) if (!t.isBot && t.alive && !t.locked) { t.shot = null; t.locked = true; } g.current = null; g.waitingPass = false; g.planNextBot(true); g.beginFire(); } }),
        ]),
        el('div.dev-row', {}, [el('span', { text: 'Wind' }), windIn, btn('SET', () => g.devOp({ type: 'wind', v: clamp(+windIn.value || 0, -12, 12) }))]),
        el('div.dev-row', {}, [wepSel, btn('+5 AMMO', () => { if (me) { me.addAmmo(wepSel.value, 5); if (!me.tiers[wepSel.value]) me.tiers[wepSel.value] = 1; me.weaponId = wepSel.value; } }), btn('ALL +1', () => { if (me) for (const f of FAMILIES) { if (!me.tiers[f.id]) me.tiers[f.id] = 1; me.addAmmo(f.id, 1); } }), btn('H-BOMB', () => { if (me) { me.addAmmo('hbomb', 1); me.tiers.hbomb = 1; me.weaponId = 'hbomb'; } }, 'danger')]),
        el('div.dev-row', {}, [btn('CRATE HERE', () => { if (me) g.devOp({ type: 'crate', x: clamp(Math.round(me.x + 80 * me.facing), 60, WORLD_W - 60), kind: 'weapon' }); }), btn('REPAIR CRATE', () => { if (me) g.devOp({ type: 'crate', x: clamp(Math.round(me.x - 80 * me.facing), 60, WORLD_W - 60), kind: 'health' }); }), btn('ALL ITEMS', () => { if (me) for (const k of Object.keys(me.items)) me.items[k] = 3; })]),
        el('div.dev-row', {}, [mapSel, btn('REGEN TERRAIN', () => { g.devOp({ type: 'terrain', style: mapSel.value, seed: Math.floor(Math.random() * 1e9) }); this.note('terrain regenerated'); })]),
      );
      gameControls.push(el('div.muted', { text: online ? 'Online: heal, kills, crates, wind, terrain and god mode are sent to everyone with your next lock-in. Ammo and items stay local (shots carry the weapon).' : 'Offline sandbox: everything applies instantly.' }));
    } else {
      gameControls.push(el('div.dev-row', {}, [btn('WEAPON TEST RANGE', () => this.testRange()), btn('BOT BATTLE (SPECTATE)', () => this.botBattle())]));
    }
    panel.append(section('GAME', gameControls));
    panel.append(section('LOG', [el('pre.dev-log', { text: this.log.join('\n') || '—' })]));
    this.refreshStats(g);
  }

  // All weapons, unlimited turn time, three stationary target bots.
  testRange() {
    const app = this.app;
    app.startGame({
      settings: { ...DEFAULT_SETTINGS, arsenal: 'all', dummies: true, turnTime: 0, wind: 'none', crates: false, map: 'flats', hp: 300 },
      players: [{ name: app.profile.name, isBot: false, team: 1, isProfile: true }, ...[0, 1, 2].map((i) => ({ name: `Target ${i + 1}`, isBot: true, team: 2 + i, level: 1 }))],
      seed: Math.floor(Math.random() * 1e9),
    });
    this.flags.infAmmo = true;
    this.note('weapon test range started');
    this.render();
  }

  botBattle() {
    const app = this.app;
    const names = BOT_NAMES.slice(0, 8);
    app.startGame({
      settings: { ...DEFAULT_SETTINGS, arsenal: 'all', difficulty: 'Hard', turnTime: 15 },
      players: names.map((n, i) => ({ name: n, isBot: true, team: 100 + i, level: 50 })),
      seed: Math.floor(Math.random() * 1e9),
    });
    this.note('bot battle started');
    this.render();
  }
}
