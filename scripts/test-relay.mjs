// Protocol test for the Worker relay (run `npm run dev` in worker/ first, or set RELAY=url).
// Two clients create and join a room, start a game, lock shots, finish a volley and leave.
const base = process.env.RELAY || 'http://localhost:8787';
const wsBase = base.replace(/^http/, 'ws');
const fails = [];
const check = (c, m) => { if (!c) { fails.push(m); console.error('FAIL', m); } };

function client(code, name) {
  const ws = new WebSocket(`${wsBase}/room/${code}/ws`);
  const inbox = [];
  const waiters = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); inbox.push(m); for (const w of waiters.splice(0)) w(); };
  const send = (o) => ws.send(JSON.stringify(o));
  const until = (pred, ms = 5000) => new Promise((res, rej) => {
    const t0 = Date.now();
    let done = false; // a settled waiter must not keep polling and swallow later messages
    const tick = () => {
      if (done) return;
      const m = inbox.find((x) => !x._used && pred(x));
      if (m) { done = true; m._used = true; return res(m); }
      if (Date.now() - t0 > ms) { done = true; return rej(new Error(`timeout waiting: ${name} (last: ${inbox.slice(-3).map((x) => x.type).join(', ')})`)); }
      waiters.push(tick); setTimeout(tick, 100);
    };
    tick();
  });
  const opened = new Promise((r) => { ws.onopen = r; });
  return { ws, send, until, inbox, opened, name };
}

const { code } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
check(/^[A-Z0-9]{5}$/.test(code), 'room code format');
const a = client(code, 'A'), b = client(code, 'B');
await a.opened; await b.opened;
const wa = await a.until((m) => m.type === 'welcome');
await b.until((m) => m.type === 'welcome');
a.send({ type: 'join', name: 'Alice', level: 7, unlockedIds: ['shot', 'tri'], tiers: { shot: 2 } });
await a.until((m) => m.type === 'lobby' && m.players.length === 1);
b.send({ type: 'join', name: 'Bob', level: 3, unlockedIds: ['shot'], tiers: {} });
const lobby = await b.until((m) => m.type === 'lobby' && m.players.length === 2);
check(lobby.hostId === wa.id, 'first joiner is host');
// developer access (needs the password; set DEV_KEY to exercise it)
if (process.env.DEV_KEY) {
  b.send({ type: 'dev', key: 'wrong-password' });
  check(!!(await b.until((m) => m.type === 'error' && /denied/i.test(m.msg))), 'wrong developer key refused');
  b.send({ type: 'dev', key: process.env.DEV_KEY });
  await b.until((m) => m.type === 'devOk');
  check(!!(await a.until((m) => m.type === 'lobby' && m.players[1]?.dev)), 'developer flag shown in lobby');
  b.send({ type: 'settings', settings: { hp: 200 } });
  check(!!(await a.until((m) => m.type === 'lobby' && m.settings.hp === 200)), 'non-host developer can change settings');
  b.send({ type: 'grant', id: wa.id, levels: 5, gears: 100 });
  const gr = await a.until((m) => m.type === 'devGrant');
  check(gr.levels === 5 && gr.gears === 100 && gr.from === 'Bob', 'grant relayed to its target');
  a.send({ type: 'update', level: 12, unlockedIds: ['shot', 'tri', 'big'], tiers: { shot: 2 } });
  check(!!(await b.until((m) => m.type === 'lobby' && m.players[0].level === 12)), 'profile update reflected in lobby');
  a.send({ type: 'grant', id: wa.id, levels: 5 });
  await new Promise((r) => setTimeout(r, 300));
  check(!a.inbox.some((m) => m.type === 'devGrant' && !m._used), 'non-developer grants are ignored');
} else console.log('DEV_KEY not set: skipping developer-access checks');
a.send({ type: 'settings', settings: { turnTime: 2, mode: 'team' } });
const l2 = await b.until((m) => m.type === 'lobby' && m.settings.turnTime === 2);
check(l2.settings.mode === 'team', 'settings propagate');
a.send({ type: 'addBot', level: 9, name: 'Rook' });
await b.until((m) => m.type === 'lobby' && m.players.length === 3);
const list = await (await fetch(`${base}/rooms`)).json();
check(list.rooms.some((r) => r.code === code && r.players === 3), 'room listed publicly');
a.send({ type: 'start' });
const chat = await a.until((m) => m.type === 'chat' && m.system && /ready up/.test(m.text));
check(!!chat, 'start refused until ready');
b.send({ type: 'ready', ready: true });
await a.until((m) => m.type === 'lobby' && m.players[1]?.ready);
a.send({ type: 'ready', ready: true });
const cd = await b.until((m) => m.type === 'lobby' && m.startIn != null);
check(cd.startIn > 1000 && cd.startIn <= 3000, `countdown announced (${cd.startIn})`);
const start = await b.until((m) => m.type === 'start', 8000);
check(start.players.length === 3 && start.players[2].bot && start.players[0].unlockedIds.includes('tri'), 'start payload');
check(start.deadline > Date.now(), 'deadline set');
// round 1: A locks with bots, B does nothing -> alarm fires volley after deadline (2s + grace)
a.send({ type: 'lock', round: 1, x: 100, shot: { weaponId: 'shot', angle: 45, power: 70 }, items: [], bots: { 2: { weaponId: 'shot', angle: 90, power: 50 } } });
await b.until((m) => m.type === 'locked' && m.count === 1);
b.send({ type: 'move', x: 333 });
const mv = await a.until((m) => m.type === 'move' && m.x === 333);
check(mv.id !== wa.id, 'move relayed to others only');
const volley = await b.until((m) => m.type === 'volley' && m.round === 1, 9000);
check(volley.entries.length === 1 && volley.entries[0].bots['2'].angle === 90, 'volley from deadline includes host bots');
a.send({ type: 'done', round: 1, snapshot: { hp: [100, 80, 60] } });
b.send({ type: 'done', round: 1 });
const aim = await b.until((m) => m.type === 'aim' && m.round === 2);
check(aim.snapshot && aim.snapshot.hp[1] === 80, 'host snapshot forwarded with aim');
// round 2: both lock -> immediate volley
a.send({ type: 'lock', round: 2, x: 1, shot: null, items: [{ id: 'shield' }] });
b.send({ type: 'lock', round: 2, x: 2, shot: { weaponId: 'tri', angle: 120, power: 60 }, items: [] });
const v2 = await a.until((m) => m.type === 'volley' && m.round === 2);
check(v2.entries.length === 2 && v2.entries[1].shot.weaponId === 'tri', 'immediate volley when all locked');
// B leaves mid-volley -> left notice, A alone continues
b.ws.close();
const left = await a.until((m) => m.type === 'left');
check(left.id !== wa.id, 'left broadcast');
a.send({ type: 'done', round: 2, over: true });
const post = await a.until((m) => m.type === 'post');
check(!!post, 'over -> post phase');
a.send({ type: 'lobby' });
const l3 = await a.until((m) => m.type === 'lobby' && m.phase === 'lobby');
check(l3.players.length === 2 && l3.players.every((p) => p.connected), 'back to lobby drops disconnected players');
a.ws.close();
await new Promise((r) => setTimeout(r, 400));
const st = await (await fetch(`${base}/room/${code}/state`)).json();
check(st.phase === 'empty', `room resets when empty (got ${st.phase})`);
console.log(fails.length ? `${fails.length} failures` : 'relay protocol: all checks passed');
process.exit(fails.length ? 1 : 0);
