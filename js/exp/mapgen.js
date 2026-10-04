// Generación procedural de los mapas subterráneos
import { RNG, clamp } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { SECTOR_NAMES } from '../data/world.js';
import { ENEMIES } from '../data/enemies.js';
import { SQUADS, SQUAD_MIN_TIER } from '../data/humans.js';
import { rollLoot, createItem } from '../core/items.js';
import { NOTES, SURVIVOR_LINES, FOREIGN_NOTES } from '../data/lore.js';
import { ITEMS } from '../data/items.js';
import { BLOCKING_OBJ } from './shared.js';

const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Ningún objeto que bloquee el paso (cajas, taquillas, vetas…) puede dejar una salida o el montacargas sin camino:
// si pasa, se quita el objeto que hace de tapón (el que toca la zona alcanzable y la que no). Se repite hasta que haya camino.
export function clearChokepoints(W, H, t, start, exits, lift, objects) {
  const targets = [...exits.map((e) => [e.x, e.y]), ...(lift ? [lift] : [])];
  for (let guard = 0; guard < 40; guard++) {
    const block = new Map(objects.filter((o) => BLOCKING_OBJ[o.kind] && !o.vault).map((o) => [o.y * W + o.x, o]));
    const seen = new Uint8Array(W * H), q = [start[1] * W + start[0]];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (!seen[k] && TILES[t[k]].walk && !block.has(k)) { seen[k] = 1; q.push(k); } }
    }
    if (targets.every(([x, y]) => seen[y * W + x])) return;
    // tapones: objetos junto a la zona alcanzable que dan a casillas transitables no alcanzadas
    let plug = null;
    for (const [k, o] of block) {
      const x = k % W, y = (k / W) | 0;
      let inSide = false, outSide = false;
      for (const [dx, dy] of D8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const kk = ny * W + nx; if (seen[kk]) inSide = true; else if (TILES[t[kk]].walk && !block.has(kk)) outSide = true; }
      if (inSide && outSide) { plug = o; break; }
    }
    if (!plug) return;
    objects.splice(objects.indexOf(plug), 1);
  }
}
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const walkable = (t) => TILES[t].walk === 1;

// objetos propios de una facción (campo origin de los objetos)
const ORIGIN = {};
for (const [id, d] of Object.entries(ITEMS)) if (d.origin && d.cat !== 'valuable') (ORIGIN[d.origin] = ORIGIN[d.origin] || []).push(id);
function originPick(fac, n, g) {
  const out = [];
  const list = ORIGIN[fac] || [];
  for (let i = 0; i < n && list.length; i++) { const b = g.pick(list); out.push(createItem(b, g.chance(0.2) ? 1 : 0, g, ITEMS[b].cat === 'ammo' ? ITEMS[b].pack : ITEMS[b].stack > 1 ? 1 : undefined)); }
  return out;
}

export function generateMap(def, mapIdx, seed, opts = {}) {
  const g = new RNG(seed);
  const originItems = (fac, n) => originPick(fac, n, g);
  const W = def.w, H = def.h;
  const N = W * H;
  const t = new Uint8Array(N); // ROCK
  const sec = new Uint8Array(N).fill(255);
  const room = new Uint8Array(N);
  const I = (x, y) => y * W + x;
  const inb = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;

  // ---------------- Sectores ----------------
  const sectors = [];
  const bx = [], by = [];
  for (let i = 0; i <= def.sx; i++) bx.push(1 + Math.round((i * (W - 2)) / def.sx));
  for (let j = 0; j <= def.sy; j++) by.push(1 + Math.round((j * (H - 2)) / def.sy));
  const usedNames = new Set();
  const zoneKeys = Object.keys(def.zones);
  for (let j = 0; j < def.sy; j++) {
    for (let i = 0; i < def.sx; i++) {
      const type = g.weighted(zoneKeys, (k) => def.zones[k]);
      let nm, tries = 0;
      do { nm = g.pick(SECTOR_NAMES[type]); } while (usedNames.has(nm) && tries++ < 10);
      usedNames.add(nm);
      const s = { id: sectors.length, i, j, type, x: bx[i], y: by[j], w: bx[i + 1] - bx[i], h: by[j + 1] - by[j], code: String.fromCharCode(65 + i) + '-' + (j + 1), name: nm };
      sectors.push(s);
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) sec[I(x, y)] = s.id;
    }
  }
  const sectorAt = (i, j) => sectors[j * def.sx + i];

  // ---------------- Industrial (BSP) ----------------
  function carveRoom(x0, y0, w, h, tile = T.FLOOR) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) { t[I(x, y)] = tile; room[I(x, y)] = 1; }
  }
  function carveCorr(x0, y0, x1, y1, tile, wide = false) {
    const horizFirst = g.chance(0.5);
    const path = [];
    let x = x0, y = y0;
    const step = (nx, ny) => { x = nx; y = ny; path.push([x, y]); };
    path.push([x, y]);
    if (horizFirst) {
      while (x !== x1) step(x + Math.sign(x1 - x), y);
      while (y !== y1) step(x, y + Math.sign(y1 - y));
    } else {
      while (y !== y1) step(x, y + Math.sign(y1 - y));
      while (x !== x1) step(x + Math.sign(x1 - x), y);
    }
    for (const [px, py] of path) {
      if (!inb(px, py)) continue;
      const k = I(px, py);
      if (!walkable(t[k]) || t[k] === T.PAD) t[k] = tile;
      if (wide) for (const [dx, dy] of D4) { const nx = px + dx, ny = py + dy; if (inb(nx, ny) && !walkable(t[I(nx, ny)]) && g.chance(0.5)) t[I(nx, ny)] = tile; }
    }
  }
  function genIndustrial(s) {
    const rect = { x: s.x + 1, y: s.y + 1, w: s.w - 2, h: s.h - 2 };
    const leaves = [];
    function split(r, depth) {
      const canH = r.w >= 16, canV = r.h >= 13;
      if (depth > 5 || (!canH && !canV) || (depth > 1 && g.chance(0.15))) { leaves.push(r); return r; }
      let horiz = canH && (!canV || r.w / r.h > 1.25 || (r.w / r.h > 0.8 && g.chance(0.5)));
      const node = { a: null, b: null };
      if (horiz) {
        const cut = Math.round(r.w * g.float(0.38, 0.62));
        node.a = split({ x: r.x, y: r.y, w: cut, h: r.h }, depth + 1);
        node.b = split({ x: r.x + cut, y: r.y, w: r.w - cut, h: r.h }, depth + 1);
      } else {
        const cut = Math.round(r.h * g.float(0.38, 0.62));
        node.a = split({ x: r.x, y: r.y, w: r.w, h: cut }, depth + 1);
        node.b = split({ x: r.x, y: r.y + cut, w: r.w, h: r.h - cut }, depth + 1);
      }
      return node;
    }
    const tree = split(rect, 0);
    for (const lf of leaves) {
      const rw = g.int(Math.max(4, Math.floor(lf.w * 0.55)), Math.max(4, lf.w - 2));
      const rh = g.int(Math.max(3, Math.floor(lf.h * 0.55)), Math.max(3, lf.h - 2));
      const rx = lf.x + g.int(1, Math.max(1, lf.w - rw - 1));
      const ry = lf.y + g.int(1, Math.max(1, lf.h - rh - 1));
      const tile = g.chance(0.12) ? T.GRATE : T.FLOOR;
      // revisión: no todas las salas son rectángulos (ovaladas, en L o en cruz)
      const shape = rw >= 7 && rh >= 5 ? g.weighted(['rect', 'oval', 'ele', 'cruz'], (k) => ({ rect: 6, oval: 1.5, ele: 1.5, cruz: 1 })[k]) : 'rect';
      if (shape === 'oval') carveEllipse(rx + rw / 2 - 0.5, ry + rh / 2 - 0.5, rw / 2, rh / 2, tile);
      else if (shape === 'ele') {
        carveRoom(rx, ry, rw, rh, tile);
        const cx = g.chance(0.5) ? rx : rx + Math.ceil(rw / 2), cy = g.chance(0.5) ? ry : ry + Math.ceil(rh / 2);
        for (let y = cy; y < cy + Math.floor(rh / 2); y++) for (let x = cx; x < cx + Math.floor(rw / 2); x++) if (inb(x, y)) { t[I(x, y)] = T.ROCK; room[I(x, y)] = 0; }
      } else if (shape === 'cruz') {
        const bw = Math.max(3, Math.floor(rw / 3)), bh = Math.max(3, Math.floor(rh / 3));
        carveRoom(rx, ry + Math.floor((rh - bh) / 2), rw, bh, tile);
        carveRoom(rx + Math.floor((rw - bw) / 2), ry, bw, rh, tile);
      } else carveRoom(rx, ry, rw, rh, tile);
      lf.room = { x: rx, y: ry, w: rw, h: rh };
      // maquinaria en salas grandes
      if (rw >= 9 && rh >= 7 && g.chance(0.55)) {
        const stepX = g.int(2, 3), stepY = g.int(2, 3);
        for (let y = ry + 2; y <= ry + rh - 3; y += stepY + 1) {
          for (let x = rx + 2; x <= rx + rw - 3; x += stepX + 1) {
            if (g.chance(0.75)) {
              t[I(x, y)] = T.MACHINE;
              if (stepX >= 3 && x + 1 <= rx + rw - 3 && g.chance(0.5)) t[I(x + 1, y)] = T.MACHINE;
            }
          }
        }
      }
    }
    const center = (r) => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
    function anyRoom(n) {
      if (n.room) return n.room;
      if (n.a) return g.chance(0.5) ? anyRoom(n.a) || anyRoom(n.b) : anyRoom(n.b) || anyRoom(n.a);
      return null;
    }
    function connect(n) {
      if (!n || n.room || !n.a) return;
      connect(n.a); connect(n.b);
      const ra = anyRoom(n.a), rb = anyRoom(n.b);
      if (ra && rb) {
        const [ax, ay] = center(ra), [bx2, by2] = center(rb);
        const ox = ra.x + g.int(0, ra.w - 1), oy = ra.y + g.int(0, ra.h - 1);
        const px = rb.x + g.int(0, rb.w - 1), py = rb.y + g.int(0, rb.h - 1);
        carveCorr(g.chance(0.5) ? ax : ox, g.chance(0.5) ? ay : oy, g.chance(0.5) ? bx2 : px, g.chance(0.5) ? by2 : py, T.FLOOR);
      }
    }
    connect(tree);
  }

  // ---------------- Cavernas (autómata celular) ----------------
  function genCave(s, flooded) {
    const x0 = s.x + 1, y0 = s.y + 1, w = s.w - 2, h = s.h - 2;
    let m = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) m[k] = g.chance(0.46) ? 1 : 0;
    const at = (mm, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 1 : mm[y * w + x]);
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let c = 0, c2 = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dy) continue;
          const v = at(m, x + dx, y + dy);
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) c += v;
          c2 += v;
        }
        n[y * w + x] = c >= 5 || (it < 3 && c2 <= 2) ? 1 : 0;
      }
      m = n;
    }
    // región mayor
    const lab = new Int32Array(w * h).fill(-1);
    let best = -1, bestSize = 0;
    for (let k = 0; k < w * h; k++) {
      if (m[k] || lab[k] >= 0) continue;
      const q = [k]; lab[k] = k; let size = 0;
      while (q.length) {
        const c = q.pop(); size++;
        const cx = c % w, cy = (c / w) | 0;
        for (const [dx, dy] of D4) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nk = ny * w + nx;
          if (!m[nk] && lab[nk] < 0) { lab[nk] = k; q.push(nk); }
        }
      }
      if (size > bestSize) { bestSize = size; best = k; }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!m[k] && lab[k] === best) t[I(x0 + x, y0 + y)] = T.CAVE;
    }
    if (bestSize < w * h * 0.15) {
      // caverna demasiado pequeña: tallar una cámara elíptica
      const cx = x0 + w / 2, cy = y0 + h / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x0 + x - cx) / (w / 2.4), dy = (y0 + y - cy) / (h / 2.4);
        if (dx * dx + dy * dy < 1 + g.float(-0.15, 0.15)) t[I(x0 + x, y0 + y)] = T.CAVE;
      }
    }
    if (flooded) floodBlobs(s, g.int(2, 4), [T.CAVE]);
    // escombros dispersos
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (t[I(x, y)] === T.CAVE && g.chance(0.04)) t[I(x, y)] = T.RUBBLE;
  }
  function floodBlobs(s, count, on) {
    for (let b = 0; b < count; b++) {
      const cx = g.int(s.x + 2, s.x + s.w - 3), cy = g.int(s.y + 2, s.y + s.h - 3);
      const r = g.float(2.5, Math.min(7, Math.min(s.w, s.h) / 3));
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (!inb(x, y) || sec[I(x, y)] !== s.id) continue;
        const d = Math.hypot((x - cx) * 0.8, y - cy) + g.float(-0.8, 0.8);
        if (d < r && on.includes(t[I(x, y)])) t[I(x, y)] = d < r - 2.2 ? T.DEEP : T.WATER;
      }
    }
  }

  // ---------------- Fase 17: superficie y subsuelo nuevo ----------------
  const SURF = { ciudad: 1, bosque: 1, ferroviario: 1, chatarreria: 1, antena: 1, lago: 1 };
  const hot = []; // casillas muy radiactivas [k, intensidad]
  const refuge = []; // interiores protegidos de la radiación (blindados)
  const wagons = []; // interiores de vagones y vehículos (contenedores de botín)
  const cables = []; // cables de la antena (anomalías)
  const extraObjects = [];
  let antennaAt = null;
  const surfGround = (x, y) => (noise2(x, y) > 0.62 ? T.GRASS : T.GROUND);
  function noise2(x, y) { const v = Math.sin(x * 0.21 + seed * 1e-5) * Math.cos(y * 0.27 - seed * 3e-6) + Math.sin((x + y) * 0.13); return (v + 2) / 4; }
  function fillSector(s, fn) { for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (inb(x, y)) t[I(x, y)] = fn(x, y); }
  function rectFree(x0, y0, w, h, ok) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!inb(x, y) || x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || !ok(t[I(x, y)])) return false; return true; }
  // edificio: muros, interior transitable y 1–2 puertas
  function building(x0, y0, w, h, inner = T.FLOOR, wall = T.WALL) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      t[I(x, y)] = edge ? wall : inner;
      if (!edge) room[I(x, y)] = 1;
    }
    const nd = g.chance(0.5) ? 2 : 1;
    for (let d = 0; d < nd; d++) {
      const side = g.int(0, 3);
      const dx = side < 2 ? g.int(x0 + 1, x0 + w - 2) : side === 2 ? x0 : x0 + w - 1;
      const dy = side >= 2 ? g.int(y0 + 1, y0 + h - 2) : side === 0 ? y0 : y0 + h - 1;
      t[I(dx, dy)] = wall === T.HULL ? T.FLOOR : T.DOOR;
    }
    return { x0, y0, w, h };
  }
  const openish = (tt) => tt === T.GROUND || tt === T.GRASS || tt === T.ASPHALT;
  function genCity(s) {
    fillSector(s, surfGround);
    const sp = g.int(13, 16);
    for (let y = s.y + 1; y < s.y + s.h; y += sp) for (let yy = y; yy < y + 2; yy++) for (let x = s.x; x < s.x + s.w; x++) if (inb(x, yy)) t[I(x, yy)] = T.ASPHALT;
    for (let x = s.x + 1; x < s.x + s.w; x += sp + 4) for (let xx = x; xx < x + 2; xx++) for (let y = s.y; y < s.y + s.h; y++) if (inb(xx, y)) t[I(xx, y)] = T.ASPHALT;
    const park = /Parque|Plaza|Estadio/.test(s.name);
    for (let n = 0; n < (park ? 2 : 7); n++) {
      const w = g.int(7, 14), h = g.int(5, 9);
      const x0 = g.int(s.x + 1, Math.max(s.x + 1, s.x + s.w - w - 1)), y0 = g.int(s.y + 1, Math.max(s.y + 1, s.y + s.h - h - 1));
      if (rectFree(x0 - 1, y0 - 1, w + 2, h + 2, (tt) => tt === T.GROUND || tt === T.GRASS)) building(x0, y0, w, h);
    }
    if (park) for (let n = 0; n < g.int(3, 6); n++) { const x = g.int(s.x + 2, s.x + s.w - 3), y = g.int(s.y + 2, s.y + s.h - 3); if (openish(t[I(x, y)])) t[I(x, y)] = g.chance(0.6) ? T.SWING : T.PINE; }
    for (let n = 0; n < g.int(4, 9); n++) { const x = g.int(s.x + 1, s.x + s.w - 2), y = g.int(s.y + 1, s.y + s.h - 2); if (t[I(x, y)] === T.ASPHALT) t[I(x, y)] = T.CAR; }
    for (let n = 0; n < g.int(4, 10); n++) { const x = g.int(s.x + 1, s.x + s.w - 2), y = g.int(s.y + 1, s.y + s.h - 2); if (t[I(x, y)] === T.GROUND || t[I(x, y)] === T.GRASS) t[I(x, y)] = T.PINE; }
  }
  function genForest(s) {
    fillSector(s, surfGround);
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (noise2(x * 1.7, y * 1.9) > 0.55 && g.chance(0.45)) t[I(x, y)] = T.PINE;
    for (let n = 0; n < (g.chance(0.65) ? g.int(1, 2) : 0); n++) {
      const w = g.int(6, 11), h = g.int(3, 6);
      const x0 = g.int(s.x + 2, Math.max(s.x + 2, s.x + s.w - w - 2)), y0 = g.int(s.y + 2, Math.max(s.y + 2, s.y + s.h - h - 2));
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) { t[I(x, y)] = T.DUG; hot.push([I(x, y), 2.2]); }
    }
  }
  function genRail(s) {
    fillSector(s, surfGround);
    for (let y = s.y + 3; y < s.y + s.h - 2; y += 6) {
      for (let x = s.x; x < s.x + s.w; x++) t[I(x, y)] = T.RAIL;
      // vagones sobre la vía (3 de alto, con puerta lateral)
      let x = s.x + g.int(1, 6);
      while (x < s.x + s.w - 10) {
        const len = g.int(6, 10);
        if (g.chance(0.6) && rectFree(x, y - 1, len, 3, (tt) => tt === T.RAIL || tt === T.GROUND || tt === T.GRASS)) {
          for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x; xx < x + len; xx++) t[I(xx, yy)] = yy === y && xx > x && xx < x + len - 1 ? T.FLOOR : T.HULL;
          const dx = g.int(x + 1, x + len - 2);
          t[I(dx, g.chance(0.5) ? y - 1 : y + 1)] = T.FLOOR;
          wagons.push({ x: x + 1, y, len: len - 2 });
        }
        x += len + g.int(2, 6);
      }
    }
  }
  function genJunk(s) {
    fillSector(s, (x, y) => (noise2(x, y) > 0.55 ? T.ASPHALT : T.GROUND));
    for (let y = s.y + 2; y < s.y + s.h - 4; y += g.int(5, 7)) {
      let x = s.x + g.int(1, 4);
      while (x < s.x + s.w - 8) {
        const kind = g.pick(['heli', 'truck', 'btr']);
        const w = kind === 'heli' ? 7 : kind === 'truck' ? 5 : 6, h = kind === 'btr' ? 4 : kind === 'heli' ? 3 : 2;
        if (rectFree(x, y, w, h, openish)) {
          if (kind === 'btr') {
            building(x, y, w, h, T.FLOOR, T.HULL);
            for (let yy = y + 1; yy < y + h - 1; yy++) for (let xx = x + 1; xx < x + w - 1; xx++) refuge.push(I(xx, yy));
            wagons.push({ x: x + 1, y: y + 1, len: w - 2 });
          } else for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!(kind === 'heli' && yy !== y + 1 && (xx === x || xx >= x + w - 2))) t[I(xx, yy)] = T.HULL;
        }
        x += w + g.int(2, 5);
      }
    }
  }
  function genAntenna(s) {
    fillSector(s, surfGround);
    const ox = g.int(0, 4);
    for (let y = s.y + 1; y < s.y + s.h - 1; y++) for (let x = s.x + 1; x < s.x + s.w - 1; x++) {
      if ((x + ox) % 6 === 0 && y % 4 !== 0) { t[I(x, y)] = T.LATTICE; if (g.chance(0.12)) cables.push(I(x + 1, y)); }
      else if (y % 8 === 0 && (x + ox) % 6 !== 3 && g.chance(0.5)) t[I(x, y)] = T.LATTICE;
    }
    if (!antennaAt && /control/i.test(s.name + ' control')) {
      const w = 9, h = 7, x0 = s.x + Math.floor(s.w / 2) - 4, y0 = s.y + Math.floor(s.h / 2) - 3;
      for (let y = y0 - 1; y < y0 + h + 1; y++) for (let x = x0 - 1; x < x0 + w + 1; x++) if (inb(x, y)) t[I(x, y)] = T.GROUND;
      building(x0, y0, w, h);
      antennaAt = [x0 + 4, y0 + 3];
      t[I(antennaAt[0], antennaAt[1])] = T.ANTENNA;
    }
  }
  function genLake(s) {
    fillSector(s, () => T.DEEP);
    // orillas en el borde del mapa
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y) + (noise2(x, y) - 0.5) * 4;
      if (d < 5) t[I(x, y)] = surfGround(x, y); else if (d < 7) t[I(x, y)] = T.WATER;
    }
    // islotes
    for (let n = 0; n < g.int(1, 3); n++) {
      const cx = g.int(s.x + 4, s.x + s.w - 5), cy = g.int(s.y + 3, s.y + s.h - 4), r = g.float(2.5, 4.5);
      for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 7; x <= cx + 7; x++) {
        if (!inb(x, y) || sec[I(x, y)] !== s.id) continue;
        const d = Math.hypot((x - cx) * 0.8, y - cy);
        if (d < r) t[I(x, y)] = surfGround(x, y); else if (d < r + 1.3 && t[I(x, y)] === T.DEEP) t[I(x, y)] = T.WATER;
      }
    }
  }
  function genMetro(s) {
    genIndustrial(s);
    const cy = s.y + Math.floor(s.h / 2);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = s.x; x < s.x + s.w; x++) if (inb(x, y)) { t[I(x, y)] = y === cy ? T.RAIL : T.FLOOR; room[I(x, y)] = 0; }
    // andén
    const px = g.int(s.x + 2, Math.max(s.x + 2, s.x + s.w - 14));
    for (let y = cy - 4; y <= cy - 2; y++) for (let x = px; x < px + 12; x++) if (inb(x, y)) { t[I(x, y)] = T.FLOOR; room[I(x, y)] = 1; }
    // vagones de metro sobre la vía
    let x = s.x + g.int(2, 8);
    while (x < s.x + s.w - 9) { if (g.chance(0.45)) { for (let xx = x; xx < x + 7; xx++) t[I(xx, cy)] = T.HULL; } x += g.int(10, 16); }
  }

  // ---------------- Revisión: variedad de trazados por sector ----------------
  // Cada sector elige un trazado según su tipo (y evita repetir mucho los que ya hay en el mapa):
  //   edificios: salas (BSP clásico) · nave · pasillo · anillo · pozo · almacen · derrumbe
  //   cavernas:  celular (autómata clásico) · gusanos · gruta · rio · lago
  const inSec = (s, x, y) => x > s.x && y > s.y && x < s.x + s.w - 1 && y < s.y + s.h - 1 && inb(x, y);
  const setT = (x, y, tile, isRoom = 0) => { if (!inb(x, y)) return; t[I(x, y)] = tile; room[I(x, y)] = isRoom; };
  function carveEllipse(cx, cy, rx, ry, tile, isRoom = 1, s = null, jitter = 0) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (s ? !inSec(s, x, y) : !inb(x, y)) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 + (jitter ? g.float(-jitter, jitter) : 0)) { t[I(x, y)] = tile; room[I(x, y)] = isRoom; }
    }
  }
  // ruido suave por sector (sumas de senos con fases al azar), en [-1, 1]
  function makeNoise(sc = 1) {
    const ph = [g.float(0, 6.28), g.float(0, 6.28), g.float(0, 6.28), g.float(0, 6.28)];
    return (x, y) => (Math.sin(x * 0.31 * sc + ph[0]) + Math.sin(y * 0.37 * sc + ph[1]) + Math.sin((x + y) * 0.19 * sc + ph[2]) + Math.sin((x - y) * 0.23 * sc + ph[3])) / 4;
  }
  const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // en orden circular
  // nave: una gran sala con columnas, hileras de maquinaria y, a veces, oficinas en un extremo
  function genHall(s) {
    const m = g.int(2, 3);
    const x0 = s.x + m, y0 = s.y + m, w = s.w - 2 * m, h = s.h - 2 * m;
    carveRoom(x0, y0, w, h, g.chance(0.2) ? T.GRATE : T.FLOOR);
    let ox0 = x0, ow = 0;
    if (w >= 24 && g.chance(0.55)) {
      // oficinas: tabique con despachos a un lado
      ow = g.int(5, 7);
      const left = g.chance(0.5);
      const wx = left ? x0 + ow : x0 + w - 1 - ow;
      for (let y = y0; y < y0 + h; y++) setT(wx, y, T.WALL);
      let y = y0;
      while (y < y0 + h) {
        const oh = g.int(3, 5);
        const ye = Math.min(y0 + h - 1, y + oh);
        if (ye < y0 + h - 1) for (let x = left ? x0 : wx + 1; x < (left ? wx : x0 + w); x++) setT(x, ye, T.WALL);
        setT(wx, g.int(y, Math.max(y, ye - 1)), T.FLOOR, 1); // puerta del despacho
        y = ye + 1;
      }
      if (left) ox0 = wx + 1;
    }
    const hx0 = ow && ox0 !== x0 ? ox0 : x0, hw = w - (ow ? ow + 1 : 0);
    // columnas
    const px = g.int(4, 6), py = g.int(4, 5), big = g.chance(0.35);
    for (let y = y0 + 2; y < y0 + h - 2; y += py) for (let x = hx0 + 2; x < hx0 + hw - 2; x += px) {
      setT(x, y, T.WALL);
      if (big && x + 1 < hx0 + hw - 2 && y + 1 < y0 + h - 2) { setT(x + 1, y, T.WALL); setT(x, y + 1, T.WALL); setT(x + 1, y + 1, T.WALL); }
    }
    // hileras de maquinaria entre columnas, con huecos para pasar
    if (g.chance(0.7)) for (let y = y0 + 2 + Math.floor(py / 2) + (big ? 1 : 0); y < y0 + h - 2; y += py * g.int(1, 2)) {
      let x = hx0 + 2;
      while (x < hx0 + hw - 3) {
        const len = g.int(2, 5);
        if (g.chance(0.7)) for (let i = 0; i < len && x + i < hx0 + hw - 3; i++) if (t[I(x + i, y)] === T.FLOOR || t[I(x + i, y)] === T.GRATE) setT(x + i, y, T.MACHINE);
        x += len + g.int(2, 3);
      }
    }
  }
  // pasillo: un corredor ancho a lo largo del sector y una hilera de celdas a cada lado, cada una con su puerta
  function genSpine(s) {
    const horiz = s.w >= s.h;
    const P = (u, v) => (horiz ? [u, v] : [v, u]);
    const U0 = horiz ? s.x + 2 : s.y + 2, U1 = horiz ? s.x + s.w - 3 : s.y + s.h - 3;
    const V0 = horiz ? s.y + 2 : s.x + 2, V1 = horiz ? s.y + s.h - 3 : s.x + s.w - 3;
    const cw = g.int(2, 3);
    const vc = Math.floor((V0 + V1) / 2) - (cw >> 1) + g.int(-2, 2);
    for (let u = U0 - 1; u <= U1 + 1; u++) for (let v = vc; v < vc + cw; v++) { const [x, y] = P(u, v); setT(x, y, T.FLOOR, 0); }
    for (const side of [-1, 1]) {
      const a = side < 0 ? V0 : vc + cw + 1, b = side < 0 ? vc - 2 : V1;
      if (b - a < 2) continue;
      const wallV = side < 0 ? vc - 1 : vc + cw;
      let u = U0;
      while (u < U1 - 2) {
        const rw = g.int(4, 8), ue = Math.min(U1, u + rw - 1);
        if (ue - u < 2) break;
        const depth = g.chance(0.35) ? g.int(Math.max(3, Math.floor((b - a) / 2)), b - a + 1) : b - a + 1;
        const aa = side < 0 ? b - depth + 1 : a, bb = side < 0 ? b : a + depth - 1;
        if (!g.chance(0.1)) {
          const tile = g.chance(0.15) ? T.GRATE : T.FLOOR;
          for (let uu = u; uu <= ue; uu++) for (let v = aa; v <= bb; v++) { const [x, y] = P(uu, v); setT(x, y, tile, 1); }
          const [dx, dy] = P(g.int(u, ue), wallV); setT(dx, dy, T.FLOOR, 0); // puerta al pasillo
          if (g.chance(0.25) && ue + 2 <= U1) { const [ix, iy] = P(ue + 1, g.int(aa, bb)); setT(ix, iy, T.FLOOR, 1); } // paso a la celda de al lado
        }
        u = ue + 2;
      }
    }
  }
  // anillo: corredor alrededor de un atrio central (piscina de combustible, núcleo de grafito o columnas)
  function genRing(s) {
    const m = 2, cw = 2;
    const x0 = s.x + m, y0 = s.y + m, x1 = s.x + s.w - 1 - m, y1 = s.y + s.h - 1 - m;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < x0 + cw || x > x1 - cw || y < y0 + cw || y > y1 - cw) setT(x, y, T.FLOOR, 0);
    const ax0 = x0 + cw + 1, ay0 = y0 + cw + 1, ax1 = x1 - cw - 1, ay1 = y1 - cw - 1;
    if (ax1 - ax0 < 6 || ay1 - ay0 < 4) return;
    for (let y = ay0; y <= ay1; y++) for (let x = ax0; x <= ax1; x++) setT(x, y, T.FLOOR, 1);
    // entradas al atrio (una o dos por lado)
    for (const [side, n] of [['N', g.int(1, 2)], ['S', g.int(1, 2)], ['W', g.int(0, 1)], ['E', g.int(0, 1)]]) for (let i = 0; i < n; i++) {
      if (side === 'N' || side === 'S') setT(g.int(ax0 + 1, ax1 - 1), side === 'N' ? ay0 - 1 : ay1 + 1, T.FLOOR, 0);
      else setT(side === 'W' ? ax0 - 1 : ax1 + 1, g.int(ay0 + 1, ay1 - 1), T.FLOOR, 0);
    }
    const cx = (ax0 + ax1) / 2, cy = (ay0 + ay1) / 2, rx = (ax1 - ax0) / 2, ry = (ay1 - ay0) / 2;
    const feat = g.weighted(['piscina', 'nucleo', 'columnas'], (k) => ({ piscina: usedLayouts.pozo ? 0.3 : 0.8, nucleo: 1, columnas: 1.2 })[k]);
    if (feat === 'piscina' && rx >= 5 && ry >= 3) {
      // piscina de combustible gastado: agua profunda y radiactiva, con una pasarela que la cruza
      carveEllipse(cx, cy, rx * 0.6, ry * 0.6, T.WATER, 1);
      carveEllipse(cx, cy, rx * 0.6 - 1, ry * 0.6 - 0.8, T.DEEP, 1);
      for (let y = ay0; y <= ay1; y++) for (let x = ax0; x <= ax1; x++) if (t[I(x, y)] === T.DEEP) hot.push([I(x, y), 1.4]);
      const yy = Math.round(cy);
      for (let x = ax0; x <= ax1; x++) if (t[I(x, yy)] === T.DEEP || t[I(x, yy)] === T.WATER) setT(x, yy, T.CATWALK, 1);
    } else if (feat === 'nucleo') {
      // núcleo: bloque de maquinaria con grafito esparcido alrededor
      const bw = Math.max(1, Math.floor(rx / 3.5)), bh = Math.max(1, Math.floor(ry / 3));
      for (let y = Math.round(cy) - bh; y <= Math.round(cy) + bh; y++) for (let x = Math.round(cx) - bw; x <= Math.round(cx) + bw; x++) setT(x, y, T.MACHINE, 1);
      for (let y = ay0; y <= ay1; y++) for (let x = ax0; x <= ax1; x++) if (t[I(x, y)] === T.FLOOR && g.chance(0.12)) { setT(x, y, T.GRAPHITE, 1); hot.push([I(x, y), 0.8]); }
    } else {
      for (let a = 0; a < 12; a++) { const ang = (a / 12) * Math.PI * 2; setT(Math.round(cx + Math.cos(ang) * (rx - 1.5)), Math.round(cy + Math.sin(ang) * (ry - 1.2)), T.WALL); }
    }
  }
  // pozo: sala grande con un pozo inundado en el centro y pasarelas que lo cruzan
  function genPit(s) {
    const m = g.int(2, 3);
    const x0 = s.x + m, y0 = s.y + m, w = s.w - 2 * m, h = s.h - 2 * m;
    carveRoom(x0, y0, w, h, T.FLOOR);
    const cx = x0 + w / 2 - 0.5, cy = y0 + h / 2 - 0.5, rx = w * g.float(0.17, 0.25), ry = h * g.float(0.17, 0.25);
    carveEllipse(cx, cy, rx + 1, ry + 1, T.WATER, 1);
    carveEllipse(cx, cy, rx, ry, T.DEEP, 1, null, 0.08);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (t[I(x, y)] === T.DEEP) hot.push([I(x, y), 0.7]);
    // pasarelas en cruz (a veces solo una)
    const yy = Math.round(cy) + g.int(-1, 1), xx = Math.round(cx) + g.int(-2, 2);
    for (let x = x0; x < x0 + w; x++) if (t[I(x, yy)] === T.DEEP || t[I(x, yy)] === T.WATER) setT(x, yy, T.CATWALK, 1);
    if (g.chance(0.7)) for (let y = y0; y < y0 + h; y++) if (t[I(xx, y)] === T.DEEP || t[I(xx, y)] === T.WATER) setT(xx, y, T.CATWALK, 1);
    // barandillas de maquinaria en las esquinas
    for (const [cx2, cy2] of [[x0 + 1, y0 + 1], [x0 + w - 3, y0 + h - 3]]) if (g.chance(0.6)) { setT(cx2, cy2, T.MACHINE, 1); setT(cx2 + 1, cy2, T.MACHINE, 1); }
  }
  // almacén: estanterías largas con pasillos y cruces
  function genStore(s) {
    const m = 2;
    const x0 = s.x + m, y0 = s.y + m, w = s.w - 2 * m, h = s.h - 2 * m;
    carveRoom(x0, y0, w, h, T.FLOOR);
    const horiz = w >= h;
    const L0 = horiz ? x0 + 2 : y0 + 2, L1 = horiz ? x0 + w - 3 : y0 + h - 3; // a lo largo
    const C0 = horiz ? y0 + 2 : x0 + 2, C1 = horiz ? y0 + h - 3 : x0 + w - 3; // a lo ancho
    const gap = g.int(2, 3);
    const cross = new Set();
    for (let l = L0 + g.int(4, 8); l < L1 - 2; l += g.int(7, 11)) { cross.add(l); cross.add(l + 1); }
    for (let c = C0; c <= C1; c += gap + 1) for (let l = L0; l <= L1; l++) {
      if (cross.has(l)) continue;
      const [x, y] = horiz ? [l, c] : [c, l];
      setT(x, y, T.MACHINE, 1);
    }
  }
  // derrumbe: salas normales con un cráter de escombros que se lo ha llevado todo por delante en el medio
  function genCollapse(s) {
    genIndustrial(s);
    const nz = makeNoise(1.6);
    const cx = s.x + s.w * g.float(0.35, 0.65), cy = s.y + s.h * g.float(0.35, 0.65);
    const rx = s.w * g.float(0.26, 0.38), ry = s.h * g.float(0.26, 0.38);
    for (let y = s.y + 1; y < s.y + s.h - 1; y++) for (let x = s.x + 1; x < s.x + s.w - 1; x++) {
      if (!inSec(s, x, y)) continue;
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) + nz(x, y) * 0.25;
      if (d < 0.85) setT(x, y, g.chance(0.55) ? T.RUBBLE : g.chance(0.5) ? T.CAVE : T.FLOOR, 0);
      else if (d < 1.05 && !walkable(t[I(x, y)]) && g.chance(0.45)) setT(x, y, T.DEBRIS, 0);
    }
  }
  // gusanos: túneles serpenteantes con cámaras, que parten de un punto común
  function genWorms(s, flooded) {
    const x0 = s.x + 2, y0 = s.y + 2, x1 = s.x + s.w - 3, y1 = s.y + s.h - 3;
    const hub = [Math.floor((x0 + x1) / 2) + g.int(-3, 3), Math.floor((y0 + y1) / 2) + g.int(-2, 2)];
    carveEllipse(hub[0], hub[1], g.float(2.5, 4), g.float(2, 3), T.CAVE, 0, s, 0.3);
    const n = g.int(4, 6);
    for (let wi = 0; wi < n; wi++) {
      let x = hub[0], y = hub[1], dir = g.int(0, 7);
      const steps = g.int(60, 140), rad = g.chance(0.35) ? 1 : 0;
      for (let st = 0; st < steps; st++) {
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (inSec(s, x + dx, y + dy)) setT(x + dx, y + dy, T.CAVE, 0);
        if (g.chance(0.025)) carveEllipse(x, y, g.float(2, 4), g.float(1.6, 3), T.CAVE, 0, s, 0.3); // cámara
        if (g.chance(0.3)) dir = (dir + g.pick([-1, 1]) + 8) % 8;
        let nx = x + DIR8[dir][0], ny = y + DIR8[dir][1];
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) { dir = (dir + 4) % 8; nx = Math.max(x0, Math.min(x1, x)); ny = Math.max(y0, Math.min(y1, y)); }
        x = nx; y = ny;
      }
    }
    if (flooded) floodBlobs(s, g.int(1, 3), [T.CAVE]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (t[I(x, y)] === T.CAVE && g.chance(0.03)) t[I(x, y)] = T.RUBBLE;
  }
  // gruta: una caverna enorme y abierta, con estalagmitas y una charca
  function genGrotto(s, flooded, lake = false) {
    const nz = makeNoise(1.2);
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2, rx = s.w / 2 - 1.5, ry = s.h / 2 - 1.5;
    for (let y = s.y + 1; y < s.y + s.h - 1; y++) for (let x = s.x + 1; x < s.x + s.w - 1; x++) {
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) + nz(x, y) * 0.3;
      if (d < 0.95) setT(x, y, T.CAVE, 0);
    }
    // estalagmitas sueltas (nunca dos juntas)
    for (let y = s.y + 2; y < s.y + s.h - 2; y++) for (let x = s.x + 2; x < s.x + s.w - 2; x++) {
      if (t[I(x, y)] !== T.CAVE || !g.chance(0.035)) continue;
      if (D8.every(([dx, dy]) => t[I(x + dx, y + dy)] === T.CAVE)) setT(x, y, T.ROCK, 0);
    }
    // charca o lago (con playa de arena)
    if (lake || flooded || g.chance(0.5)) {
      const lx = cx + g.float(-rx, rx) * (lake ? 0.15 : 0.4), ly = cy + g.float(-ry, ry) * (lake ? 0.15 : 0.4);
      const lr = lake ? g.float(0.32, 0.42) : g.float(0.12, 0.2);
      const Lx = rx * lr * 2, Ly = ry * lr * 2;
      carveEllipse(lx, ly, Lx + 1.6, Ly + 1.3, T.SAND, 0, s, 0.3);
      carveEllipse(lx, ly, Lx + 0.6, Ly + 0.5, T.WATER, 0, s, 0.2);
      carveEllipse(lx, ly, Lx, Ly, T.DEEP, 0, s, 0.15);
      // islotes en los lagos grandes
      if (lake) for (let n = 0; n < g.int(1, 3); n++) carveEllipse(lx + g.float(-Lx, Lx) * 0.6, ly + g.float(-Ly, Ly) * 0.6, g.float(1.5, 2.5), g.float(1, 2), T.CAVE, 0, s, 0.3);
    }
  }
  // río: un cauce que cruza el sector de lado a lado con puentes (de corium en el Útero: ahí los puentes son de roca)
  function genRiver(s, kind = 'agua') {
    if (g.chance(0.5)) genCave(s, false); else genGrotto(s, false);
    const horiz = s.w >= s.h;
    const U0 = horiz ? s.x + 1 : s.y + 1, U1 = horiz ? s.x + s.w - 2 : s.y + s.h - 2;
    const V0 = horiz ? s.y + 3 : s.x + 3, V1 = horiz ? s.y + s.h - 4 : s.x + s.w - 4;
    const mid = (V0 + V1) / 2, amp = (V1 - V0) * g.float(0.12, 0.25), fr = g.float(0.12, 0.25), ph = g.float(0, 6.28);
    const core = kind === 'corium' ? T.CORIUM : T.DEEP, bank = kind === 'corium' ? T.GRAPHITE : T.WATER;
    const bridges = new Set();
    for (let i = 0; i < g.int(1, 2); i++) { const b0 = g.int(U0 + 3, U1 - 4); bridges.add(b0); bridges.add(b0 + 1); }
    for (let u = U0; u <= U1; u++) {
      const c = mid + Math.sin(u * fr + ph) * amp;
      const half = g.chance(0.15) ? 2 : 1.3;
      for (let v = Math.floor(c - half - 1.5); v <= Math.ceil(c + half + 1.5); v++) {
        const [x, y] = horiz ? [u, v] : [v, u];
        if (!inSec(s, x, y)) continue;
        const d = Math.abs(v - c);
        if (bridges.has(u)) { setT(x, y, kind === 'corium' ? T.CAVE : T.CATWALK, 0); continue; }
        if (d <= half) { setT(x, y, core, 0); if (kind === 'corium') hot.push([I(x, y), 2.5]); }
        else if (d <= half + 1.5) { setT(x, y, bank, 0); if (kind === 'corium') hot.push([I(x, y), 1.2]); }
      }
    }
  }
  const ROOM_LAYOUTS = {
    industrial: { salas: 3, nave: 2.2, pasillo: 1.5, anillo: 1, pozo: 0.6, almacen: 1.5, derrumbe: 0.7 },
    ruinas: { salas: 2, derrumbe: 3, nave: 1, pasillo: 1, anillo: 0.7 },
    laboratorio: { pasillo: 3, salas: 2, anillo: 2, pozo: 0.4, almacen: 0.6, nave: 0.8 },
    base: { salas: 2, pasillo: 2, anillo: 1.5, nave: 1, almacen: 1 },
    campamento: { salas: 2, nave: 1 },
  };
  const CAVE_LAYOUTS = {
    caverna: { celular: 3, gusanos: 2, gruta: 2, rio: 1.2 },
    inundado: { celular: 2, lago: 2.5, rio: 1.5, gusanos: 1 },
    organico: { celular: 2, gusanos: 2.5, gruta: 1 },
    corium: { celular: 2, rio: 1.5, gruta: 1.5, gusanos: 1 },
  };
  const usedLayouts = {};
  // los trazados ya usados en el mapa pesan menos: así un mismo mapa mezcla varios
  const pickLayout = (table) => { const keys = Object.keys(table); const k = g.weighted(keys, (key) => table[key] / (1 + 1.5 * (usedLayouts[key] || 0))); usedLayouts[k] = (usedLayouts[k] || 0) + 1; return k; };
  // los sectores muy pequeños (zonas sociales, pisos estrechos) siguen con el trazado clásico
  const roomy = (s) => s.w >= 22 && s.h >= 16;
  function genRoomSector(s) {
    const L = roomy(s) && ROOM_LAYOUTS[s.type] ? pickLayout(ROOM_LAYOUTS[s.type]) : 'salas';
    s.layout = L;
    ({ salas: genIndustrial, nave: genHall, pasillo: genSpine, anillo: genRing, pozo: genPit, almacen: genStore, derrumbe: genCollapse })[L](s);
  }
  function genCaveSector(s) {
    const L = roomy(s) && CAVE_LAYOUTS[s.type] ? pickLayout(CAVE_LAYOUTS[s.type]) : 'celular';
    s.layout = L;
    const flooded = s.type === 'inundado';
    if (L === 'gusanos') genWorms(s, flooded);
    else if (L === 'gruta') genGrotto(s, flooded);
    else if (L === 'lago') genGrotto(s, true, true);
    else if (L === 'rio') genRiver(s, s.type === 'corium' ? 'corium' : 'agua');
    else genCave(s, flooded);
  }

  const organic = new Set();
  for (const s of sectors) {
    if (s.type === 'industrial' || s.type === 'ruinas' || s.type === 'campamento' || s.type === 'base' || s.type === 'laboratorio') {
      genRoomSector(s);
      if (def.zones.inundado && g.chance(0.4)) floodBlobs(s, g.int(1, 2), [T.FLOOR, T.GRATE]);
    } else if (s.type === 'ciudad') genCity(s);
    else if (s.type === 'bosque') genForest(s);
    else if (s.type === 'ferroviario') genRail(s);
    else if (s.type === 'chatarreria') genJunk(s);
    else if (s.type === 'antena') genAntenna(s);
    else if (s.type === 'lago') genLake(s);
    else if (s.type === 'metro') genMetro(s);
    else { genCaveSector(s); if (s.type === 'organico') organic.add(s.id); }
    if (opts.mods && opts.mods.inundacion && !SURF[s.type]) floodBlobs(s, g.int(2, 4), [T.FLOOR, T.GRATE, T.CAVE]);
  }

  // ---------------- Conexión entre sectores ----------------
  function cellsOf(s, filterFn) {
    const out = [];
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (filterFn(t[I(x, y)], x, y)) out.push([x, y]);
    return out;
  }
  function borderPick(s, side) {
    const cells = cellsOf(s, (tt) => walkable(tt) && tt !== T.WATER);
    if (!cells.length) return [s.x + (s.w >> 1), s.y + (s.h >> 1)];
    const score = ([x, y]) => (side === 'E' ? s.x + s.w - x : side === 'W' ? x - s.x : side === 'S' ? s.y + s.h - y : y - s.y);
    cells.sort((a, b) => score(a) - score(b));
    return g.pick(cells.slice(0, Math.max(1, Math.floor(cells.length * 0.12))));
  }
  for (let j = 0; j < def.sy; j++) for (let i = 0; i < def.sx; i++) {
    const a = sectorAt(i, j);
    const links = [];
    if (i + 1 < def.sx) links.push([sectorAt(i + 1, j), 'E', 'W']);
    if (j + 1 < def.sy) links.push([sectorAt(i, j + 1), 'S', 'N']);
    for (const [b, sa, sb] of links) {
      if ((SURF[a.type] && SURF[b.type]) && !(a.type === 'lago' || b.type === 'lago')) continue; // a cielo abierto ya está conectado
      const n = g.chance(0.35) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const [ax, ay] = borderPick(a, sa), [bx2, by2] = borderPick(b, sb);
        const cave = a.type === 'caverna' || a.type === 'inundado' || b.type === 'caverna' || b.type === 'inundado';
        carveCorr(ax, ay, bx2, by2, a.type === 'lago' || b.type === 'lago' ? T.BOAT : SURF[a.type] ? T.GROUND : cave ? T.CAVE : T.FLOOR, cave);
      }
    }
  }

  // ---------------- Conectividad global ----------------
  function regions() {
    const lab = new Int32Array(N).fill(-1);
    const regs = [];
    for (let k = 0; k < N; k++) {
      if (lab[k] >= 0 || !walkable(t[k])) continue;
      const id = regs.length, cells = [k];
      lab[k] = id;
      for (let qi = 0; qi < cells.length; qi++) {
        const c = cells[qi], cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of D8) {
          const nx = cx + dx, ny = cy + dy;
          if (!inb(nx, ny)) continue;
          const nk = I(nx, ny);
          if (lab[nk] < 0 && walkable(t[nk])) { lab[nk] = id; cells.push(nk); }
        }
      }
      regs.push(cells);
    }
    return { lab, regs };
  }
  for (let pass = 0; pass < 6; pass++) {
    const { lab, regs } = regions();
    if (regs.length <= 1) break;
    let main = 0;
    regs.forEach((r, i) => { if (r.length > regs[main].length) main = i; });
    for (let ri = 0; ri < regs.length; ri++) {
      if (ri === main) continue;
      const cells = regs[ri];
      if (cells.length < 10) { for (const c of cells) t[c] = T.ROCK; continue; }
      // BFS hacia la región principal a través de cualquier cosa
      const prev = new Int32Array(N).fill(-2);
      const q = [];
      for (const c of cells) { prev[c] = -1; q.push(c); }
      let hit = -1;
      for (let qi = 0; qi < q.length && hit < 0; qi++) {
        const c = q[qi], cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = cx + dx, ny = cy + dy;
          if (!inb(nx, ny)) continue;
          const nk = I(nx, ny);
          if (prev[nk] !== -2) continue;
          prev[nk] = c;
          if (walkable(t[nk]) && lab[nk] === main) { hit = nk; break; }
          q.push(nk);
        }
      }
      let c = hit >= 0 ? prev[hit] : -1;
      while (c >= 0 && prev[c] !== -1) {
        if (!walkable(t[c])) {
          const s = sectors[sec[c]];
          t[c] = t[c] === T.DEEP ? (s && s.type === 'lago' ? T.BOAT : T.WATER) : s && SURF[s.type] ? T.GROUND : s && (s.type === 'caverna' || s.type === 'inundado' || s.type === 'organico' || s.type === 'corium') ? T.CAVE : T.FLOOR;
        }
        c = prev[c];
      }
    }
  }

  // ---------------- Muros (zonas industriales) ----------------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = I(x, y);
    if (t[k] !== T.ROCK) continue;
    for (const [dx, dy] of D8) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nt = t[I(nx, ny)];
      if (nt === T.FLOOR || nt === T.GRATE || (nt === T.WATER && room[I(nx, ny)])) { t[k] = T.WALL; break; }
    }
  }
  // en superficie, lo que queda entre edificios es terreno abierto
  if (opts.surface || def.surface) for (let k = 0; k < N; k++) if (t[k] === T.ROCK) { const x = k % W, y = (k / W) | 0; if (x > 0 && y > 0 && x < W - 1 && y < H - 1) t[k] = noise2(x, y) > 0.6 ? T.GRASS : T.GROUND; }
  // puertas
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = I(x, y);
    if (t[k] !== T.FLOOR || room[k]) continue;
    const L = t[I(x - 1, y)], R = t[I(x + 1, y)], U = t[I(x, y - 1)], Dn = t[I(x, y + 1)];
    const roomAdj = room[I(x - 1, y)] || room[I(x + 1, y)] || room[I(x, y - 1)] || room[I(x, y + 1)];
    if (!roomAdj) continue;
    const vert = L === T.WALL && R === T.WALL && walkable(U) && walkable(Dn);
    const hor = U === T.WALL && Dn === T.WALL && walkable(L) && walkable(R);
    if ((vert || hor) && g.chance(0.5)) t[k] = T.DOOR;
  }
  // ruinas: muros derrumbados y escombros
  for (const s of sectors) {
    if (s.type !== 'ruinas') continue;
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
      if (!inb(x, y)) continue;
      const k = I(x, y);
      if (t[k] === T.WALL && g.chance(0.18)) {
        let adj = 0;
        for (const [dx, dy] of D4) if (walkable(t[I(x + dx, y + dy)])) adj++;
        if (adj >= 1 && x > 1 && y > 1 && x < W - 2 && y < H - 2) t[k] = T.RUBBLE;
      } else if (t[k] === T.FLOOR && g.chance(0.12)) t[k] = T.RUBBLE;
    }
  }
  // bordes (en superficie, la alambrada de la zona de exclusión)
  const surface = !!(opts.surface || def.surface);
  const edge = surface ? T.FENCE : T.ROCK;
  for (let x = 0; x < W; x++) { t[I(x, 0)] = edge; t[I(x, H - 1)] = edge; }
  for (let y = 0; y < H; y++) { t[I(0, y)] = edge; t[I(W - 1, y)] = edge; }
  // cavernas orgánicas: la roca expuesta es pared viva
  if (organic.size) for (let k = 0; k < N; k++) {
    if (t[k] !== T.ROCK || !organic.has(sec[k])) continue;
    const x = k % W, y = (k / W) | 0;
    if (D8.some(([dx, dy]) => inb(x + dx, y + dy) && walkable(t[I(x + dx, y + dy)]))) t[k] = T.ORGWALL;
  }
  // después de los derrumbes puede quedar algo aislado: conectividad final simple
  {
    const { regs } = regions();
    let main = 0;
    regs.forEach((r, i) => { if (r.length > regs[main].length) main = i; });
    regs.forEach((r, i) => { if (i !== main) for (const c of r) t[c] = t[c] === T.WATER ? T.DEEP : T.RUBBLE === t[c] ? T.WALL : T.ROCK; });
  }

  // ---------------- Casillas con mecánica (fase 16) ----------------
  const blocked = new Uint8Array(N); // casillas ocupadas por objetos/POIs
  // placeBlock: solo coloca obstáculos si todo su anillo de vecinos es transitable, así nunca rompe la conectividad
  const plain = (tt) => tt === T.FLOOR || tt === T.CAVE || tt === T.GRATE || tt === T.RUBBLE;
  const isWalkK = (k) => walkable(t[k]) && t[k] !== T.DOOR;
  function placeBlock(cells, tile) {
    const set = new Set(cells.map(([x, y]) => I(x, y)));
    for (const [x, y] of cells) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || !plain(t[I(x, y)]) || blocked[I(x, y)]) return false;
      for (const [dx, dy] of D8) { const nk = I(x + dx, y + dy); if (!set.has(nk) && !isWalkK(nk)) return false; }
    }
    for (const k of set) t[k] = tile;
    return true;
  }
  const mods = opts.mods || {};
  const tier = def.tier || 0;
  const dressLvl = Math.floor(tier / 2) + (opts.floor || 0);
  const lootB = (opts.floor || 0) * 0.15 + (mods.apagon ? 0.45 : 0) + (mods.esporas ? 0.2 : 0) + (mods.niebla ? 0.2 : 0);
  const nestState = mods.inquietos ? 'errante' : 'dormido';
  // salas: componentes del mapa de salas
  const roomId = new Int32Array(N).fill(-1);
  const rooms = [];
  for (let k = 0; k < N; k++) {
    if (!room[k] || roomId[k] >= 0 || !walkable(t[k])) continue;
    const cells = [k]; roomId[k] = rooms.length;
    for (let qi = 0; qi < cells.length; qi++) {
      const c = cells[qi], cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of D4) { const nk = I(cx + dx, cy + dy); if (inb(cx + dx, cy + dy) && room[nk] && roomId[nk] < 0 && walkable(t[nk])) { roomId[nk] = rooms.length; cells.push(nk); } }
    }
    rooms.push({ cells, sec: sec[k] });
  }
  const pickCell = (list) => { const k = g.pick(list); return [k % W, (k / W) | 0]; };
  for (const r of rooms) {
    const s = sectors[r.sec];
    if (!s || r.cells.length < 12) continue;
    const ruins = s.type === 'ruinas';
    // barriles (a veces con charco de aceite)
    if (g.chance(ruins ? 0.3 : 0.45)) {
      const n = g.int(1, 3);
      for (let i = 0; i < n; i++) {
        const [x, y] = pickCell(r.cells);
        if (placeBlock([[x, y]], T.BARREL) && g.chance(0.45)) for (const [dx, dy] of D8) { const k = I(x + dx, y + dy); if (plain(t[k]) && g.chance(0.4)) t[k] = T.OIL; }
      }
    }
    // consolas y sacos terreros (cobertura)
    if (g.chance(ruins ? 0.35 : 0.5)) {
      const len = g.int(1, 3), horiz = g.chance(0.5);
      const [x, y] = pickCell(r.cells);
      const cells = Array.from({ length: len }, (_, i) => (horiz ? [x + i, y] : [x, y + i]));
      placeBlock(cells, ruins || g.chance(0.3) ? T.SANDBAG : T.LOWWALL);
    }
    // lámparas de emergencia
    if (!mods.apagon && g.chance(0.35)) { const [x, y] = pickCell(r.cells); placeBlock([[x, y]], T.LAMP); }
    // cristales rotos junto a las paredes
    if (g.chance(0.22)) for (let i = 0; i < g.int(3, 7); i++) { const [x, y] = pickCell(r.cells); if (t[I(x, y)] === T.FLOOR && D4.some(([dx, dy]) => t[I(x + dx, y + dy)] === T.WALL)) t[I(x, y)] = T.GLASS; }
    // pasarelas metálicas (salas con rejilla)
    if (r.cells.some((k) => t[k] === T.GRATE) && g.chance(0.3)) for (const k of r.cells) if (t[k] === T.GRATE) t[k] = T.CATWALK;
  }
  // tuberías de vapor en muros industriales
  for (let k = 0; k < N; k++) {
    if (t[k] !== T.WALL) continue;
    const s = sectors[sec[k]];
    if (!s || s.type !== 'industrial' || !g.chance(0.05)) continue;
    const x = k % W, y = (k / W) | 0;
    if (D4.some(([dx, dy]) => inb(x + dx, y + dy) && walkable(t[I(x + dx, y + dy)]))) t[k] = T.PIPE;
  }
  const litSectors = [];
  for (const s of sectors) {
    const cells = [];
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) cells.push(I(x, y));
    const roomCells = cells.filter((k) => room[k] && plain(t[k]));
    const caveCells = cells.filter((k) => t[k] === T.CAVE);
    // interruptor de energía (uno por sector con salas)
    if (roomCells.length > 30) for (let tries = 0; tries < 30; tries++) { const [x, y] = pickCell(roomCells); if (placeBlock([[x, y]], T.SWITCH)) break; }
    // ruinas: escombros inestables y posiciones defensivas abandonadas
    if (s.type === 'ruinas') for (const k of cells) if (t[k] === T.RUBBLE && g.chance(0.3)) t[k] = T.UNSTABLE;
    // cavernas: arena, raíces, cristales de esencia, grafito
    if (caveCells.length > 20) {
      if (g.chance(0.45)) for (let b2 = 0; b2 < g.int(1, 3); b2++) {
        const [cx, cy] = pickCell(caveCells); const rr = g.float(1.5, 3.5);
        for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) if (inb(x, y) && t[I(x, y)] === T.CAVE && Math.hypot(x - cx, y - cy) < rr + g.float(-0.5, 0.5)) t[I(x, y)] = T.SAND;
      }
      if ((def.enemies.includes('raiz') || dressLvl >= 2) && g.chance(0.5)) for (let c = 0; c < g.int(2, 6); c++) { const [x, y] = pickCell(caveCells); placeBlock([[x, y]], T.ROOTS); }
    }
    // luz: algunos sectores tienen la iluminación de emergencia funcionando
    const litP = ({ industrial: 0.7, ruinas: 0.4, caverna: 0.12, inundado: 0.25, campamento: 1.3, base: 0.95, laboratorio: 0.55, metro: 0.35, organico: 0.05, corium: 0.8 }[s.type] ?? 0) - dressLvl * 0.07;
    s.lit = !mods.apagon && g.chance(Math.max(0.05, litP)) ? 1 : 0;
    if (s.lit) litSectors.push(s.id);
  }
  // raíles con vagoneta en pasillos rectos largos
  const rails = [];
  for (let tries = 0; tries < 40 && rails.length < 1 + (g.chance(0.5) ? 1 : 0); tries++) {
    const x = g.int(3, W - 4), y = g.int(3, H - 4);
    if (t[I(x, y)] !== T.FLOOR || room[I(x, y)]) continue;
    const horiz = g.chance(0.5);
    const run = [];
    for (let i = 0; i < 30; i++) { const xx = horiz ? x + i : x, yy = horiz ? y : y + i; if (!inb(xx, yy) || t[I(xx, yy)] !== T.FLOOR) break; run.push([xx, yy]); }
    if (run.length < 8) continue;
    for (const [xx, yy] of run) t[I(xx, yy)] = T.RAIL;
    rails.push(run);
  }
  // hielo (modificador «Helada»): el agua poco profunda se congela
  if (mods.helada) for (let k = 0; k < N; k++) if (t[k] === T.WATER) t[k] = T.ICE;

  // ---------------- Inserción y extracciones ----------------
  const open3 = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) return false;
      const tt = t[I(nx, ny)];
      if (!walkable(tt) || tt === T.WATER || tt === T.DOOR) return false;
    }
    return true;
  };
  function edgeSpot(side) {
    const cand = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (open3(x, y) && !blocked[I(x, y)]) cand.push([x, y]);
    const score = ([x, y]) => (side === 'W' ? x : side === 'E' ? W - x : side === 'N' ? y : H - y) + Math.abs((side === 'W' || side === 'E' ? y - H / 2 : x - W / 2)) * 0.25;
    cand.sort((a, b) => score(a) - score(b));
    const pick = g.pick(cand.slice(0, Math.max(1, Math.min(12, cand.length))));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { t[I(pick[0] + dx, pick[1] + dy)] = T.PAD; blocked[I(pick[0] + dx, pick[1] + dy)] = 1; }
    return pick;
  }
  const sides = ['W', 'E', 'N', 'S'];
  const startSide = g.pick(['W', 'E']);
  const opp = { W: 'E', E: 'W', N: 'S', S: 'N' };
  const fl = opts.floor || 0, nFloors = opts.floors || 1;
  const start = edgeSpot(startSide);
  // pisos inferiores: se llega por el montacargas (no hay extracciones permanentes)
  if (fl > 0) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t[I(start[0] + dx, start[1] + dy)] = dx || dy ? T.FLOOR : T.LIFT_UP; }
  const exitSides = fl > 0 ? [] : [opp[startSide], g.pick(['N', 'S'])];
  if (fl === 0 && (opts.radar || 0) >= 5) exitSides.push(exitSides[1] === 'N' ? 'S' : 'N');
  const SIDE_NAMES = { W: 'Oeste', E: 'Este', N: 'Norte', S: 'Sur' };
  const EXIT_NAMES = ['Montacargas', 'Pozo de ventilación', 'Escalera de servicio', 'Conducto de cables'];
  const exits = exitSides.map((sd, i) => {
    const [x, y] = edgeSpot(sd);
    return { x, y, perm: true, name: `${EXIT_NAMES[i % EXIT_NAMES.length]} ${SIDE_NAMES[sd]}` };
  });

  // puertas blindadas: algunas puertas cierran salas pequeñas que pasan a ser cámaras acorazadas
  const vaults = [];
  for (let k = 0; k < N && vaults.length < 1 + Math.floor(dressLvl / 2); k++) {
    if (t[k] !== T.DOOR || !g.chance(0.12)) continue;
    const x = k % W, y = (k / W) | 0;
    t[k] = T.ROCK; // provisional: ¿qué queda al otro lado?
    const sides = D4.map(([dx, dy]) => I(x + dx, y + dy)).filter((nk) => walkable(t[nk]));
    let vault = null;
    for (const st of sides) {
      const seen = new Set([st]), q = [st];
      let pad = false;
      for (let qi = 0; qi < q.length && q.length < 180; qi++) {
        const c = q[qi], cx = c % W, cy = (c / W) | 0;
        if (t[c] === T.PAD || t[c] === T.LIFT_UP) pad = true;
        for (const [dx, dy] of D8) { const nk = I(cx + dx, cy + dy); if (!seen.has(nk) && walkable(t[nk])) { seen.add(nk); q.push(nk); } }
      }
      if (q.length < 180 && q.length >= 6 && !pad) { vault = q; break; }
    }
    if (vault) { t[k] = T.ARMORDOOR; vaults.push({ door: [x, y], cells: vault }); for (const c of vault) blocked[c] = 3; }
    else t[k] = T.DOOR;
  }

  // distancias desde el inicio
  const dist = new Int32Array(N).fill(-1);
  {
    const q = [I(start[0], start[1])]; dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of D8) {
        const nk = I(cx + dx, cy + dy);
        if (dist[nk] < 0 && walkable(t[nk])) { dist[nk] = dist[c] + 1; q.push(nk); }
      }
    }
  }
  let maxDist = 1;
  for (let k = 0; k < N; k++) if (dist[k] > maxDist) maxDist = dist[k];

  // ---------------- POIs ----------------
  const pois = [];
  const spawns = [];
  const objects = [];
  const floor = [];
  const radField = new Float32Array(N);
  const anomaly = new Uint8Array(N);
  const vents = [];
  const [lvMin, lvMax] = def.lvl;
  // montacargas al piso inferior (lejos de la llegada) y simas
  let lift = null;
  const chasms = [];
  if (fl < nFloors - 1) {
    const cand = [];
    for (let k = 0; k < N; k++) if (dist[k] > maxDist * 0.55 && !blocked[k] && open3(k % W, (k / W) | 0) && exits.every((ex) => Math.hypot(ex.x - (k % W), ex.y - ((k / W) | 0)) > 14)) cand.push(k);
    const k = cand.length ? g.pick(cand) : null;
    if (k != null) { lift = [k % W, (k / W) | 0]; t[k] = T.LIFT; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) blocked[I(lift[0] + dx, lift[1] + dy)] = 1; }
    for (let c = 0; c < (g.chance(0.6) ? g.int(1, 2) : 0); c++) {
      for (let tries = 0; tries < 80; tries++) {
        const kk = g.int(0, N - 1);
        if (dist[kk] < maxDist * 0.3 || blocked[kk]) continue;
        const x = kk % W, y = (kk / W) | 0;
        if (placeBlock([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], T.CHASM)) { chasms.push([x, y]); break; }
      }
    }
  }
  const levelAt = (k) => {
    const p = clamp(dist[k] / maxDist, 0, 1);
    let l = lvMin + Math.floor(p * (lvMax - lvMin + 1.4));
    if (g.chance(0.18)) l++;
    if (g.chance(0.12)) l--;
    return clamp(l, Math.max(1, lvMin - 1), Math.min(10, lvMax + 1));
  };
  const farFromPois = (x, y, d) => pois.every((p) => Math.hypot(p.x - x, p.y - y) >= d);
  const openAround = (x, y, r) => {
    let c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy) && walkable(t[I(x + dx, y + dy)])) c++;
    return c;
  };
  const allNeighWalk = (x, y) => {
    for (const [dx, dy] of D8) {
      const nk = I(x + dx, y + dy);
      if (!walkable(t[nk]) || blocked[nk] || t[nk] === T.DOOR) return false;
    }
    return true;
  };
  function findSpot({ minDist = 16, poiGap = 10, open = 0, openR = 2, sectorId = null, needFree = false, tries = 400 }) {
    for (let i = 0; i < tries; i++) {
      let x, y;
      if (sectorId != null) { const s = sectors[sectorId]; x = g.int(s.x + 1, s.x + s.w - 2); y = g.int(s.y + 1, s.y + s.h - 2); }
      else { x = g.int(2, W - 3); y = g.int(2, H - 3); }
      const k = I(x, y);
      if (!walkable(t[k]) || blocked[k] || t[k] === T.DOOR || t[k] === T.PAD) continue;
      if (dist[k] < minDist) continue;
      if (!farFromPois(x, y, poiGap)) continue;
      if (open && openAround(x, y, openR) < open) continue;
      if (needFree && !allNeighWalk(x, y)) continue;
      return [x, y];
    }
    return null;
  }
  function freeCellsAround(cx, cy, r, n) {
    const out = [];
    const seen = new Set([I(cx, cy)]);
    const q = [[cx, cy]];
    for (let qi = 0; qi < q.length && out.length < n; qi++) {
      const [x, y] = q[qi];
      const k = I(x, y);
      if (walkable(t[k]) && !blocked[k] && t[k] !== T.DEEP) { out.push([x, y]); blocked[k] = 2; }
      for (const [dx, dy] of g.shuffle([...D8])) {
        const nx = x + dx, ny = y + dy, nk = I(nx, ny);
        if (!inb(nx, ny) || seen.has(nk) || Math.hypot(nx - cx, ny - cy) > r) continue;
        if (!walkable(t[nk])) continue;
        seen.add(nk); q.push([nx, ny]);
      }
    }
    return out;
  }
  const enemyPool = def.enemies.filter((e) => !ENEMIES[e].boss && !ENEMIES[e].abil.includes('aquatic'));
  // fase 22: el jefe propio de la zona (home) va aparte, en el piso más profundo
  const homeBoss = def.enemies.find((e) => ENEMIES[e].boss && ENEMIES[e].home === def.id) || null;
  const bossPool = def.enemies.filter((e) => ENEMIES[e].boss && e !== homeBoss);
  const W22 = opts.world || {}; // mundo persistente: { nestK, grow, alert, bossAway }
  function pickTypes(lvl) {
    let c = enemyPool.filter((e) => ENEMIES[e].minL <= lvl && ENEMIES[e].maxL >= lvl);
    if (!c.length) c = enemyPool;
    return c;
  }
  function spawnGroup(type, lvl, cx, cy, n, state, poi) {
    const cells = freeCellsAround(cx, cy, 5, n);
    for (const [x, y] of cells) spawns.push({ type, lvl, x, y, state, poi });
    return cells.length;
  }

  // Nidos
  const nestCount = Math.max(1, Math.round(g.int(def.nests[0], def.nests[1]) * (W22.nestK || 1)));
  const sectorOrder = g.shuffle(sectors.map((s) => s.id));
  for (let n = 0; n < nestCount; n++) {
    const spot = findSpot({ minDist: 20, poiGap: 14, open: 16, openR: 2, sectorId: n < sectorOrder.length ? sectorOrder[n] : null }) || findSpot({ minDist: 16, poiGap: 10, open: 12 });
    if (!spot) continue;
    const [x, y] = spot;
    const lvl = Math.min(10, levelAt(I(x, y)) + (W22.grow || 0));
    const types = pickTypes(lvl);
    const main = g.pick(types);
    const md = ENEMIES[main];
    const p = { type: 'nest', x, y, lvl, name: `Nido · ${md.name}`, enemy: main, sector: sec[I(x, y)], cleared: false, members: 0 };
    pois.push(p);
    const pi = pois.length - 1;
    let count = g.int(md.group[0], md.group[1]) + Math.floor(lvl / 4) + (W22.grow || 0) + (W22.alert >= 2 ? 1 : 0);
    p.members += spawnGroup(main, lvl, x, y, count, nestState, pi);
    if (g.chance(0.45)) {
      const second = g.pick(types);
      p.members += spawnGroup(second, lvl, x, y, g.int(1, 2), nestState, pi);
    }
  }
  // Jefe en el nido más lejano
  if (bossPool.length) {
    const nests = pois.filter((p) => p.type === 'nest').sort((a, b) => dist[I(b.x, b.y)] - dist[I(a.x, a.y)]);
    const bossChance = tier >= 8 ? 1 : tier >= 6 ? 0.75 : 0.5;
    const nBoss = tier >= 8 ? 2 : 1;
    for (let b = 0; b < Math.min(nBoss, nests.length); b++) {
      if (!g.chance(bossChance)) continue;
      const nest = nests[b];
      const lvl = Math.min(10, nest.lvl + 1);
      let bp = bossPool.filter((e) => ENEMIES[e].minL <= lvl);
      if (!bp.length) bp = bossPool;
      const boss = g.pick(bp);
      nest.lvl = lvl;
      nest.boss = boss;
      nest.name = `Nido alfa · ${ENEMIES[boss].name}`;
      const pi = pois.indexOf(nest);
      nest.members += spawnGroup(boss, lvl, nest.x, nest.y, 1, nestState, pi);
      for (const sp of spawns) if (sp.poi === pi) sp.lvl = lvl;
    }
  }

  // jefe propio de la zona (fase 22): siempre en el piso más profundo, salvo si lo abatisteis hace poco
  if (homeBoss && fl === nFloors - 1 && !W22.bossAway) {
    const bd = ENEMIES[homeBoss];
    const lvl = Math.min(10, lvMax + 1 + (W22.grow || 0));
    if (bd.abil.includes('aquatic')) {
      // en el agua más lejana
      let best = -1;
      for (let k = 0; k < N; k++) if ((t[k] === T.DEEP || t[k] === T.WATER) && !blocked[k] && (best < 0 || (dist[k] > dist[best] && dist[k] < 32767) || (t[k] === T.DEEP && t[best] !== T.DEEP))) best = k;
      if (best >= 0) {
        blocked[best] = 2;
        pois.push({ type: 'nest', x: best % W, y: (best / W) | 0, lvl, name: `Guarida · ${bd.name}`, enemy: homeBoss, boss: homeBoss, sector: sec[best], cleared: false, members: 1 });
        spawns.push({ type: homeBoss, lvl, x: best % W, y: (best / W) | 0, state: 'dormido', poi: pois.length - 1 });
      }
    } else {
      const nest = pois.filter((p) => p.type === 'nest' && !p.boss).sort((a, b) => dist[I(b.x, b.y)] - dist[I(a.x, a.y)])[0];
      if (nest) {
        const pi = pois.indexOf(nest);
        nest.lvl = lvl; nest.boss = homeBoss; nest.name = `Guarida · ${bd.name}`;
        nest.members += spawnGroup(homeBoss, lvl, nest.x, nest.y, 1, nestState, pi);
      }
    }
  }

  // Vetas de esencia
  const veinCount = g.int(def.veins[0], def.veins[1]);
  for (let n = 0; n < veinCount; n++) {
    const spot = findSpot({ minDist: 14, poiGap: 10, needFree: true });
    if (!spot) continue;
    const [x, y] = spot;
    const k = I(x, y);
    const lvl = levelAt(k);
    blocked[k] = 1;
    const amount = Math.round(g.int(18, 30) * (1 + 0.35 * (lvl - 1)) * (mods.vetamadre ? 1.5 : 1));
    objects.push({ kind: 'vein', x, y, amount, max: amount, lvl });
    pois.push({ type: 'vein', x, y, lvl, name: 'Veta de esencia', sector: sec[k] });
    if (mods.vetamadre || g.chance(0.5)) {
      const tp = g.pick(pickTypes(lvl));
      spawnGroup(tp, lvl, x, y, g.int(1, 3) + (mods.vetamadre ? 1 : 0), 'dormido', pois.length - 1);
    }
  }

  // Alijos
  const cacheCount = g.int(def.caches[0], def.caches[1]);
  for (let n = 0; n < cacheCount; n++) {
    const spot = findSpot({ minDist: 14, poiGap: 10, needFree: true });
    if (!spot) continue;
    const [x, y] = spot;
    const k = I(x, y);
    const lvl = levelAt(k);
    blocked[k] = 1;
    const items = [];
    const nItems = g.int(3, 5);
    for (let i = 0; i < nItems; i++) items.push(rollLoot(lvl, g, { rarityBonus: 0.3 + lootB }));
    const best = Math.max(...items.map((it) => it.r));
    objects.push({ kind: 'cache', x, y, items, opened: false, lvl, best });
    pois.push({ type: 'cache', x, y, lvl, name: 'Alijo de suministros', sector: sec[k], best });
    if (g.chance(0.6)) {
      const tp = g.pick(pickTypes(lvl));
      spawnGroup(tp, lvl, x, y, g.int(2, 3), 'dormido', pois.length - 1);
    }
  }

  // Peligros
  const hazCount = g.int(def.hazards[0], def.hazards[1]) + (mods.esporas ? 2 : 0);
  for (let n = 0; n < hazCount; n++) {
    const spot = findSpot({ minDist: 10, poiGap: 8 });
    if (!spot) continue;
    const [x, y] = spot;
    const kind = g.weighted(['rad', 'gas', 'anomaly'], (k) => ({ rad: 0.5, gas: mods.esporas ? 0.75 : 0.25, anomaly: 0.25 }[k]));
    const lvl = levelAt(I(x, y));
    if (kind === 'rad') {
      const r = g.int(3, 6), inten = 1.6 + lvl * 0.35;
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
        if (!inb(xx, yy)) continue;
        const d = Math.hypot(xx - x, yy - y);
        if (d <= r) radField[I(xx, yy)] += inten * (1 - d / (r + 1));
      }
      pois.push({ type: 'hazard', kind, x, y, r, lvl, name: 'Foco de radiación', sector: sec[I(x, y)] });
    } else if (kind === 'gas') {
      vents.push({ x, y, lvl });
      // a veces un ventilador industrial cerca ayuda a despejar el gas
      if (g.chance(0.5)) for (let tries = 0; tries < 20; tries++) { const fx = x + g.int(-5, 5), fy = y + g.int(-5, 5); if (inb(fx, fy) && Math.hypot(fx - x, fy - y) >= 3 && placeBlock([[fx, fy]], T.FAN)) break; }
      pois.push({ type: 'hazard', kind, x, y, r: 3, lvl, name: 'Fuga de esporas', sector: sec[I(x, y)] });
    } else {
      const cells = g.int(6, 12);
      for (let i = 0; i < cells * 3; i++) {
        const xx = x + g.int(-3, 3), yy = y + g.int(-3, 3);
        if (inb(xx, yy) && walkable(t[I(xx, yy)]) && t[I(xx, yy)] !== T.PAD) anomaly[I(xx, yy)] = 1;
      }
      pois.push({ type: 'hazard', kind, x, y, r: 3, lvl, name: 'Anomalía eléctrica', sector: sec[I(x, y)] });
    }
  }
  // agua radiactiva + radiación ambiente
  for (let k = 0; k < N; k++) {
    if (t[k] === T.WATER || t[k] === T.DEEP) radField[k] += 0.5 + def.ambientRad * 0.5;
    radField[k] += def.ambientRad * 0.25;
  }

  // Errantes
  const wanderGroups = 3 + Math.round(tier / 2) + g.int(0, 2);
  for (let n = 0; n < wanderGroups; n++) {
    const spot = findSpot({ minDist: 18, poiGap: 6 });
    if (!spot) continue;
    const lvl = levelAt(I(spot[0], spot[1]));
    const tp = g.pick(pickTypes(lvl).filter((e) => !ENEMIES[e].abil.includes('stationary')).concat(['rata']).filter((e) => def.enemies.includes(e)) || ['rata']);
    if (!tp) continue;
    spawnGroup(mods.esporas && g.chance(0.5) && ENEMIES.esporangio ? 'esporangio' : tp, lvl, spot[0], spot[1], g.int(1, 3), 'errante', null);
  }
  // Otras expediciones (fase 18): patrullas de las facciones de la zona; «Presencia extranjera» y Metro-2 garantizan varias
  // fase 27: el dueño de la zona y las ofensivas fuerzan sus patrullas (forceFpool, warPatrols)
  const fpool = (def.fpool || []).filter((f) => SQUADS[f] && (def.forceFpool || (SQUAD_MIN_TIER[f] || 0) <= tier + (mods.extranjeros || def.factions ? 3 : 0)));
  const nPat = Math.max(def.warPatrols || 0, def.factions ? 4 : mods.extranjeros ? g.int(2, 3) : (g.chance(0.5) ? 1 : 0) + (tier >= 4 && g.chance(0.35) ? 1 : 0));
  for (const fac of g.shuffle([...fpool]).slice(0, nPat)) {
    const spot = findSpot({ minDist: 22, poiGap: 8, open: 14, openR: 2 }) || findSpot({ minDist: 16, poiGap: 5, open: 10 });
    if (!spot) continue;
    const lvl = levelAt(I(spot[0], spot[1]));
    for (const [type, a0, a1] of SQUADS[fac]) for (const [x, y] of freeCellsAround(spot[0], spot[1], 4, g.int(a0, a1))) spawns.push({ type, lvl, x, y, state: 'errante', poi: null, faction: fac });
    // sus suministros: abrirlos sin permiso es robar
    if (g.chance(0.55)) {
      const c = freeCellsAround(spot[0], spot[1], 3, 1)[0];
      if (c) { blocked[I(c[0], c[1])] = 1; objects.push({ kind: 'crate', x: c[0], y: c[1], items: [rollLoot(lvl, g, { west: true, rarityBonus: 0.3 }), ...originItems(fac, 1)], opened: false, lvl, owner: fac }); }
    }
  }
  // Restos de expediciones (fase 18): campamentos abandonados con tiendas, hoguera, radio, cajas OTAN y diarios
  if (g.chance(0.6)) {
    const spot = findSpot({ minDist: 18, poiGap: 8, open: 22, openR: 2, tries: 400 });
    if (spot) {
      const [cx, cy] = spot;
      const fac = g.pick(['usa', 'uk', 'rda', 'suecia', 'finlandia', 'checos', 'yugo', 'cuba']);
      const lvl = levelAt(I(cx, cy));
      placeBlock([[cx, cy]], T.CAMPFIRE);
      let tents = 0;
      for (const [dx, dy] of g.shuffle([[-3, -2], [3, -2], [-3, 2], [3, 2], [0, -3], [0, 3]])) if (tents < g.int(1, 3) && placeBlock([[cx + dx, cy + dy]], T.TENT)) tents++;
      const ring = freeCellsAround(cx, cy, 4, 30);
      for (const [x, y] of ring) blocked[I(x, y)] = 0;
      const around = g.shuffle(ring.filter(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) >= 2));
      const put = (o) => { const c = around.shift(); if (!c) return; blocked[I(c[0], c[1])] = 1; objects.push({ x: c[0], y: c[1], opened: false, lvl, ...o }); };
      const west = !['rda', 'cuba', 'checos'].includes(fac);
      put({ kind: 'crate', label: west ? 'Caja OTAN' : 'Caja de suministros', items: [rollLoot(lvl, g, { west: true, rarityBonus: 0.45, catW: { ammo: 6, consumable: 6, weapon: 4, gadget: 3 } }), ...originItems(fac, 2)] });
      if (g.chance(0.6)) put({ kind: 'corpse', items: [rollLoot(lvl, g, { west: true, rarityBonus: 0.3 }), ...originItems(fac, 1)] });
      put({ kind: 'radio', items: [], opened: false, fac });
      const ds = around.shift();
      if (ds) objects.push({ kind: 'note', x: ds[0], y: ds[1], fnote: g.int(0, FOREIGN_NOTES.length - 1), opened: false, items: [] });
      pois.push({ type: 'cache', x: cx, y: cy, lvl, name: 'Campamento abandonado', sector: sec[I(cx, cy)], best: 2 });
    }
  }

  // Contenedores dispersos (taquillas y cajas)
  const crateCount = Math.round((W * H) / 520);
  for (let n = 0; n < crateCount; n++) {
    const spot = findSpot({ minDist: 4, poiGap: 3, needFree: true, tries: 60 });
    if (!spot) continue;
    const [x, y] = spot;
    const k = I(x, y);
    const s = sectors[sec[k]];
    const lvl = levelAt(k);
    blocked[k] = 1;
    const items = [];
    const nItems = g.int(0, 2) + (g.chance(0.5) ? 1 : 0);
    for (let i = 0; i < nItems; i++) items.push(rollLoot(lvl, g, { rarityBonus: lootB }));
    const kind = s && (s.type === 'industrial' || s.type === 'ruinas') ? (g.chance(0.6) ? 'locker' : 'crate') : g.chance(0.5) ? 'crate' : 'corpse';
    objects.push({ kind, x, y, items, opened: false, lvl });
  }
  // Notas y supervivientes (eventos narrativos)
  const noteCount = g.int(1, 3);
  const usedNotes = new Set();
  for (let n = 0; n < noteCount; n++) {
    const spot = findSpot({ minDist: 8, poiGap: 3, tries: 80 });
    if (!spot) continue;
    let note = g.int(0, NOTES.length - 1);
    if (usedNotes.has(note)) note = (note + 1) % NOTES.length;
    usedNotes.add(note);
    objects.push({ kind: 'note', x: spot[0], y: spot[1], note, opened: false, items: [] });
  }
  if (g.chance(0.5)) {
    const spot = findSpot({ minDist: 16, poiGap: 6, needFree: true });
    if (spot) {
      blocked[I(spot[0], spot[1])] = 1;
      objects.push({ kind: 'survivor', x: spot[0], y: spot[1], line: g.int(0, SURVIVOR_LINES.length - 1), lvl: levelAt(I(spot[0], spot[1])), opened: false, items: [] });
    }
  }
  // Cámaras acorazadas: botín bueno y un terminal fuera para abrirlas
  for (const v of vaults) {
    const lvl = Math.min(10, lvMax + 1);
    const inner = v.cells.filter((c) => walkable(t[c]) && t[c] !== T.DOOR);
    for (let i = 0; i < Math.min(2, inner.length); i++) {
      const c = inner.splice(g.int(0, inner.length - 1), 1)[0];
      const items = [];
      for (let j = 0; j < g.int(2, 3); j++) items.push(rollLoot(lvl, g, { rarityBonus: 0.8 + lootB }));
      objects.push({ kind: 'locker', x: c % W, y: (c / W) | 0, items, opened: false, lvl, vault: 1 });
    }
    const [dx0, dy0] = v.door;
    for (let tries = 0; tries < 200; tries++) {
      const x = dx0 + g.int(-12, 12), y = dy0 + g.int(-12, 12);
      if (!inb(x, y) || blocked[I(x, y)] === 3 || dist[I(x, y)] < 0) continue;
      if (placeBlock([[x, y]], T.TERMINAL)) break;
    }
  }
  // Grafito expuesto (zonas profundas): muy radiactivo, se recogen muestras
  if (dressLvl >= 2) for (let n = 0; n < g.int(1, 2); n++) {
    const spot = findSpot({ minDist: 18, poiGap: 6 });
    if (!spot) continue;
    const [x, y] = spot;
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (inb(xx, yy) && plain(t[I(xx, yy)]) && g.chance(0.7)) t[I(xx, yy)] = T.GRAPHITE;
    for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 4; xx++) if (inb(xx, yy)) radField[I(xx, yy)] += Math.max(0, 4.5 - Math.hypot(xx - x, yy - y)) * 0.9;
  }
  // Cristales de esencia incrustados (pequeñas vetas)
  for (let n = 0; n < g.int(1, 3) + Math.floor(dressLvl / 2); n++) {
    const spot = findSpot({ minDist: 10, poiGap: 5, needFree: true, tries: 80 });
    if (!spot) continue;
    const k = I(spot[0], spot[1]);
    if (sectors[sec[k]] && sectors[sec[k]].type === 'industrial') continue;
    blocked[k] = 1;
    const lvl = levelAt(k);
    const amount = Math.round(g.int(6, 11) * (1 + 0.3 * (lvl - 1)) * (mods.vetamadre ? 1.5 : 1));
    objects.push({ kind: 'shard', x: spot[0], y: spot[1], amount, max: amount, lvl });
  }
  // (las vagonetas sobre los raíles se quitaron: podían cerrar el único pasillo hacia la salida)

  // ---------------- Fase 17: contenido propio de cada zona ----------------
  const sp = def.special;
  // radiación de fosas y corium; los blindados protegen
  for (const [k, v] of hot) radField[k] += v;
  // contenedores en vagones y vehículos
  for (const w of wagons) {
    if (!g.chance(0.6)) continue;
    const x = w.x + g.int(0, Math.max(0, w.len - 1)), y = w.y;
    const k = I(x, y);
    if (!walkable(t[k]) || blocked[k]) continue;
    blocked[k] = 1;
    const lvl = levelAt(k) || lvMin;
    const items = [];
    for (let i = 0; i < g.int(1, 3); i++) items.push(rollLoot(lvl, g, { rarityBonus: lootB + 0.1 }));
    if (def.zones.chatarreria) items.push(createItem('parts', 0, g, g.int(1, 4)));
    objects.push({ kind: 'crate', x, y, items, opened: false, lvl });
  }
  // cables de la antena: anomalías eléctricas
  for (const k of cables) if (walkable(t[k])) for (let i = 0; i < 4; i++) { const kk = k + g.int(-1, 1) + g.int(-2, 2) * W; if (kk > 0 && kk < N && walkable(t[kk])) anomaly[kk] = 1; }
  // estanque: siluros gigantes en el agua profunda
  if (sp === 'lago') {
    const deep = [];
    for (let k = 0; k < N; k++) if (t[k] === T.DEEP) deep.push(k);
    for (let n = 0; n < Math.min(deep.length, g.int(3, 6)); n++) { const k = g.pick(deep); spawns.push({ type: 'siluro', lvl: Math.min(10, lvMax), x: k % W, y: (k / W) | 0, state: 'dormido', poi: null }); }
  }
  // fase 22: chebylitas acuáticos (medusas, sanguijuelas) en el agua de la zona, nunca en tierra
  const aqua = def.enemies.filter((e) => ENEMIES[e] && ENEMIES[e].abil.includes('aquatic') && !ENEMIES[e].boss);
  if (aqua.length) {
    const wet = [];
    for (let k = 0; k < N; k++) if ((t[k] === T.WATER || t[k] === T.DEEP) && !blocked[k] && !(dist[k] < 12)) wet.push(k);
    if (wet.length >= 12) {
      const used = new Set();
      const groups = Math.min(4, 1 + Math.floor(wet.length / 150));
      for (let gi = 0; gi < groups; gi++) {
        const k0 = g.pick(wet), x0 = k0 % W, y0 = (k0 / W) | 0;
        const lvl = levelAt(k0);
        const fit = aqua.filter((e) => ENEMIES[e].minL <= lvl);
        const tp = g.pick(fit.length ? fit : aqua);
        const n = g.int(ENEMIES[tp].group[0], ENEMIES[tp].group[1]);
        const near = wet.filter((k) => !used.has(k) && Math.abs((k % W) - x0) <= 4 && Math.abs(((k / W) | 0) - y0) <= 4);
        for (let i = 0; i < n && near.length; i++) {
          const k = near.splice(g.int(0, near.length - 1), 1)[0];
          used.add(k); blocked[k] = 2;
          spawns.push({ type: tp, lvl, x: k % W, y: (k / W) | 0, state: 'dormido', poi: null });
        }
      }
    }
  }
  // Prípiat, sótano del hospital: la ropa de los bomberos de la primera noche
  if (def.id === 'pripyat' && fl > 0) {
    const spot = findSpot({ minDist: 20, poiGap: 6, needFree: true });
    if (spot) {
      const k = I(spot[0], spot[1]);
      blocked[k] = 1;
      objects.push({ kind: 'locker', x: spot[0], y: spot[1], items: [createItem('firecoat', 0, g), createItem('firecoat', 0, g)], opened: false, lvl: lvMax, special: 'hospital' });
      for (let yy = spot[1] - 4; yy <= spot[1] + 4; yy++) for (let xx = spot[0] - 4; xx <= spot[0] + 4; xx++) if (inb(xx, yy)) radField[I(xx, yy)] += Math.max(0, 4.5 - Math.hypot(xx - spot[0], yy - spot[1])) * 1.1;
      pois.push({ type: 'hazard', kind: 'rad', x: spot[0], y: spot[1], r: 4, lvl: lvMax, name: 'Ropa de los bomberos', sector: sec[k] });
    }
  }
  // Campamento «Wismut»: comerciante, enfermería y tablón de rumores; residentes de la RDA
  if (sectors.some((s2) => s2.type === 'campamento')) {
    for (const kind of ['trader', 'medic', 'board']) {
      const spot = findSpot({ minDist: 6, poiGap: 6, needFree: true, tries: 400 }) || findSpot({ minDist: 3, poiGap: 2, needFree: true, tries: 400 });
      if (!spot) continue;
      blocked[I(spot[0], spot[1])] = 1;
      objects.push({ kind, x: spot[0], y: spot[1], opened: true, items: [] });
    }
    for (let n = 0; n < g.int(6, 9); n++) {
      const spot = findSpot({ minDist: 4, poiGap: 2, tries: 200 });
      if (spot) spawns.push({ type: g.pick(['rda_rifle', 'rda_rifle', 'rda_scientist', 'rda_officer']), lvl: g.int(lvMin, lvMax), x: spot[0], y: spot[1], state: 'errante', poi: null, faction: 'rda' });
    }
  }
  // Estación «Fénix»: cámaras, torretas y operadores de élite; botín occidental
  if (sp === 'fenix') {
    for (let n = 0; n < 6 + fl * 2; n++) {
      const spot = findSpot({ minDist: 14, poiGap: 4, tries: 300 });
      if (!spot) continue;
      const kind = n % 3 === 0 ? 'usa_camera' : n % 3 === 1 ? 'usa_turret' : null;
      if (kind) { spawns.push({ type: kind, lvl: lvMax, x: spot[0], y: spot[1], state: 'errante', poi: null, faction: 'usa' }); blocked[I(spot[0], spot[1])] = 2; continue; }
      for (const [x, y] of freeCellsAround(spot[0], spot[1], 3, g.int(2, 3))) spawns.push({ type: g.chance(0.5) ? 'usa_elite' : g.pick(['usa_operator', 'usa_sniper']), lvl: g.int(lvMin, lvMax), x, y, state: 'errante', poi: null, faction: 'usa' });
    }
    for (const o of objects) if ((o.kind === 'cache' || o.kind === 'locker') && o.items) { o.items.push(rollLoot(lvMax, g, { west: true, rarityBonus: 0.4, catW: { weapon: 8, ammo: 6 } })); if (g.chance(0.4)) o.items.push(createItem('intel', 0, g)); }
  }
  // Objeto 7: celdas de contención y el archivo del director
  if (sp === 'objeto7') {
    let cells = 0;
    const objCells = new Set(objects.map((o) => I(o.x, o.y)));
    for (let k = 0; k < N && cells < 6; k++) {
      if (t[k] !== T.DOOR || !g.chance(0.25)) continue;
      const x = k % W, y = (k / W) | 0;
      t[k] = T.ROCK;
      const side = D4.map(([dx, dy]) => I(x + dx, y + dy)).filter((nk) => walkable(t[nk]));
      let inside = null;
      for (const st of side) {
        const seen = new Set([st]), q = [st];
        for (let qi = 0; qi < q.length && q.length < 90; qi++) { const c = q[qi]; for (const [dx, dy] of D8) { const nk = c + dx + dy * W; if (!seen.has(nk) && walkable(t[nk])) { seen.add(nk); q.push(nk); } } }
        if (q.length < 90 && !q.some((c) => blocked[c] || objCells.has(c) || t[c] === T.PAD || t[c] === T.LIFT_UP || t[c] === T.LIFT)) { inside = q; break; }
      }
      if (!inside) { t[k] = T.DOOR; continue; }
      t[k] = T.CELL; cells++;
      const c0 = inside[Math.floor(inside.length / 2)];
      const tp = g.pick(pickTypes(lvMax));
      spawns.push({ type: tp, lvl: Math.min(10, lvMax + 1), x: c0 % W, y: (c0 / W) | 0, state: 'dormido', poi: null, caged: 1 });
      const c1 = inside[0];
      if (!blocked[c1]) { blocked[c1] = 1; objects.push({ kind: 'crate', x: c1 % W, y: (c1 / W) | 0, items: [rollLoot(lvMax, g, { rarityBonus: 0.6 })], opened: false, lvl: lvMax, vault: 1 }); }
    }
    const v = vaults[0];
    const inner = v ? v.cells.filter((c) => walkable(t[c]) && !blocked[c]) : [];
    const spot = inner.length ? [inner[0] % W, (inner[0] / W) | 0] : findSpot({ minDist: 25, poiGap: 4, needFree: true });
    if (spot) { blocked[I(spot[0], spot[1])] = 1; objects.push({ kind: 'archive', x: spot[0], y: spot[1], opened: false, items: [] }); }
  }
  // ---------------- Zonas de evento (17.3) ----------------
  const wreckAt = (items, name, radHot) => {
    const spot = findSpot({ minDist: Math.min(40, maxDist * 0.55), poiGap: 6, needFree: true, open: 20, openR: 2 }) || findSpot({ minDist: 14, poiGap: 4, needFree: true });
    if (!spot) return null;
    const k = I(spot[0], spot[1]);
    blocked[k] = 1;
    objects.push({ kind: 'wreck', x: spot[0], y: spot[1], items, opened: false, lvl: lvMax });
    pois.push({ type: 'cache', x: spot[0], y: spot[1], lvl: lvMax, name, sector: sec[k], best: Math.max(0, ...items.map((it) => it.r)) });
    if (radHot) for (let yy = spot[1] - 5; yy <= spot[1] + 5; yy++) for (let xx = spot[0] - 5; xx <= spot[0] + 5; xx++) if (inb(xx, yy)) radField[I(xx, yy)] += Math.max(0, 5.5 - Math.hypot(xx - spot[0], yy - spot[1])) * radHot;
    // restos esparcidos alrededor del aparato
    for (const [x, y] of freeCellsAround(spot[0], spot[1], 4, 6)) { if (g.chance(0.5) && [T.FLOOR, T.GROUND, T.GRASS, T.ASPHALT, T.CAVE].includes(t[I(x, y)])) t[I(x, y)] = T.RUBBLE; blocked[I(x, y)] = 0; }
    return spot;
  };
  if (sp === 'heli') {
    const items = [createItem('blackbox', 0, g)];
    for (let i = 0; i < 3; i++) items.push(rollLoot(lvMax, g, { rarityBonus: 0.5, catW: { weapon: 6, ammo: 6, consumable: 6 } }));
    const spot = wreckAt(items, 'Mi-8 estrellado', 0.9);
    // la manada ya ronda el helicóptero
    if (spot) for (const [x, y] of freeCellsAround(spot[0], spot[1], 7, g.int(4, 6))) spawns.push({ type: g.pick(pickTypes(lvMax)), lvl: lvMax, x, y, state: 'errante', poi: null });
  }
  if (sp === 'spyplane') {
    const items = [createItem('intel', 0, g), createItem('intel', 0, g)];
    for (let i = 0; i < 4; i++) items.push(rollLoot(Math.min(10, lvMax + 1), g, { west: true, rarityBonus: 0.8, catW: { weapon: 10, ammo: 6, armor: 4, gadget: 4 } }));
    const spot = wreckAt(items, 'Avión espía', 0.3);
    // dos equipos de recuperación americanos
    for (let n = 0; n < 2; n++) {
      const sp2 = findSpot({ minDist: 25, poiGap: 8, open: 12 });
      if (sp2) for (const [x, y] of freeCellsAround(sp2[0], sp2[1], 4, g.int(3, 4))) spawns.push({ type: g.pick(['usa_operator', 'usa_elite', 'usa_sniper']), lvl: lvMax, x, y, state: 'errante', poi: null, faction: 'usa' });
    }
    if (spot) for (const [x, y] of freeCellsAround(spot[0], spot[1], 5, 2)) spawns.push({ type: 'usa_elite', lvl: lvMax, x, y, state: 'errante', poi: null, faction: 'usa' });
  }
  if (sp === 'convoy') {
    // camiones de evacuación abandonados en fila
    const spot = findSpot({ minDist: 24, poiGap: 6, open: 30, openR: 3 }) || findSpot({ minDist: 16, poiGap: 4 });
    if (spot) {
      pois.push({ type: 'cache', x: spot[0], y: spot[1], lvl: lvMax, name: 'Convoy de evacuación', sector: sec[I(spot[0], spot[1])], best: 1 });
      for (const [x, y] of freeCellsAround(spot[0], spot[1], 6, g.int(5, 7))) {
        const items = [rollLoot(lvMax, g, { rarityBonus: 0.35 }), rollLoot(lvMax, g, { rarityBonus: 0.35 }), createItem('parts', 0, g, g.int(2, 5))];
        if (g.chance(0.3)) items.push(createItem('docs', 0, g));
        blocked[I(x, y)] = 1;
        objects.push({ kind: g.chance(0.7) ? 'crate' : 'corpse', x, y, items, opened: false, lvl: lvMax });
      }
      // lo que acabó con el convoy sigue cerca
      const sp2 = findSpot({ minDist: 18, poiGap: 3, open: 10 });
      if (sp2) for (const [x, y] of freeCellsAround(sp2[0], sp2[1], 5, g.int(4, 6))) spawns.push({ type: g.pick(pickTypes(lvMax)), lvl: lvMax, x, y, state: 'dormido', poi: null });
    }
  }
  if (sp === 'nido') {
    // vetas por todas partes: la colonia se alimenta de ellas
    for (let n = 0; n < 6; n++) {
      const spot = findSpot({ minDist: 14, poiGap: 5, needFree: true, tries: 200 });
      if (!spot) continue;
      blocked[I(spot[0], spot[1])] = 1;
      const amount = g.int(10, 16) * Math.max(1, lvMax - 2);
      objects.push({ kind: 'shard', x: spot[0], y: spot[1], amount, max: amount, lvl: lvMax });
    }
  }
  if (sp === 'mercado') {
    const spot = findSpot({ minDist: 10, poiGap: 4, needFree: true, open: 20, openR: 2 }) || findSpot({ minDist: 6, poiGap: 2, needFree: true });
    if (spot) {
      blocked[I(spot[0], spot[1])] = 1;
      objects.push({ kind: 'trader', x: spot[0], y: spot[1], opened: true, items: [], dlg: 'smuggler_trader' });
      pois.push({ type: 'cache', x: spot[0], y: spot[1], lvl: lvMax, name: 'Mercado negro', sector: sec[I(spot[0], spot[1])], cleared: true, best: 0 });
      // los contrabandistas rondan el puesto sin taparlo
      const ring = freeCellsAround(spot[0], spot[1], 7, 30);
      for (const [x, y] of ring) if (Math.max(Math.abs(x - spot[0]), Math.abs(y - spot[1])) <= 2) blocked[I(x, y)] = 0;
      const far = ring.filter(([x, y]) => Math.max(Math.abs(x - spot[0]), Math.abs(y - spot[1])) > 2);
      const nSm = g.int(5, 7);
      for (const [x, y] of far.slice(nSm)) blocked[I(x, y)] = 0;
      for (const [x, y] of far.slice(0, nSm)) spawns.push({ type: 'smuggler', lvl: g.int(lvMin, lvMax), x, y, state: 'errante', poi: null, faction: 'contrabandistas' });
    }
  }
  // Defensa de la base (fase 21.6): los atacantes entran por los bordes
  if (sp === 'defensa') {
    for (const type of def.attackers || []) {
      const spot = findSpot({ minDist: 22, poiGap: 0, tries: 200 }) || findSpot({ minDist: 12, poiGap: 0, tries: 200 });
      if (!spot) continue;
      const human = !ENEMIES[type];
      spawns.push({ type, lvl: g.int(lvMin, lvMax), x: spot[0], y: spot[1], state: 'alerta', poi: null, faction: human ? def.attackFaction : undefined, attacker: 1 });
      blocked[I(spot[0], spot[1])] = 2;
    }
  }
  // Útero de corium: lagos de combustible fundido
  if (sp === 'corium') {
    for (let n = 0; n < g.int(6, 10); n++) {
      const spot = findSpot({ minDist: 12, poiGap: 3, tries: 120 });
      if (!spot) continue;
      const [x, y] = spot;
      if (placeBlock([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], T.CORIUM)) for (let yy = y - 4; yy <= y + 5; yy++) for (let xx = x - 4; xx <= x + 5; xx++) if (inb(xx, yy)) radField[I(xx, yy)] += Math.max(0, 5 - Math.hypot(xx - x, yy - y)) * 0.6;
    }
  }
  // Las Raíces: raíces por todas partes
  if (sp === 'raices') for (let n = 0; n < 40; n++) { const spot = findSpot({ minDist: 8, poiGap: 1, tries: 40 }); if (spot) placeBlock([spot], T.ROOTS); }
  // interiores blindados: sin radiación
  for (const k of refuge) radField[k] = 0;
  for (const o of extraObjects) objects.push(o);

  // Objetos sueltos en el suelo
  const looseCount = 5 + tier;
  for (let n = 0; n < looseCount; n++) {
    const spot = findSpot({ minDist: 6, poiGap: 2, tries: 60 });
    if (!spot) continue;
    const lvl = levelAt(I(spot[0], spot[1]));
    floor.push({ x: spot[0], y: spot[1], item: rollLoot(lvl, g, { rarityBonus: lootB, catW: { weapon: 4, armor: 2, helmet: 2, gadget: 2, backpack: 1 } }) });
  }

  // casillas interiores (bajo techo) en superficie
  const indoor = surface ? room.slice() : null;
  // vías largas (para el «tren fantasma» de Yanov)
  const railRows = [];
  if (sp === 'tren') for (let y = 1; y < H - 1; y++) { let n = 0; for (let x = 0; x < W; x++) if (t[I(x, y)] === T.RAIL) n++; if (n > W * 0.5) railRows.push(y); }
  // fase 19: contenedores sellados (soldadura, soplete) y minas enemigas ocultas (sonda sísmica)
  for (const o of objects) if ((o.kind === 'locker' || o.kind === 'crate' || o.kind === 'corpse') && o.items && g.chance(0.22)) o.items.push(createItem(g.pick(['chatarra', 'chatarra', 'electronica', 'plomo']), 0, g, g.int(1, 3)));
  for (const o of objects) if ((o.kind === 'locker' || o.kind === 'crate') && !o.vault && !o.owner && !o.special && g.chance(0.12)) { o.sealed = 1; o.items.push(rollLoot(Math.min(10, lvMax + 1), g, { rarityBonus: 0.5 })); }
  const mines = [];
  if (tier >= 3 && g.chance(0.55)) {
    const objAt = new Set(objects.map((o) => I(o.x, o.y)));
    for (let n = 0; n < g.int(1, 3); n++) {
      const spot = findSpot({ minDist: 15, poiGap: 3, tries: 120 });
      if (spot && !objAt.has(I(spot[0], spot[1])) && !spawns.some((sp) => sp.x === spot[0] && sp.y === spot[1])) mines.push({ x: spot[0], y: spot[1] });
    }
  }
  clearChokepoints(W, H, t, start, exits, lift, objects);
  return { w: W, h: H, t, sec, sectors, start, exits, pois, spawns, objects, floor, radField, anomaly, vents, lift, chasms, litSectors, indoor, antennaAt, railRows, mines };
}
