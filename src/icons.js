// Procedural weapon/item icons drawn with canvas primitives, so the game ships with no image assets.
// Icons are drawn white onto a colored tile, like a pictogram set.

const cache = new Map();

function circle(c, x, y, r, fill = true) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fill ? c.fill() : c.stroke(); }
function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function poly(c, pts, fill = true) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); fill ? c.fill() : c.stroke(); }
function star(c, x, y, r, n = 5, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}

// Draws the glyph for `key` into a unit box [0..1] scaled by s. Context is pre-styled white.
export function drawGlyph(c, key, s) {
  const u = (v) => v * s;
  c.lineWidth = u(0.09); c.lineCap = 'round'; c.lineJoin = 'round';
  switch (key) {
    case 'ball': circle(c, u(0.5), u(0.5), u(0.3)); break;
    case 'dot': circle(c, u(0.5), u(0.5), u(0.16)); break;
    case 'heavy': circle(c, u(0.5), u(0.52), u(0.36)); c.globalAlpha = 0.35; c.fillStyle = '#000'; circle(c, u(0.56), u(0.58), u(0.2)); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'balls3': [0.22, 0.5, 0.78].forEach((x) => circle(c, u(x), u(0.5), u(0.12))); break;
    case 'balls5': [0, 1, 2, 3, 4].forEach((i) => { const a = Math.PI + (i / 4) * Math.PI; circle(c, u(0.5 + Math.cos(a) * 0.32), u(0.62 + Math.sin(a) * 0.32), u(0.1)); }); break;
    case 'shower': circle(c, u(0.5), u(0.2), u(0.1)); [-0.3, -0.15, 0, 0.15, 0.3].forEach((dx, i) => circle(c, u(0.5 + dx), u(0.62 + Math.abs(dx) * 0.4), u(0.07))); break;
    case 'cluster': circle(c, u(0.5), u(0.6), u(0.16)); [[0.25, 0.3], [0.5, 0.2], [0.75, 0.3], [0.2, 0.62], [0.8, 0.62]].forEach((p) => circle(c, u(p[0]), u(p[1]), u(0.08))); break;
    case 'cluster10': for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) circle(c, u(0.25 + i * 0.25), u(0.3 + j * 0.22), u(0.07)); circle(c, u(0.5), u(0.82), u(0.06)); break;
    case 'grid': for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) circle(c, u(0.18 + i * 0.16), u(0.18 + j * 0.16), u(0.05)); break;
    case 'star': star(c, u(0.5), u(0.5), u(0.38)); break;
    case 'sparkle': star(c, u(0.5), u(0.5), u(0.4), 4, 0.3); break;
    case 'needle': line(c, u(0.2), u(0.8), u(0.8), u(0.2)); poly(c, [[u(0.84), u(0.16)], [u(0.62), u(0.22)], [u(0.78), u(0.38)]]); break;
    case 'needle2': c.lineWidth = u(0.07); line(c, u(0.15), u(0.72), u(0.8), u(0.25)); line(c, u(0.25), u(0.88), u(0.9), u(0.4)); break;
    case 'laser': c.lineWidth = u(0.14); line(c, u(0.12), u(0.5), u(0.88), u(0.5)); circle(c, u(0.18), u(0.5), u(0.12)); break;
    case 'laser2': c.lineWidth = u(0.1); line(c, u(0.12), u(0.38), u(0.88), u(0.38)); line(c, u(0.12), u(0.62), u(0.88), u(0.62)); break;
    case 'laser3': c.lineWidth = u(0.08); line(c, u(0.12), u(0.5), u(0.9), u(0.2)); line(c, u(0.12), u(0.5), u(0.9), u(0.5)); line(c, u(0.12), u(0.5), u(0.9), u(0.8)); break;
    case 'bounce': c.beginPath(); c.moveTo(u(0.1), u(0.75)); c.quadraticCurveTo(u(0.3), u(0.1), u(0.45), u(0.75)); c.quadraticCurveTo(u(0.6), u(0.35), u(0.72), u(0.75)); c.quadraticCurveTo(u(0.8), u(0.55), u(0.9), u(0.75)); c.stroke(); circle(c, u(0.9), u(0.75), u(0.08)); break;
    case 'roll': circle(c, u(0.62), u(0.55), u(0.22)); line(c, u(0.08), u(0.4), u(0.32), u(0.4)); line(c, u(0.12), u(0.56), u(0.3), u(0.56)); line(c, u(0.08), u(0.72), u(0.32), u(0.72)); break;
    case 'dig': c.lineWidth = u(0.11); line(c, u(0.5), u(0.12), u(0.5), u(0.6)); poly(c, [[u(0.3), u(0.5)], [u(0.7), u(0.5)], [u(0.5), u(0.78)]]); line(c, u(0.12), u(0.88), u(0.88), u(0.88)); break;
    case 'rain': [[0.25, 0.3], [0.55, 0.2], [0.78, 0.45], [0.4, 0.65], [0.65, 0.78]].forEach((p) => { c.beginPath(); c.moveTo(u(p[0]), u(p[1] - 0.12)); c.quadraticCurveTo(u(p[0] + 0.1), u(p[1] + 0.05), u(p[0]), u(p[1] + 0.08)); c.quadraticCurveTo(u(p[0] - 0.1), u(p[1] + 0.05), u(p[0]), u(p[1] - 0.12)); c.fill(); }); break;
    case 'bird': c.lineWidth = u(0.1); c.beginPath(); c.moveTo(u(0.1), u(0.45)); c.quadraticCurveTo(u(0.3), u(0.25), u(0.5), u(0.55)); c.quadraticCurveTo(u(0.7), u(0.25), u(0.9), u(0.45)); c.stroke(); break;
    case 'bird3': c.lineWidth = u(0.08); [0.35, 0.6].forEach((y, i) => { c.beginPath(); c.moveTo(u(0.1 + i * 0.1), u(y)); c.quadraticCurveTo(u(0.3), u(y - 0.2), u(0.5), u(y + 0.1)); c.quadraticCurveTo(u(0.7), u(y - 0.2), u(0.9 - i * 0.1), u(y)); c.stroke(); }); break;
    case 'missile': c.save(); c.translate(u(0.5), u(0.5)); c.rotate(-Math.PI / 4); c.fillRect(u(-0.1), u(-0.28), u(0.2), u(0.5)); poly(c, [[u(-0.1), u(-0.28)], [u(0.1), u(-0.28)], [0, u(-0.48)]]); poly(c, [[u(-0.1), u(0.1)], [u(-0.26), u(0.3)], [u(-0.1), u(0.22)]]); poly(c, [[u(0.1), u(0.1)], [u(0.26), u(0.3)], [u(0.1), u(0.22)]]); c.restore(); break;
    case 'jet': poly(c, [[u(0.15), u(0.3)], [u(0.85), u(0.5)], [u(0.15), u(0.7)], [u(0.3), u(0.5)]]); c.globalAlpha = 0.6; poly(c, [[u(0.05), u(0.42)], [u(0.2), u(0.5)], [u(0.05), u(0.58)]]); c.globalAlpha = 1; break;
    case 'nuke': for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 3; c.beginPath(); c.moveTo(u(0.5), u(0.5)); c.arc(u(0.5), u(0.5), u(0.42), a - 0.5, a + 0.5); c.closePath(); c.fill(); } c.fillStyle = '#fff'; circle(c, u(0.5), u(0.5), u(0.1)); break;
    case 'fire': c.beginPath(); c.moveTo(u(0.5), u(0.1)); c.quadraticCurveTo(u(0.9), u(0.5), u(0.68), u(0.85)); c.quadraticCurveTo(u(0.5), u(0.95), u(0.32), u(0.85)); c.quadraticCurveTo(u(0.1), u(0.5), u(0.38), u(0.4)); c.quadraticCurveTo(u(0.42), u(0.6), u(0.5), u(0.55)); c.quadraticCurveTo(u(0.56), u(0.3), u(0.5), u(0.1)); c.fill(); break;
    case 'dirt': c.beginPath(); c.arc(u(0.5), u(0.82), u(0.38), Math.PI, 0); c.closePath(); c.fill(); c.globalAlpha = 0.5; c.fillStyle = '#000'; circle(c, u(0.4), u(0.66), u(0.05)); circle(c, u(0.6), u(0.72), u(0.04)); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'mountain': poly(c, [[u(0.05), u(0.85)], [u(0.35), u(0.25)], [u(0.5), u(0.5)], [u(0.68), u(0.15)], [u(0.95), u(0.85)]]); break;
    case 'heart': c.beginPath(); c.moveTo(u(0.5), u(0.85)); c.bezierCurveTo(u(0.1), u(0.55), u(0.15), u(0.15), u(0.5), u(0.35)); c.bezierCurveTo(u(0.85), u(0.15), u(0.9), u(0.55), u(0.5), u(0.85)); c.fill(); break;
    case 'tele': c.beginPath(); c.arc(u(0.5), u(0.5), u(0.32), 0.3, Math.PI - 0.3); c.stroke(); c.beginPath(); c.arc(u(0.5), u(0.5), u(0.32), Math.PI + 0.3, Math.PI * 2 - 0.3); c.stroke(); poly(c, [[u(0.16), u(0.42)], [u(0.3), u(0.5)], [u(0.14), u(0.62)]]); poly(c, [[u(0.84), u(0.58)], [u(0.7), u(0.5)], [u(0.86), u(0.38)]]); break;
    case 'ring': c.lineWidth = u(0.12); circle(c, u(0.5), u(0.5), u(0.3), false); break;
    case 'spike': [0.2, 0.5, 0.8].forEach((x, i) => poly(c, [[u(x - 0.14), u(0.85)], [u(x + 0.14), u(0.85)], [u(x), u(i === 1 ? 0.12 : 0.3)]])); break;
    case 'cactus': c.fillRect(u(0.4), u(0.15), u(0.2), u(0.75)); c.fillRect(u(0.15), u(0.35), u(0.14), u(0.3)); c.fillRect(u(0.15), u(0.55), u(0.3), u(0.12)); c.fillRect(u(0.71), u(0.25), u(0.14), u(0.3)); c.fillRect(u(0.55), u(0.45), u(0.3), u(0.12)); break;
    case 'chain': [0.22, 0.5, 0.78].forEach((x) => { c.lineWidth = u(0.09); circle(c, u(x), u(0.5), u(0.11), false); }); line(c, u(0.33), u(0.5), u(0.39), u(0.5)); line(c, u(0.61), u(0.5), u(0.67), u(0.5)); break;
    case 'ghost': c.beginPath(); c.arc(u(0.5), u(0.42), u(0.3), Math.PI, 0); c.lineTo(u(0.8), u(0.85)); c.lineTo(u(0.68), u(0.75)); c.lineTo(u(0.56), u(0.85)); c.lineTo(u(0.44), u(0.75)); c.lineTo(u(0.32), u(0.85)); c.lineTo(u(0.2), u(0.75)); c.closePath(); c.fill(); c.fillStyle = '#000'; c.globalAlpha = 0.5; circle(c, u(0.4), u(0.42), u(0.05)); circle(c, u(0.6), u(0.42), u(0.05)); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'ufo': c.beginPath(); c.ellipse(u(0.5), u(0.58), u(0.42), u(0.14), 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(u(0.5), u(0.5), u(0.18), Math.PI, 0); c.fill(); c.fillStyle = '#000'; c.globalAlpha = 0.4; [0.3, 0.5, 0.7].forEach((x) => circle(c, u(x), u(0.6), u(0.04))); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'heli': c.beginPath(); c.ellipse(u(0.45), u(0.58), u(0.28), u(0.16), 0, 0, Math.PI * 2); c.fill(); c.fillRect(u(0.6), u(0.52), u(0.3), u(0.08)); line(c, u(0.12), u(0.28), u(0.8), u(0.28)); line(c, u(0.45), u(0.28), u(0.45), u(0.42)); break;
    case 'balloon': c.beginPath(); c.ellipse(u(0.5), u(0.4), u(0.24), u(0.3), 0, 0, Math.PI * 2); c.fill(); line(c, u(0.5), u(0.7), u(0.46), u(0.92)); break;
    case 'bubble': c.lineWidth = u(0.07); circle(c, u(0.5), u(0.5), u(0.32), false); c.beginPath(); c.arc(u(0.5), u(0.5), u(0.22), Math.PI * 1.1, Math.PI * 1.5); c.stroke(); break;
    case 'wave': c.beginPath(); for (let i = 0; i <= 20; i++) { const x = 0.1 + (i / 20) * 0.8; const y = 0.5 + Math.sin((i / 20) * Math.PI * 2) * 0.22; i ? c.lineTo(u(x), u(y)) : c.moveTo(u(x), u(y)); } c.stroke(); break;
    case 'zigzag': poly(c, [[u(0.1), u(0.5)], [u(0.3), u(0.25)], [u(0.5), u(0.75)], [u(0.7), u(0.25)], [u(0.9), u(0.5)]].slice(0), false); break;
    case 'boomerang': c.lineWidth = u(0.16); c.beginPath(); c.moveTo(u(0.2), u(0.25)); c.quadraticCurveTo(u(0.5), u(0.8), u(0.8), u(0.25)); c.stroke(); break;
    case 'flower': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; circle(c, u(0.5 + Math.cos(a) * 0.24), u(0.5 + Math.sin(a) * 0.24), u(0.13)); } c.fillStyle = '#000'; c.globalAlpha = 0.4; circle(c, u(0.5), u(0.5), u(0.1)); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'bomb': circle(c, u(0.45), u(0.58), u(0.28)); line(c, u(0.6), u(0.35), u(0.75), u(0.18)); star(c, u(0.8), u(0.15), u(0.09), 4, 0.4); break;
    case 'dynamite': c.save(); c.translate(u(0.5), u(0.55)); c.rotate(-0.5); c.fillRect(u(-0.3), u(-0.12), u(0.6), u(0.24)); c.restore(); line(c, u(0.68), u(0.35), u(0.8), u(0.18)); star(c, u(0.84), u(0.14), u(0.08), 4, 0.4); break;
    case 'quake': poly(c, [[u(0.08), u(0.55)], [u(0.25), u(0.45)], [u(0.35), u(0.7)], [u(0.5), u(0.3)], [u(0.62), u(0.65)], [u(0.75), u(0.45)], [u(0.92), u(0.55)]], false); break;
    case 'hole': c.lineWidth = u(0.06); circle(c, u(0.5), u(0.5), u(0.36), false); circle(c, u(0.5), u(0.5), u(0.2)); break;
    case 'wall': [[0.12, 0.3], [0.52, 0.3], [0.32, 0.52], [0.12, 0.74], [0.52, 0.74]].forEach((p) => c.fillRect(u(p[0]), u(p[1]), u(0.36), u(0.18))); c.fillRect(u(0.72), u(0.52), u(0.16), u(0.18)); break;
    case 'turret': c.beginPath(); c.arc(u(0.45), u(0.6), u(0.22), Math.PI, 0); c.fill(); c.fillRect(u(0.15), u(0.6), u(0.6), u(0.14)); c.lineWidth = u(0.1); line(c, u(0.5), u(0.5), u(0.85), u(0.3)); break;
    case 'mole': c.beginPath(); c.ellipse(u(0.5), u(0.5), u(0.32), u(0.2), 0, 0, Math.PI * 2); c.fill(); circle(c, u(0.82), u(0.5), u(0.07)); line(c, u(0.1), u(0.82), u(0.9), u(0.82)); break;
    case 'snow': c.lineWidth = u(0.07); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; line(c, u(0.5 - Math.cos(a) * 0.36), u(0.5 - Math.sin(a) * 0.36), u(0.5 + Math.cos(a) * 0.36), u(0.5 + Math.sin(a) * 0.36)); } circle(c, u(0.5), u(0.5), u(0.08)); break;
    case 'meteor': circle(c, u(0.65), u(0.65), u(0.2)); c.lineWidth = u(0.07); line(c, u(0.5), u(0.5), u(0.15), u(0.15)); line(c, u(0.6), u(0.42), u(0.35), u(0.1)); line(c, u(0.42), u(0.6), u(0.1), u(0.35)); break;
    case 'drone': c.lineWidth = u(0.08); line(c, u(0.2), u(0.2), u(0.8), u(0.8)); line(c, u(0.8), u(0.2), u(0.2), u(0.8)); [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].forEach((p) => circle(c, u(p[0]), u(p[1]), u(0.1))); circle(c, u(0.5), u(0.5), u(0.09)); break;
    case 'comet': circle(c, u(0.68), u(0.32), u(0.17)); c.beginPath(); c.moveTo(u(0.6), u(0.46)); c.lineTo(u(0.1), u(0.85)); c.lineTo(u(0.55), u(0.3)); c.closePath(); c.fill(); break;
    case 'gun': c.fillRect(u(0.1), u(0.42), u(0.55), u(0.16)); c.fillRect(u(0.1), u(0.55), u(0.18), u(0.25)); [0.72, 0.82, 0.92].forEach((x) => circle(c, u(x), u(0.5), u(0.04))); break;
    case 'shield': c.beginPath(); c.moveTo(u(0.5), u(0.1)); c.lineTo(u(0.85), u(0.25)); c.lineTo(u(0.78), u(0.6)); c.lineTo(u(0.5), u(0.9)); c.lineTo(u(0.22), u(0.6)); c.lineTo(u(0.15), u(0.25)); c.closePath(); c.fill(); break;
    case 'beacon': poly(c, [[u(0.5), u(0.15)], [u(0.7), u(0.7)], [u(0.3), u(0.7)]]); c.lineWidth = u(0.07); c.beginPath(); c.ellipse(u(0.5), u(0.74), u(0.38), u(0.12), 0, 0, Math.PI * 2); c.stroke(); break;
    case 'sun': circle(c, u(0.5), u(0.5), u(0.18)); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(c, u(0.5 + Math.cos(a) * 0.28), u(0.5 + Math.sin(a) * 0.28), u(0.5 + Math.cos(a) * 0.42), u(0.5 + Math.sin(a) * 0.42)); } break;
    case 'skull': circle(c, u(0.5), u(0.42), u(0.28)); c.fillRect(u(0.34), u(0.6), u(0.32), u(0.2)); c.fillStyle = '#000'; c.globalAlpha = 0.6; circle(c, u(0.4), u(0.42), u(0.07)); circle(c, u(0.6), u(0.42), u(0.07)); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'mushroom': c.beginPath(); c.ellipse(u(0.5), u(0.35), u(0.38), u(0.22), 0, 0, Math.PI * 2); c.fill(); c.fillRect(u(0.4), u(0.4), u(0.2), u(0.45)); c.beginPath(); c.ellipse(u(0.5), u(0.85), u(0.3), u(0.08), 0, 0, Math.PI * 2); c.fill(); break;
    case 'v': c.lineWidth = u(0.14); poly(c, [[u(0.15), u(0.2)], [u(0.5), u(0.85)], [u(0.85), u(0.2)]], false); break;
    case 'spiral': c.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40; const a = t * Math.PI * 4; const r = 0.05 + t * 0.35; const x = 0.5 + Math.cos(a) * r, y = 0.5 + Math.sin(a) * r; i ? c.lineTo(u(x), u(y)) : c.moveTo(u(x), u(y)); } c.stroke(); break;
    case 'popcorn': [[0.35, 0.4], [0.62, 0.38], [0.48, 0.6], [0.3, 0.62], [0.68, 0.62]].forEach((p) => circle(c, u(p[0]), u(p[1]), u(0.14))); break;
    case 'snake': c.lineWidth = u(0.12); c.beginPath(); c.moveTo(u(0.15), u(0.3)); c.bezierCurveTo(u(0.6), u(0.1), u(0.4), u(0.9), u(0.85), u(0.7)); c.stroke(); break;
    case 'funnel': poly(c, [[u(0.12), u(0.18)], [u(0.88), u(0.18)], [u(0.58), u(0.55)], [u(0.58), u(0.88)], [u(0.42), u(0.88)], [u(0.42), u(0.55)]]); break;
    case 'fan': for (let i = 0; i < 5; i++) { const a = Math.PI * 1.1 + (i / 4) * Math.PI * 0.8; line(c, u(0.5), u(0.82), u(0.5 + Math.cos(a) * 0.55), u(0.82 + Math.sin(a) * 0.55)); } break;
    case 'split': line(c, u(0.5), u(0.88), u(0.5), u(0.5)); line(c, u(0.5), u(0.5), u(0.2), u(0.15)); line(c, u(0.5), u(0.5), u(0.8), u(0.15)); break;
    case 'area': c.lineWidth = u(0.06); c.strokeRect(u(0.12), u(0.3), u(0.76), u(0.45)); [0.3, 0.5, 0.7].forEach((x) => circle(c, u(x), u(0.52), u(0.07))); break;
    case 'firework': for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(c, u(0.5 + Math.cos(a) * 0.12), u(0.5 + Math.sin(a) * 0.12), u(0.5 + Math.cos(a) * 0.4), u(0.5 + Math.sin(a) * 0.4)); } break;
    case 'box': c.fillRect(u(0.18), u(0.3), u(0.64), u(0.55)); c.fillStyle = '#000'; c.globalAlpha = 0.4; c.fillRect(u(0.18), u(0.52), u(0.64), u(0.08)); c.globalAlpha = 1; c.fillStyle = '#fff'; break;
    case 'fuel': c.fillRect(u(0.22), u(0.2), u(0.42), u(0.65)); c.fillRect(u(0.3), u(0.1), u(0.26), u(0.1)); c.lineWidth = u(0.07); line(c, u(0.64), u(0.35), u(0.8), u(0.45)); line(c, u(0.8), u(0.45), u(0.8), u(0.75)); break;
    case 'x2': c.font = `bold ${u(0.62)}px Rajdhani, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('x2', u(0.5), u(0.54)); break;
    case 'crosshair': c.lineWidth = u(0.07); circle(c, u(0.5), u(0.5), u(0.28), false); line(c, u(0.5), u(0.1), u(0.5), u(0.3)); line(c, u(0.5), u(0.7), u(0.5), u(0.9)); line(c, u(0.1), u(0.5), u(0.3), u(0.5)); line(c, u(0.7), u(0.5), u(0.9), u(0.5)); break;
    case 'tank': c.fillRect(u(0.18), u(0.5), u(0.64), u(0.2)); c.beginPath(); c.arc(u(0.5), u(0.5), u(0.14), Math.PI, 0); c.fill(); c.lineWidth = u(0.08); line(c, u(0.5), u(0.42), u(0.82), u(0.28)); c.beginPath(); c.roundRect ? c.roundRect(u(0.12), u(0.68), u(0.76), u(0.16), u(0.08)) : c.rect(u(0.12), u(0.68), u(0.76), u(0.16)); c.fill(); break;
    default: circle(c, u(0.5), u(0.5), u(0.28));
  }
}

// Rounded colored tile with white glyph; returns a cached data URL.
export function iconURL(key, color = '#546e7a', size = 44) {
  const k = `${key}|${color}|${size}`;
  if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const c = cv.getContext('2d');
  const r = size * 0.16;
  const g = c.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, lighten(color, 0.18)); g.addColorStop(1, darken(color, 0.25));
  c.fillStyle = g;
  c.beginPath(); c.roundRect ? c.roundRect(0, 0, size, size, r) : c.rect(0, 0, size, size); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
  c.beginPath(); c.roundRect ? c.roundRect(0.5, 0.5, size - 1, size - 1, r) : c.rect(0.5, 0.5, size - 1, size - 1); c.stroke();
  c.save();
  c.translate(size * 0.12, size * 0.12);
  c.fillStyle = '#fff'; c.strokeStyle = '#fff';
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 2; c.shadowOffsetY = 1;
  drawGlyph(c, key, size * 0.76);
  c.restore();
  const url = cv.toDataURL();
  cache.set(k, url);
  return url;
}

export function drawIcon(ctx, key, x, y, size, color) {
  const img = iconImage(key, color, size);
  if (img.complete) ctx.drawImage(img, x, y, size, size);
}

const imgCache = new Map();
export function iconImage(key, color, size = 44) {
  const k = `${key}|${color}|${size}`;
  if (imgCache.has(k)) return imgCache.get(k);
  const img = new Image();
  img.src = iconURL(key, color, size);
  imgCache.set(k, img);
  return img;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function lighten(hex, t) { const [r, g, b] = hexToRgb(hex); return `rgb(${r + (255 - r) * t | 0},${g + (255 - g) * t | 0},${b + (255 - b) * t | 0})`; }
function darken(hex, t) { const [r, g, b] = hexToRgb(hex); return `rgb(${r * (1 - t) | 0},${g * (1 - t) | 0},${b * (1 - t) | 0})`; }
