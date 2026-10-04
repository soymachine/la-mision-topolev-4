// Expedición · fase 26: fluidos y destrucción.
// Tres campos de aire por casilla (0–15): gas de esporas (pesado, a ras de suelo), humo (alto) y polvo radiactivo
// (lo levantan las explosiones). Se difunden hacia las casillas vecinas con menos concentración, se diluyen poco a
// poco y no atraviesan lo opaco (muros, roca, puertas cerradas): cerrar una puerta encierra el gas. Los ventiladores
// los dispersan y en superficie el viento se los lleva. El fuego humea. El humo denso tapa la vista, salvo agachado
// (se ve por debajo); el gas pesado se traga más agachado. El agua de una tubería rota inunda poco a poco y apaga
// el fuego. Las explosiones abren muros; las cargas de demolición rompen roca y pueden hundir el suelo.
// (métodos mezclados en Expedition: ver expedition.js)
import { rng } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { ACTORS } from '../data/actors.js';
import { D8 } from './shared.js';

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// tipos de aire: color, carácter en las casillas vacías, ritmo de difusión y de disipación (fracción que se pierde cada turno)
export const AIR_TYPES = {
  smoke: { name: 'Humo', color: '#9a948c', glyphs: ['░', '▒'], cb: '░', spread: 0.5, decay: 0.07, high: 1 },
  gas: { name: 'Esporas', color: '#a050e0', glyphs: ['≈', '≋'], cb: '≋', spread: 0.35, decay: 0.04 },
  dust: { name: 'Polvo radiactivo', color: '#b8c83a', glyphs: ['∴', '⁘'], cb: '∴', spread: 0.3, decay: 0.05 },
};
export const SMOKE_OPAQUE = 6; // a partir de aquí el humo tapa la vista (de pie)
export const SMOKE_OPAQUE_LOW = 11; // agachado se ve por debajo hasta aquí
export const AIR_MAX = 15;

export class FluidPart {
  fluidInit() {
    const N = this.w * this.h;
    if (!this.dust || this.dust.length !== N) this.dust = new Uint8Array(N);
    this.floods = this.floods || [];
  }
  // ¿pasa el aire por esta casilla? (no por muros, roca ni puertas cerradas)
  airOpen(k) { return TILES[this.t[k]].opaque !== 1 && this.t[k] !== T.ROCK; }
  // el aire dominante en una casilla: { type, v } o null
  airAt(k) {
    let best = null;
    for (const type of ['smoke', 'gas', 'dust']) {
      const f = this[type];
      const v = f ? f[k] : 0;
      if (v && (!best || v > best.v)) best = { type, v };
    }
    return best;
  }

  // cada turno (desde environment)
  fluidTick() {
    this.fluidInit();
    const W = this.w, N = W * this.h;
    // el fuego humea
    for (let k = 0; k < N; k++) if (this.fire[k]) this.smoke[k] = Math.min(12, Math.max(this.smoke[k] + 4, 6));
    // ventiladores: dispersan todo el aire a su alrededor
    if (this.fans == null) { this.fans = []; for (let k = 0; k < N; k++) if (this.t[k] === T.FAN) this.fans.push(k); }
    for (const k of this.fans) {
      const fx = k % W, fy = (k / W) | 0;
      for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) if (this.inb(x, y)) { const kk = this.key(x, y); for (const tp of ['gas', 'smoke', 'dust']) if (this[tp][kk]) this[tp][kk] = Math.max(0, this[tp][kk] - 3); }
    }
    for (const [type, A] of Object.entries(AIR_TYPES)) {
      const f = this[type];
      let any = false;
      for (let k = 0; k < N; k++) if (f[k]) { any = true; break; }
      if (!any) continue;
      const nf = new Float32Array(N);
      for (let k = 0; k < N; k++) nf[k] = f[k];
      // difusión: cada casilla reparte parte de lo que tiene entre sus vecinas abiertas con menos concentración
      for (let k = 0; k < N; k++) {
        const v = f[k];
        if (v < 2) continue;
        const x = k % W, y = (k / W) | 0;
        const outs = [];
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const nk = ny * W + nx;
          if (f[nk] < v && this.airOpen(nk)) outs.push(nk);
        }
        if (!outs.length) continue;
        // se reparte entre las salidas que hay: por un pasillo o una puerta el aire se canaliza
        const per = (v * A.spread) / outs.length;
        for (const nk of outs) { const amt = Math.min(per, (v - f[nk]) / 2); nf[nk] += amt; nf[k] -= amt; }
      }
      // disipación: se pierde una fracción cada turno (más al aire libre, donde sopla el viento, y sobre el agua)
      for (let k = 0; k < N; k++) {
        let v = nf[k];
        if (v <= 0) { f[k] = 0; continue; }
        const outdoors = this.surface && (!this.indoor || !this.indoor[k]);
        v -= v * A.decay + (outdoors ? 0.6 : 0);
        if (this.t[k] === T.WATER || this.t[k] === T.DEEP) v -= 0.3;
        // redondeo aleatorio: conserva la cantidad media (si no, los flujos pequeños se perderían)
        const fl = Math.floor(v);
        f[k] = Math.max(0, Math.min(AIR_MAX, fl + (rng.next() < v - fl ? 1 : 0)));
      }
    }
    this.floodTick();
  }

  // ---------------------------------------------------------------- respirar el aire (desde environment, por agente)
  breathe(sq) {
    const k = this.key(sq.x, sq.y);
    const mask = this.flag(sq, 'gasResist') || this.ast(sq).gasImmune;
    // gas pesado: agachado se traga más
    if (this.gas[k] && sq.crouch && !this.ast(sq).gasImmune) this.addPoison(sq, 1);
    // humo denso: de pie, tos (puntería −10 y algo de ruido); agachado se respira por debajo
    if (this.smoke[k] >= SMOKE_OPAQUE && !sq.crouch && !mask) {
      this.addBuff(sq, { name: 'Tos', turns: 1, mods: { acc: -10 } });
      if (this.turn % 3 === 0) { this.noise(sq.x, sq.y, 3); if (sq === this.cur && this.turn % 9 === 0) this.say(`${this.nm(sq)} tose en el humo (agáchate para respirar por debajo).`, 'dimt'); }
    }
    // polvo radiactivo: radiación al respirarlo (la máscara lo filtra)
    if (this.dust[k] && !mask) sq.a.rad = Math.min(150, sq.a.rad + this.dust[k] * 0.06 * (sq.crouch ? 1.5 : 1));
  }

  // ---------------------------------------------------------------- inundaciones
  // { x, y, vol }: el agua avanza desde (x, y) por el suelo, unas casillas por turno, hasta agotar vol
  floodTick() {
    if (!this.floods || !this.floods.length) return;
    const W = this.w;
    for (const fl of this.floods) {
      // frontera: casillas transitables (no agua) junto al agua conectada con el origen
      const seen = new Set([this.key(fl.x, fl.y)]);
      const q = [this.key(fl.x, fl.y)], front = [];
      for (let qi = 0; qi < q.length && q.length < 600; qi++) {
        const c = q[qi], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const nk = ny * W + nx;
          if (seen.has(nk)) continue;
          seen.add(nk);
          const tt = this.t[nk];
          if (tt === T.WATER || tt === T.DEEP) q.push(nk);
          else if (TILES[tt].walk && tt !== T.DOOR && tt !== T.PAD && tt !== T.LIFT && tt !== T.LIFT_UP && tt !== T.RAIL) front.push(nk);
        }
      }
      for (let i = 0; i < 3 && front.length && fl.vol > 0; i++) {
        const nk = front.splice(rng.int(0, front.length - 1), 1)[0];
        this.t[nk] = T.WATER; this.fire[nk] = 0; this.gas[nk] = Math.max(0, this.gas[nk] - 4); this.dust[nk] = 0;
        fl.vol--;
      }
      this.dirty = true; this.dmap = null;
    }
    this.floods = this.floods.filter((fl) => fl.vol > 0);
  }
  startFlood(x, y, vol = 28) {
    this.fluidInit();
    // el agua sale por la primera casilla transitable junto a la tubería
    const out = D8.map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => this.walkTile(nx, ny));
    if (!out) return false;
    this.t[this.key(out[0], out[1])] = T.WATER;
    this.floods.push({ x: out[0], y: out[1], vol });
    this.dirty = true; this.dmap = null;
    return true;
  }

  // ---------------------------------------------------------------- destrucción (desde explode)
  // r: radio de la explosión · demo: carga de demolición (rompe roca, puertas blindadas y puede hundir el suelo)
  blastStructure(x, y, r, demo = false) {
    this.fluidInit();
    const inner = demo ? r : Math.max(1, r - 1);
    let opened = 0;
    for (let yy = y - inner; yy <= y + inner; yy++) for (let xx = x - inner; xx <= x + inner; xx++) {
      if (xx <= 0 || yy <= 0 || xx >= this.w - 1 || yy >= this.h - 1) continue; // el borde del mapa nunca cae
      if (Math.hypot(xx - x, yy - y) > inner + 0.5) continue;
      const k = this.key(xx, yy), tt = this.t[k];
      const weak = tt === T.WALL || tt === T.LOWWALL || tt === T.SANDBAG || tt === T.GLASS || tt === T.DOOR || tt === T.DOOR_OPEN || tt === T.HULL || tt === T.CELL || tt === T.LATTICE;
      const hard = tt === T.ROCK || tt === T.ARMORDOOR || tt === T.ORGWALL;
      if ((weak && rng.chance(demo ? 1 : 0.55)) || (hard && demo && rng.chance(0.6))) { this.t[k] = T.RUBBLE; opened++; }
    }
    // polvo (radiactivo donde ya había radiación)
    for (let yy = y - r - 1; yy <= y + r + 1; yy++) for (let xx = x - r - 1; xx <= x + r + 1; xx++) {
      if (!this.inb(xx, yy)) continue;
      const k = this.key(xx, yy);
      if (!this.airOpen(k)) continue;
      const d = Math.hypot(xx - x, yy - y);
      if (d > r + 1.5) continue;
      this.dust[k] = Math.min(AIR_MAX, Math.max(this.dust[k], Math.round((demo ? 10 : 7) * (1 - d / (r + 2)) + (this.rad[k] > 0.5 || this.ambient > 0.3 ? 2 : 0))));
    }
    // carga de demolición sobre suelo, con piso debajo: el suelo puede hundirse
    if (demo && (this.floor || 0) < (this.nFloors || 1) - 1 && rng.chance(0.35)) {
      const cells = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      if (cells.every(([cx, cy]) => this.inb(cx, cy) && TILES[this.t[this.key(cx, cy)]].walk && !this.entityAt(cx, cy) && !this.objAt(cx, cy))) {
        for (const [cx, cy] of cells) this.t[this.key(cx, cy)] = T.CHASM;
        (this.chasms = this.chasms || []).push([x, y]);
        this.say('El suelo cede bajo la explosión: se abre una <b>sima</b> al piso de abajo.', 'warn');
        opened++;
      }
    }
    if (opened) {
      this.dirty = true; this.dmap = null; this.lightDirty = true;
      if (this.isVisible(x, y)) this.say(demo ? '✱ La carga abre un boquete en la estructura.' : 'La explosión abre un hueco en la pared.', 'warn');
    }
    return opened;
  }
  // fase 27: incendio forestal: prende n casillas junto a los pinos (lejos del escuadrón al empezar)
  igniteForest(n) {
    const cand = [];
    for (let k = 0; k < this.t.length; k++) {
      if (this.t[k] !== T.PINE) continue;
      const x = k % this.w, y = (k / this.w) | 0;
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (this.walkTile(nx, ny) && !this.fire[this.key(nx, ny)]) cand.push([nx, ny]); }
    }
    let lit = 0;
    for (let i = 0; i < n && cand.length; i++) {
      const [x, y] = cand.splice(rng.int(0, cand.length - 1), 1)[0];
      if (this.team && this.team.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) < 6)) continue;
      this.igniteCell(x, y, 10); lit++;
    }
    return lit;
  }
  // ¿lo dejaría pasar el humo? (para las armas que no ven a través)
  smokeBlocks(k, crouch = false) { return this.smoke[k] >= (crouch ? SMOKE_OPAQUE_LOW : SMOKE_OPAQUE); }
  // un enemigo dentro de humo muy denso solo se ve como una silueta
  inThickSmoke(x, y) { return this.smoke[this.key(x, y)] >= SMOKE_OPAQUE_LOW; }
  // ¿se puede ver la especie de este actor? (lo usa el render)
  actorHiddenBySmoke(e) { return this.inThickSmoke(e.x, e.y) && !this.team.some((q) => Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) <= 1) && !(ACTORS[e.type] && ACTORS[e.type].companion); }
}
