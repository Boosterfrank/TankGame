// In-game HUD (DOM) modeled on a classic artillery-game bottom bar.
import { el, roman } from '../util.js';
import { PHYS } from '../config.js';
import { iconURL } from '../icons.js';
import { getWeapon, FAMILY_BY_ID } from '../weapons.js';
import { ITEMS, ITEM_TYPES, TIER_NAMES, itemCount } from '../items.js';
import { drawTankSprite } from '../tanksprite.js';

export class HUD {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('hud');
    this.overlay = document.getElementById('overlay');
    this.last = {};
    this.page = 0;
    this.overlayMode = null; // 'weapons' | 'items' | null
    this.build();
  }

  build() {
    const h = this.el;
    h.innerHTML = `
      <div class="hud-panel hud-profile">
        <div class="bar armor"><div class="fill"></div><span class="label">0 / 50 Armor</span></div>
        <div class="bar hp"><div class="fill"></div><span class="label">100 / 100 HP</span></div>
        <div class="profile-bottom"><canvas class="tank-icon" width="92" height="52"></canvas><div class="profile-right"><span class="xp">+0 XP</span><span class="balance"></span></div></div>
      </div>
      <div class="hud-panel hud-fuel">
        <canvas class="gauge" width="140" height="96"></canvas>
        <div class="fuel-num">500</div>
        <div class="fuel-label">FUEL</div>
        <div class="move-btns"><button class="mv" data-dir="-1" title="Drive left (A)">&#9664;</button><button class="mv" data-dir="1" title="Drive right (D)">&#9654;</button></div>
      </div>
      <button class="hud-panel hud-items" title="Items (E)"><span>ITEMS</span><small class="item-count"></small></button>
      <div class="hud-panel hud-weapons" title="Weapons (W / Tab)">
        <div class="wep-header">WEAPONS</div>
        <div class="wep-row">
          <img class="wep-icon" alt="">
          <div class="wep-main"><div class="wep-pips"></div><div class="wep-name">Shot</div></div>
          <div class="wep-ammo">&infin;</div>
        </div>
      </div>
      <button class="hud-panel hud-fire" title="Fire (Space)">FIRE</button>
      <div class="hud-panel hud-mode">
        <div class="mode-top"><div><div class="mode-name">DEATHMATCH</div><div class="mode-desc">Destroy your opponents</div></div><div class="mode-skull"></div></div>
        <div class="mode-hint"></div>
      </div>
      <button class="hud-panel hud-leave">LEAVE<small>GAME</small></button>`;
    this.q = (s) => h.querySelector(s);
    this.q('.hud-fire').addEventListener('click', () => this.app.fire());
    this.q('.hud-leave').addEventListener('click', () => this.app.confirmLeave());
    this.q('.hud-weapons').addEventListener('click', () => this.toggleOverlay('weapons'));
    this.q('.hud-items').addEventListener('click', () => this.toggleOverlay('items'));
    for (const b of h.querySelectorAll('.mv')) {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.app.input.moveBtn = +b.dataset.dir; });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { this.app.input.moveBtn = 0; });
    }
    this.drawTankIcon();
    this.mode = el('div.mode-skull-icon');
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.closeOverlay(); });
  }

  drawTankIcon(color = '#4cff5e') {
    const c = this.q('.tank-icon'), x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    drawTankSprite(x, { x: 46, y: 50, color, angle: 30, scale: 1.45 });
  }

  show() {
    this.el.classList.remove('hidden'); this.last = {};
    this.el.style.animation = 'none'; void this.el.offsetWidth; this.el.style.animation = '';
  }
  hide() { this.el.classList.add('hidden'); this.closeOverlay(); }

  set(key, value, fn) { if (this.last[key] !== value) { this.last[key] = value; fn(value); } }

  update(game) {
    const cur = game.current;
    const t = cur || game.viewer;
    if (!t) return;
    const maxArmor = Math.max(PHYS.maxArmor, t.armor);
    this.set('armor', `${Math.round(t.armor)}/${maxArmor}`, () => {
      this.q('.armor .label').textContent = `${Math.round(t.armor)} / ${maxArmor} Armor`;
      this.q('.armor .fill').style.width = `${(t.armor / maxArmor) * 100}%`;
    });
    this.set('hp', `${Math.round(t.hp)}/${t.maxHp}`, () => {
      this.q('.hp .label').textContent = `${Math.round(t.hp)} / ${t.maxHp} HP`;
      this.q('.hp .fill').style.width = `${(t.hp / t.maxHp) * 100}%`;
    });
    this.set('xp', Math.round(t.xp), (v) => { this.q('.xp').textContent = `+${v} XP`; });
    this.set('fuel', `${Math.round(t.fuel)}/${t.maxFuel}`, (v) => { const [f, m] = v.split('/'); this.q('.fuel-num').textContent = f; this.drawGauge(+f / +m); });
    const w = game.currentWeapon(t) || getWeapon('shot');
    const ammo = t.ammo(w.id);
    this.set('wep', `${w.id}|${w.tier}|${ammo}`, () => {
      this.q('.wep-icon').src = iconURL(w.icon, w.color, 44);
      this.q('.wep-name').innerHTML = `${w.name}${w.tier > 1 ? ` <span class="tier">${roman(w.tier)}</span>` : ''}`;
      this.q('.wep-ammo').innerHTML = ammo === Infinity ? '&infin;' : String(ammo);
      const pips = this.q('.wep-pips');
      pips.innerHTML = '';
      const n = ammo === Infinity ? 0 : Math.min(ammo, 6);
      for (let i = 0; i < n; i++) pips.append(el('i'));
    });
    const items = itemCount(t);
    this.set('items', items, (v) => { this.q('.item-count').textContent = v ? `${v} left` : 'none left'; });
    let fireState, fireText;
    if (game.phase === 'fire') { fireState = 'busy'; fireText = 'INCOMING'; }
    else if (game.phase === 'move') {
      if (!cur) { fireState = 'busy'; fireText = 'SPECTATING'; }
      else if (cur.moved) { fireState = 'locked'; fireText = game.online ? `PARKED · ${Math.ceil(game.moveTimer)}` : 'PARKED'; }
      else { fireState = 'ready'; fireText = 'DONE MOVING'; }
    }
    else if (game.phase !== 'aim') { fireState = 'busy'; fireText = game.phase === 'over' ? 'GAME OVER' : 'WAIT'; }
    else if (!cur) { fireState = 'busy'; fireText = 'SPECTATING'; }
    else if (cur.locked) { fireState = 'locked'; fireText = game.online && game.lockInfo ? `LOCKED IN ${game.lockInfo.count}/${game.lockInfo.needed}` : 'LOCKED IN'; }
    else { fireState = 'ready'; fireText = 'FIRE'; }
    if (game.phase === 'waiting') { fireState = 'busy'; fireText = 'SYNCING'; }
    this.set('fire', fireState + fireText, () => { const b = this.q('.hud-fire'); b.dataset.state = fireState; b.textContent = fireText; b.classList.toggle('long', fireText.length > 8); });
    this.set('mode', game.settings.mode, (m) => {
      this.q('.mode-name').textContent = m === 'team' ? 'TEAM BATTLE' : 'DEATHMATCH';
      this.q('.mode-desc').textContent = m === 'team' ? 'Eliminate the other teams' : 'Destroy your opponents';
    });
    this.set('urgent', !!(cur && !cur.locked && game.phase === 'aim' && game.settings.turnTime > 0 && game.turnTimer < 6), (v) => { this.q('.hud-fire').classList.toggle('urgent', v); });
    this.set('nodrive', game.phase === 'move' ? (cur?.moved ? 'parked' : 'drive') : game.moveTime > 0 ? 'nodrive' : 'drive', (v) => { this.el.classList.toggle('no-drive', v !== 'drive'); });
    this.set('balance', Math.round((game.balanceFor(t) - 1) * 100), (v) => { this.q('.balance').textContent = v ? `BALANCE ${v > 0 ? '+' : ''}${v}% DMG` : ''; });
    const hintKey = `${game.online ? 'online' : 'local'}:${game.phase === 'move' ? 'move' : game.moveTime > 0 ? 'aim' : 'both'}`;
    this.set('hint', hintKey, (v) => {
      const [net, ph] = v.split(':');
      const chat = net === 'online' ? '<b>ENTER</b>, <b>T</b> OR <b>/</b> TO CHAT<br>' : '';
      const body = ph === 'move' ? '<b>A D</b> DRIVE &nbsp; <b>SPACE</b> DONE MOVING' : ph === 'aim' ? '<b>&larr; &rarr;</b> AIM &nbsp; <b>&uarr; &darr;</b> POWER &nbsp; <b>SPACE</b> FIRE' : '<b>&larr; &rarr;</b> AIM &nbsp; <b>&uarr; &darr;</b> POWER &nbsp; <b>A D</b> DRIVE &nbsp; <b>SPACE</b> FIRE';
      this.q('.mode-hint').innerHTML = chat + body;
    });
    this.set('canAct', !!(cur && !cur.locked && game.phase === 'aim'), (v) => { this.el.classList.toggle('inactive', !v); if (!v) this.closeOverlay(); });
    if (this.overlayMode === 'weapons' && this.overlayTank !== t) this.renderWeapons(game, t);
  }

  drawGauge(frac) {
    const c = this.q('.gauge'), x = c.getContext('2d');
    const W = c.width, H = c.height;
    x.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H - 14, r = 56;
    x.lineWidth = 8; x.lineCap = 'butt';
    x.strokeStyle = '#2a323c';
    x.beginPath(); x.arc(cx, cy, r, Math.PI, Math.PI * 2); x.stroke();
    const g = x.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, '#d7322f'); g.addColorStop(0.3, '#ffb300'); g.addColorStop(1, '#43d14a');
    x.strokeStyle = g;
    x.beginPath(); x.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * Math.max(0.001, frac)); x.stroke();
    x.strokeStyle = '#5a6a7c'; x.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r0 = i % 5 === 0 ? r - 12 : r - 8;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5)); x.stroke();
    }
    const na = Math.PI + Math.PI * frac;
    x.strokeStyle = '#ff5252'; x.lineWidth = 3; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(na) * (r - 2), cy + Math.sin(na) * (r - 2)); x.stroke();
    x.fillStyle = '#e8eef4'; x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#90a4ae'; x.font = '700 13px Rajdhani, sans-serif';
    x.textAlign = 'left'; x.fillText('E', cx - r - 2, cy + 14);
    x.textAlign = 'right'; x.fillText('F', cx + r + 2, cy + 14);
  }

  toggleOverlay(mode) {
    if (this.overlayMode === mode) this.closeOverlay(); else this.openOverlay(mode);
  }

  openOverlay(mode) {
    const game = this.app.game;
    const t = game?.current;
    if (!game || !t || t.locked || game.phase !== 'aim') return;
    this.overlayMode = mode;
    this.query = '';
    this.overlay.classList.remove('hidden');
    this.el.classList.toggle('wep-open', mode === 'weapons');
    this.el.classList.toggle('items-open', mode === 'items');
    if (mode === 'weapons') { this.renderWeapons(game, t); this.overlay.querySelector('.wsearch')?.focus(); } else this.renderItems(game, t);
    this.app.audio.play('click');
  }

  closeOverlay() {
    this.overlayMode = null; this.overlayTank = null;
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
    this.el.classList.remove('wep-open', 'items-open');
  }

  renderWeapons(game, t) {
    this.overlayTank = t;
    const q = (this.query || '').toLowerCase();
    // Weapons with no ammo left drop out of the grid (crates and ammo items bring them back).
    const ids = [...t.arsenal.keys()].filter((id) => t.ammo(id) > 0).filter((id) => !q || FAMILY_BY_ID[id].name.toLowerCase().includes(q)).sort((a, b) => FAMILY_BY_ID[a].name.localeCompare(FAMILY_BY_ID[b].name));
    const perPage = 63;
    const pages = Math.max(1, Math.ceil(ids.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    const slice = ids.slice(this.page * perPage, (this.page + 1) * perPage);
    const grid = el('div.wgrid');
    slice.forEach((id, i) => {
      const w = getWeapon(id, t.tier(id));
      const ammo = t.ammo(id);
      const tile = el('button.wtile', { class: `wtile${id === t.weaponId ? ' selected' : ''}${ammo <= 0 ? ' empty' : ''}`, title: w.fam.desc, style: { '--i': i } }, [
        el('img', { src: iconURL(w.icon, w.color, 40), alt: '' }),
        el('span.wname', { text: w.name }),
        el('span.wtier', { text: roman(w.tier) }),
        el('span.wammo', { text: ammo === Infinity ? '∞' : ammo }),
      ]);
      tile.addEventListener('click', () => { if (ammo > 0) { game.selectWeapon(id); this.closeOverlay(); } });
      grid.append(tile);
    });
    this.overlay.innerHTML = '';
    const prev = el('button.pager.prev', { html: '&#9664;', disabled: this.page === 0, onclick: () => { this.page--; this.renderWeapons(game, t); } });
    const next = el('button.pager.next', { html: '&#9654;', disabled: this.page >= pages - 1, onclick: () => { this.page++; this.renderWeapons(game, t); } });
    const search = el('input.wsearch', { type: 'search', placeholder: 'Search weapons…', value: this.query || '', spellcheck: false, autocomplete: 'off' });
    search.addEventListener('input', () => {
      this.query = search.value;
      this.page = 0;
      this.renderWeapons(game, t);
      const n = this.overlay.querySelector('.wsearch');
      if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    });
    search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { if (search.value) { this.query = ''; this.renderWeapons(game, t); this.overlay.querySelector('.wsearch')?.focus(); } else this.closeOverlay(); }
      if (e.key === 'Enter') { const first = slice.find((id) => t.ammo(id) > 0); if (first) { game.selectWeapon(first); this.closeOverlay(); } }
    });
    const head = el('div.ov-head', {}, [el('span', { text: `WEAPONS` }), search, el('small', { text: `${ids.length} weapons with ammo · supply drops add more · page ${this.page + 1}/${pages}` })]);
    if (!slice.length) grid.append(el('div.muted.room-empty', { text: q ? `No weapons with ammo match "${this.query}"` : 'Out of ammo for everything but Shot' }));
    this.overlay.append(head, prev, grid, next);
  }

  renderItems(game, t) {
    this.overlay.innerHTML = '';
    const head = el('div.ov-head', {}, [el('span', { text: 'ITEMS' }), el('small', { text: 'Using an item does not end your turn' })]);
    const grid = el('div.igrid');
    // One column per item type; each tier you own gets its own tile. Empty types show a grey card.
    for (const g of ITEM_TYPES) {
      const owned = ITEMS.filter((it) => it.type === g.type && t.items[it.id] > 0);
      const col = el('div.icol');
      if (!owned.length) {
        col.append(el('div.itile.empty', {}, [el('img', { src: iconURL(g.icon, '#546e7a', 56), alt: '' }), el('div.iname', { text: g.tiers[0].name }), el('div.idesc', { text: 'None left. Supply crates may hold more.' })]));
      }
      for (const it of owned) {
        const n = t.items[it.id];
        const tile = el('button.itile', { class: `itile tier${it.tier}` }, [
          el('div.itier', { text: TIER_NAMES[it.tier - 1] }),
          el('img', { src: iconURL(it.icon, it.color, 56), alt: '' }),
          el('div.iname', { text: it.name }),
          el('div.idesc', { text: it.desc }),
          el('div.icount', { text: `x${n}` }),
        ]);
        tile.addEventListener('click', () => { if (game.useItem(it.id)) { this.closeOverlay(); } });
        col.append(tile);
      }
      grid.append(col);
    }
    this.overlay.append(head, grid);
  }
}
