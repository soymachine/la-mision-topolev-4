// Prueba de generación (sin navegador): todas las zonas, pisos y combinaciones de modificadores.
// Comprueba que la inserción, las extracciones, el montacargas, los objetos y los enemigos son alcanzables.
// Uso: node tests/mapgen.mjs
import { generateMap } from '../js/exp/mapgen.js';
import { MAPS } from '../js/data/world.js';
import { TILES } from '../js/data/tiles.js';
import { MODIFIERS } from '../js/data/modifiers.js';
import { floorsFor } from '../js/exp/expedition.js';

const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const modSets = [{}, ...Object.keys(MODIFIERS).map((m) => ({ [m]: true })), Object.fromEntries(Object.keys(MODIFIERS).map((m) => [m, true]))];
let maps = 0, fails = 0;
for (let mi = 0; mi < MAPS.length; mi++) {
  const nf = floorsFor(mi);
  for (let f = 0; f < nf; f++) for (let si = 0; si < modSets.length; si++) {
    const seed = (mi * 1009 + f * 131 + si * 17 + 7) >>> 0;
    const m = generateMap(MAPS[mi], mi, seed, { floor: f, floors: nf, mods: modSets[si] });
    maps++;
    const W = m.w, seen = new Uint8Array(m.w * m.h), q = [m.start[1] * W + m.start[0]];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D8) { const k = (y + dy) * W + x + dx; if (!seen[k] && TILES[m.t[k]].walk) { seen[k] = 1; q.push(k); } }
    }
    const near = (x, y) => [[0, 0], ...D8].some(([dx, dy]) => seen[(y + dy) * W + x + dx]);
    const errs = [];
    if (f === 0 && m.exits.length < 2) errs.push('pocas extracciones');
    if (f > 0 && m.exits.length) errs.push('extracción permanente en piso inferior');
    if (f < nf - 1 && !m.lift) errs.push('sin montacargas');
    if (!m.exits.every((e) => seen[e.y * W + e.x])) errs.push('extracción inalcanzable');
    if (m.lift && !seen[m.lift[1] * W + m.lift[0]]) errs.push('montacargas inalcanzable');
    if (!m.objects.filter((o) => !o.vault && o.kind !== 'cart').every((o) => near(o.x, o.y))) errs.push('objeto inalcanzable');
    if (!m.spawns.every((sp) => seen[sp.y * W + sp.x])) errs.push('enemigo inalcanzable');
    if (errs.length) { fails++; console.log(`✗ zona ${mi} piso ${f} mods ${Object.keys(modSets[si]).join(',') || '—'}: ${errs.join(', ')}`); }
  }
}
console.log(`${maps} mapas generados, ${fails} con fallos`);
process.exit(fails ? 1 : 0);
