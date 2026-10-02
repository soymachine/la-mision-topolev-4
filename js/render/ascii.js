// Renderer ASCII en canvas: capa estática cacheada (terreno) + capa dinámica (entidades, efectos)
import { TILES, T } from '../data/tiles.js';
import { ENEMIES, enemyColor } from '../data/enemies.js';
import { hexToRgb, rng, clamp } from '../util/rng.js';
import { Particles } from './particles.js';
import { rarityColor, itemGlyph } from '../core/items.js';
import { ESSENCE_COLOR } from '../exp/shared.js';

export const FONT = '"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace';
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
const OBJ_GLYPH = { vein: '✦', cache: '■', locker: '▤', crate: '□', corpse: '%', note: '?', survivor: '☺' };
const OBJ_NAME = { vein: 'Veta de esencia', cache: 'Alijo de suministros', locker: 'Taquilla', crate: 'Caja de material', corpse: 'Cadáver de liquidador', note: 'Nota', survivor: 'Superviviente' };
export { OBJ_NAME };

export class MapRenderer {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.parts = new Particles();
    this.cam = { x: 0, y: 0 };
    this.shake = 0;
    this.pos = new Map(); // posiciones interpoladas
    this.flashes = new Map(); // destellos de entidades
    this.hover = null;
    this.overlay = null; // { path, target, blast, line }
    this.flashScreen = null;
    this.sx = 0; this.sy = 0;
    this.radar = 0;
    this.setZoom(15);
    this.resize();
  }

  setZoom(fs) {
    this.fs = clamp(Math.round(fs), 9, 28);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${this.fs}px ${FONT}`;
    this.cw = Math.ceil(c.measureText('M').width + 1);
    this.ch = Math.ceil(this.fs * 1.18);
    if (this.exp) this.buildStatic();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.vw = Math.max(50, r.width); this.vh = Math.max(50, r.height);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
  }

  attach(exp) {
    this.exp = exp;
    this.pos.clear();
    this.buildStatic();
    const c = exp.cur;
    if (c) this.centerOn(c.x, c.y, true);
  }

  // ---------- capa estática ----------
  buildStatic() {
    const e = this.exp;
    this.sdpr = this.dpr;
    if (e.w * this.cw * this.sdpr * e.h * this.ch * this.sdpr > 14e6) this.sdpr = 1;
    this.st = document.createElement('canvas');
    this.st.width = Math.ceil(e.w * this.cw * this.sdpr);
    this.st.height = Math.ceil(e.h * this.ch * this.sdpr);
    this.sctx = this.st.getContext('2d');
    this.sctx.scale(this.sdpr, this.sdpr);
    this.sctx.textAlign = 'center';
    this.sctx.textBaseline = 'middle';
    this.sctx.font = `${this.fs}px ${FONT}`;
    this.sctx.fillStyle = '#000';
    this.sctx.fillRect(0, 0, e.w * this.cw, e.h * this.ch);
    // retícula tenue de radar sobre lo inexplorado (muestra los límites del mapa)
    this.sctx.fillStyle = '#2c1606';
    for (let y = 0; y < e.h; y += 3) for (let x = 0; x < e.w; x += 4) this.sctx.fillText(x % 20 === 0 && y % 15 === 0 ? '+' : '·', x * this.cw + this.cw / 2, y * this.ch + this.ch / 2);
    this.code = new Int16Array(e.w * e.h).fill(-1);
    // roca expuesta
    this.exposed = new Uint8Array(e.w * e.h);
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) {
      const k = y * e.w + x;
      if (e.t[k] !== T.ROCK) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < e.w && ny < e.h && TILES[e.t[ny * e.w + nx]].walk) this.exposed[k] = 1;
      }
    }
    // caché de colores
    this.colCache = new Map();
    this.updateStatic(true);
  }
  tileColor(hex, bucket) {
    const key = hex + bucket;
    let c = this.colCache.get(key);
    if (!c) {
      const [r, g, b] = hexToRgb(hex);
      if (bucket === 0) {
        // recordado: oscuro y algo desaturado
        const m = (r + g + b) / 3;
        const f = 0.4;
        c = `rgb(${Math.round((r * 0.7 + m * 0.3) * f)},${Math.round((g * 0.7 + m * 0.3) * f)},${Math.round((b * 0.7 + m * 0.3) * f)})`;
      } else {
        const f = 0.5 + (bucket / 7) * 0.62;
        c = `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
      }
      this.colCache.set(key, c);
    }
    return c;
  }
  updateStatic(all = false) {
    const e = this.exp;
    const ctx = this.sctx;
    const cw = this.cw, ch = this.ch;
    const W = e.w, H = e.h;
    for (let k = 0; k < W * H; k++) {
      const ex = e.explored[k];
      if (!ex) continue;
      const v = e.visible[k];
      const bucket = v ? 1 + Math.min(6, Math.floor(((v - 40) / 216) * 7)) : 0;
      const tt = e.t[k];
      const code = (tt << 4) | (bucket << 1) | 1;
      if (this.code[k] === code) continue;
      this.code[k] = code;
      const x = k % W, y = (k / W) | 0;
      const px = x * cw, py = y * ch;
      const td = TILES[tt];
      ctx.fillStyle = '#000';
      ctx.fillRect(px, py, cw, ch);
      if (tt === T.ROCK && !this.exposed[k]) continue;
      const hsh = hash(x, y);
      if (td.bg) { ctx.fillStyle = this.tileColor(td.bg, bucket); ctx.fillRect(px, py, cw, ch); }
      const g = td.glyphs[hsh % td.glyphs.length];
      ctx.fillStyle = this.tileColor(td.fg[(hsh >>> 8) % td.fg.length], bucket);
      ctx.fillText(g, px + cw / 2, py + ch / 2 + 1);
    }
  }

  // ---------- cámara ----------
  centerOn(x, y, snap = false) {
    const cols = this.vw / this.cw, rows = this.vh / this.ch;
    const e = this.exp;
    let tx = x + 0.5 - cols / 2, ty = y + 0.5 - rows / 2;
    if (e.w <= cols) tx = (e.w - cols) / 2; else tx = clamp(tx, -2, e.w - cols + 2);
    if (e.h <= rows) ty = (e.h - rows) / 2; else ty = clamp(ty, -2, e.h - rows + 2);
    this.camT = { x: tx, y: ty };
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
  }
  toScreen = (x, y) => [(x - this.cam.x) * this.cw + this.sx, (y - this.cam.y) * this.ch + this.sy];
  screenToCell(px, py) {
    return [Math.floor(px / this.cw + this.cam.x), Math.floor(py / this.ch + this.cam.y)];
  }

  // interpolación de entidades
  rpos(id, x, y, dt) {
    let p = this.pos.get(id);
    if (!p) { p = { x, y }; this.pos.set(id, p); return p; }
    if (Math.abs(p.x - x) > 3 || Math.abs(p.y - y) > 3) { p.x = x; p.y = y; return p; }
    const k = 1 - Math.exp(-dt * 22);
    p.x += (x - p.x) * k; p.y += (y - p.y) * k;
    return p;
  }

  // ---------- efectos ----------
  consumeFx() {
    const e = this.exp;
    if (!e.fx.length) return;
    const P = this.parts;
    for (const f of e.fx) {
      const d = f.delay || 0;
      switch (f.type) {
        case 'muzzle': P.burst(f.x + 0.5, f.y + 0.5, 4, { chars: ['*', '+', '·'], colors: ['#fff6c0', '#ffd23f'], speed: 4, life: 0.18, glow: 10 }); break;
        case 'shot': {
          const ox = f.hit ? 0 : rng.float(-0.8, 0.8), oy = f.hit ? 0 : rng.float(-0.8, 0.8);
          const col = f.wtype === 'energy' ? '#7ff' : '#ffe9a0';
          P.tracer(f.x0 + 0.5, f.y0 + 0.5, f.x1 + 0.5 + ox, f.y1 + 0.5 + oy, { delay: d, color: col, onEnd: f.hit ? (p) => P.burst(p.x, p.y, 5, { chars: ['*', '·', ','], colors: ['#ff6a3d', '#ffd23f', '#fff'], speed: 4, life: 0.3 }) : null });
          break;
        }
        case 'slash': P.burst(f.x1 + 0.5, f.y1 + 0.5, 3, { chars: ['/', '\\', 'x'], colors: ['#fff', '#ffd0a0'], speed: 1.5, life: 0.25, delay: d, scale: 1.2 }); break;
        case 'beam': {
          const n = Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0));
          for (let i = 1; i <= n; i++) {
            const t = i / n;
            P.add({ x: f.x0 + 0.5 + (f.x1 - f.x0) * t, y: f.y0 + 0.5 + (f.y1 - f.y0) * t, life: 0.45, ch: '═', color: i % 2 ? '#bfffff' : '#5ff7ff', glow: 14, delay: i * 8, scale: 1.1 });
          }
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'arc': {
          const n = Math.max(2, Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) * 1.5));
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            P.add({ x: f.x0 + 0.5 + (f.x1 - f.x0) * t + rng.float(-0.3, 0.3), y: f.y0 + 0.5 + (f.y1 - f.y0) * t + rng.float(-0.3, 0.3), life: 0.3, ch: rng.pick(['~', '*', '≈']), color: '#9ff', glow: 12, delay: d });
          }
          break;
        }
        case 'flame': P.burst(f.x + 0.5, f.y + 0.5, 4, { chars: ['^', '*', '▲', '"'], colors: ['#ff3b1f', '#ff8a1f', '#ffd23f'], speed: 1.5, up: 2, life: 0.5, delay: d, glow: 8 }); break;
        case 'dmg': P.text(f.x + 0.5, f.y + 0.5, (f.crit ? '¡' : '−') + f.n + (f.crit ? '!' : ''), f.color, { delay: d, scale: f.crit ? 1.25 : 0.9 }); this.flashes.set(f.agent ? 'a' + f.x + ',' + f.y : 'c' + f.x + ',' + f.y, performance.now() + d + 120); break;
        case 'miss': P.text(f.x + 0.5, f.y + 0.5, 'fallo', '#9a5a22', { delay: d, scale: 0.6, glow: 0, life: 0.7 }); break;
        case 'kill': {
          P.burst(f.x + 0.5, f.y + 0.5, f.boss ? 40 : 14, { chars: [f.glyph, '·', ',', '\'', '*', '`'], colors: [f.color, f.color, '#fff'], speed: f.boss ? 9 : 6, gravity: 9, drag: 1.5, life: 0.9, delay: d, up: 3 });
          P.burst(f.x + 0.5, f.y + 0.5, 6, { chars: ['✦'], colors: [ESSENCE_COLOR], speed: 2, up: 1, life: 0.9, delay: d + 150, glow: 10 });
          if (f.boss) this.shake = Math.max(this.shake, 14);
          break;
        }
        case 'essence':
          P.burst(f.x + 0.5, f.y + 0.5, 8 + Math.min(20, f.n), { chars: ['✦', '·', '*'], colors: [ESSENCE_COLOR, '#bfffff'], speed: 3, up: 3, life: 0.8, glow: 12 });
          P.text(f.x + 0.5, f.y, `+${f.n} ✦`, ESSENCE_COLOR, { vy: -1.2, life: 1.3 });
          this.onEssence && this.onEssence(f.n);
          break;
        case 'mine':
          for (let i = 0; i < 8; i++) P.add({ x: f.x + 0.5, y: f.y + 0.5, x0: f.x + 0.5 + rng.float(-0.4, 0.4), y0: f.y + 0.5 + rng.float(-0.4, 0.4), tx: f.tx + 0.5, ty: f.ty + 0.5, arc: rng.float(0.3, 1.2), life: rng.float(0.35, 0.7), ch: '✦', color: ESSENCE_COLOR, glow: 10, delay: i * 40, noFade: true, ease: (k) => k * k });
          P.burst(f.x + 0.5, f.y + 0.5, 6, { chars: [':', '.', '*'], colors: ['#8a4a1c', ESSENCE_COLOR], speed: 3, gravity: 6, life: 0.5 });
          P.text(f.tx + 0.5, f.ty, `+${f.n} ✦`, ESSENCE_COLOR, { delay: 350 });
          this.onEssence && this.onEssence(f.n);
          break;
        case 'hurt': this.flashes.set('h' + f.x + ',' + f.y, performance.now() + d + 160); if (this.exp.cur && this.exp.cur.x === f.x && this.exp.cur.y === f.y) { this.shake = Math.max(this.shake, 5); this.flashScreen = { color: 'rgba(255,40,30,', t: performance.now() + d, dur: 260 }; } break;
        case 'death':
          P.burst(f.x + 0.5, f.y + 0.5, 30, { chars: ['@', '*', '·', '+', '%'], colors: [f.color, '#ff3b30', '#fff'], speed: 8, gravity: 8, life: 1.2 });
          this.shake = Math.max(this.shake, 12);
          this.flashScreen = { color: 'rgba(255,0,0,', t: performance.now(), dur: 700 };
          break;
        case 'explosion': {
          const r = f.r;
          setTimeout(() => {
            this.shake = Math.max(this.shake, 8 + r * 3);
            P.burst(f.x + 0.5, f.y + 0.5, 18 + r * 14, { chars: ['*', '#', '%', '&', '@', '▓', '▒'], colors: f.fire ? ['#ff3b1f', '#ff8a1f', '#ffd23f'] : ['#ffffff', '#ffd23f', '#ff8a1f', '#ff3b1f'], speed: 4 + r * 4, life: 0.7, glow: 12 });
            P.burst(f.x + 0.5, f.y + 0.5, 10 + r * 6, { chars: ['░', '▒', '·'], colors: ['#5a4a40', '#3a302a', '#7a6a5a'], speed: 2 + r, life: 1.6, drag: 1.5, up: 0.6 });
          }, d);
          break;
        }
        case 'smoke': setTimeout(() => P.burst(f.x + 0.5, f.y + 0.5, 30, { chars: ['░', '▒', '·', 'o'], colors: ['#8a8078', '#b0a89e', '#605850'], speed: 3, life: 1.5, drag: 1.5 }), d); break;
        case 'flash':
          setTimeout(() => {
            this.flashScreen = { color: 'rgba(255,250,220,', t: performance.now(), dur: 350 };
            P.burst(f.x + 0.5, f.y + 0.5, 24, { chars: ['*', '+', '✶', '·'], colors: ['#fff', '#ffe9a0'], speed: 8, life: 0.5, glow: 16 });
          }, d);
          break;
        case 'spores': P.burst(f.x + 0.5, f.y + 0.5, 30, { chars: ['°', 'o', '·', '░'], colors: ['#c06cff', '#9a4adf', '#e0a0ff'], speed: 4, life: 1.2, drag: 2 }); break;
        case 'zap': P.burst(f.x + 0.5, f.y + 0.5, 8, { chars: ['*', '+', '\\', '/', '|'], colors: ['#bfe8ff', '#5fb0ff', '#fff'], speed: 5, life: 0.25, glow: 14 }); this.flashes.set('h' + f.x + ',' + f.y, performance.now() + 120); break;
        case 'open': P.burst(f.x + 0.5, f.y + 0.5, 6, { chars: ['·', '\'', ','], colors: ['#c97a2c', '#ffb35c'], speed: 2.5, life: 0.4 }); break;
        case 'pickup': P.burst(f.x + 0.5, f.y + 0.5, 6, { chars: ['+', '*', '·'], colors: [f.color], speed: 2, up: 2, life: 0.5, glow: 8 }); break;
        case 'heal': P.burst(f.x + 0.5, f.y + 0.5, 10, { chars: ['+'], colors: [f.color || '#3ddc6b'], speed: 1.2, up: 2.5, life: 0.9, glow: 8 }); break;
        case 'levelup':
          for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; P.add({ x: f.x + 0.5, y: f.y + 0.5, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, drag: 3, life: 1, ch: '★', color: '#ffb02e', glow: 12 }); }
          P.text(f.x + 0.5, f.y - 0.5, '¡NIVEL!', '#ffb02e', { life: 1.6, scale: 1.1 });
          break;
        case 'reload': P.text(f.x + 0.5, f.y + 0.5, 'clac', '#9a5a22', { scale: 0.55, glow: 0, life: 0.6 }); break;
        case 'door': P.burst(f.x + 0.5, f.y + 0.5, 3, { chars: ['·', '\''], colors: ['#c97a2c'], speed: 1.5, life: 0.3 }); break;
        case 'wake': P.text(f.x + 0.5, f.y, '!', '#ff3b30', { vy: -0.8, scale: 1.2, life: 1 }); break;
        case 'spawn': P.burst(f.x + 0.5, f.y + 0.5, 10, { chars: ['·', '*', ','], colors: ['#3ddc6b', '#8aff6a'], speed: 3, life: 0.5 }); break;
        case 'charge': P.burst(f.x + 0.5, f.y + 0.5, 10, { chars: [':', '.', '·'], colors: ['#8a4a1c', '#c97a2c'], speed: 4, life: 0.5, gravity: 4 }); this.shake = Math.max(this.shake, 4); break;
        case 'throw': P.add({ x: f.x0 + 0.5, y: f.y0 + 0.5, x0: f.x0 + 0.5, y0: f.y0 + 0.5, tx: f.x1 + 0.5, ty: f.y1 + 0.5, arc: 1 + Math.hypot(f.x1 - f.x0, f.y1 - f.y0) * 0.15, life: 0.26, ch: f.glyph, color: '#fff', noFade: true, bold: true }); break;
        case 'flare': P.burst(f.x + 0.5, f.y + 0.5, 30, { chars: ['*', '+', '·'], colors: ['#ff6ad5', '#fff', '#ffb0e8'], speed: 5, life: 1, glow: 16, delay: d }); break;
        case 'newexit': case 'evac':
          for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; P.add({ x: f.x + 0.5, y: f.y + 0.5, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6 * 0.6, drag: 1.5, life: 1.1, ch: '·', color: '#5ff7ff', glow: 10, delay: ring * 220 }); }
          break;
        case 'extract':
          for (let i = 0; i < 18; i++) P.add({ x: f.x + 0.5 + rng.float(-0.3, 0.3), y: f.y + 0.5, vy: -rng.float(6, 14), life: 1, ch: rng.pick(['│', '║', '·', '*']), color: rng.pick(['#5ff7ff', '#fff', f.color]), glow: 12, delay: i * 20 });
          break;
        case 'ebolt':
          P.tracer(f.x0 + 0.5, f.y0 + 0.5, f.x1 + 0.5 + (f.hit ? 0 : rng.float(-0.8, 0.8)), f.y1 + 0.5 + (f.hit ? 0 : rng.float(-0.8, 0.8)), { ch: '*', color: f.color, speed: 0.03, glow: 12, onEnd: f.hit ? (p) => P.burst(p.x, p.y, 6, { chars: ['*', '·'], colors: [f.color, '#fff'], speed: 4, life: 0.3 }) : null });
          break;
        case 'bite': {
          this.lunge = this.lunge || new Map();
          this.lunge.set(f.x0 + ',' + f.y0, { dx: (f.x1 - f.x0) * 0.35, dy: (f.y1 - f.y0) * 0.35, t: performance.now() });
          P.burst(f.x1 + 0.5, f.y1 + 0.5, 3, { chars: ['/', '\\', '×'], colors: [f.color, '#fff'], speed: 2, life: 0.25, delay: 60 });
          break;
        }
        case 'surge': this.flashScreen = { color: 'rgba(184,245,61,', t: performance.now(), dur: 1500 }; this.shake = 10; break;
        case 'alert': this.alertPulse = performance.now(); break;
      }
    }
    e.fx.length = 0;
  }

  // ---------- frame ----------
  frame(now, dt) {
    const e = this.exp;
    if (!e) return;
    this.consumeFx();
    if (e.dirty) { this.updateStatic(); e.dirty = false; }
    // limpieza periódica de cachés
    if ((this.gc = (this.gc || 0) + 1) % 120 === 0) {
      for (const [k, t] of this.flashes) if (t < now) this.flashes.delete(k);
      if (this.lunge) for (const [k, l] of this.lunge) if (now - l.t > 300) this.lunge.delete(k);
      const live = new Set([...e.enemies.map((x) => x.uid), ...e.squad.map((x) => x.id)]);
      for (const k of this.pos.keys()) if (!live.has(k)) this.pos.delete(k);
    }
    const ctx = this.ctx;
    const cw = this.cw, ch = this.ch;
    // cámara
    if (this.camT) {
      const k = 1 - Math.exp(-dt * 9);
      this.cam.x += (this.camT.x - this.cam.x) * k;
      this.cam.y += (this.camT.y - this.cam.y) * k;
    }
    this.shake *= Math.exp(-dt * 10);
    this.sx = this.shake > 0.3 ? rng.float(-this.shake, this.shake) * 0.5 : 0;
    this.sy = this.shake > 0.3 ? rng.float(-this.shake, this.shake) * 0.5 : 0;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.vw, this.vh);
    // blit de la capa estática
    const ox = -this.cam.x * cw + this.sx, oy = -this.cam.y * ch + this.sy;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.st, 0, 0, this.st.width, this.st.height, Math.round(ox * this.dpr) / this.dpr, Math.round(oy * this.dpr) / this.dpr, e.w * cw, e.h * ch);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = `${this.fs}px ${FONT}`;
    const fontB = `700 ${this.fs}px ${FONT}`;
    ctx.font = font;
    const x0 = Math.max(0, Math.floor(this.cam.x) - 1), y0 = Math.max(0, Math.floor(this.cam.y) - 1);
    const x1 = Math.min(e.w - 1, Math.ceil(this.cam.x + this.vw / cw) + 1), y1 = Math.min(e.h - 1, Math.ceil(this.cam.y + this.vh / ch) + 1);
    const T_ = now / 1000;
    const S = this.toScreen;
    const glyph = (x, y, g, color, bg = null, scale = 1, bold = false) => {
      const [sx, sy] = S(x, y);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(sx, sy, cw, ch); }
      ctx.fillStyle = color;
      if (scale !== 1 || bold) ctx.font = `${bold ? '700 ' : ''}${Math.round(this.fs * scale)}px ${FONT}`;
      ctx.fillText(g, sx + cw / 2, sy + ch / 2 + 1);
      if (scale !== 1 || bold) ctx.font = font;
    };

    // ---- celdas animadas: agua, campos ----
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * e.w + x;
        const v = e.visible[k];
        if (!v) {
          if (e.explored[k] && e.anomaly[k] && Math.sin(T_ * 7 + x * 3 + y) > 0.97) glyph(x, y, '*', 'rgba(120,180,255,.5)');
          continue;
        }
        const tt = e.t[k];
        if (tt === T.WATER || tt === T.DEEP) {
          const w = Math.sin(T_ * 1.6 + x * 0.55 + y * 0.9) + Math.sin(T_ * 0.9 - x * 0.3 + y * 0.2);
          const b = 0.45 + 0.4 * (v / 255);
          const col = tt === T.DEEP ? `rgba(${42 + w * 10},${111 + w * 16},${154 + w * 18},${b})` : `rgba(${46 + w * 14},${140 + w * 22},${126 + w * 18},${b})`;
          glyph(x, y, w > 0.6 ? '≈' : w < -0.8 ? '-' : '~', col, tt === T.DEEP ? '#020a12' : '#03110f');
        }
        if (e.rad[k] > 1.2 && Math.sin(T_ * 3 + hashf(x, y) * 40) > 0.93) {
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(184,245,61,${Math.min(0.7, e.rad[k] / 8)})`;
          ctx.fillText('·', sx + cw / 2 + Math.sin(T_ * 5 + x) * cw * 0.3, sy + ch / 2);
        }
        if (e.rad[k] > 0.8) {
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(150,255,40,${Math.min(0.13, e.rad[k] / 50) * (0.7 + 0.3 * Math.sin(T_ * 2 + x * 0.3))})`;
          ctx.fillRect(sx, sy, cw, ch);
        }
        if (e.anomaly[k]) {
          const fl = Math.sin(T_ * 11 + x * 7.3 + y * 3.1);
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(80,140,255,${0.12 + 0.1 * fl})`; ctx.fillRect(sx, sy, cw, ch);
          if (fl > 0.6) glyph(x, y, rng.pick(['*', '+', '·', '\'']), `rgba(190,230,255,${0.5 + fl * 0.5})`);
        }
        if (e.gas[k]) {
          const a = Math.min(0.55, e.gas[k] / 10);
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(160,70,220,${a * 0.5})`; ctx.fillRect(sx, sy, cw, ch);
          glyph(x, y, Math.sin(T_ * 2 + x + y * 2) > 0 ? '░' : '▒', `rgba(200,120,255,${a})`);
        }
        if (e.smoke[k]) {
          const a = Math.min(0.8, e.smoke[k] / 10 + 0.2);
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(90,85,80,${a * 0.6})`; ctx.fillRect(sx, sy, cw, ch);
          glyph(x, y, Math.sin(T_ * 1.5 + x * 0.7 + y) > 0 ? '▒' : '░', `rgba(170,160,150,${a})`);
        }
        if (e.fire[k]) {
          const f = Math.sin(T_ * 17 + x * 5 + y * 3);
          glyph(x, y, f > 0.3 ? '▲' : f > -0.4 ? '^' : '*', f > 0.3 ? '#ffd23f' : f > -0.4 ? '#ff8a1f' : '#ff3b1f', 'rgba(80,10,0,.6)');
        }
      }
    }

    // ---- objetos (contenedores, vetas) ----
    for (const o of e.objects) {
      if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      const k = o.y * e.w + o.x;
      if (!e.explored[k]) continue;
      const vis = e.visible[k] > 0;
      let col, g = OBJ_GLYPH[o.kind];
      if (o.kind === 'vein') {
        if (o.amount <= 0) col = '#2a5a5a';
        else { const p = 0.6 + 0.4 * Math.sin(T_ * 3 + o.x); col = vis ? `rgba(95,247,255,${p})` : 'rgba(95,247,255,.35)'; }
        if (vis && o.amount > 0) { ctx.shadowColor = ESSENCE_COLOR; ctx.shadowBlur = 10; }
        glyph(o.x, o.y, g, col, vis ? '#021416' : null, 1.1, true);
        ctx.shadowBlur = 0;
        continue;
      }
      if (o.kind === 'note') { glyph(o.x, o.y, '?', o.opened ? (vis ? '#7a6a4a' : '#3a3020') : vis ? `rgba(240,225,170,${0.7 + 0.3 * Math.sin(T_ * 3 + o.x)})` : '#5a5030', null, 1, !o.opened); continue; }
      if (o.kind === 'survivor') { glyph(o.x, o.y, '☺', vis ? `rgba(160,232,160,${0.75 + 0.25 * Math.sin(T_ * 2)})` : '#3a5a3a', null, 1.05, true); continue; }
      if (o.opened) col = vis ? '#6a4a2a' : '#3a2814';
      else if (o.kind === 'cache') col = vis ? (this.radar >= 2 ? rarityColor(o.best) : '#ffb02e') : '#7a5a20';
      else col = vis ? '#d9a066' : '#6a4a2a';
      glyph(o.x, o.y, g, col, vis && o.kind !== 'corpse' ? '#140a02' : null, 1, o.kind === 'cache' && !o.opened);
    }
    // ---- esencia en el suelo ----
    for (const [k, n] of e.essence) {
      const x = k % e.w, y = (k / e.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !e.visible[k]) continue;
      const p = 0.65 + 0.35 * Math.sin(T_ * 5 + x * 2);
      ctx.shadowColor = ESSENCE_COLOR; ctx.shadowBlur = 8;
      glyph(x, y, n >= 20 ? '✦' : '*', `rgba(95,247,255,${p})`, null, 1, true);
      ctx.shadowBlur = 0;
    }
    // ---- objetos en el suelo ----
    for (const [k, list] of e.floorItems) {
      if (!list.length) continue;
      const x = k % e.w, y = (k / e.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !e.explored[k]) continue;
      const best = list.reduce((a, b) => (b.r > a.r ? b : a), list[0]);
      const vis = e.visible[k] > 0;
      glyph(x, y, list.length > 1 ? '&' : itemGlyph(best), vis ? rarityColor(best.r) : '#4a3a2a', null, 1, true);
    }
    // ---- extracciones (siempre visibles) ----
    for (const ex of e.exits) {
      const temp = !ex.perm;
      const left = temp ? ex.expires - e.turn : 99;
      const p = 0.55 + 0.45 * Math.sin(T_ * 4);
      const evacHere = e.evac && e.evac.x === ex.x && e.evac.y === ex.y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = ex.x + dx, y = ex.y + dy;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        if (dx || dy) {
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(95,247,255,${(evacHere ? 0.25 : 0.1) * p})`;
          ctx.fillRect(sx, sy, cw, ch);
          glyph(x, y, '░', `rgba(95,247,255,${0.25 + 0.3 * p * ((Math.sin(T_ * 6 - (Math.abs(dx) + Math.abs(dy))) + 1) / 2)})`);
        }
      }
      if (ex.x >= x0 && ex.x <= x1 && ex.y >= y0 && ex.y <= y1) {
        ctx.shadowColor = '#5ff7ff'; ctx.shadowBlur = 12 * p;
        glyph(ex.x, ex.y, '⌂', temp && left < 6 && Math.sin(T_ * 12) > 0 ? '#ff3b30' : '#5ff7ff', '#001416', 1.1, true);
        ctx.shadowBlur = 0;
        const [sx, sy] = S(ex.x, ex.y - 1);
        ctx.font = `700 ${Math.round(this.fs * 0.62)}px ${FONT}`;
        ctx.fillStyle = '#5ff7ff';
        const lbl = evacHere ? `EVAC ${e.evac.left}` : temp ? `${left}t` : 'SALIDA';
        ctx.fillText(lbl, sx + cw / 2, sy + ch / 2 - ch * 0.6);
        ctx.font = font;
      }
    }
    for (const p of e.pending) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      glyph(p.x, p.y, '◊', `rgba(95,247,255,${0.5 + 0.5 * Math.sin(T_ * 8)})`);
    }

    // ---- trampas propias ----
    for (const t of e.traps || []) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1 || !e.explored[t.y * e.w + t.x]) continue;
      glyph(t.x, t.y, '×', `rgba(255,80,60,${0.55 + 0.25 * Math.sin(T_ * 3)})`);
    }
    // ---- enemigos detectados por el detector de movimiento ----
    if (e.sense > 0) {
      for (const en of e.enemies) {
        if (e.visible[en.y * e.w + en.x]) continue;
        if (!e.team.some((q) => Math.hypot(q.x - en.x, q.y - en.y) <= e.senseR)) continue;
        if (en.x < x0 || en.x > x1 || en.y < y0 || en.y > y1) continue;
        const def = ENEMIES[en.type];
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(T_ * 4 + en.x);
        glyph(en.x, en.y, def.glyph, enemyColor(def.hue, en.lvl), null, 1, true);
        ctx.globalAlpha = 1;
      }
    }
    // ---- enemigos ----
    const lunge = this.lunge;
    for (const en of e.enemies) {
      const k = en.y * e.w + en.x;
      if (!e.visible[k]) { this.pos.delete(en.uid); continue; }
      const def = ENEMIES[en.type];
      const p = this.rpos(en.uid, en.x, en.y, dt);
      let rx = p.x, ry = p.y;
      if (lunge) {
        const l = lunge.get(en.x + ',' + en.y);
        if (l) { const t = (now - l.t) / 160; if (t < 1) { const s = Math.sin(t * Math.PI); rx += l.dx * s; ry += l.dy * s; } else lunge.delete(en.x + ',' + en.y); }
      }
      const col = enemyColor(def.hue, en.lvl);
      const fl = this.flashes.get('c' + en.x + ',' + en.y);
      const flashing = fl && fl > now;
      const [sx, sy] = S(rx, ry);
      const breathe = en.state === 'dormido' ? 0.55 + 0.15 * Math.sin(T_ * 2 + en.x) : 1;
      if (def.boss) { ctx.shadowColor = col; ctx.shadowBlur = 14 + 6 * Math.sin(T_ * 3); }
      else if (en.lvl >= 7) { ctx.shadowColor = col; ctx.shadowBlur = 6; }
      ctx.globalAlpha = breathe;
      ctx.fillStyle = flashing ? '#ffffff' : col;
      ctx.font = def.boss ? `800 ${Math.round(this.fs * 1.25)}px ${FONT}` : fontB;
      ctx.fillText(def.glyph, sx + cw / 2, sy + ch / 2 + 1);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.font = font;
      // barra de vida
      if (en.hp < en.hpMax) {
        const w = cw - 2, f = Math.max(0, en.hp / en.hpMax);
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(sx + 1, sy + ch - 2, w, 2);
        ctx.fillStyle = f > 0.5 ? '#3ddc6b' : f > 0.25 ? '#ffd23f' : '#ff3b30';
        ctx.fillRect(sx + 1, sy + ch - 2, w * f, 2);
      }
      if (en.stun > 0) { ctx.font = `${Math.round(this.fs * 0.6)}px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.fillText(['✶', '*', '·', '*'][Math.floor(T_ * 8) % 4], sx + cw / 2 + Math.sin(T_ * 6) * cw * 0.4, sy - ch * 0.15); ctx.font = font; }
      if (en.state === 'dormido' && Math.sin(T_ * 1.3 + en.x * 2) > 0.985) this.parts.add({ x: en.x + 0.8, y: en.y, vy: -0.8, vx: 0.3, life: 1.4, ch: 'z', color: col, scale: 0.6 });
    }
    // ---- agentes ----
    for (const sq of e.squad) {
      if (!e.inMap(sq)) { this.pos.delete(sq.id); continue; }
      const p = this.rpos(sq.id, sq.x, sq.y, dt);
      const [sx, sy] = S(p.x, p.y);
      const active = sq === e.cur;
      const fl = this.flashes.get('h' + sq.x + ',' + sq.y);
      const hurt = fl && fl > now;
      if (active) {
        const a = 0.35 + 0.25 * Math.sin(T_ * 4);
        ctx.strokeStyle = `rgba(255,138,31,${a + 0.2})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, cw - 1, ch - 1);
        ctx.fillStyle = `rgba(255,138,31,${a * 0.25})`;
        ctx.fillRect(sx, sy, cw, ch);
      }
      ctx.shadowColor = sq.a.color; ctx.shadowBlur = active ? 10 : 4;
      ctx.fillStyle = hurt ? '#ff3b30' : sq.a.color;
      ctx.font = fontB;
      ctx.fillText('@', sx + cw / 2, sy + ch / 2 + 1);
      ctx.shadowBlur = 0; ctx.font = font;
      const st = e.ast(sq);
      const f = Math.max(0, sq.a.hp / st.hpMaxEff);
      if (f < 1) {
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(sx + 1, sy + ch - 2, cw - 2, 2);
        ctx.fillStyle = f > 0.5 ? '#3ddc6b' : f > 0.25 ? '#ffd23f' : '#ff3b30';
        ctx.fillRect(sx + 1, sy + ch - 2, (cw - 2) * f, 2);
      }
    }

    // ---- superposiciones: hover, ruta, objetivo ----
    const ov = this.overlay;
    if (ov && ov.path) {
      ctx.fillStyle = 'rgba(255,179,92,.55)';
      for (let i = 0; i < ov.path.length; i++) {
        const [x, y] = ov.path[i];
        const [sx, sy] = S(x, y);
        ctx.fillText(i === ov.path.length - 1 ? '×' : '·', sx + cw / 2, sy + ch / 2);
      }
    }
    if (ov && ov.line) {
      const [lx0, ly0, lx1, ly1, ok] = ov.line;
      const [ax, ay] = S(lx0 + 0.5, ly0 + 0.5), [bx, by] = S(lx1 + 0.5, ly1 + 0.5);
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -T_ * 20;
      ctx.strokeStyle = ok ? 'rgba(255,210,63,.75)' : 'rgba(255,59,48,.75)';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
    }
    if (ov && ov.blast) {
      const { x, y, r } = ov.blast;
      ctx.fillStyle = 'rgba(255,90,40,.18)';
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
        if (Math.hypot(xx - x, yy - y) > r + 0.5) continue;
        const [sx, sy] = S(xx, yy); ctx.fillRect(sx, sy, cw, ch);
      }
    }
    if (this.hover) {
      const [hx, hy] = this.hover;
      const [sx, sy] = S(hx, hy);
      const tgt = ov && ov.targetMode;
      ctx.strokeStyle = tgt ? '#ff3b30' : 'rgba(255,179,92,.9)';
      ctx.lineWidth = 1;
      const c = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy + c); ctx.lineTo(sx, sy); ctx.lineTo(sx + c, sy);
      ctx.moveTo(sx + cw - c, sy); ctx.lineTo(sx + cw, sy); ctx.lineTo(sx + cw, sy + c);
      ctx.moveTo(sx + cw, sy + ch - c); ctx.lineTo(sx + cw, sy + ch); ctx.lineTo(sx + cw - c, sy + ch);
      ctx.moveTo(sx + c, sy + ch); ctx.lineTo(sx, sy + ch); ctx.lineTo(sx, sy + ch - c);
      ctx.stroke();
      if (ov && ov.hit != null) {
        ctx.font = `700 ${Math.round(this.fs * 0.75)}px ${FONT}`;
        ctx.fillStyle = '#000'; ctx.fillRect(sx + cw + 2, sy - 2, cw * 3.6, ch * 0.8);
        ctx.fillStyle = ov.hit >= 60 ? '#3ddc6b' : ov.hit >= 35 ? '#ffd23f' : '#ff3b30';
        ctx.textAlign = 'left';
        ctx.fillText(ov.hit + '%', sx + cw + 4, sy + ch * 0.3);
        ctx.textAlign = 'center';
        ctx.font = font;
      }
    }

    // ---- partículas ----
    this.parts.update(dt, now);
    this.parts.draw(ctx, S, cw, ch, FONT);

    // ---- destellos de pantalla ----
    const fsc = this.flashScreen;
    if (fsc) {
      const t = (now - fsc.t) / fsc.dur;
      if (t >= 1) this.flashScreen = null;
      else if (t >= 0) {
        const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.3, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.7);
        g.addColorStop(0, fsc.color + '0)');
        g.addColorStop(1, fsc.color + (0.45 * (1 - t)) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
      }
    }
    if (this.alertPulse) {
      const t = (now - this.alertPulse) / 600;
      if (t > 1) this.alertPulse = null;
      else { ctx.strokeStyle = `rgba(255,59,48,${0.6 * (1 - t)})`; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, this.vw - 3, this.vh - 3); ctx.lineWidth = 1; }
    }
  }
}

function hashf(x, y) { return (hash(x, y) % 1000) / 1000; }
