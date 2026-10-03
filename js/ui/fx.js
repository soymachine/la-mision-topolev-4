// Partículas de interfaz sobre toda la pantalla (overlay). Se simulan en px (capa lógica) y se dibujan ajustadas a
// una rejilla de caracteres (capa ASCII, ver Particles.draw).
import { Particles } from '../render/particles.js';
import { FONT } from '../render/ascii.js';

const canvas = document.getElementById('fx-overlay');
const ctx = canvas.getContext('2d');
const parts = new Particles();
let dpr = 1, running = false, last = 0;
const CELL = 12; // unidad de la capa lógica (px por unidad); no se dibuja así
// capa ASCII: rejilla fija de caracteres sobre toda la pantalla
const UI_FS = 14;
const m = document.createElement('canvas').getContext('2d');
m.font = `${UI_FS}px ${FONT}`;
const GW = Math.ceil(m.measureText('M').width), GH = Math.round(UI_FS * 1.25);
const snap = (x, y) => [Math.floor(((x + 0.5) * CELL) / GW), Math.floor(((y + 0.5) * CELL) / GH)];
const cellPx = (cx, cy) => [cx * GW, cy * GH];

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
  parts.draw(ctx, cellPx, GW, GH, FONT, { snap, fs: UI_FS, mask: '#000', maskA: 0.85 });
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
  const a = fromEl.getBoundingClientRect();
  uiFlyFrom(a.left + a.width / 2, a.top + a.height / 2, toEl, n, ch, color);
}
// desde un punto de la pantalla (px de la ventana) hasta un elemento: p. ej. la esencia recogida en el mapa → contador
export function uiFlyFrom(px, py, toEl, n = 10, ch = '✦', color = '#5ff7ff') {
  if (!toEl) return;
  const b = toEl.getBoundingClientRect();
  const [x0, y0] = toCell(px, py);
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
