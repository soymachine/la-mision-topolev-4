// Partículas de interfaz sobre toda la pantalla (overlay)
import { Particles } from '../render/particles.js';
import { FONT } from '../render/ascii.js';

const canvas = document.getElementById('fx-overlay');
const ctx = canvas.getContext('2d');
const parts = new Particles();
let dpr = 1, running = false, last = 0;
const CELL = 12;

function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
}
resize();
addEventListener('resize', resize);

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  parts.update(dt, now);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts.draw(ctx, (x, y) => [x * CELL, y * CELL], CELL, CELL * 1.3, FONT);
  if (parts.list.length || parts.pending.length) requestAnimationFrame(loop);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }

const toCell = (px, py) => [px / CELL - 0.5, py / CELL - 0.5];

export function uiBurst(px, py, opts = {}) {
  const [x, y] = toCell(px, py);
  parts.burst(x, y, opts.n || 16, { chars: opts.chars || ['*', '+', '·', '✦'], colors: opts.colors || ['#ff8a1f', '#ffd23f', '#fff'], speed: opts.speed || 14, life: opts.life || 0.8, gravity: opts.gravity ?? 20, glow: 10, scale: 1.3 });
  kick();
}
export function uiText(px, py, text, color = '#ffd23f') {
  const [x, y] = toCell(px, py);
  parts.text(x, y, text, color, { vy: -4, life: 1.2, scale: 1.4 });
  kick();
}
// partículas que vuelan de un punto a otro (p. ej. esencia hacia el contador)
export function uiFly(fromEl, toEl, n = 10, ch = '✦', color = '#5ff7ff') {
  if (!fromEl || !toEl) return;
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const [x0, y0] = toCell(a.left + a.width / 2, a.top + a.height / 2);
  const [x1, y1] = toCell(b.left + b.width / 2, b.top + b.height / 2);
  for (let i = 0; i < n; i++) {
    parts.add({ x: x0, y: y0, x0: x0 + (Math.random() - 0.5) * 4, y0: y0 + (Math.random() - 0.5) * 3, tx: x1, ty: y1, arc: 3 + Math.random() * 6, life: 0.5 + Math.random() * 0.4, ch, color, glow: 12, delay: i * 35, noFade: true, ease: (k) => k * k, scale: 1.3 });
  }
  kick();
}
export function uiSparkEl(el, opts = {}) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  uiBurst(r.left + r.width / 2, r.top + r.height / 2, opts);
}
