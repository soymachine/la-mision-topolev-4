// Prueba de generación (sin navegador): todas las zonas, pisos y combinaciones de modificadores.
// Comprueba que la inserción, las extracciones, el montacargas, los objetos y los enemigos son alcanzables.
// Uso: node tests/mapgen.mjs
import { BLOCKING_OBJ } from '../js/exp/shared.js';
import { ENEMIES } from '../js/data/enemies.js';
import { generateMap } from '../js/exp/mapgen.js';
import { MAPS, floorDef, EVENT_ZONES, eventDef, mapIndex } from '../js/data/world.js';
import { TILES } from '../js/data/tiles.js';
import { MODIFIERS } from '../js/data/modifiers.js';
import { floorsFor } from '../js/exp/expedition.js';

const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const modSets = [{}, ...Object.keys(MODIFIERS).map((m) => ({ [m]: true })), Object.fromEntries(Object.keys(MODIFIERS).map((m) => [m, true]))];
let maps = 0, fails = 0;
// zonas fijas (todas sus plantas y modificadores) + zonas de evento (17.3) con varias semillas
const jobs = [];
for (let mi = 0; mi < MAPS.length; mi++) {
  const nf = floorsFor(mi);
  for (let f = 0; f < nf; f++) for (let si = 0; si < modSets.length; si++) jobs.push({ label: `zona ${mi}`, def: floorDef(MAPS[mi], f), mi, f, nf, si, seed: (mi * 1009 + f * 131 + si * 17 + 7) >>> 0 });
}
for (const kind of Object.keys(EVENT_ZONES)) for (let n = 0; n < 12; n++) {
  const mi = mapIndex(EVENT_ZONES[kind].base);
  jobs.push({ label: `evento ${kind}`, def: floorDef(eventDef({ kind, pos: [0, 0] }), 0), mi, f: 0, nf: 1, si: 0, seed: (n * 7919 + kind.length * 31) >>> 0 });
}
for (const { label, def, mi, f, nf, si, seed } of jobs) {
  {
    const m = generateMap(def, mi, seed, { floor: f, floors: nf, mods: modSets[si] });
    maps++;
    const W = m.w, seen = new Uint8Array(m.w * m.h), q = [m.start[1] * W + m.start[0]];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D8) { const k = (y + dy) * W + x + dx; if (!seen[k] && TILES[m.t[k]].walk) { seen[k] = 1; q.push(k); } }
    }
    const near = (x, y) => [[0, 0], ...D8].some(([dx, dy]) => seen[(y + dy) * W + x + dx]);
    // con los objetos que bloquean el paso (cajas, taquillas, vetas…) como muros: las salidas y el montacargas deben seguir alcanzables
    const blockObj = new Set(m.objects.filter((o) => BLOCKING_OBJ[o.kind]).map((o) => o.y * W + o.x));
    const seen2 = new Uint8Array(m.w * m.h), q2 = [m.start[1] * W + m.start[0]];
    seen2[q2[0]] = 1;
    for (let i = 0; i < q2.length; i++) {
      const c = q2[i], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D8) { const k = (y + dy) * W + x + dx; if (!seen2[k] && TILES[m.t[k]].walk && !blockObj.has(k)) { seen2[k] = 1; q2.push(k); } }
    }
    const errs = [];
    if (f === 0 && m.exits.length < 2) errs.push('pocas extracciones');
    if (f > 0 && m.exits.length) errs.push('extracción permanente en piso inferior');
    if (f < nf - 1 && !m.lift) errs.push('sin montacargas');
    if (!m.exits.every((e) => seen[e.y * W + e.x])) errs.push('extracción inalcanzable');
    if (m.lift && !seen[m.lift[1] * W + m.lift[0]]) errs.push('montacargas inalcanzable');
    if (!m.exits.every((e) => seen2[e.y * W + e.x])) errs.push('extracción bloqueada por objetos');
    if (m.lift && !seen2[m.lift[1] * W + m.lift[0]]) errs.push('montacargas bloqueado por objetos');
    if (!m.objects.filter((o) => !o.vault).every((o) => near(o.x, o.y))) errs.push('objeto inalcanzable');
    if (!m.spawns.filter((sp) => !sp.caged && !(ENEMIES[sp.type] && ENEMIES[sp.type].abil.includes('aquatic'))).every((sp) => seen[sp.y * W + sp.x])) errs.push('enemigo inalcanzable');
    if (errs.length) { fails++; console.log(`✗ ${label} piso ${f} mods ${Object.keys(modSets[si]).join(',') || '—'}: ${errs.join(', ')}`); }
  }
}
console.log(`${maps} mapas generados, ${fails} con fallos`);
process.exit(fails ? 1 : 0);
