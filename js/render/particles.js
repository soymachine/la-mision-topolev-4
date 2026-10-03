// Sistema de partículas ASCII. Coordenadas en casillas (float).
import { rng } from '../util/rng.js';

export class Particles {
  constructor() { this.list = []; this.pending = []; }

  add(p) {
    // p: x,y,vx,vy,ax,ay,life,ch,color,scale,glow,drag,text
    const q = { vx: 0, vy: 0, ax: 0, ay: 0, life: 0.6, t: 0, ch: '*', color: '#fff', scale: 1, alpha: 1, drag: 0, ...p };
    if (q.delay) { q.at = performance.now() + q.delay; this.pending.push(q); } else this.list.push(q);
    return q;
  }

  update(dt, now) {
    if (this.pending.length) {
      const still = [];
      for (const p of this.pending) if (p.at <= now) this.list.push(p); else still.push(p);
      this.pending = still;
    }
    const out = [];
    for (const p of this.list) {
      p.t += dt;
      if (p.t >= p.life) { if (p.onEnd) p.onEnd(p); continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.tx != null) {
        // movimiento dirigido (trazadoras / proyectiles)
        const k = Math.min(1, p.t / p.life);
        const e = p.ease ? p.ease(k) : k;
        p.x = p.x0 + (p.tx - p.x0) * e;
        p.y = p.y0 + (p.ty - p.y0) * e - (p.arc ? Math.sin(k * Math.PI) * p.arc : 0);
      } else { p.x += p.vx * dt; p.y += p.vy * dt; }
      out.push(p);
    }
    this.list = out;
  }

  // Capa ASCII (revisión): la simulación de arriba es la capa lógica (posiciones con decimales, escala, halo) y no
  // se dibuja tal cual. Cada partícula se ajusta a una casilla de la rejilla de caracteres: una sola letra por casilla
  // (gana la más intensa; los textos, siempre), todas del mismo tamaño, con fondo de casilla que tapa lo de debajo.
  // La escala grande pasa a negrita y el halo a un tinte del fondo de la casilla. Los proyectiles dejan una estela
  // de casillas entre donde estaban hace un instante y donde están.
  // snap(x, y) → [col, fila] de la casilla · cell(col, fila) → [px, py] de su esquina · fs: tamaño de letra fijo
  raster(snap) {
    const cells = new Map();
    const put = (cx, cy, c, col, a, w, p) => {
      const k = cx * 8192 + cy;
      const o = cells.get(k);
      if (o && o.w >= w) return;
      cells.set(k, { cx, cy, c, col, a, w, bold: !!(p.bold || p.scale > 1.15), glow: !!p.glow });
    };
    for (const p of this.list) {
      const k = p.t / p.life;
      const a = p.fadeIn ? Math.min(1, k * 5) * (1 - k) : p.noFade ? 1 : 1 - k * k;
      if (a * p.alpha <= 0.04) continue;
      const col = typeof p.color === 'function' ? p.color(k) : p.color;
      const chs = [...String(typeof p.ch === 'function' ? p.ch(k) : p.ch)];
      const [cx, cy] = snap(p.x, p.y);
      const al = a * p.alpha;
      if (chs.length === 1) put(cx, cy, chs[0], col, al, al * (p.bold ? 1.3 : 1) * (p.scale || 1), p);
      else { const x0 = cx - Math.floor((chs.length - 1) / 2); chs.forEach((g, i) => { if (g !== ' ') put(x0 + i, cy, g, col, al, 10 + al, p); }); }
      if (p.trail && p.tx != null) {
        // estela: la línea de casillas desde la posición de hace ~40 ms
        const [qx, qy] = posAt(p, Math.max(0, k - Math.min(0.4, 0.04 / p.life)));
        const [tx, ty] = snap(qx, qy);
        line(tx, ty, cx, cy, (x, y, i, n) => { if (i < n) put(x, y, chs[0], col, al * (0.3 + 0.4 * (i / n)), al * 0.4, p); });
      }
    }
    return cells;
  }
  draw(ctx, cell, cw, ch, fontFamily, { snap = (x, y) => [Math.floor(x), Math.floor(y)], fs = Math.round(ch / 1.18), mask = '#000', maskA = 1 } = {}) {
    if (!this.list.length) return;
    const cells = this.raster(snap);
    if (!cells.size) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    const fN = `${fs}px ${fontFamily}`, fB = `700 ${fs}px ${fontFamily}`;
    let lastFont = '';
    for (const o of cells.values()) {
      const [sx, sy] = cell(o.cx, o.cy);
      // fondo de la casilla: tapa el carácter de debajo (se desvanece con la partícula)
      if (mask) { ctx.globalAlpha = Math.min(1, o.a * 1.2) * maskA; ctx.fillStyle = mask; ctx.fillRect(sx, sy, cw, ch); }
      if (o.glow) { ctx.globalAlpha = 0.3 * o.a; ctx.fillStyle = o.col; ctx.fillRect(sx, sy, cw, ch); }
      const f = o.bold ? fB : fN;
      if (f !== lastFont) { ctx.font = f; lastFont = f; }
      ctx.globalAlpha = o.a;
      ctx.fillStyle = o.col;
      ctx.fillText(o.c, sx + cw / 2, sy + ch / 2 + 1);
    }
    ctx.restore();
  }

  // --------- emisores comunes ---------
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const ang = rng.float(0, Math.PI * 2);
      const sp = rng.float(opt.minSpeed ?? 1.5, opt.speed ?? 6);
      this.add({
        x: x + rng.float(-0.2, 0.2), y: y + rng.float(-0.2, 0.2), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (opt.up || 0),
        ay: opt.gravity ?? 0, drag: opt.drag ?? 2.5, life: rng.float(opt.minLife ?? 0.25, opt.life ?? 0.6),
        ch: Array.isArray(opt.chars) ? rng.pick(opt.chars) : opt.chars || '*',
        color: Array.isArray(opt.colors) ? rng.pick(opt.colors) : opt.colors || '#ffd23f',
        scale: opt.scale ?? rng.float(0.6, 1), glow: opt.glow || 0, delay: opt.delay || 0,
      });
    }
  }
  text(x, y, str, color, opt = {}) {
    this.add({ x, y: y - 0.3, vx: opt.vx ?? rng.float(-0.3, 0.3), vy: opt.vy ?? -1.6, drag: 1.2, life: opt.life ?? 1.0, ch: str, color, scale: opt.scale ?? 0.9, bold: true, glow: opt.glow ?? 6, delay: opt.delay || 0, fadeIn: true });
  }
  tracer(x0, y0, x1, y1, opt = {}) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const a = ((ang * 180) / Math.PI + 360) % 180;
    const ch = opt.ch || (a < 22.5 || a >= 157.5 ? '─' : a < 67.5 ? '\\' : a < 112.5 ? '│' : '/');
    const d = Math.hypot(x1 - x0, y1 - y0);
    return this.add({ x: x0, y: y0, x0, y0, tx: x1, ty: y1, life: opt.life ?? Math.max(0.06, d * (opt.speed ?? 0.018)), ch, color: opt.color || '#ffe9a0', glow: opt.glow ?? 8, noFade: true, delay: opt.delay || 0, scale: opt.scale ?? 1, onEnd: opt.onEnd, arc: opt.arc || 0, bold: true, trail: true });
  }
}

// posición de una partícula dirigida en el instante k (0–1) de su vida (la misma fórmula que update)
function posAt(p, k) {
  const e = p.ease ? p.ease(k) : k;
  return [p.x0 + (p.tx - p.x0) * e, p.y0 + (p.ty - p.y0) * e - (p.arc ? Math.sin(k * Math.PI) * p.arc : 0)];
}
// casillas de una línea (Bresenham): fn(x, y, i, n)
export function line(x0, y0, x1, y1, fn) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  const n = Math.max(dx, -dy);
  let err = dx + dy, x = x0, y = y0;
  for (let i = 0; i <= n; i++) {
    fn(x, y, i, n);
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
