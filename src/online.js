// Online session: talks to the Cloudflare Worker relay (worker/) and bridges it to the Game.
// The relay only collects locked-in shots; every client simulates volleys itself from the shared seed.
import { unlockedIds, allTiers, saveProfile, xpForLevel, MAX_LEVEL } from './profile.js';
import { cosmeticsOf } from './cosmetics.js';

export class OnlineSession {
  constructor(app, serverUrl) {
    this.app = app;
    this.base = serverUrl.replace(/\/+$/, '');
    this.ws = null;
    this.myId = null; this.code = null;
    this.lobby = null; this.hostId = null; this.phase = null;
    this.chat = [];
    this.handlers = {};
    this.game = null;
    this.order = [];
    this.joined = false; this.closed = false;
    this.moveAt = 0;
    this.latency = null; this.pingAt = 0;
    this.pingTimer = null;
    this.isDev = false; // relay-verified developer
    this.clockOffset = 0; // relay clock minus ours, measured from timestamped messages
  }

  get isHost() { return !!this.myId && this.hostId === this.myId; }

  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return this; }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }
  emit(type, data) { for (const fn of this.handlers[type] || []) fn(data); }

  async listRooms() {
    const r = await fetch(`${this.base}/rooms`);
    if (!r.ok) throw new Error(`Server replied ${r.status}`);
    return (await r.json()).rooms || [];
  }

  async createRoom() {
    const r = await fetch(`${this.base}/rooms`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!j.code) throw new Error(j.error || `Could not create a room (${r.status})`);
    return j.code;
  }

  connect(code) {
    const p = this.app.profile;
    return new Promise((resolve, reject) => {
      const url = `${this.base.replace(/^http/, 'ws')}/room/${encodeURIComponent(code.toUpperCase())}/ws`;
      let ws;
      try { ws = new WebSocket(url); } catch (e) { reject(new Error('Invalid server URL')); return; }
      this.ws = ws; this.code = code.toUpperCase();
      const timeout = setTimeout(() => { if (!this.joined) { reject(new Error('Connection timed out')); try { ws.close(); } catch { /* ignore */ } } }, 9000);
      ws.onopen = () => {
        this.send({ type: 'join', name: p.name, level: p.level, unlockedIds: unlockedIds(p), tiers: allTiers(p), cosmetics: cosmeticsOf(p) });
        this.pingTimer = setInterval(() => { if (ws.readyState === 1) { this.pingAt = performance.now(); ws.send('ping'); } }, 20000);
      };
      ws.onmessage = (e) => {
        if (e.data === 'pong') { this.latency = Math.round(performance.now() - this.pingAt); return; }
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'welcome') this.myId = m.id;
        if (m.type === 'lobby' && !this.joined) { this.joined = true; clearTimeout(timeout); this.handle(m); resolve(m); this.authDev(); return; }
        if (m.type === 'error' && !this.joined) { clearTimeout(timeout); reject(new Error(m.msg)); return; }
        this.handle(m);
      };
      ws.onclose = () => {
        clearInterval(this.pingTimer);
        if (!this.joined) { clearTimeout(timeout); reject(new Error('Could not connect to the server')); }
        const wasClosed = this.closed;
        this.closed = true;
        if (!wasClosed) this.emit('close');
      };
      ws.onerror = () => { /* onclose follows */ };
    });
  }

  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  handle(m) {
    if (typeof m.now === 'number') this.clockOffset = m.now - Date.now();
    switch (m.type) {
      case 'lobby': this.lobby = m; this.hostId = m.hostId; this.phase = m.phase; this.startDeadline = m.startIn != null ? performance.now() + m.startIn : null; this.emit('lobby', m); break;
      case 'chat': this.chat.push({ name: m.system ? null : m.name, text: m.text, t: Date.now() }); if (this.chat.length > 60) this.chat.shift(); this.emit('chat', m); if (this.game) this.game.message(m.system ? m.text : `${m.name}: ${m.text}`, m.system ? '#90a4ae' : '#80deea'); break;
      case 'host': this.hostId = m.id; this.emit('host', m); if (this.game && this.isHost) this.game.message('You are now the host', '#ffd740'); break;
      case 'start': this.startGame(m); break;
      case 'aim': this.game?.serverAim(m); break;
      case 'volley': this.game?.applyVolley(m); break;
      case 'locked': if (this.game) { this.game.lockInfo = { count: m.count, needed: m.needed }; const t = this.game.tankByNet(m.id); if (t) t.locked = true; } break;
      case 'move': this.game?.setRemoteX(m.id, m.x); break;
      case 'left': if (this.game) { const t = this.game.tankByNet(m.id); if (t) t.connected = false; } break;
      case 'post': this.phase = 'post'; this.emit('post', m); break;
      case 'devOk': this.isDev = true; this.app.toast('Developer access verified for this room', '#ea80fc'); this.emit('lobby', this.lobby); this.app.dev.onScreen(); break;
      case 'devGrant': this.applyGrant(m); break;
      case 'error': this.app.toast(m.msg, '#ff5252'); break;
    }
  }

  indexOf(id) { return this.order.indexOf(id); }

  startGame(m) {
    this.order = m.players.map((p) => p.id);
    this.hostId = m.hostId;
    this.phase = 'game';
    const players = m.players.map((p) => ({
      name: p.name, isBot: !!p.bot, team: p.team, level: p.level, netId: p.id,
      isProfile: p.id === this.myId, unlockedIds: p.unlockedIds || ['shot'], tiers: p.tiers || {}, cosmetics: p.cosmetics || null,
    }));
    this.app.startGame({ settings: m.settings, players, seed: m.seed, online: this, deadline: m.deadline, moveUntil: m.moveUntil || null });
  }

  bind(game) {
    this.game = game;
    game.on.lock = (payload) => this.send({ type: 'lock', round: game.round, ...payload });
    game.on.volleyDone = (round, snapshot, over) => this.send({ type: 'done', round, snapshot, over });
    game.on.move = (x, force = false) => {
      const now = performance.now();
      if (force || now - this.moveAt > 120) { this.moveAt = now; this.send({ type: 'move', x: Math.round(x) }); }
    };
  }

  // Developer powers (see worker: the relay verifies the password hash before honoring them).
  authDev() { const d = this.app.dev; if (d?.unlocked && d.key && !this.isDev) this.send({ type: 'dev', key: d.key }); }
  grant(id, fields) { this.send({ type: 'grant', id, ...fields }); }
  sendUpdate() { const p = this.app.profile; this.send({ type: 'update', level: p.level, unlockedIds: unlockedIds(p), tiers: allTiers(p), cosmetics: cosmeticsOf(p) }); }

  // A developer gave us levels / gears / XP: apply to the profile and re-report it to the room.
  applyGrant(m) {
    const p = this.app.profile;
    const parts = [];
    if (m.level != null) { p.level = Math.max(1, Math.min(MAX_LEVEL, Math.round(m.level))); p.xp = 0; parts.push(`level set to ${p.level}`); }
    if (m.levels) { p.level = Math.max(1, Math.min(MAX_LEVEL, p.level + Math.round(m.levels))); p.xp = Math.min(p.xp, xpForLevel(p.level) - 1); parts.push(`${m.levels > 0 ? '+' : ''}${m.levels} levels`); }
    if (m.gears) { p.gears = Math.max(0, p.gears + Math.round(m.gears)); parts.push(`${m.gears > 0 ? '+' : ''}${m.gears} gears`); }
    if (m.xp > 0) {
      p.xp += Math.round(m.xp);
      while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; }
      parts.push(`+${m.xp} XP`);
    }
    if (!parts.length) return;
    saveProfile(p);
    this.app.audio.play('levelup');
    this.app.toast(`Developer ${m.from}: ${parts.join(', ')}`, '#ea80fc');
    this.sendUpdate();
    if (this.app.screenName === 'onlineLobby') this.app.show('onlineLobby');
  }

  sendChat(text) { const t = String(text || '').trim(); if (t) this.send({ type: 'chat', text: t.slice(0, 160) }); }
  setReady(ready) { this.send({ type: 'ready', ready: !!ready }); }
  setTeam(team, id = null) { this.send(id ? { type: 'team', team, id } : { type: 'team', team }); }
  setSettings(settings) { this.send({ type: 'settings', settings }); }
  setPublic(isPublic) { this.send({ type: 'public', isPublic }); }
  addBot(level, name) { this.send({ type: 'addBot', level, name }); }
  setBotLevel(id, level) { this.send({ type: 'botLevel', id, level }); }
  kick(id) { this.send({ type: 'kick', id }); }
  start() { this.send({ type: 'start' }); }
  backToLobby() { this.send({ type: 'lobby' }); }

  leave() {
    this.closed = true;
    clearInterval(this.pingTimer);
    this.game = null;
    try { this.ws?.close(1000, 'leave'); } catch { /* ignore */ }
  }
}
