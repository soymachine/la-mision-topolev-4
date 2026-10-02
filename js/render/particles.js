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

  draw(ctx, toScreen, cw, ch, fontFamily) {
    if (!this.list.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let lastFont = '';
    for (const p of this.list) {
      const k = p.t / p.life;
      const a = p.fadeIn ? Math.min(1, k * 5) * (1 - k) : p.noFade ? 1 : 1 - k * k;
      if (a <= 0.01) continue;
      const [sx, sy] = toScreen(p.x, p.y);
      const size = Math.round(ch * 0.8 * p.scale * (p.grow ? 1 + k * p.grow : 1));
      const f = `${p.bold ? '700 ' : ''}${size}px ${fontFamily}`;
      if (f !== lastFont) { ctx.font = f; lastFont = f; }
      ctx.globalAlpha = a * p.alpha;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.glow; } else ctx.shadowBlur = 0;
      ctx.fillStyle = typeof p.color === 'function' ? p.color(k) : p.color;
      const chs = typeof p.ch === 'function' ? p.ch(k) : p.ch;
      ctx.fillText(chs, sx + cw / 2, sy + ch / 2);
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
    return this.add({ x: x0, y: y0, x0, y0, tx: x1, ty: y1, life: opt.life ?? Math.max(0.06, d * (opt.speed ?? 0.018)), ch, color: opt.color || '#ffe9a0', glow: opt.glow ?? 8, noFade: true, delay: opt.delay || 0, scale: opt.scale ?? 1, onEnd: opt.onEnd, arc: opt.arc || 0, bold: true });
  }
}
