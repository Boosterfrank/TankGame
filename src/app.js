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
import { onlineScreen, onlineLobbyScreen } from './ui/online.js';
import { DevTools } from './ui/devtools.js';
import { ONLINE_SERVER, DEFAULT_SETTINGS } from './config.js';
import { MusicPlayer } from './music.js';
import { shopScreen } from './ui/shop.js';
import { rewardsScreen } from './ui/rewards.js';
import { OnlineSession } from './online.js';
import { cosmeticsOf } from './cosmetics.js';
import { Intro } from './intro.js';

// Audio sink for the background attract-mode battle (it must stay silent).
const SILENT_AUDIO = { init() {}, play() {}, engine() {}, update() {}, setMuted() {}, setVolume() {} };

const STEP = 1 / 60;

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
    this.input = { keys: new Set(), drag: null, moveBtn: 0, holds: new Map() };
    this.timeScale = 1;
    this.lastTs = 0;
    this.time = 0;
    this.spectateEl = null;
    this.lastGameConfig = null;
    this.session = null;        // OnlineSession while connected to a room
    this.acc = 0;               // fixed-timestep accumulator
    this.chat = document.getElementById('chat');
    this.chatOpen = false;
    this.dev = new DevTools(this);
    this.music = new MusicPlayer(this.audio);
    this.intro = null;          // Intro cutscene while playing
    this.attract = null;        // bots-only battle rendered behind the menus
    this.attractAcc = 0;
    this.np = document.getElementById('nowplaying');
  }

  serverUrl() { return (this.profile.settings.server || ONLINE_SERVER || '').trim(); }

  init() {
    this.fit();
    window.addEventListener('resize', () => this.fit());
    this.bindInput();
    this.applyAudioSettings();
    this.np.querySelector('.np-mute').addEventListener('click', () => {
      this.profile.settings.music = !this.profile.settings.music;
      saveProfile(this.profile);
      this.applyAudioSettings();
    });
    this.show('boot');
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
    const s = this.profile.settings;
    this.audio.setMuted(!s.sound);
    this.audio.setVolume(s.volume);
    this.music.volume = s.musicVolume ?? 0.6;
    if (this.music.enabled !== (s.music !== false)) this.music.setEnabled(s.music !== false);
    else this.music.fadeTo(this.music.targetVolume(), 0.3);
    this.np.querySelector('.np-mute').textContent = s.music === false ? 'UNMUTE' : 'MUTE';
  }

  // First click on the boot screen: unlock audio, start music, play the intro (or go straight to the menu).
  beginSession() {
    this.audio.init();
    const go = () => {
      this.music.play();
      this.renderer.fade = 1;
      this.renderer.fadeTo(0, this.profile.settings.intro !== false ? 1.2 : 1.8);
      if (this.profile.settings.intro !== false) this.startIntro();
      else { this.startAttract(); this.show('menu'); }
    };
    if (!this.profile.settings.named) this.askName(go); else go();
  }

  // First run: pick a commander name.
  askName(done) {
    const p = this.profile;
    const input = el('input', { type: 'text', maxlength: 14, placeholder: 'Your callsign', value: p.name && p.name !== 'Commander' ? p.name : '', autocomplete: 'off', spellcheck: false });
    const err = el('div.gate-error');
    const submit = () => {
      const v = input.value.trim();
      if (v.length < 2) { err.textContent = 'At least two characters, Commander.'; input.focus(); return; }
      p.name = v.slice(0, 14); p.settings.named = true; saveProfile(p);
      this.closeModal(); done();
    };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); });
    this.modal.innerHTML = '';
    this.modal.classList.remove('hidden');
    this.modal.append(el('div.modal-box.name-modal', {}, [
      el('h2', { text: 'WELCOME, COMMANDER' }),
      el('p', { text: 'Choose the name other players will see. You can change it later in Settings.' }),
      input, err,
      el('button.btn.btn-primary.btn-big', { text: 'CONTINUE', onclick: submit }),
    ]));
    setTimeout(() => input.focus(), 50);
  }

  // Generic choice dialog.
  choice(title, text, options) {
    this.modal.innerHTML = '';
    this.modal.classList.remove('hidden');
    this.modal.append(el('div.modal-box.choice', {}, [
      el('h2', { text: title }), text ? el('p', { text }) : null,
      el('div.modal-buttons.choice-buttons', {}, options.map((o) => el('button', { class: `btn btn-big ${o.cls || ''}`, html: o.html, onclick: () => { this.closeModal(); o.fn(); } }))),
      el('button.btn.btn-small', { text: 'CANCEL', onclick: () => this.closeModal() }),
    ]));
  }

  startIntro() {
    this.show(null);
    this.screenName = 'intro';
    this.attract = null;
    this.intro = new Intro(this);
  }

  onIntroDone() {
    this.intro = null;
    this.startAttract();
    this.show('menu');
  }

  // Bots fight each other behind the menus. Silent, restarts itself when a battle ends.
  startAttract() {
    const rng = new RNG(Date.now());
    const names = rng.shuffle(BOT_NAMES).slice(0, 5);
    const g = new Game({
      settings: { ...DEFAULT_SETTINGS, arsenal: 'all', difficulty: 'Hard', turnTime: 4, items: false, crates: true, hp: 150, map: 'random' },
      players: names.map((n, i) => ({ name: n, isBot: true, team: 100 + i, level: 45 })),
      seed: rng.int(1, 1e9), audio: SILENT_AUDIO,
    });
    g.dev = {};
    // Fade to black, hold, then a fresh battle fades in once its tanks have landed.
    g.on.gameOver = () => { this.renderer.fadeTo(1, 1.6); setTimeout(() => { if (this.attract === g) this.startAttract(); }, 2300); };
    this.attract = g;
    this.attractAcc = 0;
    this.renderer.fade = 1; this.renderer.fadeTarget = 1;
    this.attractFadeWait = true;
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
      case 'help': case 'settings': node = S.settingsScreen(this); break;
      case 'shop': node = shopScreen(this); break;
      case 'rewards': node = rewardsScreen(this, args[0], args[1], () => this.show('results', args[0], args[1])); break;
      case 'results': node = S.resultsScreen(this, ...args); break;
      case 'boot': case 'title': node = S.bootScreen(this); break;
      case 'online': node = onlineScreen(this); break;
      case 'onlineLobby': node = onlineLobbyScreen(this); break;
      case null: break;
    }
    if (node) this.screens.append(node);
    if (name && name !== 'results' && name !== 'rewards' && this.game) { this.game = null; if (this.session) this.session.game = null; this.hud.hide(); this.removeSpectate(); this.closeChat(); }
    if (name && name !== 'onlineLobby' && name !== 'results' && this.session && !this.game) {
      // Leaving the online flow entirely drops the room connection.
      if (!['online', 'onlineLobby'].includes(name) && this.session.phase !== 'game') { this.session.leave(); this.session = null; }
    }
    if (name) this.audio.play('click');
    if (name && name !== 'boot' && name !== 'title') {
      if (this.intro) this.intro = null;
      if (!this.game && !this.attract) this.startAttract();
      if (!this.game || name === 'results' || name === 'rewards') this.music.duck(false);
    }
    this.dev.onScreen(name);
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
    this.choice('QUICK PLAY', 'Jump straight into a battle.', [
      { html: 'ONLINE<small>find or open a public room</small>', cls: 'btn-primary', fn: () => this.quickOnline() },
      { html: 'VS BOTS<small>offline against five bots</small>', fn: () => this.quickBots() },
    ]);
  }

  // Join the first open public room, or create one.
  async quickOnline() {
    const server = this.serverUrl();
    if (!server) { this.show('online'); return; }
    this.toast('Finding a room…', '#4fc3ff');
    const session = new OnlineSession(this, server);
    try {
      const rooms = await session.listRooms();
      const open = rooms.find((r) => r.phase === 'lobby' && r.players < r.max);
      const code = open ? open.code : await session.createRoom();
      await session.connect(code);
      this.session = session;
      this.show('onlineLobby');
      this.toast(open ? `Joined ${open.hostName || 'a'}'s room` : 'No open rooms, so you are hosting a new public one');
    } catch (e) { this.toast(e.message, '#ff5252'); this.show('online'); }
  }

  quickBots() {
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
    const players = config.players.map((p) => (p.isBot || config.online) ? p : { ...p, unlockedIds: ids, tiers, level: this.profile.level, cosmetics: p.isProfile ? cosmeticsOf(this.profile) : null });
    this.show(null);
    this.audio.init();
    this.game = new Game({ settings: config.settings, players, seed: config.seed, audio: this.audio, online: config.online || null, deadline: config.deadline || null });
    const g = this.game;
    g.dev = this.dev.flags;
    this.acc = 0;
    this.attract = null;
    this.music.duck(true);
    this.renderer.fade = 1; this.renderer.fadeTarget = 1;
    this.gameFadeWait = true; // stay black until the tanks have dropped in
    if (config.online) {
      const onClose = () => { if (this.game === g) { this.hud.hide(); this.removeSpectate(); this.closeChat(); this.game = null; this.session = null; this.modal.innerHTML = ''; this.modal.classList.remove('hidden'); this.modal.append(S.confirmModal('Connection to the room was lost.', () => { this.closeModal(); this.show('menu'); }, () => { this.closeModal(); this.show('menu'); })); } };
      config.online.on('close', onClose);
    }
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
    this.chat.innerHTML = '';
    this.chat.classList.toggle('hidden', !config.online);
  }

  // ------------------------------------------------------------ in-game chat (online)
  openChat() {
    if (!this.game?.online || this.chatOpen) return;
    this.chatOpen = true;
    const input = el('input.chat-input.ingame', { type: 'text', placeholder: 'Say something… (Enter to send, Esc to cancel)', maxlength: 160 });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.session?.sendChat(input.value); this.closeChat(); }
      if (e.key === 'Escape') this.closeChat();
    });
    this.chat.append(input);
    input.focus();
  }

  closeChat() {
    this.chatOpen = false;
    this.chat.querySelector('.chat-input')?.remove();
  }

  showPass(tank) {
    this.modal.innerHTML = '';
    this.modal.classList.remove('hidden');
    this.modal.append(S.passModal(this, tank, () => { this.closeModal(); this.game?.confirmPass(); }));
  }

  endGame(results) {
    const g = this.game;
    if (!g || g.ended) return; // a game pays out once, even if its over-timer is re-armed
    g.ended = true;
    const me = results.find((r) => r.tank.isProfile);
    let summary = null;
    if (me) {
      summary = applyGameResults(this.profile, {
        xp: me.xp, kills: me.kills, damage: me.damage, shots: me.tank.stats.shots, won: !!me.winner, mastery: me.tank.mastery || {},
      });
    }
    this.hud.hide();
    this.removeSpectate();
    this.closeChat();
    this.timeScale = 1;
    this.renderer.banner = null;
    if (summary && (summary.xp > 0 || summary.gears > 0)) this.show('rewards', results, summary);
    else this.show('results', results, summary);
  }

  confirmLeave() {
    if (!this.game) return;
    this.confirm('Leave the battle? Progress from this game will be lost.', () => { if (this.session) { this.session.leave(); this.session = null; } this.show('menu'); });
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
      if (this.intro) { this.intro.input(); return; }
      const g = this.game;
      this.input.keys.add(e.code);
      if (!g) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) { this.aimKey(e.code, 1, e.shiftKey); this.input.holds.set(e.code, { t: 0, acc: 0 }); }
      if (e.code === 'Enter' && g.online) { if (this.hud.overlayMode) this.hud.closeOverlay(); this.openChat(); }
      else if (e.code === 'Space' || e.code === 'Enter') { if (this.hud.overlayMode) this.hud.closeOverlay(); else this.fire(); }
      else if (e.code === 'Backquote') { this.dev.toggle(); }
      else if (e.code === 'Tab' || e.code === 'KeyW') { this.hud.toggleOverlay('weapons'); }
      else if (e.code === 'KeyE') { this.hud.toggleOverlay('items'); }
      else if (e.code === 'KeyQ') { g.cycleWeapon(-1); }
      else if (e.code === 'Escape') { if (this.hud.overlayMode) this.hud.closeOverlay(); else if (!this.modal.classList.contains('hidden')) this.closeModal(); else this.confirmLeave(); }
    });
    window.addEventListener('keyup', (e) => { this.input.keys.delete(e.code); this.input.holds.delete(e.code); });
    window.addEventListener('blur', () => { this.input.keys.clear(); this.input.holds.clear(); });

    const toWorld = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * WORLD_W, y: ((e.clientY - r.top) / r.height) * WORLD_H };
    };
    this.stage.addEventListener('pointerdown', () => { if (this.intro) this.intro.input(); });
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
      g.adjustPower(e.deltaY < 0 ? 1 : -1);
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
    let angle = deg(Math.atan2(dy, dx));
    if (angle < -90) angle += 360;
    const power = clamp((d - 34) / 1.96, 5, 100);
    g.setAim(angle, power);
  }

  // One aim step per key press; holding repeats with acceleration (Shift = 5 per step).
  aimKey(code, n, shift) {
    const g = this.game;
    if (!g || g.phase !== 'aim' || !g.current || g.current.locked || g.waitingPass) return;
    const step = (shift ? 5 : 1) * n;
    if (code === 'ArrowLeft') g.adjustAngle(step);
    else if (code === 'ArrowRight') g.adjustAngle(-step);
    else if (code === 'ArrowUp') g.adjustPower(step);
    else if (code === 'ArrowDown') g.adjustPower(-step);
  }

  handleHeldKeys(dt) {
    const g = this.game;
    if (!g || g.phase !== 'aim' || !g.current || g.current.locked || g.waitingPass) return;
    const k = this.input.keys;
    const shift = k.has('ShiftLeft') || k.has('ShiftRight');
    for (const [code, h] of this.input.holds) {
      h.t += dt;
      if (h.t < 0.22) continue;
      const rate = h.t < 0.7 ? 18 : h.t < 1.6 ? 40 : 80;
      h.acc += rate * dt;
      const n = Math.floor(h.acc);
      if (n > 0) { h.acc -= n; this.aimKey(code, n, shift); }
    }
    const mv = (k.has('KeyA') ? -1 : 0) + (k.has('KeyD') ? 1 : 0) + this.input.moveBtn;
    if (mv) g.moveCurrent(Math.sign(mv), dt);
  }

  // ------------------------------------------------------------ loop
  loop(ts) {
    const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000);
    this.lastTs = ts;
    this.time += dt;
    this.music.update();
    this.renderer.updateFade(dt);
    this.stage.style.setProperty('--bass', this.music.bass.toFixed(3));
    const g = this.game;
    if (this.intro) {
      this.intro.update(dt);
      this.intro.draw(this.renderer);
    } else if (g) {
      this.handleHeldKeys(dt);
      const spectating = g.phase !== 'over' && (g.online ? !(g.me && g.me.alive) : g.humansAlive().length === 0);
      if (spectating && !this.spectateEl) { this.spectateEl = S.spectateBar(this, !!g.online); this.stage.append(this.spectateEl); if (!g.online) this.timeScale = 2.5; }
      // Fixed timestep keeps the simulation deterministic across machines (required for online play).
      this.acc += dt * (this.dev.flags.timeScale || 1) * this.timeScale;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) { g.update(STEP); this.acc -= STEP; steps++; }
      if (steps >= 8) this.acc = 0;
      if (this.gameFadeWait && (g.phase !== 'intro' || g.introT < 0.3)) { this.gameFadeWait = false; this.renderer.fadeTo(0, 1.2); }
      this.renderer.drawGame(g, this.time, dt);
      this.hud.update(g);
      this.dev.update(g, dt);
      if (g.phase === 'aim' && g.current && g.settings.turnTime > 0 && g.turnTimer < 5.5 && !g.current.locked) {
        const s = Math.ceil(g.turnTimer);
        if (s !== this.lastTick) { this.lastTick = s; this.audio.play('tick'); }
      }
    } else if (this.attract) {
      this.attractAcc += dt;
      let steps = 0;
      while (this.attractAcc >= STEP && steps < 4) { this.attract.update(STEP); this.attractAcc -= STEP; steps++; }
      if (steps >= 4) this.attractAcc = 0;
      if (this.attractFadeWait && (this.attract.phase !== 'intro' || this.attract.introT < 0.4)) { this.attractFadeWait = false; this.renderer.fadeTo(0, 2.2); }
      this.renderer.drawGame(this.attract, this.time, dt, { attract: true, music: this.music });
    } else {
      this.renderer.drawMenu(this.time, dt, { music: this.music });
    }
    this.updateNowPlaying();
    this.audio.update();
    requestAnimationFrame((t2) => this.loop(t2));
  }

  updateNowPlaying() {
    const show = !this.game && !this.intro && this.screenName !== 'boot' && this.screenName !== 'title' && this.music.started && !this.music.failed;
    this.np.classList.toggle('hidden', !show);
    if (!show) return;
    const title = this.np.querySelector('.np-title');
    if (title.textContent !== this.music.title) title.textContent = this.music.title;
    const bars = this.np.querySelectorAll('.eq i');
    const bins = [2, 5, 9, 16, 28];
    bars.forEach((b, i) => { const v = this.music.active ? this.music.data[bins[i]] / 255 : 0; b.style.height = `${4 + v * 18}px`; });
  }
}
