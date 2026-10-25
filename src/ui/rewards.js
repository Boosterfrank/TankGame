// Post-battle rewards sequence: counters tick up, the XP bar fills live, level-ups flash,
// and unlocked weapons / mastery tiers slide in one by one. Click to skip ahead.
import { el, fmt, roman } from '../util.js';
import { xpForLevel } from '../profile.js';
import { FAMILY_BY_ID } from '../weapons.js';
import { iconURL } from '../icons.js';

export function rewardsScreen(app, results, summary, onDone) {
  const me = results.find((r) => r.tank.isProfile);
  const won = !!me?.winner;
  const totalXp = Math.round(summary.xp), gears = summary.gears;
  const L0 = summary.before, X0 = summary.beforeXp || 0;
  const cards = [
    ...summary.unlocks.map((id) => ({ kind: 'unlock', id })),
    ...summary.masteryUps.map((m) => ({ kind: 'mastery', id: m.id, tier: m.tier })),
  ];
  const xpCount = el('b.count', { text: '0' }), gearCount = el('b.count', { text: '0' });
  const lvlEl = el('b.lvl', { text: L0 });
  const fill = el('div.pb-xp-fill', { style: { width: `${(X0 / xpForLevel(L0)) * 100}%` } });
  const barText = el('span', { text: `${fmt(X0)} / ${fmt(xpForLevel(L0))} XP` });
  const levelUpEl = el('div.rw-levelup');
  const unlocks = el('div.rw-unlocks');
  const cont = el('button.btn.btn-primary.btn-big.rw-continue', { text: 'CONTINUE', style: { visibility: 'hidden' } });
  const flashEl = el('div.rw-flash');
  const s = el('div.screen.rewards-screen', {}, [
    flashEl,
    el('div.rw-inner', {}, [
      el('div', { class: `rw-kicker ${won ? 'win' : 'lose'}`, text: won ? 'VICTORY' : me?.alive ? 'DRAW' : 'DEFEATED' }),
      el('h1.rw-title', { text: 'BATTLE REWARDS' }),
      el('div.rw-counters', {}, [
        el('div.rw-counter', {}, [xpCount, el('small', { text: 'XP EARNED' })]),
        el('div.rw-counter.gears', {}, [gearCount, el('small', { html: 'GEARS <i class="gear"></i>' })]),
      ]),
      el('div.rw-levelbox', {}, [el('div.rw-level', {}, [el('small', { text: 'LEVEL' }), lvlEl]), el('div.pb-xp.big.rw-bar', {}, [fill, barText])]),
      levelUpEl,
      unlocks, cont,
      el('div.rw-skip', { text: 'click anywhere to skip' }),
    ]),
  ]);

  const COUNT_START = 0.7, COUNT_T = 2.4, GAP = 0.55;
  const cardsStart = COUNT_START + COUNT_T + 0.4;
  const events = cards.map((c, i) => ({ at: cardsStart + i * GAP, fn: () => addCard(c) }));
  const endAt = cardsStart + cards.length * GAP + 0.4;
  let t = 0, last = performance.now(), finished = false, lastLevel = L0, lastTick = 0, raf = 0;
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  function stateAt(frac) {
    let L = L0, x = X0 + totalXp * frac;
    while (L < 99 && x >= xpForLevel(L)) { x -= xpForLevel(L); L++; }
    return { L, x, need: xpForLevel(L) };
  }
  function pop(node) { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); }
  function levelUp(L) {
    levelUpEl.textContent = `LEVEL UP!  ${L - 1} → ${L}`;
    pop(levelUpEl); pop(lvlEl);
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
    app.audio.play('levelup');
  }
  function addCard(c) {
    const fam = FAMILY_BY_ID[c.id];
    if (!fam) return;
    unlocks.append(el('div.rw-card', {}, [
      el('small', { text: c.kind === 'unlock' ? 'NEW WEAPON UNLOCKED' : `MASTERY · TIER ${roman(c.tier)}` }),
      el('img', { src: iconURL(fam.icon, fam.color, 72), alt: '' }),
      el('b', { text: fam.name }),
      el('span', { text: fam.desc }),
    ]));
    app.audio.play('pickup');
    unlocks.scrollLeft = unlocks.scrollWidth;
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    const cf = Math.min(1, Math.max(0, (t - COUNT_START) / COUNT_T));
    const f = ease(cf);
    xpCount.textContent = `+${fmt(totalXp * f)}`;
    gearCount.textContent = `+${fmt(gears * f)}`;
    const st = stateAt(f);
    if (st.L !== lastLevel) { lastLevel = st.L; levelUp(st.L); }
    lvlEl.textContent = st.L;
    fill.style.width = `${(st.x / st.need) * 100}%`;
    barText.textContent = `${fmt(st.x)} / ${fmt(st.need)} XP`;
    if (cf > 0 && cf < 1 && t - lastTick > 0.08) { lastTick = t; app.audio.play('tick'); }
    while (events.length && events[0].at <= t) events.shift().fn();
    if (t >= endAt && !finished) { finished = true; cont.style.visibility = 'visible'; cont.classList.add('pop'); }
    if (s.isConnected) raf = requestAnimationFrame(frame);
  }
  s.addEventListener('click', (e) => { if (e.target === cont) return; if (!finished) t = Math.max(t, endAt); });
  cont.addEventListener('click', () => { cancelAnimationFrame(raf); onDone(); });
  raf = requestAnimationFrame(frame);
  return s;
}
