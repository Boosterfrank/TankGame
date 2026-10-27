// Online play screens: room browser and the server-driven lobby with chat.
import { el, escapeHtml, RNG, roman } from '../util.js';
import { titleName } from '../cosmetics.js';
import { GAME_NAME, WORLD_W, WORLD_H, BOT_NAMES } from '../config.js';
import { MAP_STYLES, generateHeights } from '../terrain-gen.js';
import { Terrain } from '../terrain.js';
import { OnlineSession } from '../online.js';
import { profileBar, brandEl, SETTING_DEFS, drawMiniTank } from './screens.js';

export function onlineScreen(app) {
  const s = el('div.screen.online-screen');
  const server = app.serverUrl();
  const top = el('div.topbar', {}, [brandEl(app), profileBar(app)]);
  if (!server) {
    s.append(top, el('div.online-body.centered', {}, [
      el('div.card.online-setup', {}, [
        el('h3', { text: 'ONLINE PLAY' }),
        el('p', { text: 'No relay server is configured. Deploy the Cloudflare Worker in the worker/ folder (see README), then paste its URL into Settings.' }),
        el('div.modal-buttons', {}, [
          el('button.btn.btn-primary', { text: 'OPEN SETTINGS', onclick: () => app.show('settings') }),
          el('button.btn', { text: 'BACK', onclick: () => app.show('menu') }),
        ]),
      ]),
    ]));
    return s;
  }
  let busy = false;
  const status = el('div.online-status', { text: `Server: ${server}` });
  const list = el('div.room-list');
  const refresh = async () => {
    if (!s.isConnected) return;
    try {
      const rooms = await new OnlineSession(app, server).listRooms();
      list.innerHTML = '';
      if (!rooms.length) list.append(el('div.muted.room-empty', { text: 'No public rooms right now. Create one!' }));
      for (const r of rooms) {
        const map = MAP_STYLES.find((m) => m.id === r.settings?.map)?.name || 'Random Map';
        list.append(el('div.room-row', {}, [
          el('div.room-code', { text: r.code }),
          el('div.room-info', {}, [el('b', { text: `${r.hostName || 'Someone'}'s Game` }), el('small', { text: `${r.settings?.mode === 'team' ? 'Team Battle' : 'Deathmatch'} · ${map} · ${r.settings?.hp} HP` })]),
          el('div.room-players', { text: `${r.players} / ${r.max}` }),
          el('button.btn.btn-small.btn-primary', { text: 'JOIN', onclick: () => join(r.code) }),
        ]));
      }
      status.textContent = `Server: ${server} · ${rooms.length} public room${rooms.length === 1 ? '' : 's'}`;
    } catch (e) {
      status.textContent = `Cannot reach ${server} (${e.message})`;
    }
  };
  const join = async (code) => {
    if (busy) return;
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) { app.toast('Enter a room code like AB12C', '#ff5252'); return; }
    busy = true; status.textContent = `Joining ${code}…`;
    const session = new OnlineSession(app, server);
    try {
      await session.connect(code);
      app.session = session;
      app.show('onlineLobby');
    } catch (e) { app.toast(e.message, '#ff5252'); status.textContent = `Could not join ${code}: ${e.message}`; }
    busy = false;
  };
  const create = async () => {
    if (busy) return;
    busy = true; status.textContent = 'Creating room…';
    const session = new OnlineSession(app, server);
    try {
      const code = await session.createRoom();
      await session.connect(code);
      if (!pub.checked) session.setPublic(false);
      app.session = session;
      app.show('onlineLobby');
    } catch (e) { app.toast(e.message, '#ff5252'); status.textContent = `Could not create a room: ${e.message}`; }
    busy = false;
  };
  const codeInput = el('input.code-input', { type: 'text', placeholder: 'ROOM CODE', maxlength: 8, spellcheck: false });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(codeInput.value); });
  const pub = el('input', { type: 'checkbox', checked: true });
  s.append(top, el('div.online-body', {}, [
    el('div.online-left', {}, [
      el('div.armory-head', {}, [el('h2', { text: 'PUBLIC ROOMS' }), el('button.mini', { text: '⟳ REFRESH', onclick: refresh })]),
      list, status,
    ]),
    el('div.online-right', {}, [
      el('div.card', {}, [
        el('h3', { text: 'CREATE A ROOM' }),
        el('label.srow', {}, [el('span', { text: 'Listed publicly' }), pub]),
        el('button.btn.btn-primary.wide', { text: 'CREATE ROOM', onclick: create }),
      ]),
      el('div.card', {}, [
        el('h3', { text: 'JOIN BY CODE' }),
        codeInput,
        el('button.btn.wide', { text: 'JOIN', onclick: () => join(codeInput.value) }),
      ]),
      el('button.btn.wide', { text: 'BACK', onclick: () => app.show('menu') }),
    ]),
  ]));
  setTimeout(refresh, 0); // runs once the screen is attached
  const timer = setInterval(() => { if (s.isConnected) refresh(); else clearInterval(timer); }, 5000);
  return s;
}

export function onlineLobbyScreen(app) {
  const session = app.session;
  const s = el('div.screen.lobby-screen.online-lobby');
  if (!session || session.closed) { app.show('online'); return s; }
  let chatDraft = '';
  const render = () => {
    const L = session.lobby;
    if (!L) return;
    const draftEl = s.querySelector('.chat-input');
    if (draftEl) chatDraft = draftEl.value;
    s.innerHTML = '';
    const isHost = session.isHost;
    const admin = isHost || session.isDev; // relay-verified developers get host powers
    const dev = session.isDev;
    const teamMode = L.settings.mode === 'team';
    const list = el('div.player-list');
    L.players.forEach((pl, i) => {
      const me = pl.id === session.myId;
      const row = el('div.player-row', { class: `player-row${pl.bot ? ' bot' : ' human'}${me ? ' me' : ''}`, style: { '--i': i } });
      row.append(el('div.pl-level', {}, [el('small', { text: pl.bot ? 'BOT' : pl.id === L.hostId ? 'HOST' : 'LVL' }), el('b', { text: pl.level })]));
      row.append(el('div.pl-avatar', { text: pl.name.slice(0, 2).toUpperCase() }));
      const title = titleName(pl.cosmetics?.title);
      const nameCell = el('div.pl-name', {}, [el('div.pl-namewrap', {}, [title ? el('i.pl-title', { text: title }) : null, el('b', { text: pl.name })]), el('small', { text: me ? 'You' : pl.id === L.hostId ? 'Host' : pl.connected === false ? 'Disconnected' : '' }), pl.dev ? el('span.dev-chip', { text: 'DEV' }) : null]);
      if (dev) { // developer controls: levels, gears and XP for anyone in the room
        const mini = (text, fn, title2) => el('button.mini', { text, title: title2 || '', onclick: fn });
        nameCell.append(el('div.pl-dev', {}, [
          mini('+1', () => session.grant(pl.id, { levels: 1 }), '+1 level'), mini('+5', () => session.grant(pl.id, { levels: 5 }), '+5 levels'), mini('+10', () => session.grant(pl.id, { levels: 10 }), '+10 levels'), mini('−5', () => session.grant(pl.id, { levels: -5 }), '−5 levels'),
          mini('LVL…', () => askNumber(app, `Set ${pl.name}'s level`, pl.level, 1, pl.bot ? 60 : 99, (v) => session.grant(pl.id, { level: v })), 'Set an exact level'),
          pl.bot ? null : mini('+100⚙', () => session.grant(pl.id, { gears: 100 }), '+100 gears'),
          pl.bot ? null : mini('+1k⚙', () => session.grant(pl.id, { gears: 1000 }), '+1000 gears'),
          pl.bot ? null : mini('+1k XP', () => session.grant(pl.id, { xp: 1000 }), '+1000 XP'),
        ]));
      }
      row.append(nameCell);
      if (pl.bot && admin) {
        row.append(el('div.pl-botlvl', {}, [
          el('button.mini', { text: '−', onclick: () => session.setBotLevel(pl.id, Math.max(1, pl.level - 5)) }),
          el('span', { text: `Lvl ${pl.level}` }),
          el('button.mini', { text: '+', onclick: () => session.setBotLevel(pl.id, Math.min(60, pl.level + 5)) }),
        ]));
      } else row.append(el('div.pl-botlvl.ghost', { text: pl.bot ? `Lvl ${pl.level}` : '' }));
      // Everyone picks their own team; the host (or a developer) can place anyone, bots included.
      // Teams only matter in Team Battle, but they can be arranged ahead of switching the mode.
      const canTeam = me || admin;
      const tid = me ? null : pl.id;
      row.append(el('div.pl-team', { class: `pl-team${teamMode ? '' : ' off'}`, title: teamMode ? 'Team' : 'Teams apply in Team Battle (Mode setting)' }, [
        el('small', { text: 'TEAM' }),
        el('button.mini', { text: '◀', disabled: !canTeam, onclick: () => session.setTeam(((pl.team - 2 + 4) % 4) + 1, tid) }),
        el('b', { text: pl.team }),
        el('button.mini', { text: '▶', disabled: !canTeam, onclick: () => session.setTeam((pl.team % 4) + 1, tid) }),
      ]));
      const tankPrev = el('canvas.pl-tank', { width: 70, height: 40 });
      drawMiniTank(tankPrev, teamMode ? ['#4cff5e', '#4fc3ff', '#ff4b4b', '#ffd740'][pl.team - 1] : (me ? '#4cff5e' : '#ff4b4b'), 1.1, pl.cosmetics);
      row.append(tankPrev);
      const ready = pl.bot || pl.ready;
      const readyEl = el('button.pl-ready', { class: `pl-ready${ready ? '' : ' not'}`, html: ready ? '&#10004;' : 'Ready?', disabled: !me, title: me ? 'Toggle ready' : '' });
      if (me) readyEl.addEventListener('click', () => session.setReady(!pl.ready));
      row.append(readyEl);
      if (admin && !me) row.append(el('button.kick', { text: 'KICK', onclick: () => session.kick(pl.id) }));
      else row.append(el('div.kick.ghost'));
      list.append(row);
    });
    const addRow = el('div.add-row');
    if (admin && L.players.length < 8) {
      addRow.append(el('button.btn.btn-small', { text: '+ ADD BOT', onclick: () => session.addBot(Math.max(1, app.profile.level + Math.floor(Math.random() * 8) - 2), BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]) }));
    } else if (!admin) addRow.append(el('span.muted', { text: 'Only the host can change settings and add bots.' }));
    // chat
    const chatLog = el('div.chat-log');
    for (const c of session.chat.slice(-14)) chatLog.append(el('div.chat-line', { class: `chat-line${c.name ? '' : ' system'}`, html: c.name ? `<b>${escapeHtml(c.name)}</b> ${escapeHtml(c.text)}` : escapeHtml(c.text) }));
    const chatInput = el('input.chat-input', { type: 'text', placeholder: 'Type a message and press Enter', maxlength: 160, value: chatDraft });
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { session.sendChat(chatInput.value); chatInput.value = ''; } e.stopPropagation(); });
    // right column
    const preview = el('canvas.map-preview', { width: 420, height: 180 });
    const { heights, style } = generateHeights(L.settings.map, 7, WORLD_W, WORLD_H);
    Terrain.drawPreview(preview.getContext('2d'), heights, WORLD_W, WORLD_H, 420, 180, []);
    const mapName = MAP_STYLES.find((m) => m.id === L.settings.map);
    const cycleMap = (d) => { const idx = MAP_STYLES.findIndex((m) => m.id === L.settings.map); session.setSettings({ map: MAP_STYLES[(idx + d + MAP_STYLES.length) % MAP_STYLES.length].id }); };
    const mapCard = el('div.card.map-card', {}, [
      el('div.map-head', {}, [
        el('button.mini', { text: '◀', disabled: !admin, onclick: () => cycleMap(-1) }),
        el('b', { text: mapName?.name || 'Random Map' }),
        el('button.mini', { text: '▶', disabled: !admin, onclick: () => cycleMap(1) }),
      ]),
      preview,
      el('small.map-desc', { text: L.settings.map === 'random' ? 'A random style is rolled when the game starts.' : mapName?.desc }),
    ]);
    const table = el('div.settings-table');
    table.append(el('div.srow', {}, [el('span', { text: 'Room code' }), el('b.room-code-big', { text: L.code })]));
    table.append(el('div.srow', {}, [el('span', { text: 'Players' }), el('b', { text: `${L.players.length} / 8` })]));
    for (const def of SETTING_DEFS) {
      const idx = Math.max(0, def.values.findIndex((v) => v[0] === L.settings[def.key]));
      const row = el('div.srow', { class: `srow${admin ? ' clickable' : ''}` }, [el('span', { text: def.label }), el('b', { text: def.values[idx][1] })]);
      if (admin) row.addEventListener('click', () => session.setSettings({ [def.key]: def.values[(idx + 1) % def.values.length][0] }));
      table.append(row);
    }
    if (admin) {
      const row = el('div.srow.clickable', {}, [el('span', { text: 'Listed publicly' }), el('b', { text: L.isPublic ? 'Yes' : 'No' })]);
      row.addEventListener('click', () => session.setPublic(!L.isPublic));
      table.append(row);
    }
    const myPl = L.players.find((p) => p.id === session.myId);
    const notReady = L.players.filter((p) => !p.bot && !p.ready).length;
    const status = session.startDeadline != null
      ? el('div.start-count', { text: `STARTING IN ${Math.max(0, Math.ceil((session.startDeadline - performance.now()) / 1000))}` })
      : el('div.hotseat-note', { text: L.players.length < 2 ? 'Need at least two tanks. Add a bot or wait for players.' : session.phase === 'post' ? 'Game over. Ready up for another round.' : myPl?.ready ? `Waiting for ${notReady} player${notReady === 1 ? '' : 's'} to ready up…` : 'Everyone readies up and the battle starts by itself.' });
    const right = el('div.lobby-right', {}, [mapCard, table, status,
      el('button', { class: `btn btn-big wide ${myPl?.ready ? '' : 'btn-primary'}`, text: myPl?.ready ? 'UNREADY' : 'READY', onclick: () => session.setReady(!myPl?.ready) }),
      el('button.btn.wide', { text: 'LEAVE ROOM', onclick: () => { session.leave(); app.session = null; app.show('online'); } }),
    ]);
    s.append(
      el('div.topbar', {}, [brandEl(app), profileBar(app)]),
      el('div.lobby-body', {}, [
        el('div.lobby-left', {}, [
          el('h2.lobby-title', { html: `${escapeHtml(L.players.find((p) => p.id === L.hostId)?.name || 'Online')}'s Game <span class="code-chip">ROOM ${escapeHtml(L.code)}</span><button class="mini copy-code">COPY CODE</button>` }),
          list, addRow,
          el('div.card.chat-card', {}, [el('h3', { text: 'CHAT' }), chatLog, chatInput]),
        ]),
        right,
      ]),
    );
    s.querySelector('.copy-code')?.addEventListener('click', () => { navigator.clipboard?.writeText(L.code).then(() => app.toast(`Room code ${L.code} copied`)); });
    chatLog.scrollTop = chatLog.scrollHeight;
  };
  const onLobby = () => { if (s.isConnected) render(); };
  const onChat = () => { if (s.isConnected) { const log = s.querySelector('.chat-log'); if (log) { log.innerHTML = ''; for (const c of session.chat.slice(-14)) log.append(el('div.chat-line', { class: `chat-line${c.name ? '' : ' system'}`, html: c.name ? `<b>${escapeHtml(c.name)}</b> ${escapeHtml(c.text)}` : escapeHtml(c.text) })); log.scrollTop = log.scrollHeight; } } };
  const onClose = () => { if (s.isConnected) { app.toast('Disconnected from the room', '#ff5252'); app.session = null; app.show('online'); } };
  session.on('lobby', onLobby).on('chat', onChat).on('close', onClose).on('host', onLobby).on('post', onLobby);
  const tick = setInterval(() => {
    if (!s.isConnected) { clearInterval(tick); return; }
    const n = s.querySelector('.start-count');
    if (n && session.startDeadline != null) n.textContent = `STARTING IN ${Math.max(0, Math.ceil((session.startDeadline - performance.now()) / 1000))}`;
  }, 250);
  render();
  return s;
}

// Small numeric prompt in the app modal (used by developer controls).
function askNumber(app, title, value, min, max, fn) {
  const input = el('input', { type: 'number', value, min, max, style: { fontSize: '28px', width: '160px', textAlign: 'center' } });
  const go = () => { const v = Math.max(min, Math.min(max, Math.round(+input.value || min))); app.closeModal(); fn(v); };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') app.closeModal(); });
  app.modal.innerHTML = '';
  app.modal.classList.remove('hidden');
  app.modal.append(el('div.modal-box', {}, [el('h2', { text: title.toUpperCase() }), el('p.muted', { text: `${min} – ${max}` }), input, el('div.modal-buttons', {}, [el('button.btn.btn-primary', { text: 'APPLY', onclick: go }), el('button.btn', { text: 'CANCEL', onclick: () => app.closeModal() })])]));
  setTimeout(() => { input.focus(); input.select(); }, 30);
}
