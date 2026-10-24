// Application controller: screens, game lifecycle, input and the render loop.
import { DESIGN_W, DESIGN_H, WORLD_W, WORLD_H, PHYS, BOT_NAMES } from './config.js';
import { clamp, el, RNG, deg } from './util.js';
import { Renderer } from './render.js';
import { GameAudio } from './audio.js';
import { Game } from './game.js';
import { HUD } from './ui/hud.js';
import { loadProfile, saveProfile, unlockedIds, allTiers, applyGameResults } from './profile.js';
import { MAP_STYLES } from './terrain-gen.js';
import * as S from './ui/screens.js';

export class App {
  constructor() {
    this.stage = document.getElementById('stage');
    this.canvas = document.getElementById('game');
    this.screens = document.getElementById('screens');
    this.modal = document.getElementById('modal');
    this.toasts = document.getElementById('toasts');
    this.renderer = new Renderer(this.canvas);
    this.audio = new GameAudio();
    this.profile = loadProfile();
    this.hud = new HUD(this);
    this.game = null;
    this.lobby = null;
    this.screenName = null;
    this.input = { keys: new Set(), drag: null, moveBtn: 0 };
    this.timeScale = 1;
    this.lastTs = 0;
    this.time = 0;
    this.spectateEl = null;
    this.lastGameConfig = null;
  }

  init() {
    this.fit();
    window.addEventListener('resize', () => this.fit());
    this.bindInput();
    this.applyAudioSettings();
    this.show('title');
    requestAnimationFrame((ts) => this.loop(ts));
    window.__app = this;
    window.__Game = Game;
  }

  fit() {
    const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    this.scale = s;
    this.stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    this.renderer.resize(s, window.devicePixelRatio || 1);
  }

  applyAudioSettings() {
    this.audio.setMuted(!this.profile.settings.sound);
    this.audio.setVolume(this.profile.settings.volume);
  }

  // ------------------------------------------------------------ screens
  show(name, ...args) {
    this.screens.innerHTML = '';
    this.modal.classList.add('hidden'); this.modal.innerHTML = '';
    this.screenName = name;
    let node = null;
    switch (name) {
      case 'title': node = S.titleScreen(this); break;
      case 'menu': node = S.menuScreen(this); break;
      case 'lobby': node = S.lobbyScreen(this); break;
      case 'armory': node = S.armoryScreen(this); break;
      case 'help': node = S.helpScreen(this); break;
      case 'settings': node = S.settingsScreen(this); break;
      case 'results': node = S.resultsScreen(this, ...args); break;
      case null: break;
    }
    if (node) this.screens.append(node);
    if (name && name !== 'results' && this.game) { this.game = null; this.hud.hide(); this.removeSpectate(); }
    if (name) this.audio.play('click');
  }

  toast(text, color = '#ffd740') {
    const t = el('div.toast', { text, style: { borderColor: color } });
    this.toasts.append(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
  }

  confirm(text, onYes) {
    this.modal.innerHTML = '';
    this.modal.classList.remove('hidden');
    this.modal.append(S.confirmModal(text, () => { this.closeModal(); onYes(); }, () => this.closeModal()));
  }

  closeModal() { this.modal.classList.add('hidden'); this.modal.innerHTML = ''; }

  // ------------------------------------------------------------ game lifecycle
  quickPlay() {
    const rng = new RNG(Date.now());
    const names = rng.shuffle(BOT_NAMES);
    const p = this.profile;
    const config = {
      settings: { mode: 'deathmatch', map: 'random', difficulty: p.level < 5 ? 'Easy' : 'Normal' },
      players: [
        { name: p.name, isBot: false, team: 1, isProfile: true },
        ...[0, 1, 2, 3, 4].map((i) => ({ name: names[i], isBot: true, team: 2 + i, level: Math.max(1, p.level + rng.int(-2, 5)) })),
      ],
      seed: rng.int(1, 1e9),
    };
    this.startGame(config);
  }

  startFromLobby() {
    const L = this.lobby;
    this.startGame({ settings: { ...L.settings }, players: L.players.map((p) => ({ ...p })), seed: L.seed });
  }

  rematch() {
    if (!this.lastGameConfig) return this.show('menu');
    const c = this.lastGameConfig;
    this.startGame({ ...c, seed: Math.floor(Math.random() * 1e9) });
    if (this.lobby) this.lobby.seed = this.game.seed;
  }

  startGame(config) {
    this.lastGameConfig = config;
    const ids = unlockedIds(this.profile), tiers = allTiers(this.profile);
    const players = config.players.map((p) => p.isBot ? p : { ...p, unlockedIds: ids, tiers });
    this.show(null);
    this.audio.init();
    this.game = new Game({ settings: config.settings, players, seed: config.seed, audio: this.audio });
    const g = this.game;
    g.on.pass = (tank) => this.showPass(tank);
    g.on.gameOver = (results) => this.endGame(results);
    g.on.crate = (tank, text) => { if (!tank.isBot) this.toast(text); };
    g.on.phase = (phase) => {
      if (phase === 'aim') this.renderer.showBanner(`ROUND ${g.round}`, g.round === 1 ? MAP_STYLES.find((m) => m.id === g.terrain.styleId)?.name || '' : '', '#fff', 1.6);
      if (phase === 'fire') this.renderer.showBanner('FIRE!', '', '#ff7043', 0.9);
      if (phase === 'over') {
        const me = g.tanks.find((t) => t.isProfile);
        const won = me && g.winners?.includes(me);
        this.audio.play(won ? 'win' : 'lose');
        this.renderer.showBanner(won ? 'VICTORY' : me?.alive ? 'DRAW' : 'DEFEATED', g.winners?.length ? `${g.winners.map((w) => w.name).join(' & ')} wins` : '', won ? '#4cff5e' : '#ff4b4b', 2.2);
      }
    };
    this.hud.show();
    this.timeScale = 1;
    this.removeSpectate();
    this.renderer.showBanner(MAP_STYLES.find((m) => m.id === g.terrain.styleId)?.name || 'BATTLE', 'Get ready', '#4fc3ff', 1.5);
  }

  showPass(tank) {
    this.modal.innerHTML = '';
    this.modal.classList.remove('hidden');
    this.modal.append(S.passModal(this, tank, () => { this.closeModal(); this.game?.confirmPass(); }));
  }

  endGame(results) {
    const g = this.game;
    if (!g) return;
    const me = results.find((r) => r.tank.isProfile);
    let summary = null;
    if (me) {
      summary = applyGameResults(this.profile, {
        xp: me.xp, kills: me.kills, damage: me.damage, shots: me.tank.stats.shots, won: !!me.winner, mastery: me.tank.mastery || {},
      });
      if (summary.levelUps.length) this.audio.play('levelup');
    }
    this.hud.hide();
    this.removeSpectate();
    this.timeScale = 1;
    this.renderer.banner = null;
    this.show('results', results, summary);
  }

  confirmLeave() {
    if (!this.game) return;
    this.confirm('Leave the battle? Progress from this game will be lost.', () => this.show('menu'));
  }

  fire() { this.game?.fire(); }

  skipToEnd() {
    if (!this.game) return;
    this.removeSpectate();
    this.game.skipToEnd();
  }

  removeSpectate() { if (this.spectateEl) { this.spectateEl.remove(); this.spectateEl = null; } }

  // ------------------------------------------------------------ input
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const g = this.game;
      this.input.keys.add(e.code);
      if (!g) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space' || e.code === 'Enter') { if (this.hud.overlayMode) this.hud.closeOverlay(); else this.fire(); }
      else if (e.code === 'Tab' || e.code === 'KeyW') { this.hud.toggleOverlay('weapons'); }
      else if (e.code === 'KeyE') { this.hud.toggleOverlay('items'); }
      else if (e.code === 'KeyQ') { g.cycleWeapon(-1); }
      else if (e.code === 'Escape') { if (this.hud.overlayMode) this.hud.closeOverlay(); else if (!this.modal.classList.contains('hidden')) this.closeModal(); else this.confirmLeave(); }
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    window.addEventListener('blur', () => this.input.keys.clear());

    const toWorld = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * WORLD_W, y: ((e.clientY - r.top) / r.height) * WORLD_H };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      const g = this.game;
      if (!g || g.phase !== 'aim' || !g.current || g.current.locked || g.waitingPass) return;
      this.canvas.setPointerCapture(e.pointerId);
      this.input.drag = e.pointerId;
      this.aimAt(toWorld(e));
    });
    this.canvas.addEventListener('pointermove', (e) => { if (this.input.drag === e.pointerId) this.aimAt(toWorld(e)); });
    const end = (e) => { if (this.input.drag === e.pointerId) this.input.drag = null; };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => {
      const g = this.game;
      if (!g || !g.current) return;
      e.preventDefault();
      g.adjustPower(e.deltaY < 0 ? 2 : -2);
    }, { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  aimAt(pt) {
    const g = this.game;
    const t = g?.current;
    if (!t) return;
    const p = t.pivot();
    const dx = pt.x - p.x, dy = p.y - pt.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) return;
    const angle = clamp(deg(Math.atan2(dy, dx)), 0, 180);
    const power = clamp((d - 30) / 3.6, 5, 100);
    g.setAim(angle, power);
  }

  handleHeldKeys(dt) {
    const g = this.game;
    if (!g || g.phase !== 'aim' || !g.current || g.current.locked || g.waitingPass) return;
    const k = this.input.keys;
    const fine = k.has('ShiftLeft') || k.has('ShiftRight') ? 0.25 : 1;
    if (k.has('ArrowLeft')) g.adjustAngle(45 * fine * dt);
    if (k.has('ArrowRight')) g.adjustAngle(-45 * fine * dt);
    if (k.has('ArrowUp')) g.adjustPower(35 * fine * dt);
    if (k.has('ArrowDown')) g.adjustPower(-35 * fine * dt);
    const mv = (k.has('KeyA') ? -1 : 0) + (k.has('KeyD') ? 1 : 0) + this.input.moveBtn;
    if (mv) g.moveCurrent(Math.sign(mv), dt);
  }

  // ------------------------------------------------------------ loop
  loop(ts) {
    const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000);
    this.lastTs = ts;
    this.time += dt;
    const g = this.game;
    if (g) {
      this.handleHeldKeys(dt);
      const spectating = g.humansAlive().length === 0 && g.phase !== 'over';
      if (spectating && !this.spectateEl) { this.spectateEl = S.spectateBar(this); this.stage.append(this.spectateEl); this.timeScale = 2.5; }
      const n = Math.max(1, Math.round(this.timeScale));
      for (let i = 0; i < n; i++) g.update(dt);
      this.renderer.drawGame(g, this.time, dt);
      this.hud.update(g);
      if (g.phase === 'aim' && g.current && g.settings.turnTime > 0 && g.turnTimer < 5.5 && !g.current.locked) {
        const s = Math.ceil(g.turnTimer);
        if (s !== this.lastTick) { this.lastTick = s; this.audio.play('tick'); }
      }
    } else {
      this.renderer.drawMenu(this.time);
    }
    this.audio.update();
    requestAnimationFrame((t2) => this.loop(t2));
  }
}
