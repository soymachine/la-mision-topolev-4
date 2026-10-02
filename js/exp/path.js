// Búsqueda de caminos: A* (8 direcciones) y mapas Dijkstra
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class Heap {
  constructor() { this.a = []; }
  push(k, p) {
    const a = this.a; a.push([k, p]);
    let i = a.length - 1;
    while (i > 0) { const pi = (i - 1) >> 1; if (a[pi][1] <= a[i][1]) break; [a[pi], a[i]] = [a[i], a[pi]]; i = pi; }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

// passable(x,y) -> coste (Infinity si bloqueado). Devuelve [[x,y],...] sin el origen, o null
export function astar(w, h, sx, sy, tx, ty, passable, maxNodes = 6000) {
  if (sx === tx && sy === ty) return [];
  const N = w * h;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const s = sy * w + sx, t = ty * w + tx;
  g[s] = 0;
  const open = new Heap();
  const hfn = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  open.push(s, hfn(sx, sy));
  let n = 0;
  while (open.size) {
    const [c] = open.pop();
    if (c === t) break;
    if (closed[c]) continue;
    closed[c] = 1;
    if (++n > maxNodes) return null;
    const cx = c % w, cy = (c / w) | 0;
    for (const [dx, dy] of D8) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (closed[nk]) continue;
      const cost = nk === t ? 1 : passable(nx, ny);
      if (cost === Infinity) continue;
      const ng = g[c] + cost * (dx && dy ? 1.001 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = c; open.push(nk, ng + hfn(nx, ny)); }
    }
  }
  if (from[t] < 0) return null;
  const path = [];
  let c = t;
  while (c !== s) { path.push([c % w, (c / w) | 0]); c = from[c]; }
  return path.reverse();
}

// Mapa Dijkstra (BFS 8-dir con coste uniforme) desde varias metas
export function dijkstra(w, h, goals, passable, maxDist = 80) {
  const N = w * h;
  const d = new Int16Array(N).fill(32767);
  const q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (const [x, y] of goals) { const k = y * w + x; d[k] = 0; q[qt++] = k; }
  while (qh < qt) {
    const c = q[qh++];
    const dc = d[c];
    if (dc >= maxDist) continue;
    const cx = c % w, cy = (c / w) | 0;
    for (let i = 0; i < 8; i++) {
      const nx = cx + D8[i][0], ny = cy + D8[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (d[nk] <= dc + 1) continue;
      if (!passable(nx, ny)) continue;
      d[nk] = dc + 1;
      q[qt++] = nk;
    }
  }
  return d;
}
