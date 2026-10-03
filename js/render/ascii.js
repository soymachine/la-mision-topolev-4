// Renderer ASCII en canvas: capa estática cacheada (terreno) + capa dinámica (entidades, efectos)
// Revisión (capa ASCII): todo lo que se dibuja cae en la rejilla de caracteres. La cámara, el temblor, el movimiento
// interpolado de las entidades y las partículas siguen calculándose con decimales (capa lógica), pero se pintan en la
// casilla entera más cercana, con una sola letra por casilla (lo de encima tapa lo de debajo con el fondo de la casilla).
// Los halos y brillos son tintes del fondo de las casillas; los destellos de pantalla, viñetas de casillas tintadas;
// el cursor, vídeo inverso; la línea de tiro, una línea de casillas.
import { TILES, T } from '../data/tiles.js';
import { exitKnown } from '../exp/intel.js';
import { ENEMIES, enemyColor } from '../data/enemies.js';
import { ACTORS, actorColor, actorFaction, isHuman } from '../data/actors.js';
import { FACTIONS } from '../data/factions.js';
import { hexToRgb, rng, clamp } from '../util/rng.js';
import { Particles, line } from './particles.js';
import { rarityColor, itemGlyph } from '../core/items.js';
import { ESSENCE_COLOR } from '../exp/shared.js';

export const FONT = '"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace';
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
const OBJ_GLYPH = { vein: '✦', cache: '■', locker: '▤', crate: '□', corpse: '%', note: '?', survivor: '☺', shard: '✧', cart: 'Ш', trader: '₽', medic: '✚', board: '▦', archive: '▥', wreck: '✈', radio: '☏', sabotage: '▣', objective: '◎' };
const OBJ_NAME = { vein: 'Veta de esencia', cache: 'Alijo de suministros', locker: 'Taquilla', crate: 'Caja de material', corpse: 'Cadáver de liquidador', note: 'Nota', survivor: 'Superviviente', shard: 'Cristal de esencia incrustado', cart: 'Vagoneta', trader: 'Comerciante', medic: 'Enfermería', board: 'Tablón de anuncios', archive: 'Archivo del KGB', wreck: 'Restos del aparato', radio: 'Radio de campaña', dogcargo: 'Carga de Laika', sabotage: 'Centro de mando (sabotaje)', objective: 'Objetivo del encargo' };
export { OBJ_NAME };
const SOCIAL_COL = { trader: '#e6c86a', medic: '#ff6a6a', board: '#c8b48c', archive: '#e05050', wreck: '#b0b8c0', radio: '#5fd0ff', sabotage: '#ff5050', objective: '#ffd23f' };

export class MapRenderer {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas'; // (alto contraste: filtro CSS, fase 24.1)
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.parts = new Particles();
    this.cam = { x: 0, y: 0 };
    this.camR = { x: 0, y: 0 }; // cámara en casillas enteras (lo que se dibuja)
    this.shC = [0, 0]; // temblor en casillas enteras
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
    if (snap) { this.cam.x = tx; this.cam.y = ty; this.camR = { x: Math.round(tx), y: Math.round(ty) }; }
  }
  toScreen = (x, y) => [(x - this.camR.x) * this.cw + this.sx, (y - this.camR.y) * this.ch + this.sy];
  screenToCell(px, py) {
    return [Math.floor(px / this.cw + this.camR.x), Math.floor(py / this.ch + this.camR.y)];
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
        case 'train': {
          // el tren fantasma de Yanov cruza la fila de la vía de punta a punta
          const w = this.exp.w;
          for (let i = 0; i < 14; i++) P.add({ x: -2 - i, y: f.y + 0.5, x0: -2 - i, y0: f.y + 0.5, tx: w + 2 - i, ty: f.y + 0.5, arc: 0, life: 0.9, delay: i * 30, ch: i === 0 ? '◄' : i % 4 === 3 ? '═' : '█', color: i === 0 ? '#ffe08a' : '#7a8a9a', noFade: true, bold: true, glow: i === 0 ? 18 : 0 });
          this.shake = Math.max(this.shake, 9);
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
    // capa ASCII: la cámara se pinta en casillas enteras y el temblor salta casillas enteras (unas 20 veces por segundo)
    this.camR = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
    if (this.shake > 4) { if (!this.shT || now - this.shT > 50) { this.shT = now; this.shC = [rng.int(-1, 1), this.shake > 9 ? rng.int(-1, 1) : 0]; } } else this.shC = [0, 0];
    this.sx = this.shC[0] * cw; this.sy = this.shC[1] * ch;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.vw, this.vh);
    // blit de la capa estática
    const ox = -this.camR.x * cw + this.sx, oy = -this.camR.y * ch + this.sy;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.st, 0, 0, this.st.width, this.st.height, Math.round(ox * this.dpr) / this.dpr, Math.round(oy * this.dpr) / this.dpr, e.w * cw, e.h * ch);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = `${this.fs}px ${FONT}`;
    const fontB = `700 ${this.fs}px ${FONT}`;
    ctx.font = font;
    const x0 = Math.max(0, this.camR.x - 2), y0 = Math.max(0, this.camR.y - 2);
    const x1 = Math.min(e.w - 1, Math.ceil(this.camR.x + this.vw / cw) + 2), y1 = Math.min(e.h - 1, Math.ceil(this.camR.y + this.vh / ch) + 2);
    const T_ = now / 1000;
    const S = this.toScreen;
    // fondo de una casilla según su terreno (el mismo que la capa estática): tapa el carácter de debajo
    const cellBg = (x, y) => {
      if (x < 0 || y < 0 || x >= e.w || y >= e.h) return '#000';
      const k = y * e.w + x, td = TILES[e.t[k]];
      if (!td.bg || !e.explored[k] || (e.t[k] === T.ROCK && !this.exposed[k])) return '#000';
      const v = e.visible[k];
      return this.tileColor(td.bg, v ? 1 + Math.min(6, Math.floor(((v - 40) / 216) * 7)) : 0);
    };
    const tint = (x, y, color, a) => { if (a <= 0.005) return; const [sx, sy] = S(x, y); const g = ctx.globalAlpha; ctx.globalAlpha = g * Math.min(1, a); ctx.fillStyle = color; ctx.fillRect(sx, sy, cw, ch); ctx.globalAlpha = g; };
    // una letra en una casilla: fondo del terreno, fondo propio (bg), brillo (glow: tinte del fondo) y la letra.
    // Todas al mismo tamaño (el antiguo «scale» ya no cambia el tamaño: solo la negrita destaca)
    const glyph = (x, y, g, color, bg = null, _scale = 1, bold = false, glow = null, glowA = 0.25) => {
      const [sx, sy] = S(x, y);
      ctx.fillStyle = cellBg(x, y); ctx.fillRect(sx, sy, cw, ch);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(sx, sy, cw, ch); }
      if (glow) tint(x, y, glow, glowA);
      ctx.fillStyle = color;
      if (bold) ctx.font = fontB;
      ctx.fillText(g, sx + cw / 2, sy + ch / 2 + 1);
      if (bold) ctx.font = font;
    };
    // texto en la rejilla, centrado en la casilla (x, y)
    const textCells = (x, y, str, color, bg = '#000') => { const cs = [...str]; const xs = x - Math.floor((cs.length - 1) / 2); cs.forEach((c, i) => glyph(xs + i, y, c, color, bg, 1, true)); };

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
        if (e.rad[k] > 1.2 && Math.sin(T_ * 3 + hashf(x, y) * 40) > 0.93) glyph(x, y, '·', `rgba(184,245,61,${Math.min(0.7, e.rad[k] / 8)})`);
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
        // casillas animadas de la fase 16
        const an = TILES[tt].anim;
        if (an === 'blink') { const p = 0.55 + 0.45 * Math.sin(T_ * 4 + x); glyph(x, y, TILES[tt].glyphs[0], tt === T.TERMINAL ? `rgba(95,208,255,${p})` : tt === T.ANTENNA ? `rgba(127,184,255,${p})` : tt === T.LIFT ? `rgba(95,247,255,${p})` : `rgba(159,232,160,${p})`, TILES[tt].bg, 1.05, true); }
        else if (an === 'fan') glyph(x, y, ['✣', '✢', '✤', '✥'][Math.floor(T_ * 8 + x) % 4], '#c8c8c8', '#0e0e0e');
        else if (an === 'lamp') {
          const fl = Math.sin(T_ * 23 + x * 9) > 0.96 ? 0.35 : 1;
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(255,224,138,${0.07 * fl})`; ctx.fillRect(sx - cw, sy - ch, cw * 3, ch * 3);
          glyph(x, y, '☼', `rgba(255,224,138,${fl})`, '#1a1404', 1.05, true);
        } else if (an === 'graphite' && Math.sin(T_ * 2.5 + x * 1.7 + y) > 0.7) glyph(x, y, '▪', 'rgba(150,255,60,.55)', '#0a0a0a');
        else if (an === 'campfire') {
          const fl = Math.sin(T_ * 9 + x * 3) * 0.5 + Math.sin(T_ * 14 + y) * 0.5;
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(255,140,40,${0.06 + 0.03 * fl})`; ctx.fillRect(sx - cw * 2, sy - ch * 2, cw * 5, ch * 5);
          glyph(x, y, fl > 0.3 ? '*' : fl > -0.3 ? '⁂' : '·', fl > 0.3 ? '#ffd23f' : '#ff8a1f', '#1a0a02', 1.05, true);
        } else if (an === 'breathe') {
          // las paredes de las Raíces respiran: el glifo se dilata y se contrae
          const b = Math.sin(T_ * 1.4 + hashf(x, y) * 2 + (x + y) * 0.15);
          glyph(x, y, b > 0.5 ? '●' : b > -0.3 ? '○' : '◦', `rgb(${130 + b * 30 | 0},${60 + b * 12 | 0},${90 + b * 16 | 0})`, `rgb(${22 + b * 6 | 0},6,${10 + b * 3 | 0})`, 1 + b * 0.08);
        } else if (an === 'lava') {
          const w = Math.sin(T_ * 1.1 + x * 0.6 + y * 0.4) + Math.sin(T_ * 2.3 - x * 0.35);
          const [sx, sy] = S(x, y);
          ctx.fillStyle = `rgba(255,${90 + w * 25 | 0},20,${0.06 + 0.025 * w})`; ctx.fillRect(sx - cw, sy - ch, cw * 3, ch * 3); // resplandor: las 8 casillas de alrededor
          glyph(x, y, w > 0.8 ? '≋' : w > -0.5 ? '≈' : '~', `rgb(255,${130 + w * 40 | 0},${30 + w * 15 | 0})`, `rgb(${50 + w * 10 | 0},10,0)`, 1, w > 1.2);
        } else if (tt === T.CHASM && Math.sin(T_ * 1.3 + x * 2.1 + y * 0.7) > 0.95) glyph(x, y, '.', 'rgba(120,80,40,.5)', '#000');
        else if (tt === T.PIPE_BROKEN) {
          // vapor: salta a una casilla vecina (de arriba o de los lados) unas 8 veces por segundo
          const h = hash(x * 31 + Math.floor(T_ * 8), y);
          if (h % 3) { const vx = x + (h % 3) - 1, vy = y - ((h >>> 3) % 2); if (!e.entityAt || !e.entityAt(vx, vy)) glyph(vx, vy, ['°', '˚', '·', '∘'][(h >>> 5) % 4], 'rgba(220,220,220,.55)'); }
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
      if (o.kind === 'cart') { glyph(o.x, o.y, 'Ш', vis ? '#d9a066' : '#6a4a2a', vis ? '#140a02' : null, 1.05, true); continue; }
      if (o.kind === 'vein' || o.kind === 'shard') {
        if (o.amount <= 0) col = '#2a5a5a';
        else { const p = 0.6 + 0.4 * Math.sin(T_ * 3 + o.x); col = vis ? `rgba(95,247,255,${p})` : 'rgba(95,247,255,.35)'; }
        glyph(o.x, o.y, g, col, vis ? '#021416' : null, 1.1, true, vis && o.amount > 0 ? ESSENCE_COLOR : null, 0.2 + 0.08 * Math.sin(T_ * 3 + o.x));
        continue;
      }
      if (o.kind === 'note') { glyph(o.x, o.y, '?', o.opened ? (vis ? '#7a6a4a' : '#3a3020') : vis ? `rgba(240,225,170,${0.7 + 0.3 * Math.sin(T_ * 3 + o.x)})` : '#5a5030', null, 1, !o.opened); continue; }
      if (SOCIAL_COL[o.kind]) { const done = (o.kind === 'archive' || o.kind === 'wreck' || o.kind === 'radio' || o.kind === 'sabotage' || o.kind === 'objective') && o.opened && !(o.items && o.items.length);
        glyph(o.x, o.y, OBJ_GLYPH[o.kind], vis ? (done ? '#6a6a5a' : SOCIAL_COL[o.kind]) : '#4a4a3a', vis ? '#140a02' : null, 1.1, vis && !done); continue; }
      if (o.kind === 'survivor') { glyph(o.x, o.y, '☺', vis ? `rgba(160,232,160,${0.75 + 0.25 * Math.sin(T_ * 2)})` : '#3a5a3a', null, 1.05, true); continue; }
      if (o.opened) col = vis ? '#6a4a2a' : '#3a2814';
      else if (o.kind === 'cache') col = vis ? (this.radar >= 2 ? rarityColor(o.best) : '#ffb02e') : '#7a5a20';
      else if (o.sealed) col = vis ? '#9fb8d0' : '#4a5a6a';
      else col = vis ? '#d9a066' : '#6a4a2a';
      glyph(o.x, o.y, g, col, vis && o.kind !== 'corpse' ? '#140a02' : null, 1, o.kind === 'cache' && !o.opened);
    }
    // ---- esencia en el suelo ----
    for (const [k, n] of e.essence) {
      const x = k % e.w, y = (k / e.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !e.visible[k]) continue;
      const p = 0.65 + 0.35 * Math.sin(T_ * 5 + x * 2);
      glyph(x, y, n >= 20 ? '✦' : '*', `rgba(95,247,255,${p})`, null, 1, true, ESSENCE_COLOR, 0.18 * p);
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
      if (!exitKnown(e, ex)) continue;
      const temp = !ex.perm;
      const left = temp ? ex.expires - e.turn : 99;
      const p = 0.55 + 0.45 * Math.sin(T_ * 4);
      const evacHere = e.evac && e.evac.x === ex.x && e.evac.y === ex.y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = ex.x + dx, y = ex.y + dy;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        if (dx || dy) glyph(x, y, '░', `rgba(95,247,255,${0.25 + 0.3 * p * ((Math.sin(T_ * 6 - (Math.abs(dx) + Math.abs(dy))) + 1) / 2)})`, `rgba(95,247,255,${(evacHere ? 0.25 : 0.1) * p})`);
      }
      if (ex.x >= x0 && ex.x <= x1 && ex.y >= y0 && ex.y <= y1) {
        glyph(ex.x, ex.y, '⌂', temp && left < 6 && Math.sin(T_ * 12) > 0 ? '#ff3b30' : '#5ff7ff', '#001416', 1.1, true, '#5ff7ff', 0.3 * p);
        // etiqueta en la fila de encima del anillo, en la rejilla
        const lbl = evacHere ? `EVAC ${e.evac.left}` : temp ? `${left}t` : 'SALIDA';
        textCells(ex.x, ex.y - 2, lbl, '#5ff7ff', '#001416');
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
    // ---- minas enemigas detectadas (sonda sísmica) y focos del sensor de radiación de Laika ----
    for (const m of e.mines || []) {
      if (!m.known || m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
      glyph(m.x, m.y, '¤', `rgba(255,40,40,${0.6 + 0.3 * Math.sin(T_ * 5)})`, '#200404', 1, true);
    }
    if (e.radKnown) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * e.w + x;
      if (!e.radKnown[k] || e.visible[k]) continue;
      const [sx, sy] = S(x, y);
      ctx.fillStyle = `rgba(150,255,40,${0.08 + 0.04 * Math.sin(T_ * 2 + x)})`; ctx.fillRect(sx, sy, cw, ch);
    }
    // ---- cargas de demolición (Zapador): parpadean más deprisa cuanto menos falta ----
    for (const c of e.charges || []) {
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      const sp = 4 + (4 - c.t) * 5;
      glyph(c.x, c.y, String(c.t), `rgba(255,${120 + 80 * Math.sin(T_ * sp)},40,${0.7 + 0.3 * Math.sin(T_ * sp)})`, null, 1.05, true);
    }
    // ---- granadas con mecha en el suelo (fase 23.6) ----
    for (const p of e.pending || []) {
      if (p.kind !== 'nade' || !e.visible[p.y * e.w + p.x]) continue;
      glyph(p.x, p.y, '•', `rgba(255,${p.enemy ? 59 : 210},48,${0.6 + 0.4 * Math.sin(T_ * 10)})`, null, 1.1, true);
    }
    // ---- enemigos detectados por el detector de movimiento ----
    if (e.sense > 0 || e.team.some((q) => q.trackR)) {
      for (const en of e.enemies) {
        if (e.visible[en.y * e.w + en.x]) continue;
        if (!e.sensed(en)) continue;
        if (en.x < x0 || en.x > x1 || en.y < y0 || en.y > y1) continue;
        const def = ACTORS[en.type];
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(T_ * 4 + en.x);
        glyph(en.x, en.y, def.glyph, actorColor(en), null, 1, true);
        ctx.globalAlpha = 1;
      }
    }
    // ---- enemigos ----
    this.cbMode = document.body.classList.contains('cb');
    const lunge = this.lunge;
    for (const en of e.enemies) {
      const k = en.y * e.w + en.x;
      if (!e.visible[k]) { this.pos.delete(en.uid); continue; }
      const def = ACTORS[en.type];
      // fase 22: sigilo (liquidador hueco, gato, élite invisible): solo una distorsión de vez en cuando
      if (e.hidden(en)) {
        this.pos.delete(en.uid);
        if (Math.sin(T_ * 2.3 + en.x * 1.7 + en.y) > 0.93) { ctx.globalAlpha = 0.12; glyph(en.x, en.y, def.glyph, '#c8e0ff', null, 1, false); ctx.globalAlpha = 1; }
        continue;
      }
      const p = this.rpos(en.uid, en.x, en.y, dt);
      // capa ASCII: la posición interpolada (lógica) se pinta en la casilla entera más cercana
      const rx = Math.round(p.x), ry = Math.round(p.y);
      // embestida (mordisco): vídeo inverso durante un instante en lugar de desplazar la letra media casilla
      let lunging = false;
      if (lunge) {
        const l = lunge.get(en.x + ',' + en.y);
        if (l) { if ((now - l.t) / 160 < 1) lunging = true; else lunge.delete(en.x + ',' + en.y); }
      }
      const col = actorColor(en);
      const fl = this.flashes.get('c' + en.x + ',' + en.y);
      const flashing = fl && fl > now;
      const [sx, sy] = S(rx, ry);
      ctx.fillStyle = cellBg(rx, ry); ctx.fillRect(sx, sy, cw, ch);
      // personas: fondo con el color de su facción y su actitud como tinte del fondo (antes, un recuadro)
      if (isHuman(en)) {
        const fd = FACTIONS[actorFaction(en)];
        if (fd.bg) { ctx.fillStyle = fd.bg; ctx.fillRect(sx, sy, cw, ch); }
        const att = en.surrendered ? 'surr' : e.attitudeToSquad(en);
        tint(rx, ry, att === 'surr' ? '#ffffff' : att === 'hostile' ? '#ff3b30' : att === 'allied' ? '#3ddc6b' : '#ffd23f', att === 'hostile' ? 0.3 : 0.22);
        // fase 24.1: modo daltónico: la actitud también con un signo (! hostil, ? neutral, + aliado)
        if (this.cbMode && !en.surrendered && !(en.escort > 0)) { ctx.font = `${Math.round(this.fs * 0.55)}px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.fillText(att === 'hostile' ? '!' : att === 'allied' ? '+' : '?', sx + cw * 0.85, sy + ch * 0.2); ctx.font = font; }
        // bandera blanca (rendido) o escolta (os acompaña)
        if (en.surrendered || en.escort > 0) { ctx.font = `${Math.round(this.fs * 0.6)}px ${FONT}`; ctx.fillStyle = en.surrendered ? '#ffffff' : '#3ddc6b'; ctx.fillText(en.surrendered ? '⚑' : '+', sx + cw * 0.85, sy + ch * 0.2); ctx.font = font; }
      }
      if (en.charmed) tint(rx, ry, '#c06cff', 0.3);
      const breathe = en.state === 'dormido' ? 0.55 + 0.15 * Math.sin(T_ * 2 + en.x) : 1;
      // brillo de jefes, élites y chebylitas fuertes: tinte del fondo de su casilla
      if (def.boss) tint(rx, ry, col, 0.28 + 0.1 * Math.sin(T_ * 3));
      else if (en.elite) tint(rx, ry, '#ffd23f', 0.16 + 0.06 * Math.sin(T_ * 4 + en.x));
      else if (en.lvl >= 7) tint(rx, ry, col, 0.12);
      if (lunging) { ctx.fillStyle = col; ctx.fillRect(sx, sy, cw, ch); }
      ctx.globalAlpha = breathe;
      ctx.fillStyle = lunging ? '#000' : flashing ? '#ffffff' : col;
      ctx.font = def.boss ? `800 ${this.fs}px ${FONT}` : fontB;
      ctx.fillText(def.glyph, sx + cw / 2, sy + ch / 2 + 1);
      ctx.globalAlpha = 1; ctx.font = font;
      // barra de vida
      if (en.hp < en.hpMax) {
        const w = cw - 2, f = Math.max(0, en.hp / en.hpMax);
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(sx + 1, sy + ch - 2, w, 2);
        ctx.fillStyle = f > 0.5 ? '#3ddc6b' : f > 0.25 ? '#ffd23f' : '#ff3b30';
        ctx.fillRect(sx + 1, sy + ch - 2, w * f, 2);
      }
      if (en.elite) { ctx.font = `${Math.round(this.fs * 0.55)}px ${FONT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('★', sx + cw * 0.85, sy + ch * 0.18); ctx.font = font; }
      if (en.suppressed > 0) { ctx.font = `${Math.round(this.fs * 0.5)}px ${FONT}`; ctx.fillStyle = '#ffe066'; ctx.fillText('∷', sx + cw * 0.5, sy + ch * 0.12); ctx.font = font; } // fase 23.4: suprimido
      if (en.raged) { ctx.font = `${Math.round(this.fs * 0.55)}px ${FONT}`; ctx.fillStyle = '#ff3b30'; ctx.fillText('!', sx + cw * 0.15, sy + ch * 0.18); ctx.font = font; }
      // aturdido: las estrellas giran en la casilla de encima (si está libre)
      if (en.stun > 0 && !e.entityAt(rx, ry - 1)) glyph(rx, ry - 1, ['✶', '*', '·', '*'][Math.floor(T_ * 8) % 4], '#ffe9a0');
      if (en.state === 'dormido' && Math.sin(T_ * 1.3 + en.x * 2) > 0.985) this.parts.add({ x: en.x + 0.8, y: en.y, vy: -0.8, vx: 0.3, life: 1.4, ch: 'z', color: col, scale: 0.6 });
    }
    // ---- agentes ----
    for (const sq of e.squad) {
      if (!e.inMap(sq)) { this.pos.delete(sq.id); continue; }
      const p = this.rpos(sq.id, sq.x, sq.y, dt);
      const ax = Math.round(p.x), ay = Math.round(p.y);
      const [sx, sy] = S(ax, ay);
      const active = sq === e.cur;
      const fl = this.flashes.get('h' + sq.x + ',' + sq.y);
      const hurt = fl && fl > now;
      ctx.fillStyle = cellBg(ax, ay); ctx.fillRect(sx, sy, cw, ch);
      // agente activo: fondo naranja que late (antes, además, un recuadro); el resto, un tinte suave de su color
      if (active) tint(ax, ay, '#ff8a1f', 0.22 + 0.16 * Math.sin(T_ * 4));
      else tint(ax, ay, sq.a.color, 0.1);
      ctx.fillStyle = hurt ? '#ff3b30' : sq.a.color;
      ctx.font = fontB;
      // fase 23.3: abatido: gris y parpadeando sobre fondo rojo, con los turnos que le quedan
      if (sq.downed) { tint(ax, ay, '#ff3b30', 0.18 + 0.12 * Math.sin(T_ * 5)); ctx.globalAlpha = 0.55 + 0.35 * Math.sin(T_ * 5); ctx.fillStyle = '#b0b0b0'; ctx.fillText('@', sx + cw / 2, sy + ch / 2 + 1); ctx.globalAlpha = 1;
        ctx.font = `${Math.round(this.fs * 0.6)}px ${FONT}`; ctx.fillStyle = '#ff3b30'; ctx.fillText(String(sq.downed), sx + cw * 0.85, sy + ch * 0.2); ctx.font = fontB; }
      else ctx.fillText('@', sx + cw / 2, sy + ch / 2 + 1);
      ctx.font = font;
      // fase 23.1: a cubierto frente al enemigo visible más peligroso (▄ media, █ total)
      let cvl = 0;
      for (const o of e.enemies) { if (cvl === 2 || !e.visible[o.y * e.w + o.x] || !e.hostile(sq, o)) continue; cvl = Math.max(cvl, e.coverLvlOf(...(e.coverCell(o.x, o.y, sq.x, sq.y) || [-1, -1]))); }
      if (cvl) { ctx.font = `${Math.round(this.fs * 0.5)}px ${FONT}`; ctx.fillStyle = cvl === 2 ? '#3ddc6b' : '#b8f53d'; ctx.fillText(cvl === 2 ? '█' : '▄', sx + cw * 0.15, sy + ch * 0.2); ctx.font = font; }
      const st = e.ast(sq);
      const f = Math.max(0, sq.a.hp / st.hpMaxEff);
      if (f < 1) {
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(sx + 1, sy + ch - 2, cw - 2, 2);
        ctx.fillStyle = f > 0.5 ? '#3ddc6b' : f > 0.25 ? '#ffd23f' : '#ff3b30';
        ctx.fillRect(sx + 1, sy + ch - 2, (cw - 2) * f, 2);
      }
    }

    // ---- superposiciones: ruta, línea de tiro, área de explosión y cursor (todo por casillas) ----
    const ov = this.overlay;
    if (ov && ov.path) {
      // la ruta tiñe el fondo de sus casillas; la última lleva una ×
      for (let i = 0; i < ov.path.length; i++) {
        const [x, y] = ov.path[i];
        if (i === ov.path.length - 1) glyph(x, y, '×', '#ffb35c', 'rgba(255,179,92,.18)', 1, true);
        else tint(x, y, '#ffb35c', 0.16);
      }
    }
    if (ov && ov.line) {
      // línea de tiro: casillas tintadas con un tramo más brillante que avanza hacia el objetivo
      const [lx0, ly0, lx1, ly1, ok] = ov.line;
      const c = ok ? '#ffd23f' : '#ff3b30', step = Math.floor(T_ * 12);
      line(lx0, ly0, lx1, ly1, (x, y, i, n) => { if (i > 0 && i < n) tint(x, y, c, (i - step) % 4 === 0 ? 0.42 : 0.16); });
    }
    if (ov && ov.blast) {
      const { x, y, r } = ov.blast;
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (Math.hypot(xx - x, yy - y) <= r + 0.5) tint(xx, yy, '#ff5a28', 0.18);
    }
    if (this.hover) {
      const [hx, hy] = this.hover;
      const [sx, sy] = S(hx, hy);
      const tgt = ov && ov.targetMode;
      // cursor en vídeo inverso (como el de un terminal)
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = tgt ? '#e04030' : `rgb(${200 + 40 * Math.sin(T_ * 5) | 0},140,70)`;
      ctx.fillRect(sx, sy, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
      // % de impacto: en las casillas junto al cursor (derecha, izquierda, encima o debajo), sin tapar a nadie
      if (ov && ov.hit != null) {
        const lbl = [...` ${ov.hit}% `], n = lbl.length;
        const spots = [[hx + 1, hy], [hx - n, hy], [hx - (n >> 1), hy - 1], [hx - (n >> 1), hy + 1]];
        const free = ([lx, ly]) => { for (let i = 0; i < n; i++) if (e.entityAt(lx + i, ly)) return false; return true; };
        const [lx, ly] = spots.find(free) || spots[2];
        lbl.forEach((c, i) => glyph(lx + i, ly, c, ov.hit >= 60 ? '#3ddc6b' : ov.hit >= 35 ? '#ffd23f' : '#ff3b30', '#000', 1, true));
      }
    }

    // ---- partículas: capa lógica con decimales, dibujada en la rejilla ----
    this.parts.update(dt, now);
    this.parts.draw(ctx, S, cw, ch, FONT, { fs: this.fs, mask: '#000' });

    // ---- destellos de pantalla: viñeta de casillas tintadas (antes, un degradado) ----
    const cols = Math.ceil(this.vw / cw) + 1, rows = Math.ceil(this.vh / ch) + 1;
    const cellPx = (i, j) => [i * cw + (((this.sx % cw) + cw) % cw) - cw, j * ch + (((this.sy % ch) + ch) % ch) - ch];
    const fsc = this.flashScreen;
    if (fsc) {
      const t = (now - fsc.t) / fsc.dur;
      if (t >= 1) this.flashScreen = null;
      else if (t >= 0) {
        const r0 = Math.min(this.vw, this.vh) * 0.3, r1 = Math.max(this.vw, this.vh) * 0.7, top = 0.45 * (1 - t);
        for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
          const [px, py] = cellPx(i, j);
          const d = Math.hypot(px + cw / 2 - this.vw / 2, py + ch / 2 - this.vh / 2);
          const a = Math.round(Math.max(0, Math.min(1, (d - r0) / (r1 - r0))) * top * 12) / 12; // por escalones
          if (a <= 0) continue;
          ctx.fillStyle = fsc.color + a + ')'; ctx.fillRect(px, py, cw, ch);
        }
      }
    }
    if (this.alertPulse) {
      // alerta: el borde de la vista se llena de casillas rojas (dos anillos)
      const t = (now - this.alertPulse) / 600;
      if (t > 1) this.alertPulse = null;
      else for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
        const [px, py] = cellPx(i, j);
        const ring = Math.min(Math.floor(px / cw), Math.floor(py / ch), Math.floor((this.vw - px - 1) / cw), Math.floor((this.vh - py - 1) / ch));
        if (ring > 1) continue;
        ctx.fillStyle = `rgba(255,59,48,${(ring <= 0 ? 0.5 : 0.22) * (1 - t)})`; ctx.fillRect(px, py, cw, ch);
      }
    }
  }
}

function hashf(x, y) { return (hash(x, y) % 1000) / 1000; }
