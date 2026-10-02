// Generación procedural de los mapas subterráneos
import { RNG, clamp } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { SECTOR_NAMES } from '../data/world.js';
import { ENEMIES } from '../data/enemies.js';
import { rollLoot } from '../core/items.js';
import { NOTES, SURVIVOR_LINES } from '../data/lore.js';

const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const walkable = (t) => TILES[t].walk === 1;

export function generateMap(def, mapIdx, seed, opts = {}) {
  const g = new RNG(seed);
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
      carveRoom(rx, ry, rw, rh, tile);
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

  for (const s of sectors) {
    if (s.type === 'industrial' || s.type === 'ruinas') {
      genIndustrial(s);
      if (def.zones.inundado && g.chance(0.4)) floodBlobs(s, g.int(1, 2), [T.FLOOR, T.GRATE]);
    } else genCave(s, s.type === 'inundado');
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
      const n = g.chance(0.35) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const [ax, ay] = borderPick(a, sa), [bx2, by2] = borderPick(b, sb);
        const cave = a.type === 'caverna' || a.type === 'inundado' || b.type === 'caverna' || b.type === 'inundado';
        carveCorr(ax, ay, bx2, by2, cave ? T.CAVE : T.FLOOR, cave);
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
          t[c] = t[c] === T.DEEP ? T.WATER : s && (s.type === 'caverna' || s.type === 'inundado') ? T.CAVE : T.FLOOR;
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
  // bordes
  for (let x = 0; x < W; x++) { t[I(x, 0)] = T.ROCK; t[I(x, H - 1)] = T.ROCK; }
  for (let y = 0; y < H; y++) { t[I(0, y)] = T.ROCK; t[I(W - 1, y)] = T.ROCK; }
  // después de los derrumbes puede quedar algo aislado: conectividad final simple
  {
    const { regs } = regions();
    let main = 0;
    regs.forEach((r, i) => { if (r.length > regs[main].length) main = i; });
    regs.forEach((r, i) => { if (i !== main) for (const c of r) t[c] = t[c] === T.WATER ? T.DEEP : T.RUBBLE === t[c] ? T.WALL : T.ROCK; });
  }

  // ---------------- Inserción y extracciones ----------------
  const blocked = new Uint8Array(N); // casillas ocupadas por objetos/POIs
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
  const start = edgeSpot(startSide);
  const exitSides = [opp[startSide], g.pick(['N', 'S'])];
  if ((opts.radar || 0) >= 5) exitSides.push(exitSides[1] === 'N' ? 'S' : 'N');
  const SIDE_NAMES = { W: 'Oeste', E: 'Este', N: 'Norte', S: 'Sur' };
  const EXIT_NAMES = ['Montacargas', 'Pozo de ventilación', 'Escalera de servicio', 'Conducto de cables'];
  const exits = exitSides.map((sd, i) => {
    const [x, y] = edgeSpot(sd);
    return { x, y, perm: true, name: `${EXIT_NAMES[i % EXIT_NAMES.length]} ${SIDE_NAMES[sd]}` };
  });

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
  const enemyPool = def.enemies.filter((e) => !ENEMIES[e].boss);
  const bossPool = def.enemies.filter((e) => ENEMIES[e].boss);
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
  const nestCount = g.int(def.nests[0], def.nests[1]);
  const sectorOrder = g.shuffle(sectors.map((s) => s.id));
  for (let n = 0; n < nestCount; n++) {
    const spot = findSpot({ minDist: 20, poiGap: 14, open: 16, openR: 2, sectorId: n < sectorOrder.length ? sectorOrder[n] : null }) || findSpot({ minDist: 16, poiGap: 10, open: 12 });
    if (!spot) continue;
    const [x, y] = spot;
    const lvl = levelAt(I(x, y));
    const types = pickTypes(lvl);
    const main = g.pick(types);
    const md = ENEMIES[main];
    const p = { type: 'nest', x, y, lvl, name: `Nido · ${md.name}`, enemy: main, sector: sec[I(x, y)], cleared: false, members: 0 };
    pois.push(p);
    const pi = pois.length - 1;
    let count = g.int(md.group[0], md.group[1]) + Math.floor(lvl / 4);
    p.members += spawnGroup(main, lvl, x, y, count, 'dormido', pi);
    if (g.chance(0.45)) {
      const second = g.pick(types);
      p.members += spawnGroup(second, lvl, x, y, g.int(1, 2), 'dormido', pi);
    }
  }
  // Jefe en el nido más lejano
  if (bossPool.length) {
    const nests = pois.filter((p) => p.type === 'nest').sort((a, b) => dist[I(b.x, b.y)] - dist[I(a.x, a.y)]);
    const bossChance = mapIdx >= 4 ? 1 : mapIdx >= 3 ? 0.75 : 0.5;
    const nBoss = mapIdx >= 4 ? 2 : 1;
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
      nest.members += spawnGroup(boss, lvl, nest.x, nest.y, 1, 'dormido', pi);
      for (const sp of spawns) if (sp.poi === pi) sp.lvl = lvl;
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
    const amount = Math.round(g.int(18, 30) * (1 + 0.35 * (lvl - 1)));
    objects.push({ kind: 'vein', x, y, amount, max: amount, lvl });
    pois.push({ type: 'vein', x, y, lvl, name: 'Veta de esencia', sector: sec[k] });
    if (g.chance(0.5)) {
      const tp = g.pick(pickTypes(lvl));
      spawnGroup(tp, lvl, x, y, g.int(1, 3), 'dormido', pois.length - 1);
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
    for (let i = 0; i < nItems; i++) items.push(rollLoot(lvl, g, { rarityBonus: 0.3 }));
    const best = Math.max(...items.map((it) => it.r));
    objects.push({ kind: 'cache', x, y, items, opened: false, lvl, best });
    pois.push({ type: 'cache', x, y, lvl, name: 'Alijo de suministros', sector: sec[k], best });
    if (g.chance(0.6)) {
      const tp = g.pick(pickTypes(lvl));
      spawnGroup(tp, lvl, x, y, g.int(2, 3), 'dormido', pois.length - 1);
    }
  }

  // Peligros
  const hazCount = g.int(def.hazards[0], def.hazards[1]);
  for (let n = 0; n < hazCount; n++) {
    const spot = findSpot({ minDist: 10, poiGap: 8 });
    if (!spot) continue;
    const [x, y] = spot;
    const kind = g.weighted(['rad', 'gas', 'anomaly'], (k) => ({ rad: 0.5, gas: 0.25, anomaly: 0.25 }[k]));
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
  const wanderGroups = 3 + mapIdx + g.int(0, 2);
  for (let n = 0; n < wanderGroups; n++) {
    const spot = findSpot({ minDist: 18, poiGap: 6 });
    if (!spot) continue;
    const lvl = levelAt(I(spot[0], spot[1]));
    const tp = g.pick(pickTypes(lvl).filter((e) => !ENEMIES[e].abil.includes('stationary')).concat(['rata']).filter((e) => def.enemies.includes(e)) || ['rata']);
    if (!tp) continue;
    spawnGroup(tp, lvl, spot[0], spot[1], g.int(1, 3), 'errante', null);
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
    for (let i = 0; i < nItems; i++) items.push(rollLoot(lvl, g));
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
  // Objetos sueltos en el suelo
  const looseCount = 5 + mapIdx * 2;
  for (let n = 0; n < looseCount; n++) {
    const spot = findSpot({ minDist: 6, poiGap: 2, tries: 60 });
    if (!spot) continue;
    const lvl = levelAt(I(spot[0], spot[1]));
    floor.push({ x: spot[0], y: spot[1], item: rollLoot(lvl, g, { catW: { weapon: 4, armor: 2, helmet: 2, gadget: 2, backpack: 1 } }) });
  }

  return { w: W, h: H, t, sec, sectors, start, exits, pois, spawns, objects, floor, radField, anomaly, vents };
}
