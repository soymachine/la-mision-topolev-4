// Minimapa / radar y mapa completo
// Revisión (capa ASCII): la geometría de siempre (casillas cuadradas de s px, desplazamiento ox/oy, zoom y arrastre)
// es la capa lógica y no se pinta. Encima se dibuja una rejilla de caracteres: cada carácter resume las casillas del
// mapa que caen debajo (# pared, · suelo, ≈ agua…; con mucho zoom, el carácter real de cada casilla), y los
// marcadores, discos, anillos y puntos de antes se convierten en caracteres o en tintes del fondo de esas casillas.
import { TILES, T } from '../data/tiles.js';
import { ENEMIES, enemyColor } from '../data/enemies.js';
import { ACTORS, actorColor } from '../data/actors.js';
import { rarityColor } from '../core/items.js';
import { FONT } from './ascii.js';
import { exitKnown, nestIdentified, poiKnown, doorKnown, speciesKnown } from '../exp/intel.js';
import { hexToRgb } from '../util/rng.js';

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
const dim = (hex, f) => { const [r, g, b] = hexToRgb(hex); return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`; };

// rejilla de caracteres: una letra por celda (gana la de más prioridad) y tintes de fondo
class Cells {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    const n = cols * rows;
    this.ch = new Array(n).fill(null); this.fg = new Array(n); this.pri = new Int8Array(n).fill(-1);
    this.bold = new Uint8Array(n); this.alpha = new Float32Array(n);
    this.bg = [];
  }
  ok(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows; }
  put(cx, cy, c, fg, pri = 0, bold = false, alpha = 1) {
    if (!this.ok(cx, cy)) return false;
    const i = cy * this.cols + cx;
    if (pri < this.pri[i]) return false;
    this.ch[i] = c; this.fg[i] = fg; this.pri[i] = pri; this.bold[i] = bold ? 1 : 0; this.alpha[i] = alpha;
    return true;
  }
  // texto centrado en la celda (cx, cy) (o empezando en ella con left = true)
  text(cx, cy, str, fg, pri = 4, left = false) {
    const cs = [...str];
    const x0 = left ? cx : cx - Math.floor((cs.length - 1) / 2);
    cs.forEach((c, i) => { if (this.put(x0 + i, cy, c, fg, pri, true)) this.tint(x0 + i, cy, '#000', 0.85); });
  }
  tint(cx, cy, color, a) { if (a > 0.01 && this.ok(cx, cy)) this.bg.push(cx, cy, color, a); }
  draw(ctx, cw, ch, fz) {
    for (let i = 0; i < this.bg.length; i += 4) { ctx.globalAlpha = this.bg[i + 3]; ctx.fillStyle = this.bg[i + 2]; ctx.fillRect(this.bg[i] * cw, this.bg[i + 1] * ch, cw, ch); }
    ctx.globalAlpha = 1;
    const fN = `${fz}px ${FONT}`, fB = `700 ${fz}px ${FONT}`;
    let last = '';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < this.ch.length; i++) {
      const c = this.ch[i];
      if (!c || c === ' ') continue;
      const f = this.bold[i] ? fB : fN;
      if (f !== last) { ctx.font = f; last = f; }
      ctx.globalAlpha = this.alpha[i];
      ctx.fillStyle = this.fg[i];
      ctx.fillText(c, (i % this.cols) * cw + cw / 2, ((i / this.cols) | 0) * ch + ch / 2 + 1);
    }
    ctx.globalAlpha = 1;
  }
}

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lastTurn = -1;
    this.markers = [];
  }

  attach(exp) {
    this.exp = exp;
    this.lastTurn = -1;
    this.tkey = null;
  }

  // puertas blindadas conocidas (vistas o detectadas por un radar de botín)
  updateDoors() {
    const e = this.exp;
    this.doors = [];
    for (let k = 0; k < e.w * e.h; k++) if (e.t[k] === T.ARMORDOOR && doorKnown(e, k)) this.doors.push(k);
  }

  // terreno de una celda: el resumen de las casillas del mapa que tiene debajo
  terrainCell(tx0, ty0, tx1, ty1) {
    const e = this.exp;
    const span = Math.max(tx1 - tx0, ty1 - ty0);
    if (span <= 1.6) {
      // con zoom: el carácter real de la casilla del centro (como en la vista principal)
      const x = Math.floor((tx0 + tx1) / 2), y = Math.floor((ty0 + ty1) / 2);
      if (x < 0 || y < 0 || x >= e.w || y >= e.h) return null;
      const k = y * e.w + x;
      if (!e.explored[k]) return null;
      const t = e.t[k], td = TILES[t];
      const v = e.visible[k] > 0;
      if (e.fire[k]) return ['^', '#ff5a14'];
      if (e.gas[k]) return ['░', v ? '#b070e0' : '#5a3070'];
      const h = hash(x, y);
      let fg = td.fg[(h >>> 8) % td.fg.length];
      if (e.rad[k] > 1.2 && td.walk) fg = '#8ac83a';
      return [td.glyphs[h % td.glyphs.length], v ? fg : dim(fg, 0.42)];
    }
    let n = 0, vis = 0, wall = 0, floor = 0, water = 0, chasm = 0, fire = 0, gas = 0, rad = 0, lift = 0, mach = 0;
    const xa = Math.max(0, Math.floor(tx0)), xb = Math.min(e.w, Math.ceil(tx1)), ya = Math.max(0, Math.floor(ty0)), yb = Math.min(e.h, Math.ceil(ty1));
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const k = y * e.w + x;
      if (!e.explored[k]) continue;
      n++; if (e.visible[k]) vis++;
      const t = e.t[k];
      if (e.fire[k]) fire++;
      if (e.gas[k]) gas++;
      if (e.rad[k] > 1.2) rad++;
      if (t === T.LIFT || t === T.LIFT_UP) lift++;
      if (t === T.WATER || t === T.DEEP) water++;
      else if (t === T.CHASM) chasm++;
      else if (t === T.MACHINE) mach++;
      else if (TILES[t].walk) floor++;
      else wall++;
    }
    if (!n) return null;
    const v = vis > 0;
    if (fire) return ['^', '#ff5a14'];
    if (lift) return ['≡', '#5ff7ff'];
    if (gas * 2 >= n) return ['░', v ? '#b070e0' : '#5a3070'];
    if (water * 2 >= n) return ['≈', v ? '#2aa8a8' : '#1e5656'];
    if (chasm * 2 >= n) return null;
    if (floor * 2 >= n) return ['·', rad ? (v ? '#9ae040' : '#4a7020') : v ? '#c0641e' : '#64300c'];
    if (mach && mach >= wall) return ['%', v ? '#b07038' : '#583818'];
    return ['#', rad ? (v ? '#b8d850' : '#5a6a28') : v ? '#e0782a' : '#70360e'];
  }

  // dibuja el minimapa al tamaño del canvas destino
  draw(now, opts = {}) {
    const e = this.exp;
    if (!e) return;
    if (e.turn !== this.lastTurn || opts.force) { this.updateDoors(); this.lastTurn = e.turn; this.tkey = null; }
    const c = this.canvas, ctx = this.ctx;
    const W = c.width, H = c.height;
    // ---- capa lógica: la proyección de siempre (casillas cuadradas de s px) ----
    let s = Math.min(W / e.w, H / e.h);
    let ox = (W - e.w * s) / 2, oy = (H - e.h * s) / 2;
    // mapa grande con zoom y arrastre: opts.zoom (×) y opts.pan = casilla en el centro de la vista
    if (opts.zoom && (opts.zoom !== 1 || opts.pan)) {
      s *= opts.zoom;
      const [px, py] = opts.pan || [e.w / 2, e.h / 2];
      ox = W / 2 - px * s; oy = H / 2 - py * s;
    }
    this.s = s; this.ox = ox; this.oy = oy;
    const T_ = now / 1000;
    const big = !!opts.big;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // ---- capa ASCII: tamaño de letra fijo en el minimapa; en el mapa grande crece con el zoom ----
    const fz = big ? Math.round(Math.max(10 * dpr, Math.min(24 * dpr, s * 1.45))) : Math.round(9 * dpr);
    if (this.fz !== fz) { this.fz = fz; ctx.font = `${fz}px ${FONT}`; this.cw = Math.ceil(ctx.measureText('M').width); this.chh = Math.round(fz * 1.12); }
    const cw = this.cw, chh = this.chh;
    const cols = Math.ceil(W / cw), rows = Math.ceil(H / chh);
    const C = new Cells(cols, rows);
    // celda de la rejilla que contiene la casilla (x, y) del mapa, y centro en px de una celda
    const cellOf = (x, y) => [Math.floor((ox + (x + 0.5) * s) / cw), Math.floor((oy + (y + 0.5) * s) / chh)];
    const mid = (cx, cy) => [cx * cw + cw / 2, cy * chh + chh / 2];
    // tiles del mapa bajo una celda
    const tilesOf = (cx, cy) => [(cx * cw - ox) / s, (cy * chh - oy) / s, ((cx + 1) * cw - ox) / s, ((cy + 1) * chh - oy) / s];
    this.markers = [];

    // ---- terreno (se recalcula si cambian el turno o la vista) ----
    const tkey = `${e.turn}|${s}|${ox}|${oy}|${W}|${H}|${fz}`;
    if (this.tkey !== tkey || now - (this.tT || 0) > 1000) {
      this.tkey = tkey; this.tT = now;
      this.terr = new Array(cols * rows).fill(null);
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const [a, b, c2, d] = tilesOf(cx, cy);
        if (c2 <= 0 || d <= 0 || a >= e.w || b >= e.h) continue;
        this.terr[cy * cols + cx] = this.terrainCell(a, b, c2, d);
      }
    }
    for (let i = 0; i < this.terr.length; i++) { const t = this.terr[i]; if (t) C.put(i % cols, (i / cols) | 0, t[0], t[1], 0); }
    // retícula del radar cada 10 casillas: un + en los cruces que caen en zona sin explorar
    for (let gy = 0; gy <= e.h; gy += 10) for (let gx = 0; gx <= e.w; gx += 10) {
      const cx = Math.floor((ox + gx * s) / cw), cy = Math.floor((oy + gy * s) / chh);
      if (C.ok(cx, cy) && !C.ch[cy * cols + cx]) C.put(cx, cy, '+', 'rgba(255,138,31,.22)', 0);
    }
    // sectores (solo en el mapa grande): borde de puntos tenues en lo no explorado y su nombre
    if (big) {
      for (const sec of e.sectors) {
        const [ax, ay] = [Math.floor((ox + sec.x * s) / cw), Math.floor((oy + sec.y * s) / chh)];
        const [bx, by] = [Math.floor((ox + (sec.x + sec.w) * s) / cw), Math.floor((oy + (sec.y + sec.h) * s) / chh)];
        for (let x = ax; x <= bx; x++) for (const y of [ay, by]) if (C.ok(x, y) && !C.ch[y * cols + x]) C.put(x, y, '·', 'rgba(255,138,31,.25)', 0);
        for (let y = ay; y <= by; y++) for (const x of [ax, bx]) if (C.ok(x, y) && !C.ch[y * cols + x]) C.put(x, y, '·', 'rgba(255,138,31,.25)', 0);
        C.text(ax + 1, ay + 1, `${sec.code} ${sec.name}`, 'rgba(255,138,31,.55)', 1, true);
      }
    }
    // la vista de la cámara: esquinas ┌┐└┘ y un tinte muy suave en su borde
    if (opts.view) {
      const v = opts.view;
      const ax = Math.floor((ox + v.x * s) / cw), ay = Math.floor((oy + v.y * s) / chh);
      const bx = Math.floor((ox + (v.x + v.w) * s) / cw), by = Math.floor((oy + (v.y + v.h) * s) / chh);
      for (let x = ax + 1; x < bx; x++) { C.tint(x, ay, '#ffb35c', 0.07); C.tint(x, by, '#ffb35c', 0.07); }
      for (let y = ay + 1; y < by; y++) { C.tint(ax, y, '#ffb35c', 0.07); C.tint(bx, y, '#ffb35c', 0.07); }
      [[ax, ay, '┌'], [bx, ay, '┐'], [ax, by, '└'], [bx, by, '┘']].forEach(([x, y, g]) => C.put(x, y, g, 'rgba(255,179,92,.8)', 2, true));
    }
    // disco (relleno) y anillo (borde) en celdas: centro en casillas del mapa, radio en casillas
    const disc = (x, y, r, col, a) => {
      const [cx, cy] = cellOf(x, y);
      const rx = Math.ceil((r * s) / cw) + 1, ry = Math.ceil((r * s) / chh) + 1;
      for (let j = cy - ry; j <= cy + ry; j++) for (let i = cx - rx; i <= cx + rx; i++) {
        const [px, py] = mid(i, j);
        if (Math.hypot(px - (ox + (x + 0.5) * s), py - (oy + (y + 0.5) * s)) <= r * s) C.tint(i, j, col, a);
      }
    };
    const ring = (x, y, rPx, fn) => {
      const [cx, cy] = cellOf(x, y);
      const rx = Math.ceil(rPx / cw) + 1, ry = Math.ceil(rPx / chh) + 1;
      const half = Math.max(cw, chh) * 0.55;
      const X = ox + (x + 0.5) * s, Y = oy + (y + 0.5) * s;
      for (let j = cy - ry; j <= cy + ry; j++) for (let i = cx - rx; i <= cx + rx; i++) {
        const [px, py] = mid(i, j);
        if (Math.abs(Math.hypot(px - X, py - Y) - rPx) <= half) fn(i, j, Math.atan2(py - Y, px - X));
      }
    };

    // ---- POIs ----
    const storm = !!opts.storm;
    for (const p of e.pois) {
      if (storm && !e.explored[p.y * e.w + p.x]) continue; // tormenta: sin radar, solo lo ya visto
      if (!poiKnown(e, p)) continue; // alijos: ocultos hasta verlos o detectarlos
      const [cx, cy] = cellOf(p.x, p.y);
      let g, col, label = null;
      const ided = p.type !== 'nest' || nestIdentified(p);
      if (p.type === 'nest' && !ided && !p.cleared) {
        // grupo sin identificar: solo se sabe que ahí hay algo
        col = '#9a8a7a'; g = '?';
      } else if (p.type === 'nest') {
        const def = ENEMIES[p.boss || p.enemy];
        col = p.cleared ? '#5a4a3a' : enemyColor(def.hue, p.lvl);
        g = p.cleared ? '✓' : p.boss ? '☠' : '▲';
        label = p.cleared ? null : String(p.lvl);
        // territorio del nido: las celdas de alrededor laten con su color
        if (!p.cleared) disc(p.x, p.y, 5, col, 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(T_ * 2 + p.x)));
      } else if (p.type === 'vein') { g = '✦'; col = p.cleared ? '#2a5a5a' : '#5ff7ff'; }
      else if (p.type === 'cache') { g = '■'; col = p.cleared ? '#5a4a3a' : (opts.radar >= 2 ? rarityColor(p.best) : '#ffb02e'); }
      else if (p.type === 'hazard') {
        g = p.kind === 'rad' ? '☢' : p.kind === 'gas' ? '≋' : 'ϟ';
        col = p.kind === 'rad' ? '#b8f53d' : p.kind === 'gas' ? '#c06cff' : '#7fb8ff';
        // el área del peligro: anillo de puntos (a trazos) en las celdas que no son pared
        ring(p.x, p.y, (p.r || 3) * s, (i, j, ang) => {
          if (Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 16) % 2) return;
          const ci = j * cols + i;
          if (C.ok(i, j) && C.ch[ci] !== '#') C.put(i, j, '∙', col, 1, false, 0.6);
        });
      }
      if (!C.put(cx, cy, g, col, 5, true)) continue;
      C.tint(cx, cy, '#000', 0.9);
      if (label) C.text(cx + 1, cy, label, col, 4, true);
      if (big && p.type === 'nest' && !p.cleared && ided) C.text(cx, cy + 1, `${ENEMIES[p.boss || p.enemy].name} Nv ${p.lvl}`, col, 3);
      const [mx, my] = mid(cx, cy);
      this.markers.push({ x: mx, y: my, r: Math.max(cw, chh) * 0.8, poi: p });
    }
    // ---- enemigos visibles y errantes detectados por el radar ----
    for (const en of e.enemies) {
      const vis = e.visible[en.y * e.w + en.x] > 0;
      const sensed = e.sensed(en);
      if (!vis && (storm || (!sensed && !(opts.radar >= 3 && en.state === 'errante')))) continue;
      const [cx, cy] = cellOf(en.x, en.y);
      const known = vis || en.radarT === e.turn || speciesKnown(en.type) || !ENEMIES[en.type];
      const g = known && ACTORS[en.type] ? ACTORS[en.type].glyph : '•';
      C.put(cx, cy, g, known ? actorColor(en) : '#9a8a7a', 6, true, vis ? 1 : 0.45 + 0.2 * Math.sin(T_ * 4)); // sin identificar: gris
    }
    // ---- extracciones: el pulso que se expande es un anillo de celdas tintadas ----
    for (const ex of e.exits) {
      if (!exitKnown(e, ex)) continue; // el radar aún no las ha triangulado
      const [cx, cy] = cellOf(ex.x, ex.y);
      const pulse = (T_ * 0.8) % 1;
      ring(ex.x, ex.y, Math.max(cw, chh) * (0.8 + pulse * 2.2), (i, j) => C.tint(i, j, '#5ff7ff', 0.4 * (1 - pulse)));
      C.put(cx, cy, '⌂', '#5ff7ff', 7, true);
      C.tint(cx, cy, '#001416', 0.95);
      if (!ex.perm || big) C.text(cx, cy + 1, ex.perm ? ex.name : `${ex.expires - e.turn}t`, '#5ff7ff', 4);
      const [mx, my] = mid(cx, cy);
      this.markers.push({ x: mx, y: my, r: Math.max(cw, chh) * 0.8, exit: ex });
    }
    // ---- puertas blindadas, granadas/bengalas pendientes, montacargas y simas ----
    for (const k of this.doors || []) {
      const [cx, cy] = cellOf(k % e.w, (k / e.w) | 0);
      C.put(cx, cy, '▣', '#dcb450', 5, true); C.tint(cx, cy, '#000', 0.9);
      const [mx, my] = mid(cx, cy);
      this.markers.push({ x: mx, y: my, r: Math.max(cw, chh) * 0.8, conn: 'puerta blindada' });
    }
    for (const p of e.pending) { const [cx, cy] = cellOf(p.x, p.y); C.put(cx, cy, '◊', '#5ff7ff', 5); }
    const conn = (x, y, g, col, label) => {
      if (!e.explored[y * e.w + x] && !big) return;
      const [cx, cy] = cellOf(x, y);
      C.put(cx, cy, g, col, 6, true); C.tint(cx, cy, '#000', 0.9);
      if (big) C.text(cx, cy + 1, label, col, 3);
      const [mx, my] = mid(cx, cy);
      this.markers.push({ x: mx, y: my, r: Math.max(cw, chh) * 0.8, conn: label });
    };
    if (e.lift) conn(e.lift[0], e.lift[1], '↓', '#5ff7ff', 'montacargas ↓');
    if (e.floor > 0 && e.start) conn(e.start[0], e.start[1], '↑', '#9fe8a0', 'montacargas ↑');
    for (const ch of e.chasms || []) conn(ch[0], ch[1], '◌', '#c08040', 'sima');
    for (const f of e.flares) { const [cx, cy] = cellOf(f.x, f.y); C.put(cx, cy, '*', '#ff6ad5', 6, true); }
    // ---- interferencias de la tormenta electromagnética: celdas de estática ----
    if (storm) {
      for (let i = 0; i < 40; i++) { const cx = (Math.random() * cols) | 0, cy = (Math.random() * rows) | 0; C.put(cx, cy, Math.random() < 0.5 ? '░' : '▒', 'rgba(127,184,255,.35)', 2); }
      C.text(Math.floor(cols / 2), 0, 'ϟ SIN SEÑAL', `rgba(127,184,255,${0.6 + 0.3 * Math.sin(T_ * 6)})`, 8);
    }
    // ---- agentes: su @; el activo, en negrita sobre un fondo blanco que late ----
    for (const sq of e.squad) {
      if (!e.inMap(sq)) continue;
      const [cx, cy] = cellOf(sq.x, sq.y);
      const act = sq === e.cur;
      C.put(cx, cy, '@', sq.a.color, act ? 9 : 8, true);
      C.tint(cx, cy, act ? '#ffffff' : sq.a.color, act ? 0.18 + 0.14 * Math.sin(T_ * 5) : 0.12);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    C.draw(ctx, cw, chh, fz);
  }

  // casilla del mapa bajo un punto del canvas
  cellAt(px, py) {
    const e = this.exp;
    if (!this.s) return null;
    const x = Math.floor((px - this.ox) / this.s), y = Math.floor((py - this.oy) / this.s);
    if (x < 0 || y < 0 || x >= e.w || y >= e.h) return null;
    return [x, y];
  }
  markerAt(px, py) {
    let best = null, bd = 1e9;
    for (const m of this.markers) {
      const d = Math.hypot(m.x - px, m.y - py);
      if (d < m.r + 4 && d < bd) { bd = d; best = m; }
    }
    return best;
  }
}
