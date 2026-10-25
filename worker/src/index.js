// Unnamed Tank Game online relay.
//
// One Durable Object per room collects every player's locked-in shot over WebSockets and
// broadcasts the volley; clients simulate the round themselves from a shared seed, so the
// Worker never runs physics. WebSocket hibernation keeps idle rooms free.

const VERSION = '0.1.0';
const MAX_PLAYERS = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOCK_GRACE_MS = 2500;      // extra time after the client-visible deadline
const DONE_TIMEOUT_MS = 45000;   // max wait for clients to finish simulating a volley
const ROOM_TTL_MS = 3 * 60 * 1000;
const START_DELAY_MS = 3000;     // countdown once everyone is ready

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function makeCode(n = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of bytes) s += CODE_CHARS[b % CODE_CHARS.length];
  return s;
}

const clampStr = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/') return json({ ok: true, name: 'Unnamed Tank Game relay', version: VERSION });
    if (url.pathname === '/rooms' && req.method === 'GET') {
      const dir = env.DIRECTORY.get(env.DIRECTORY.idFromName('global'));
      const res = await dir.fetch('https://dir/list');
      return json(await res.json());
    }
    if (url.pathname === '/rooms' && req.method === 'POST') {
      for (let i = 0; i < 6; i++) {
        const code = makeCode();
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const res = await stub.fetch('https://room/state');
        const state = await res.json();
        if (state.phase === 'empty') return json({ code });
      }
      return json({ error: 'Could not allocate a room code' }, 503);
    }
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4,8})\/(ws|state)$/);
    if (m) {
      const code = m[1].toUpperCase();
      const stub = env.ROOM.get(env.ROOM.idFromName(code));
      if (m[2] === 'state') return json(await (await stub.fetch('https://room/state')).json());
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected WebSocket' }, 426);
      const target = new URL(req.url);
      target.pathname = '/ws';
      target.searchParams.set('code', code);
      return stub.fetch(new Request(target.toString(), req));
    }
    return json({ error: 'Not found' }, 404);
  },
};

function freshState(code = '') {
  return {
    code, phase: 'empty', hostId: null, players: {}, order: [], bots: {},
    settings: { mode: 'deathmatch', hp: 100, wind: 'low', turnTime: 30, tracers: true, items: true, crates: true, difficulty: 'Normal', arsenal: 'unlocked', map: 'random', balance: true },
    isPublic: true, seed: 0, round: 0, locks: {}, done: {}, left: [], hostSnapshot: null, deadline: null, startAt: null,
    created: Date.now(), updated: Date.now(),
  };
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.state = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.state = (await this.ctx.storage.get('state')) || freshState();
    });
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async save() { this.state.updated = Date.now(); await this.ctx.storage.put('state', this.state); }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/state') return json(this.summary());
    if (url.pathname === '/ws') {
      const code = url.searchParams.get('code') || this.state.code;
      if (this.state.phase === 'empty') { this.state = freshState(code); this.state.phase = 'lobby'; }
      if (!this.state.code) this.state.code = code;
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const id = crypto.randomUUID().slice(0, 8);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ id });
      server.send(JSON.stringify({ type: 'welcome', id, code: this.state.code, phase: this.state.phase, version: VERSION }));
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ error: 'Not found' }, 404);
  }

  summary() {
    const s = this.state;
    return { code: s.code, phase: s.phase, players: s.order.length, max: MAX_PLAYERS, hostName: s.players[s.hostId]?.name || null, settings: s.settings, isPublic: s.isPublic };
  }

  sockets() { return this.ctx.getWebSockets(); }
  idOf(ws) { try { return ws.deserializeAttachment()?.id; } catch { return null; } }

  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } }
  broadcast(obj, except = null) {
    const data = JSON.stringify(obj);
    for (const ws of this.sockets()) { if (this.idOf(ws) === except) continue; try { ws.send(data); } catch { /* closed */ } }
  }

  humans() { return this.state.order.filter((id) => this.state.players[id] && !this.state.players[id].bot); }
  connectedHumans() { return this.humans().filter((id) => this.state.players[id].connected); }

  lobbyMessage() {
    const s = this.state;
    return {
      type: 'lobby', code: s.code, phase: s.phase, hostId: s.hostId, settings: s.settings, isPublic: s.isPublic,
      startIn: s.startAt ? Math.max(0, s.startAt - Date.now()) : null,
      players: s.order.map((id) => { const p = s.players[id]; return { id, name: p.name, level: p.level, team: p.team, ready: p.ready, bot: !!p.bot, connected: p.connected !== false, cosmetics: p.cosmetics || null }; }),
    };
  }

  async publish() {
    const dir = this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('global'));
    const s = this.state;
    if (s.phase === 'lobby' && s.isPublic && s.order.length) {
      await dir.fetch('https://dir/register', { method: 'POST', body: JSON.stringify({ ...this.summary(), updated: Date.now() }) });
    } else {
      await dir.fetch('https://dir/remove', { method: 'POST', body: JSON.stringify({ code: s.code }) });
    }
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const id = this.idOf(ws);
    if (!id || !msg || typeof msg.type !== 'string') return;
    const s = this.state;
    const p = s.players[id];
    const isHost = id === s.hostId;
    switch (msg.type) {
      case 'join': {
        if (p) return;
        if (s.phase !== 'lobby') { this.send(ws, { type: 'error', msg: 'That game has already started.' }); ws.close(4001, 'in progress'); return; }
        if (s.order.length >= MAX_PLAYERS) { this.send(ws, { type: 'error', msg: 'Room is full.' }); ws.close(4002, 'full'); return; }
        s.players[id] = {
          id, name: clampStr(msg.name, 14) || 'Player', level: Math.max(1, Math.min(99, +msg.level || 1)),
          team: Math.max(1, Math.min(4, +msg.team || ((s.order.length % 4) + 1))), ready: false, connected: true,
          unlockedIds: Array.isArray(msg.unlockedIds) ? msg.unlockedIds.slice(0, 400).map((x) => clampStr(x, 24)) : ['shot'],
          tiers: msg.tiers && typeof msg.tiers === 'object' ? Object.fromEntries(Object.entries(msg.tiers).slice(0, 400).map(([k, v]) => [clampStr(k, 24), Math.max(1, Math.min(4, +v || 1))])) : {},
          cosmetics: msg.cosmetics && typeof msg.cosmetics === 'object' ? Object.fromEntries(['pattern', 'accessory', 'trail', 'title'].map((k) => [k, clampStr(msg.cosmetics[k] || 'none', 16)])) : null,
        };
        s.order.push(id);
        if (!s.hostId || !s.players[s.hostId]) s.hostId = id;
        await this.refreshStart();
        this.broadcast(this.lobbyMessage());
        this.broadcast({ type: 'chat', system: true, text: `${s.players[id].name} joined` });
        await this.publish();
        return;
      }
      case 'chat': {
        if (!p) return;
        const text = clampStr(msg.text, 160).trim();
        if (text) this.broadcast({ type: 'chat', id, name: p.name, text });
        return;
      }
    }
    if (!p) return;
    if (s.phase === 'lobby') await this.lobbyMessageFrom(id, p, isHost, msg);
    else await this.gameMessageFrom(id, p, isHost, msg);
  }

  async lobbyMessageFrom(id, p, isHost, msg) {
    const s = this.state;
    let changed = true;
    switch (msg.type) {
      case 'team': p.team = Math.max(1, Math.min(4, +msg.team || 1)); break;
      case 'ready': p.ready = !!msg.ready; break;
      case 'settings': {
        if (!isHost || !msg.settings || typeof msg.settings !== 'object') return;
        const allowed = ['mode', 'hp', 'wind', 'turnTime', 'tracers', 'items', 'crates', 'difficulty', 'arsenal', 'map', 'balance'];
        for (const k of allowed) if (k in msg.settings) s.settings[k] = typeof msg.settings[k] === 'string' ? clampStr(msg.settings[k], 24) : msg.settings[k];
        break;
      }
      case 'public': if (!isHost) return; s.isPublic = !!msg.isPublic; break;
      case 'addBot': {
        if (!isHost || s.order.length >= MAX_PLAYERS) return;
        const bid = 'bot-' + crypto.randomUUID().slice(0, 6);
        s.players[bid] = { id: bid, name: clampStr(msg.name, 14) || 'Bot', level: Math.max(1, Math.min(60, +msg.level || 5)), team: (s.order.length % 4) + 1, ready: true, bot: true, connected: true };
        s.order.push(bid);
        break;
      }
      case 'botLevel': {
        if (!isHost) return;
        const b = s.players[msg.id];
        if (b?.bot) b.level = Math.max(1, Math.min(60, +msg.level || 1));
        break;
      }
      case 'kick': {
        if (!isHost || msg.id === id) return;
        const target = s.players[msg.id];
        if (!target) return;
        delete s.players[msg.id];
        s.order = s.order.filter((x) => x !== msg.id);
        for (const ws of this.sockets()) if (this.idOf(ws) === msg.id) { this.send(ws, { type: 'error', msg: 'You were kicked from the room.' }); ws.close(4003, 'kicked'); }
        break;
      }
      case 'start': {
        if (!isHost) return;
        if (s.order.length < 2) { this.broadcast({ type: 'chat', system: true, text: 'Need at least two tanks to start.' }); return; }
        const notReady = this.humans().filter((h) => h !== s.hostId && !s.players[h].ready);
        if (notReady.length) { this.broadcast({ type: 'chat', system: true, text: 'Waiting for everyone to ready up.' }); return; }
        await this.startGame();
        return;
      }
      default: changed = false;
    }
    if (changed) { await this.refreshStart(); this.broadcast(this.lobbyMessage()); await this.publish(); }
  }

  allReady() {
    const s = this.state;
    const humans = this.connectedHumans();
    return s.phase === 'lobby' && s.order.length >= 2 && humans.length >= 1 && humans.every((h) => s.players[h].ready);
  }

  // Start a countdown when everyone is ready; cancel it when anyone isn't.
  async refreshStart() {
    const s = this.state;
    if (this.allReady()) { if (!s.startAt) s.startAt = Date.now() + START_DELAY_MS; }
    else s.startAt = null;
    await this.save();
    await this.armAlarm();
  }

  async startGame() {
    const s = this.state;
    s.phase = 'game';
    s.startAt = null;
    s.seed = Math.floor(Math.random() * 2 ** 31);
    s.round = 1;
    s.locks = {}; s.done = {}; s.left = []; s.hostSnapshot = null;
    s.deadline = this.nextDeadline();
    for (const id of s.order) s.players[id].ready = false;
    await this.save();
    this.broadcast({
      type: 'start', seed: s.seed, settings: s.settings, hostId: s.hostId, round: 1, deadline: s.deadline,
      players: s.order.map((id) => { const p = s.players[id]; return { id, name: p.name, level: p.level, team: p.team, bot: !!p.bot, unlockedIds: p.unlockedIds, tiers: p.tiers, cosmetics: p.cosmetics || null }; }),
    });
    await this.publish();
    await this.armAlarm();
  }

  nextDeadline() {
    const t = +this.state.settings.turnTime || 0;
    return t > 0 ? Date.now() + t * 1000 + LOCK_GRACE_MS : null;
  }

  async armAlarm() {
    const s = this.state;
    if (s.phase === 'lobby') { if (s.startAt) await this.ctx.storage.setAlarm(s.startAt); else await this.ctx.storage.deleteAlarm(); }
    else if (s.phase === 'game' && s.deadline) await this.ctx.storage.setAlarm(s.deadline);
    else if (s.phase === 'volley') await this.ctx.storage.setAlarm(Date.now() + DONE_TIMEOUT_MS);
    else await this.ctx.storage.deleteAlarm();
  }

  async gameMessageFrom(id, p, isHost, msg) {
    const s = this.state;
    switch (msg.type) {
      case 'lock': {
        if (s.phase !== 'game' || +msg.round !== s.round || s.locks[id]) return;
        s.locks[id] = {
          x: +msg.x || 0, shot: msg.shot && typeof msg.shot === 'object' ? { weaponId: clampStr(msg.shot.weaponId, 24), angle: +msg.shot.angle || 0, power: +msg.shot.power || 0 } : null,
          items: Array.isArray(msg.items) ? msg.items.slice(0, 24) : [],
          crates: Array.isArray(msg.crates) ? msg.crates.slice(0, 8).map((c) => +c || 0) : [],
          dev: Array.isArray(msg.dev) ? msg.dev.slice(0, 12).filter((o) => o && typeof o.type === 'string').map((o) => ({ type: clampStr(o.type, 16), x: +o.x || 0, v: +o.v || 0, seed: +o.seed || 0, kind: clampStr(o.kind, 12), style: clampStr(o.style, 16) })) : [],
          god: !!msg.god,
          bots: isHost && msg.bots && typeof msg.bots === 'object' ? msg.bots : undefined,
        };
        await this.save();
        this.broadcast({ type: 'locked', id, count: Object.keys(s.locks).length, needed: this.connectedHumans().length });
        if (this.connectedHumans().every((h) => s.locks[h])) await this.emitVolley();
        return;
      }
      case 'move': {
        if (s.phase !== 'game') return;
        this.broadcast({ type: 'move', id, x: +msg.x || 0 }, id);
        return;
      }
      case 'done': {
        if (s.phase !== 'volley' || +msg.round !== s.round) return;
        s.done[id] = true;
        if (isHost && msg.snapshot) s.hostSnapshot = msg.snapshot;
        if (msg.over) s.over = true;
        await this.save();
        if (this.connectedHumans().every((h) => s.done[h])) await this.nextRound();
        return;
      }
      case 'lobby': {
        if (!isHost || (s.phase !== 'post' && s.phase !== 'volley' && s.phase !== 'game')) return;
        await this.backToLobby();
        return;
      }
    }
  }

  async emitVolley() {
    const s = this.state;
    if (s.phase !== 'game') return;
    s.phase = 'volley';
    s.done = {};
    const entries = s.order.filter((id) => s.locks[id]).map((id) => ({ id, ...s.locks[id] }));
    const left = s.left.slice();
    s.left = [];
    s.locks = {};
    await this.save();
    this.broadcast({ type: 'volley', round: s.round, entries, left });
    await this.armAlarm();
  }

  async nextRound() {
    const s = this.state;
    if (s.over) { s.phase = 'post'; s.over = false; await this.save(); await this.ctx.storage.deleteAlarm(); this.broadcast({ type: 'post' }); return; }
    s.phase = 'game';
    s.round++;
    s.locks = {}; s.done = {};
    s.deadline = this.nextDeadline();
    await this.save();
    this.broadcast({ type: 'aim', round: s.round, deadline: s.deadline, snapshot: s.hostSnapshot });
    s.hostSnapshot = null;
    await this.armAlarm();
  }

  async backToLobby() {
    const s = this.state;
    s.phase = 'lobby';
    for (const id of s.order) if (s.players[id].connected === false) { delete s.players[id]; }
    s.order = s.order.filter((id) => s.players[id]);
    for (const id of s.order) s.players[id].ready = !!s.players[id].bot;
    s.locks = {}; s.done = {}; s.left = []; s.deadline = null; s.startAt = null;
    await this.save();
    this.broadcast(this.lobbyMessage());
    await this.publish();
    await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const s = this.state;
    if (s.phase === 'lobby') {
      if (s.startAt && Date.now() >= s.startAt - 100 && this.allReady()) await this.startGame();
      else { s.startAt = null; await this.save(); this.broadcast(this.lobbyMessage()); }
      return;
    }
    if (s.phase === 'game') await this.emitVolley();
    else if (s.phase === 'volley') await this.nextRound();
  }

  async webSocketClose(ws) { await this.handleLeave(this.idOf(ws)); }
  async webSocketError(ws) { await this.handleLeave(this.idOf(ws)); }

  async handleLeave(id) {
    const s = this.state;
    const p = id && s.players[id];
    if (!p) return;
    if (s.phase === 'lobby' || s.phase === 'post') {
      delete s.players[id];
      s.order = s.order.filter((x) => x !== id);
    } else {
      p.connected = false;
      s.left.push(id);
    }
    if (s.hostId === id) {
      s.hostId = this.connectedHumans()[0] || null;
      if (s.hostId) this.broadcast({ type: 'host', id: s.hostId });
    }
    if (!this.connectedHumans().length) {
      this.state = freshState(s.code);
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      await this.publish();
      return;
    }
    await this.save();
    this.broadcast({ type: 'chat', system: true, text: `${p.name} left` });
    if (s.phase === 'lobby') await this.refreshStart();
    if (s.phase === 'lobby' || s.phase === 'post') { this.broadcast(this.lobbyMessage()); await this.publish(); }
    else if (s.phase === 'game') {
      this.broadcast({ type: 'left', id });
      if (this.connectedHumans().every((h) => s.locks[h])) await this.emitVolley();
    } else if (s.phase === 'volley') {
      this.broadcast({ type: 'left', id });
      if (this.connectedHumans().every((h) => s.done[h])) await this.nextRound();
    }
  }
}

// Public room directory (a single instance).
export class Directory {
  constructor(ctx) { this.ctx = ctx; }
  async fetch(req) {
    const url = new URL(req.url);
    const rooms = (await this.ctx.storage.get('rooms')) || {};
    if (url.pathname === '/register') {
      const r = await req.json();
      rooms[r.code] = r;
      await this.ctx.storage.put('rooms', rooms);
      return json({ ok: true });
    }
    if (url.pathname === '/remove') {
      const r = await req.json();
      delete rooms[r.code];
      await this.ctx.storage.put('rooms', rooms);
      return json({ ok: true });
    }
    const now = Date.now();
    let dirty = false;
    for (const [code, r] of Object.entries(rooms)) if (now - r.updated > ROOM_TTL_MS) { delete rooms[code]; dirty = true; }
    if (dirty) await this.ctx.storage.put('rooms', rooms);
    return json({ rooms: Object.values(rooms).sort((a, b) => b.updated - a.updated) });
  }
}
