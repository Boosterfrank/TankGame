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

// o: { x, y, color, tilt, facing, angle, recoil, alive, scale, glow }
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
