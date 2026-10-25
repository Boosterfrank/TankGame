// Gear shop: paint, accessories, trails and titles with live tank previews.
import { el, fmt } from '../util.js';
import { COSMETICS, SLOTS, TRAIL_STYLES, cosmeticsOf, ownsCosmetic, titleName } from '../cosmetics.js';
import { buyCosmetic, equipCosmetic } from '../profile.js';
import { drawTankSprite } from '../tanksprite.js';
import { profileBar, brandEl } from './screens.js';

function drawTrailPreview(x, w, h, id) {
  const style = TRAIL_STYLES[id];
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const px = w * 0.22 + t * w * 0.7, py = h * 0.75 - Math.sin(t * Math.PI) * h * 0.55;
    let color = 'rgba(255,255,255,0.8)';
    if (style?.rainbow) color = `hsl(${i * 33}, 100%, 65%)`;
    else if (style?.trail === 'fire') color = i % 2 ? style.color : '#ffb74d';
    else if (style) color = style.color;
    x.fillStyle = color;
    x.beginPath(); x.arc(px, py, style?.trail === 'smoke' ? 4 + t * 3 : 2.5 + (style ? 1 : 0), 0, Math.PI * 2); x.fill();
  }
}

export function drawCosmeticPreview(canvas, slot, id, skin, name) {
  const x = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  x.clearRect(0, 0, w, h);
  if (slot === 'trail') {
    drawTankSprite(x, { x: w * 0.16, y: h * 0.8, color: '#4cff5e', angle: 50, scale: 1 });
    drawTrailPreview(x, w, h, id);
    return;
  }
  if (slot === 'title') {
    x.textAlign = 'center';
    const t = titleName(id);
    if (t) { x.font = 'italic 600 15px Rajdhani, sans-serif'; x.fillStyle = '#ffd740'; x.fillText(t.toUpperCase(), w / 2, h * 0.34); }
    x.font = '700 22px Rajdhani, sans-serif'; x.fillStyle = '#fff';
    x.fillText(name, w / 2, h * 0.58);
    x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(w / 2 - 25, h * 0.64, 50, 6);
    x.fillStyle = '#43d14a'; x.fillRect(w / 2 - 24, h * 0.64 + 1, 48, 4);
    return;
  }
  const s = { ...skin, [slot]: id };
  drawTankSprite(x, { x: w / 2, y: h - 10, color: '#4cff5e', angle: 28, scale: Math.min(2.2, h / 42), skin: s });
}

export function shopScreen(app) {
  const p = app.profile;
  let slot = 'pattern';
  const s = el('div.screen.shop-screen');
  const render = () => {
    s.innerHTML = '';
    const skin = cosmeticsOf(p);
    const hero = el('canvas.shop-hero', { width: 420, height: 220 });
    drawTankSprite(hero.getContext('2d'), { x: 210, y: 200, color: '#4cff5e', angle: 30, scale: 4.2, skin });
    const title = titleName(skin.title);
    const heroCard = el('div.card.shop-hero-card', {}, [
      hero,
      el('div.shop-name', {}, [title ? el('small', { text: title.toUpperCase() }) : null, el('b', { text: p.name })]),
      el('div.shop-balance', { html: `<span>YOUR GEARS</span><b>${fmt(p.gears)}</b> <i class="gear"></i>` }),
      el('p.muted', { text: 'Earn gears by playing battles. Paint and accessories show for everyone, trails color your plain shells, titles sit above your name.' }),
    ]);
    const tabs = el('div.tabs', {}, SLOTS.map((sl) => el('button.tab', { class: `tab${slot === sl.id ? ' active' : ''}`, text: sl.name.toUpperCase(), onclick: () => { slot = sl.id; render(); } })));
    const grid = el('div.shop-grid');
    COSMETICS[slot].forEach((item, i) => {
      const owned = ownsCosmetic(p, slot, item.id);
      const equipped = skin[slot] === item.id;
      const cv = el('canvas', { width: 220, height: 110 });
      drawCosmeticPreview(cv, slot, item.id, skin, p.name);
      let action;
      if (equipped) action = el('div.shop-equipped', { text: 'EQUIPPED' });
      else if (owned) action = el('button.btn.btn-small', { text: 'EQUIP', onclick: () => { equipCosmetic(p, slot, item.id); app.audio.play('click'); render(); } });
      else action = el('button.btn.btn-small.btn-warn', { html: `BUY · ${item.price} <i class="gear"></i>`, disabled: p.gears < item.price, onclick: () => {
        if (buyCosmetic(p, slot, item.id)) { app.audio.play('levelup'); app.toast(`Bought ${item.name}`); render(); }
      } });
      grid.append(el('div.shop-card', { class: `shop-card${equipped ? ' equipped' : ''}${owned ? ' owned' : ''}`, style: { '--i': i } }, [
        cv, el('b', { text: item.name }), el('span.muted', { text: item.desc }),
        el('div.shop-actions', {}, [action, !owned && p.gears < item.price ? el('small.muted', { text: `${item.price - p.gears} more gears` }) : null]),
      ]));
    });
    s.append(
      el('div.topbar', {}, [brandEl(app), profileBar(app)]),
      el('div.shop-body', {}, [
        el('div.shop-left', {}, [heroCard, el('button.btn.wide', { text: 'BACK', onclick: () => app.show('menu') })]),
        el('div.shop-right', {}, [el('div.armory-head', {}, [el('h2', { text: 'SHOP' }), el('span.muted', { text: 'Cosmetics for gears' })]), tabs, grid]),
      ]),
    );
  };
  render();
  return s;
}
