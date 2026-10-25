// Procedural tank sprite shared by the game, the intro, the HUD and lobby previews.
import { hexToRgb, rad } from './util.js';

function shade(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}

// Paint patterns, clipped to the hull, in shades of the team color.
function drawPattern(ctx, id, light, dark, hullPath) {
  if (!id || id === 'none') return;
  ctx.save();
  hullPath(); ctx.clip();
  ctx.globalAlpha = 0.6;
  switch (id) {
    case 'stripes':
      ctx.fillStyle = light;
      for (const x of [-12, -3]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 5, -10); ctx.lineTo(x + 11, -20); ctx.lineTo(x + 6, -20); ctx.closePath(); ctx.fill(); }
      break;
    case 'camo':
      for (const [x, y, rx, ry, c] of [[-14, -13, 6, 3, dark], [-4, -17, 7, 3, light], [6, -12, 6, 3, dark], [15, -16, 5, 2.5, dark], [-9, -18, 4, 2, dark], [12, -11, 4, 2, light]]) {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'hex':
      ctx.strokeStyle = dark; ctx.lineWidth = 0.8;
      for (let r = 0; r < 3; r++) for (let i = -4; i < 5; i++) { hexPath(ctx, i * 6 + (r % 2) * 3, -18 + r * 3.6, 2.2); ctx.stroke(); }
      break;
    case 'chevron':
      ctx.strokeStyle = light; ctx.lineWidth = 2;
      for (const x of [-11, -3, 5]) { ctx.beginPath(); ctx.moveTo(x, -19); ctx.lineTo(x + 5, -14.5); ctx.lineTo(x, -10); ctx.stroke(); }
      break;
    case 'flames':
      ctx.globalAlpha = 0.9;
      for (const [y, len, c] of [[-17, 16, '#ff9800'], [-13.5, 22, '#ff9800'], [-11, 13, '#ff9800'], [-17, 9, '#ffeb3b'], [-13.5, 13, '#ffeb3b']]) {
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-22, y - 1.3); ctx.quadraticCurveTo(-22 + len * 0.55, y - 2.8, -22 + len, y); ctx.quadraticCurveTo(-22 + len * 0.55, y + 2.8, -22, y + 1.3); ctx.closePath(); ctx.fill();
      }
      break;
    case 'carbon':
      ctx.strokeStyle = dark; ctx.lineWidth = 0.7;
      for (let x = -30; x < 30; x += 3) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 10, -20); ctx.stroke(); }
      ctx.globalAlpha = 0.3;
      for (let x = -30; x < 30; x += 3) { ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 10, -10); ctx.stroke(); }
      break;
    case 'checker':
      ctx.fillStyle = dark;
      for (let i = -5; i < 6; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 5 - 1, -19.5 + j * 4.75, 5, 4.75);
      break;
    case 'bolt':
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff176';
      ctx.beginPath(); ctx.moveTo(-6, -19.5); ctx.lineTo(3, -19.5); ctx.lineTo(0, -15); ctx.lineTo(6, -15); ctx.lineTo(-5, -10); ctx.lineTo(-1, -14); ctx.lineTo(-8, -14); ctx.closePath(); ctx.fill();
      break;
    case 'tiger':
      ctx.fillStyle = dark;
      for (const [x, w] of [[-20, 2.5], [-14, 4], [-7, 2], [-1, 3.5], [6, 2.5], [12, 4], [19, 2]]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + w, -10); ctx.lineTo(x + w + 3, -19.5); ctx.lineTo(x + 3, -19.5); ctx.closePath(); ctx.fill(); }
      break;
    case 'dots':
      ctx.fillStyle = light;
      for (let r = 0; r < 3; r++) for (let x = -20 + (r % 2) * 2.5; x < 24; x += 5) { ctx.beginPath(); ctx.arc(x, -18 + r * 3.3, 1.2, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'digital':
      for (const [x, y, c] of [[-20, -19, dark], [-17, -16, light], [-14, -13, dark], [-11, -19, light], [-8, -16, dark], [-8, -13, dark], [-2, -19, dark], [1, -16, light], [1, -13, dark], [4, -19, light], [7, -16, dark], [10, -13, light], [13, -19, dark], [16, -16, dark], [19, -13, light], [-5, -13, light], [-14, -19, light], [13, -13, dark]]) { ctx.fillStyle = c; ctx.fillRect(x, y, 3, 3); }
      break;
    case 'waves':
      ctx.strokeStyle = light; ctx.lineWidth = 1.3;
      for (const y of [-17.5, -14.5, -11.5]) { ctx.beginPath(); for (let x = -22; x <= 24; x += 1) { const yy = y + Math.sin((x + y) * 0.55) * 1.1; x === -22 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
      break;
    case 'stars':
      ctx.fillStyle = light; ctx.globalAlpha = 0.85;
      for (const [x, y, r] of [[-15, -14.5, 2.4], [-6, -17, 1.6], [1, -13, 2.2], [9, -17, 1.6], [16, -14, 2.2], [-10, -11.5, 1.2], [5, -11.5, 1.1]]) {
        ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr2 = i % 2 ? r * 0.45 : r; const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      }
      break;
    case 'racing':
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = light; ctx.fillRect(-22, -12.5, 46, 1.6);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1, -14.8, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 6px Rajdhani, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('7', 1, -14.5);
      break;
    case 'galaxy':
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#5e35b1'; ctx.fillRect(-24, -21, 50, 12);
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#ec407a'; ctx.beginPath(); ctx.ellipse(4, -15, 12, 3.5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#fff';
      for (const [x, y, r] of [[-18, -17, 0.8], [-12, -12, 0.6], [-7, -18, 0.5], [-2, -14, 0.9], [4, -18, 0.5], [9, -12, 0.7], [14, -17, 0.9], [19, -13, 0.6], [-15, -14, 0.4], [11, -15, 0.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'rust':
      ctx.globalAlpha = 0.7;
      for (const [x, y, rx, ry, c] of [[-16, -12, 5, 2.5, '#8d5524'], [-6, -17, 4, 2, '#a0522d'], [3, -12.5, 6, 2.2, '#8d5524'], [13, -17, 4.5, 2.4, '#b5651d'], [19, -12, 3, 2, '#8d5524'], [-12, -18, 2.5, 1.5, '#b5651d']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'leopard':
      ctx.lineWidth = 1.2; ctx.strokeStyle = dark; ctx.fillStyle = light;
      for (const [x, y] of [[-17, -15], [-10, -12], [-8, -18], [0, -15], [7, -18], [9, -12], [16, -16], [21, -12]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 2.6, 0.3, 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.6, 3.4, 5.9); ctx.stroke(); }
      break;
    case 'plaid':
      ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.5;
      for (let x = -20; x < 24; x += 6) { ctx.beginPath(); ctx.moveTo(x, -21); ctx.lineTo(x, -9); ctx.stroke(); }
      for (let y = -18.5; y < -9; y += 4) { ctx.beginPath(); ctx.moveTo(-23, y); ctx.lineTo(25, y); ctx.stroke(); }
      ctx.strokeStyle = light; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.6;
      for (let x = -17; x < 24; x += 6) { ctx.beginPath(); ctx.moveTo(x, -21); ctx.lineTo(x, -9); ctx.stroke(); }
      break;
    case 'zebra':
      ctx.fillStyle = light; ctx.globalAlpha = 0.75;
      for (const x of [-19, -13, -7, -1, 5, 11, 17]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.quadraticCurveTo(x + 2.5, -15, x + 1, -19.5); ctx.lineTo(x + 3.2, -19.5); ctx.quadraticCurveTo(x + 4.6, -15, x + 2.4, -10); ctx.closePath(); ctx.fill(); }
      break;
    case 'target':
      ctx.globalAlpha = 0.95;
      for (const [r, c] of [[4.6, '#e53935'], [3.3, '#fff'], [2, '#e53935'], [0.8, '#fff']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(2, -14.8, r, 0, Math.PI * 2); ctx.fill(); }
      break;
  }
  ctx.restore();
}

// Turret accessories (local tank space: turret spans x -10..7, top at y -28).
function drawAccessory(ctx, id, light, dark) {
  if (!id || id === 'none') return;
  ctx.save();
  switch (id) {
    case 'antenna':
      ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -27); ctx.lineTo(-12, -42); ctx.stroke();
      ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(-12, -42); ctx.lineTo(-4, -39.5); ctx.lineTo(-12, -37); ctx.closePath(); ctx.fill();
      break;
    case 'tophat':
      ctx.fillStyle = '#111'; ctx.fillRect(-11.5, -30, 15, 2.2); ctx.fillRect(-8.5, -40, 9, 10.5);
      ctx.fillStyle = '#c62828'; ctx.fillRect(-8.5, -32.5, 9, 2.2);
      break;
    case 'crown':
      ctx.fillStyle = '#ffd740';
      ctx.beginPath(); ctx.moveTo(-9, -28.5); ctx.lineTo(-9, -36); ctx.lineTo(-6, -31.5); ctx.lineTo(-3, -37.5); ctx.lineTo(0, -31.5); ctx.lineTo(3, -36); ctx.lineTo(3, -28.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e53935'; for (const x of [-7, -3, 1]) { ctx.beginPath(); ctx.arc(x, -30, 0.9, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'halo':
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 1.8; ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(-1.5, -36.5, 8, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'horns':
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.moveTo(-10, -26.5); ctx.quadraticCurveTo(-14, -31, -13.5, -38); ctx.quadraticCurveTo(-9, -32, -6, -27.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -26.5); ctx.quadraticCurveTo(9, -31, 9.5, -38); ctx.quadraticCurveTo(4, -32, 1, -27.5); ctx.closePath(); ctx.fill();
      break;
    case 'mohawk':
      ctx.fillStyle = light;
      for (let x = -9; x <= 3; x += 3) { ctx.beginPath(); ctx.moveTo(x, -27.5); ctx.lineTo(x + 3, -27.5); ctx.lineTo(x + 1.5, -36 + Math.abs(x + 3) * 0.4); ctx.closePath(); ctx.fill(); }
      break;
    case 'spikes':
      ctx.fillStyle = '#b0bec5';
      for (const x of [-8.5, -4.5, -0.5, 3.5]) { ctx.beginPath(); ctx.moveTo(x, -27.5); ctx.lineTo(x + 2.4, -27.5); ctx.lineTo(x + 1.2, -34); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-10.5, -25); ctx.lineTo(-15.5, -24); ctx.lineTo(-10.5, -22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7.5, -25); ctx.lineTo(12.5, -24); ctx.lineTo(7.5, -22); ctx.closePath(); ctx.fill();
      break;
    case 'propeller':
      ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(-1.5, -28, 5.5, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-1.5 - 5.5, -29.5, 11, 1.2);
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1.5, -33.5); ctx.lineTo(-1.5, -37); ctx.stroke();
      ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.ellipse(-1.5, -37, 7, 1.3, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'cowboy':
      ctx.fillStyle = '#6d4c41'; ctx.beginPath(); ctx.ellipse(-1.5, -29, 12, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.moveTo(-7, -29); ctx.lineTo(-6, -37); ctx.quadraticCurveTo(-1.5, -39.5, 3, -37); ctx.lineTo(4, -29); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3e2723'; ctx.fillRect(-7, -31.5, 11, 1.6);
      break;
    case 'wizard':
      ctx.fillStyle = '#5e35b1'; ctx.beginPath(); ctx.ellipse(-1.5, -29, 10.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -29); ctx.quadraticCurveTo(-3, -40, 2, -46); ctx.quadraticCurveTo(3, -36, 5, -29); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffeb3b'; for (const [x, y] of [[-3, -33], [1, -38], [-1, -42.5]]) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'pirate':
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-13, -30); ctx.quadraticCurveTo(-1.5, -24, 10, -30); ctx.quadraticCurveTo(6, -39, -1.5, -38.5); ctx.quadraticCurveTo(-9, -39, -13, -30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-1.5, -33.5, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-3.3, -31.8, 3.6, 0.9);
      break;
    case 'viking':
      ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(-1.5, -28, 7.5, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#607d8b'; ctx.fillRect(-9, -29.5, 15, 1.8); ctx.fillRect(-2.3, -35.5, 1.6, 7);
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath(); ctx.moveTo(-8, -30); ctx.quadraticCurveTo(-13, -33, -12.5, -39); ctx.quadraticCurveTo(-9, -34, -6, -33); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5, -30); ctx.quadraticCurveTo(10, -33, 9.5, -39); ctx.quadraticCurveTo(6, -34, 3, -33); ctx.closePath(); ctx.fill();
      break;
    case 'santa':
      ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.moveTo(-9, -29); ctx.lineTo(6, -29); ctx.quadraticCurveTo(7, -36, 11, -40); ctx.quadraticCurveTo(2, -38, -9, -29); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(11, -40, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-1.5, -29, 9.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'catears':
      for (const x of [-8, 1]) {
        ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(x, -27.5); ctx.lineTo(x + 3, -36); ctx.lineTo(x + 6.5, -27.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.moveTo(x + 1.5, -28); ctx.lineTo(x + 3, -33); ctx.lineTo(x + 5, -28); ctx.closePath(); ctx.fill();
      }
      break;
    case 'bunny':
      for (const x of [-5, 2]) {
        ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.ellipse(x, -36, 2.3, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.ellipse(x, -36, 1.1, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'party':
      ctx.save(); ctx.beginPath(); ctx.moveTo(-7, -28); ctx.lineTo(4, -28); ctx.lineTo(-1.5, -42); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#ffeb3b' : '#29b6f6'; ctx.fillRect(-8, -28 - i * 2.5, 13, 2.5); }
      ctx.restore();
      ctx.fillStyle = '#ff4081'; ctx.beginPath(); ctx.arc(-1.5, -42, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'headband':
      ctx.fillStyle = '#e53935'; ctx.fillRect(-10.5, -29.5, 18, 2.6);
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10.5, -28.5); ctx.quadraticCurveTo(-16, -29, -19, -25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10.5, -28); ctx.quadraticCurveTo(-15, -27, -17.5, -22.5); ctx.stroke();
      break;
    case 'bow':
      ctx.fillStyle = '#ec407a';
      ctx.beginPath(); ctx.moveTo(-1.5, -30); ctx.lineTo(-8, -34); ctx.lineTo(-8, -26.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-1.5, -30); ctx.lineTo(5, -34); ctx.lineTo(5, -26.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ad1457'; ctx.beginPath(); ctx.arc(-1.5, -30, 1.7, 0, Math.PI * 2); ctx.fill();
      break;
    case 'flower':
      ctx.strokeStyle = '#43a047'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -28); ctx.lineTo(4, -36); ctx.stroke();
      ctx.fillStyle = '#f06292'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(4 + Math.cos(a) * 2.4, -38.5 + Math.sin(a) * 2.4, 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(4, -38.5, 1.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'sombrero':
      ctx.fillStyle = '#d7a86e'; ctx.beginPath(); ctx.ellipse(-1.5, -29, 16, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-1.5, -29, 13, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e0b878'; ctx.beginPath(); ctx.moveTo(-7, -30); ctx.quadraticCurveTo(-1.5, -43, 4, -30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c62828'; ctx.fillRect(-6, -32.5, 9, 1.6);
      break;
    case 'headphones':
      ctx.strokeStyle = '#263238'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(-1.5, -26, 10.5, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.fillStyle = '#37474f'; ctx.fillRect(-14, -29.5, 4, 7); ctx.fillRect(7, -29.5, 4, 7);
      ctx.fillStyle = '#18ffff'; ctx.fillRect(-13, -28, 2, 4); ctx.fillRect(8, -28, 2, 4);
      break;
    case 'chef':
      ctx.fillStyle = '#fafafa'; ctx.fillRect(-7.5, -34, 12, 6);
      for (const [x, y, r] of [[-6, -36, 3.6], [-1.5, -38, 4], [3, -36, 3.6]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'beanie':
      ctx.fillStyle = '#5c6bc0'; ctx.beginPath(); ctx.arc(-1.5, -28.5, 8.5, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3949ab'; ctx.fillRect(-10, -31, 17, 2.6);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-1.5, -37.5, 2, 0, Math.PI * 2); ctx.fill();
      break;
  }
  ctx.restore();
}

// o: { x, y, color, tilt, facing, angle, recoil, alive, scale, glow, skin:{pattern, accessory} }
// (x, y) is the ground contact point under the middle of the tracks.
export function drawTankSprite(ctx, o) {
  const s = o.scale || 1, facing = o.facing || 1, alive = o.alive !== false;
  const color = alive ? o.color : '#3a4149';
  const light = alive ? shade(o.color, 0.42) : '#5a646e';
  const mid = alive ? shade(o.color, -0.22) : '#2f353c';
  const dark = alive ? shade(o.color, -0.58) : '#1f2429';
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.tilt || 0);
  ctx.scale(s * facing, s);
  // tracks
  rr(ctx, -24, -11, 48, 11, 5.5);
  ctx.fillStyle = '#161b20'; ctx.fill();
  ctx.strokeStyle = '#3f4a56'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#2a323b';
  for (let lx = -19; lx <= 19; lx += 4.75) ctx.fillRect(lx - 0.9, -2.6, 1.8, 2.2);
  for (const wx of [-17, -8.5, 0, 8.5, 17]) {
    ctx.beginPath(); ctx.arc(wx, -5.6, 3.6, 0, Math.PI * 2); ctx.fillStyle = '#2c343d'; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, -5.6, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#5b6775'; ctx.fill();
  }
  // hull (sloped glacis toward the facing direction)
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-21, -10); ctx.lineTo(21, -10); ctx.lineTo(23.5, -14); ctx.lineTo(18, -19.5);
    ctx.lineTo(-15, -19.5); ctx.lineTo(-21.5, -15); ctx.closePath();
  };
  if (alive && o.glow !== false) { ctx.shadowColor = o.color; ctx.shadowBlur = 16 * s; }
  hull(); ctx.fillStyle = mid; ctx.fill();
  ctx.shadowBlur = 0;
  // top plate + highlight
  ctx.beginPath(); ctx.moveTo(-15, -19.5); ctx.lineTo(18, -19.5); ctx.lineTo(16, -16.5); ctx.lineTo(-13.5, -16.5); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = light; ctx.fillRect(-13, -19.5, 29, 1.3);
  // side skirt line
  ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-19, -12.5); ctx.lineTo(20, -12.5); ctx.stroke();
  hull(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  // turret
  rr(ctx, -10, -28, 17, 9.5, 5);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
  rr(ctx, -8, -27.3, 12, 2.2, 1); ctx.fillStyle = light; ctx.fill();
  ctx.beginPath(); ctx.arc(-4.5, -28.2, 2.7, Math.PI, 0); ctx.fillStyle = mid; ctx.fill();
  if (o.skin && alive) {
    drawPattern(ctx, o.skin.pattern, light, dark, hull);
    drawAccessory(ctx, o.skin.accessory, light, dark);
  }
  ctx.restore();
  if (!alive) return;
  // barrel in world angle (independent of tilt and mirroring)
  const px = o.x, py = o.y - 23 * s;
  const a = rad(o.angle ?? 45);
  const len = (28 - (o.recoil || 0) * 7) * s;
  const ex = px + Math.cos(a) * len, ey = py - Math.sin(a) * len;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark; ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = mid; ctx.lineWidth = 3.2 * s;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = light; ctx.lineWidth = 1 * s;
  ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 6 * s, py - Math.sin(a) * 6 * s); ctx.lineTo(px + Math.cos(a) * (len - 7 * s), py - Math.sin(a) * (len - 7 * s)); ctx.stroke();
  // muzzle brake
  ctx.lineCap = 'butt';
  ctx.strokeStyle = dark; ctx.lineWidth = 7.5 * s;
  ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * (len - 5 * s), py - Math.sin(a) * (len - 5 * s)); ctx.lineTo(ex, ey); ctx.stroke();
  // mantlet collar
  ctx.beginPath(); ctx.arc(px, py, 4.2 * s, 0, Math.PI * 2); ctx.fillStyle = dark; ctx.fill();
  ctx.beginPath(); ctx.arc(px, py, 2.2 * s, 0, Math.PI * 2); ctx.fillStyle = mid; ctx.fill();
  ctx.restore();
}
