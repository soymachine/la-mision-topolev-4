// Simulación de una expedición por turnos (núcleo: creación, guardado, visibilidad, movimiento, turno)
// Los demás métodos están en combat.js, use.js, extraction.js, ai.js y environment.js
import { RNG, rng, clamp, cheb, line, uid } from '../util/rng.js';
import { exitRevealTurn } from './intel.js';
import { mapSeed } from '../core/modes.js';
import { T, TILES } from '../data/tiles.js';
import { MAPS, floorDef } from '../data/world.js';
import { ENEMIES, scaleEnemy, enemyColor } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { generateMap, clearChokepoints } from './mapgen.js';
import { computeFOV, hasLOS } from './fov.js';
import { astar, dijkstra } from './path.js';
import { itemStats, itemName, createItem, rollLoot, mergeInto, rarityColor, gadgetExtras } from '../core/items.js';
import { agentStats, agentName, giveXp, bagCapacity, talentFlag, effectSources } from '../core/agents.js';
import { S, seeEnemy, killEnemy as bestiaryKill } from '../core/state.js';
import { esc } from '../util/dom.js';
import { RADIO } from '../data/lore.js';

import { D8, FISTS, BLOCKING_OBJ, ORDERS, ESSENCE_COLOR } from './shared.js';
import { ACTORS, actorDef, actorColor, actorFaction, isHuman } from '../data/actors.js';
import { HUMANS, scaleHuman } from '../data/humans.js';
import { FACTIONS, baseAttitude, ATTITUDE_TEXT, squadAttitude, addRep } from '../data/factions.js';
import { CombatPart } from './combat.js';
import { UsePart } from './use.js';
import { ExtractionPart } from './extraction.js';
import { AIPart } from './ai.js';
import { EnvironmentPart } from './environment.js';
import { StoryPart } from './story.js';
import { AbilityPart } from './abilities.js';
import { TerrainPart } from './terrain.js';
import { FactionPart } from './factions.js';
import { CompanionPart } from './companions.js';
import { MoralePart } from './morale.js';
import { EcologyPart } from './ecology.js';
import { TacticsPart } from './tactics.js';
import { zoneWorld, reactorAlert } from '../core/ecosys.js';
import { unreadNote } from '../core/story.js';
import { seasonOf } from '../data/basedata.js';
import { MODIFIERS, modEss, modRad, WEATHER } from '../data/modifiers.js';
import { keyify } from '../ui/keys.js';
export { ORDERS, ESSENCE_COLOR };

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export class Expedition {
  // ---------------------------------------------------------------- creación
  // mods: modificadores de zona del día (data/modifiers.js)
  // zoneDef: definición propia para las zonas de evento temporales (si no, la de MAPS[mapIdx])
  static create(mapIdx, agents, mods = [], zoneDef = null) {
    const def = zoneDef || MAPS[mapIdx];
    const ms = zoneDef ? null : mapSeed(mapIdx); // fase 24.7: desafío semanal, mapas fijos en las 3 primeras zonas
    const seed = ms != null ? ms : (Math.random() * 2 ** 32) >>> 0;
    const e = new Expedition();
    e.mapIdx = mapIdx; e.seed = seed;
    e.zoneDef = zoneDef;
    // estación (fase 21.5): en invierno, el agua de la superficie se congela
    e.season = seasonOf(S.day || 1);
    if (e.season === 'invierno' && def.stratum === 'sup' && !mods.includes('helada')) mods = [...mods, 'helada'];
    e.mods = mods;
    e.nFloors = def.floors || 1;
    e.floor = 0;
    e.floorStore = [];
    e.turn = 1;
    e.log = [];
    e.evac = null;
    e.sense = 0; e.senseR = 0;
    e.tally = { kills: 0, essence: 0, items: 0, dmgDealt: 0, dmgTaken: 0 };
    const g = new RNG(seed ^ 0x5bd1e995);
    // fase 22: con la alerta del reactor alta, el pulso llega antes
    e.surgeAt = 300 + (def.tier || 0) * 20 + g.int(0, 60) - (mods.includes('pulso') ? 150 : 0) - reactorAlert() * 10;
    e.nextTemp = 40 + g.int(10, 50) - S.modules.radar * 5;
    e.nextRadio = 25 + g.int(0, 40);
    e.squad = [];
    e.enemies = [];
    // superficie: reloj (2 minutos por turno) y clima
    if (def.stratum === 'sup') {
      const day = (S.day || 1) % 2 === 1;
      e.clock = (day ? g.int(6, 14) : g.int(17, 22)) * 60 + g.int(0, 59);
      e.weather = g.weighted(Object.keys(WEATHER), (k) => WEATHER[k].w * (e.season === 'otono' && k === 'lluvia' ? 3 : e.season === 'invierno' && k === 'lluvia' ? 0.3 : 1));
    }
    if (def.social) e.raidAt = g.chance(0.5) ? g.int(60, 110) : 0;
    e.buildFloor(0);
    // escuadrón
    const startCells = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    agents.forEach((a, i) => {
      const [dx, dy] = startCells[i];
      e.squad.push({ id: a.id, a, x: e.start[0] + dx, y: e.start[1] + dy, alive: true, out: false, ess: 0, order: 'seguir', poison: 0, burn: 0, buffs: [], lastMove: -9, autoUsed: false, regenT: 0, cur: a.equip.w1 ? 'w1' : 'w2', kills: 0, xp: 0, lvl0: a.lvl, startItems: countItems(a) });
    });
    e.active = 0;
    e.init();
    e.spawnCompanions();
    e.spawnContractStuff();
    // planos parciales gracias al radar
    if (S.modules.radar >= 4) {
      for (let k = 0; k < e.w * e.h; k++) if (TILES[e.t[k]].walk && rng.chance(0.35)) e.explored[k] = 1;
    }
    e.computeVisibility(true);
    e.say(`Inserción en <b>${def.name}</b>. Nivel medio ${def.lvl[0]}–${def.lvl[1]}${e.nFloors > 1 ? ` · ${e.nFloors} pisos (más abajo, más peligro y mejor botín)` : ''}. Recolectad esencia y salid por un punto de extracción.`, 'o1');
    e.say(`El radar tardará unos ${exitRevealTurn()} turnos en triangular los puntos de extracción (<span class="cyan">⌂</span>). Los grupos de chebylitas aparecen como <b>?</b> hasta identificarlos. Pulsa <b>?</b> para ver los controles.`, 'dimt');
    if (e.clock != null) e.say(`${e.isNight() ? '☾ Es de noche' : '☀ Es de día'} (${e.timeStr()}). Clima: <b>${WEATHER[e.weather].name}</b> — ${WEATHER[e.weather].desc}`, 'o1');
    if (def.social) e.say('☭ Campamento «Wismut»: aquí no se dispara. Comerciante, enfermería y tablón de rumores (F junto a ellos).', 'good');
    for (const m of mods) if (MODIFIERS[m]) e.say(`<span style="color:${MODIFIERS[m].color}">${MODIFIERS[m].glyph} ${MODIFIERS[m].name}</span>: ${MODIFIERS[m].risk} <span class="good">${MODIFIERS[m].reward}</span>`, 'dimt');
    e.trigger('expStart');
    e.checkSector(e.cur);
    return e;
  }

  zone() { return this.zoneDef || MAPS[this.mapIdx]; }
  // hora del día en superficie (2 minutos por turno)
  minutes() { return this.clock == null ? null : (this.clock + this.turn * 2) % 1440; }
  isNight() { const m = this.minutes(); return m != null && (m < 360 || m >= 1260); }
  timeStr() { const m = this.minutes(); return m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
  outdoors(x, y) { return !!this.surface && !(this.indoor && this.indoor[this.key(x, y)]); }

  // genera el piso f (nivel de amenaza +1 por piso y mapas algo más pequeños)
  buildFloor(f) {
    const base = this.zone();
    const def = floorDef(base, f);
    const modSet = Object.fromEntries((this.mods || []).map((m) => [m, true]));
    // fase 22: mundo persistente (nidos que vuelven, zonas que crecen, jefes ausentes); las zonas de evento no lo tienen
    const world = this.zoneDef ? { alert: reactorAlert() } : zoneWorld(base.id);
    const m = generateMap(def, this.mapIdx, (this.seed + f * 7919) >>> 0, { radar: S.modules.radar, floor: f, floors: this.nFloors, mods: modSet, world });
    this.floor = f;
    this.w = m.w; this.h = m.h; this.t = m.t; this.sec = m.sec; this.sectors = m.sectors;
    this.exits = m.exits; this.pois = m.pois; this.objects = (m.objects || []).filter((o) => o.kind !== 'cart'); this.vents = m.vents;
    // notas: preferir las que aún no se han leído (colecciones, fase 20.6)
    for (const o of this.objects) if (o.kind === 'note' && o.fnote == null && S.notesRead && S.notesRead[o.note]) { const u = unreadNote(rng); if (u != null) o.note = u; }
    this.rad = m.radField; this.anomaly = m.anomaly;
    this.start = m.start; this.lift = m.lift; this.chasms = m.chasms;
    this.mines = m.mines || []; this.surface = !!def.surface; this.indoor = m.indoor || null; this.antennaAt = m.antennaAt || null; this.railRows = m.railRows || [];
    if (this.railRows.length && !this.trainAt) this.trainAt = rng.int(60, 140);
    this.floorItems = new Map();
    for (const fi of m.floor) this.addFloor(fi.x, fi.y, fi.item);
    this.essence = new Map();
    this.gas = new Uint8Array(this.w * this.h); this.fire = new Uint8Array(this.w * this.h); this.smoke = new Uint8Array(this.w * this.h);
    this.traps = []; this.pending = []; this.flares = []; this.charges = []; this.steam = [];
    this.sampled = {}; this.litOn = {}; this.termFails = {}; this.secSeen = {};
    this.explored = new Uint8Array(this.w * this.h);
    this.enemies = [];
    this.occ = new Map();
    const crit = world.alert >= 4 ? 1 : 0; // alerta crítica: los chebylitas suben un nivel
    for (const sp of m.spawns) {
      const lvl = !HUMANS[sp.type] && !sp.attacker ? Math.min(10, sp.lvl + crit) : sp.lvl;
      const en = this.spawnEnemy(sp.type, lvl, sp.x, sp.y, sp.state, sp.poi, sp.faction);
      if (sp.attacker) en.attacker = 1; if (sp.caged) en.caged = 1;
      this.rollElite(en, (def.tier || 0) + f, world.alert || 0);
    }
    this.fans = null; this.roots = null; this.lightDirty = true;
  }

  // estado propio de cada piso (lo que cambia al subir o bajar)
  mapState() {
    const sparse = (arr, mul = 1) => { const o = []; for (let k = 0; k < arr.length; k++) if (arr[k]) o.push(mul === 1 ? [k, arr[k]] : [k, Math.round(arr[k] * mul)]); return o; };
    const an = []; for (let k = 0; k < this.anomaly.length; k++) if (this.anomaly[k]) an.push(k);
    return {
      w: this.w, h: this.h, t: b64(this.t), sec: b64(this.sec), explored: b64(this.explored),
      surface: !!this.surface, indoor: this.indoor ? b64(this.indoor) : null, antennaAt: this.antennaAt || null, railRows: this.railRows || [],
      sectors: this.sectors, exits: this.exits, pois: this.pois, objects: this.objects, vents: this.vents, start: this.start, lift: this.lift || null, chasms: this.chasms || [],
      rad: sparse(this.rad, 100), anomaly: an, gas: sparse(this.gas), fire: sparse(this.fire), smoke: sparse(this.smoke),
      traps: this.traps, mines: this.mines || [], pending: this.pending || [], flares: this.flares || [], charges: this.charges || [],
      steam: this.steam || [], sampled: this.sampled || {}, litOn: this.litOn || {}, termFails: this.termFails || {}, secSeen: this.secSeen || {},
      floorItems: [...this.floorItems.entries()], essence: [...this.essence.entries()],
      enemies: this.enemies.map(({ _st, ...r }) => r),
    };
  }
  applyMapState(d) {
    for (const k of ['w', 'h', 'sectors', 'exits', 'pois', 'objects', 'vents', 'start', 'lift', 'chasms', 'traps', 'pending', 'flares', 'charges', 'steam', 'sampled', 'litOn', 'termFails', 'secSeen', 'enemies', 'antennaAt', 'railRows', 'mines']) if (d[k] !== undefined) this[k] = d[k];
    this.surface = !!d.surface; this.indoor = d.indoor ? unb64(d.indoor) : null;
    this.t = unb64(d.t); this.sec = unb64(d.sec); this.explored = unb64(d.explored);
    const N = this.w * this.h;
    this.rad = new Float32Array(N); for (const [k, v] of d.rad) this.rad[k] = v / 100;
    this.anomaly = new Uint8Array(N); for (const k of d.anomaly) this.anomaly[k] = 1;
    this.gas = new Uint8Array(N); for (const [k, v] of d.gas) this.gas[k] = v;
    this.fire = new Uint8Array(N); for (const [k, v] of d.fire) this.fire[k] = v;
    this.smoke = new Uint8Array(N); for (const [k, v] of d.smoke || []) this.smoke[k] = v;
    this.traps = d.traps || []; this.pending = d.pending || []; this.flares = d.flares || []; this.charges = d.charges || []; this.steam = d.steam || [];
    this.floorItems = new Map(d.floorItems);
    this.essence = new Map(d.essence);
    this.fans = null; this.roots = null; this.lightDirty = true;
  }

  static load(d) {
    const e = new Expedition();
    Object.assign(e, d);
    e.applyMapState(d);
    e.nFloors = d.nFloors || 1; e.floor = d.floor || 0; e.floorStore = d.floorStore || []; e.mods = d.mods || [];
    e.sense = d.sense || 0; e.senseR = d.senseR || 0;
    for (const sq of e.squad) { sq.buffs = sq.buffs || []; if (sq.lastMove == null) sq.lastMove = -9; }
    for (const sq of e.squad) sq.a = S.agents.find((a) => a.id === sq.id) || sq.snap || null;
    e.init();
    e.computeVisibility(true);
    return e;
  }

  serialize() {
    return {
      ...this.mapState(),
      mapIdx: this.mapIdx, seed: this.seed, zoneDef: this.zoneDef || null, mods: this.mods || [], nFloors: this.nFloors || 1, floor: this.floor || 0, floorStore: this.floorStore || [],
      sense: this.sense, senseR: this.senseR, relations: this.relations || {},
      eventsDone: this.eventsDone || {}, facSeen: this.facSeen || {}, dlg: this.dlg || null, dlgQueue: this.dlgQueue || [],
      patria: this.patria || 0, truceUsed: this.truceUsed || 0, defibUsed: this.defibUsed || 0, quietT: this.quietT || 0, fac: this.fac || null, sentHome: this.sentHome || [], season: this.season || null, defenseWon: this.defenseWon || 0,
      clock: this.clock ?? null, weather: this.weather || null, trainAt: this.trainAt || 0, raidAt: this.raidAt || 0, revealT: this.revealT || 0, antennaUsed: this.antennaUsed || 0,
      turn: this.turn, log: this.log.slice(-60), evac: this.evac, tally: this.tally,
      surgeAt: this.surgeAt, nextTemp: this.nextTemp, nextRadio: this.nextRadio, active: this.active,
      squad: this.squad.map((sq) => { const { a, ...rest } = sq; return rest; }),
    };
  }

  // ---------------------------------------------------------------- pisos (fase 16.2)
  // cambia de piso con todo el escuadrón; via: 'lift' (baja), 'liftup' (sube), 'fall' (sima)
  changeFloor(to, via) {
    if (to < 0 || to >= this.nFloors) return false;
    const from = this.floor;
    const comps = this.takeCompanionsAlong();
    this.floorStore[from] = this.mapState();
    if (this.evac) { this.say('La evacuación solicitada se cancela al cambiar de piso.', 'warn'); this.evac = null; }
    if (this.floorStore[to]) { this.applyMapState(this.floorStore[to]); this.floorStore[to] = null; this.floor = to; }
    else this.buildFloor(to);
    // punto de llegada
    let ax, ay;
    if (via === 'liftup' && this.lift) [ax, ay] = this.lift;
    else if (via === 'fall') {
      const cells = [];
      for (let k = 0; k < this.t.length; k++) if (TILES[this.t[k]].walk && this.t[k] !== T.DEEP && this.t[k] !== T.WATER) cells.push(k);
      const k = cells.length ? rng.pick(cells) : this.key(this.start[0], this.start[1]);
      ax = k % this.w; ay = (k / this.w) | 0;
    } else [ax, ay] = this.start;
    this.occ = new Map();
    for (const e of this.enemies) this.occ.set(this.key(e.x, e.y), e);
    this.objects = this.objects.filter((o) => o.kind !== 'cart'); // sin vagonetas (bloqueaban pasillos); también en partidas guardadas
    this.objMap = new Map();
    for (const o of this.objects) this.objMap.set(this.key(o.x, o.y), o);
    const team = this.team;
    const spots = [];
    const seen = new Set([this.key(ax, ay)]);
    const q = [[ax, ay]];
    for (let qi = 0; qi < q.length && spots.length < team.length; qi++) {
      const [x, y] = q[qi];
      if (this.passable(x, y) && !this.occ.has(this.key(x, y))) spots.push([x, y]);
      for (const [dx, dy] of D8) { const nx = x + dx, ny = y + dy, nk = this.key(nx, ny); if (this.inb(nx, ny) && !seen.has(nk) && TILES[this.t[nk]].walk) { seen.add(nk); q.push([nx, ny]); } }
    }
    team.forEach((sq, i) => { const [x, y] = spots[i] || [ax, ay]; sq.x = x; sq.y = y; sq.px = x; sq.py = y; this.occ.set(this.key(x, y), sq); });
    this.placeCompanions(comps);
    this.visible = new Uint8Array(this.w * this.h);
    this.dmap = null;
    this.updateTrack();
    this.computeVisibility(true);
    this.checkSector(this.cur);
    const lvl = this.zone().lvl;
    this.say(`${to > from ? '⇓' : '⇑'} Piso ${floorName(to)} de ${this.nFloors}. Amenaza: nivel ${Math.min(10, lvl[0] + to)}–${Math.min(10, lvl[1] + to)}.${to > 0 ? ' Las extracciones permanentes quedan arriba.' : ''}`, 'cyan');
    this.dirty = true;
    this.emit('floor');
    return true;
  }
  // vista de solo lectura de otro piso ya visitado (para el selector del radar)
  floorView(i) {
    if (i === this.floor) return this;
    const d = this.floorStore[i];
    if (!d) return null;
    const N = d.w * d.h;
    const rad = new Float32Array(N); for (const [k, v] of d.rad) rad[k] = v / 100;
    return {
      readonly: true, floor: i, w: d.w, h: d.h, t: unb64(d.t), explored: unb64(d.explored), visible: new Uint8Array(N), rad, gas: new Uint8Array(N), fire: new Uint8Array(N),
      sectors: d.sectors, pois: d.pois, exits: d.exits, lift: d.lift, chasms: d.chasms || [], start: d.start, enemies: [], squad: [], pending: d.pending || [], flares: [], turn: this.turn,
      sensed: () => false, inMap: () => false, key: (x, y) => y * d.w + x, def: this.def,
    };
  }

  // montacargas (bajar/subir) y simas: el escuadrón debe estar reunido
  useConnector(sq, x, y, u) {
    const far = this.team.filter((o) => cheb(o.x, o.y, x, y) > 4);
    if (far.length) { this.say(`Reunid al escuadrón junto ${u === 'chasm' ? 'a la sima' : 'al montacargas'} (falta${far.length > 1 ? 'n' : ''}: ${far.map((o) => this.nm(o)).join(', ')}).`, 'warn'); return false; }
    if (u === 'liftup') { this.say(`${this.nm(sq)} acciona el montacargas. Chirría hacia arriba…`, 'o1'); return this.changeFloor(this.floor - 1, 'liftup'); }
    if (this.floor >= this.nFloors - 1) { this.say('No hay nada más abajo.', 'dimt'); return false; }
    if (u === 'lift') { this.say(`${this.nm(sq)} acciona el montacargas. Descendéis hacia la oscuridad…`, 'o1'); return this.changeFloor(this.floor + 1, 'lift'); }
    // sima: cuerda o golpe
    const hurt = [];
    for (const o of this.team) {
      if (this.flag(o, 'grapple')) continue;
      const rope = o.a.bag.find((it) => it.b === 'rope');
      if (rope) this.consume(o, rope);
      else hurt.push(o);
    }
    this.say(`El escuadrón desciende por la sima${hurt.length ? ` (sin cuerda: ${hurt.map((o) => this.nm(o)).join(', ')})` : ' con cuerdas'}.`, hurt.length ? 'warn' : 'o1');
    const ok = this.changeFloor(this.floor + 1, 'fall');
    for (const o of hurt) this.damageAgent(o, rng.int(6, 12), 'caída por una sima');
    return ok;
  }

  init() {
    this.def = this.zone();
    this.ambient = this.def.ambientRad * 0.25 * (this.def.id === 'sarcofago' && S.flags.sarcophagusDone ? 0.6 : 1) + modRad(this.mods);
    this.visible = new Uint8Array(this.w * this.h);
    this.fx = [];
    this.occ = new Map();
    for (const e of this.enemies) this.occ.set(this.key(e.x, e.y), e);
    for (const sq of this.squad) if (sq.alive && !sq.out) this.occ.set(this.key(sq.x, sq.y), sq);
    // partidas guardadas con un objeto taponando el único camino a la salida (antes de la revisión): se quita
    if (this.start && this.t) clearChokepoints(this.w, this.h, this.t, this.start, this.exits || [], this.lift || null, this.objects);
    this.objects = this.objects.filter((o) => o.kind !== 'cart'); // sin vagonetas (bloqueaban pasillos); también en partidas guardadas
    this.objMap = new Map();
    for (const o of this.objects) this.objMap.set(this.key(o.x, o.y), o);
    if (this.nextRadio == null) this.nextRadio = this.turn + 40;
    this.charges = this.charges || [];
    this.updateTrack();
    this.ended = false;
    this.interrupt = false;
    this.dirty = true;
    this.listeners = {};
  }

  on(ev, fn) { this.listeners[ev] = fn; }
  emit(ev, ...args) { const f = this.listeners[ev]; if (f) f(...args); }

  // ---------------------------------------------------------------- utilidades
  key(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.t[this.key(x, y)]; }
  opaque(x, y) {
    if (!this.inb(x, y)) return true;
    const k = this.key(x, y);
    const td = TILES[this.t[k]];
    return td.opaque === 1 || this.smoke[k] > 0 || (td.half === 1 && (x + y) % 2 === 0);
  }
  walkTile(x, y) { return this.inb(x, y) && TILES[this.t[this.key(x, y)]].walk === 1; }
  blockedObj(x, y) { const o = this.objMap.get(this.key(x, y)); return o && BLOCKING_OBJ[o.kind] ? o : null; }
  passable(x, y) { return this.walkTile(x, y) && !this.blockedObj(x, y); }
  // línea de visión simétrica (Bresenham en ambos sentidos)
  los(x0, y0, x1, y1, objs = false) {
    const op = objs ? (x, y) => this.opaque(x, y) || this.blockedObj(x, y) != null : (x, y) => this.opaque(x, y);
    return hasLOS(x0, y0, x1, y1, op) || hasLOS(x1, y1, x0, y0, op);
  }
  // ¿el campo de visión desde (x0,y0) alcanza (x1,y1)? (coincide con lo que el jugador ve)
  fovSees(x0, y0, x1, y1) {
    let hit = false;
    const r = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1;
    computeFOV(x0, y0, r, (x, y) => this.opaque(x, y), (x, y) => { if (x === x1 && y === y1) hit = true; });
    return hit;
  }
  isVisible(x, y) { return this.inb(x, y) && this.visible[this.key(x, y)] > 0; }
  entityAt(x, y) { return this.occ.get(this.key(x, y)); }
  enemyAt(x, y) { const e = this.occ.get(this.key(x, y)); return e && e.type ? e : null; }
  agentAt(x, y) { const e = this.occ.get(this.key(x, y)); return e && e.id && !e.type ? e : null; }
  get cur() { return this.squad[this.active]; }
  inMap(sq) { return sq.alive && !sq.out; }
  get team() { return this.squad.filter((s) => this.inMap(s)); }
  sectorAt(x, y) { const s = this.sec[this.key(x, y)]; return this.sectors[s] || null; }
  say(s, cls = '') { s = keyify(s); this.log.push({ t: this.turn, s, c: cls }); if (this.log.length > 200) this.log.shift(); this.emit('log'); }
  addFloor(x, y, it) {
    const k = this.key(x, y);
    if (!this.floorItems.has(k)) this.floorItems.set(k, []);
    this.floorItems.get(k).push(it);
  }
  floorAt(x, y) { return this.floorItems.get(this.key(x, y)) || []; }
  objAt(x, y) { return this.objMap.get(this.key(x, y)); }
  // estadísticas del agente en la expedición: estáticas + efectos temporales + sinergias de gadgets
  ast(sq) {
    const st = agentStats(sq.a);
    if (!sq.alive || sq.out || !this.squad) return st;
    const add = (mods) => { for (const [k, v] of Object.entries(mods || {})) st[k] = (st[k] || 0) + v; };
    for (const b of sq.buffs || []) add(b.mods);
    this.moraleMods(sq, st);
    const team = this.team;
    for (const g of this.gadgets(sq)) {
      const x = gadgetExtras(g);
      if (x.cond && this.condTrue(sq, x.cond.when, st)) add(x.cond.mods);
      if (x.team && team.filter((o) => this.gadgets(o).some((h) => h.b === g.b)).length >= x.team.min) add(x.team.mods);
    }
    for (const o of team) for (const g of this.gadgets(o)) {
      const d = ITEMS[g.b];
      if (d.aura && cheb(o.x, o.y, sq.x, sq.y) <= d.aura.r) add(gadgetExtras(g).aura.mods);
    }
    // talentos, rasgos y medallas: condiciones propias y auras de los compañeros (las auras iguales no se suman)
    for (const src of effectSources(sq.a)) if (src.cond && this.condTrue(sq, src.cond.when, st)) add(src.cond.mods);
    const auras = new Set();
    for (const o of team) for (const src of effectSources(o.a)) {
      if (!src.aura || auras.has(src) || cheb(o.x, o.y, sq.x, sq.y) > src.aura.r) continue;
      auras.add(src);
      add(src.aura.mods);
    }
    st.rad = Math.min(90, st.rad);
    st.vision = Math.min(16, st.vision);
    return st;
  }
  gadgets(sq) { const a = sq.a; return a && a.equip ? [a.equip.g1, a.equip.g2].filter((g) => g && ITEMS[g.b].cat === 'gadget') : []; }
  flag(sq, f) {
    // gadgets, efectos temporales y talentos; essHeal es un umbral (cuanto menor, mejor)
    const vals = [];
    for (const g of this.gadgets(sq)) { const fl = gadgetExtras(g).flags; if (fl && fl[f]) vals.push(fl[f]); }
    for (const k of ['armor', 'helmet']) { const it = sq.a.equip[k]; const fl = it && ITEMS[it.b].flags; if (fl && fl[f]) vals.push(fl[f]); }
    for (const b of sq.buffs || []) if (b.flags && b.flags[f]) vals.push(b.flags[f]);
    const t = talentFlag(sq.a, f);
    if (t) vals.push(t);
    if (!vals.length) return 0;
    return f === 'essHeal' ? Math.min(...vals) : Math.max(...vals);
  }
  condTrue(sq, when, st) {
    const others = this.team.filter((o) => o !== sq);
    if (when === 'near') return others.some((o) => cheb(o.x, o.y, sq.x, sq.y) <= 3);
    if (when === 'alone') return !others.some((o) => cheb(o.x, o.y, sq.x, sq.y) <= 6);
    if (when === 'still') return (sq.lastMove ?? -9) < this.turn - 1;
    if (when === 'hurt') return sq.a.hp < st.hpMaxEff * 0.5;
    if (when === 'lowhp') return sq.a.hp < st.hpMaxEff * 0.3;
    if (when === 'moved') return sq.lastMove === this.turn;
    if (when === 'irradiated') return sq.a.rad >= 50;
    if (when === 'light') return sq.a.bag.length * 2 <= st.slots;
    if (when === 'inWater') { const t = this.tile(sq.x, sq.y); return t === T.WATER || t === T.DEEP; }
    if (when === 'alliesNear') return this.enemies.some((e) => cheb(e.x, e.y, sq.x, sq.y) <= 5 && isHuman(e) && this.attitudeToSquad(e) === 'allied');
    return false;
  }
  addBuff(sq, b) {
    sq.buffs = (sq.buffs || []).filter((x) => x.name !== b.name);
    sq.buffs.push({ name: b.name, turns: b.turns, mods: b.mods || null, flags: b.flags || null, after: b.after || null });
  }
  addPoison(sq, n) {
    if (this.flag(sq, 'poisonImmune')) return;
    if (S.research && S.research.r_vacuna) n = Math.ceil(n / 2);
    n = Math.max(1, n - Math.floor((agentStats(sq.a).attrs.agu - 1) / 4)); // el Aguante acorta el veneno
    sq.poison = Math.min(12, (sq.poison || 0) + n);
  }
  weapon(sq) { return sq.a.equip[sq.cur] || null; }
  weaponStats(sq) {
    const w = this.weapon(sq);
    const ws = w ? itemStats(w) : FISTS;
    // Ráfaga controlada: +1 bala en las armas de ráfaga
    if (ws.burst > 1 && ws.wtype !== 'melee' && this.flag(sq, 'burstPlus')) return { ...ws, burst: ws.burst + this.flag(sq, 'burstPlus') };
    return ws;
  }

  // Actores no jugadores: chebylitas y personas de otras expediciones (lista this.enemies)
  spawnEnemy(type, lvl, x, y, state = 'alerta', poi = null, faction = null) {
    const def = ACTORS[type];
    const human = !!HUMANS[type];
    const st = human ? scaleHuman(def, lvl) : scaleEnemy(def, lvl);
    const e = { uid: uid('e'), type, lvl, x, y, hp: st.hp, hpMax: st.hp, energy: rng.int(0, 99), state, mem: state === 'alerta' ? 15 : 0, poi, cd: 0, cd2: 0, poison: 0, burn: 0, seen: 0, kids: 0, faction: faction || def.faction || 'chebylitas' };
    if (human) {
      e.w = def.weapon ? createItem(def.weapon, rng.chance(0.25) ? 1 : 0, rng) : null;
      e.ld = e.w ? itemStats(e.w).mag || 0 : 0;
      e.home = [x, y];
      if (state === 'dormido') e.state = 'errante';
    }
    this.enemies.push(e);
    if (this.occ) this.occ.set(this.key(x, y), e);
    return e;
  }
  est(e) {
    if (ACTORS[e.type].companion) return this.compStats(e);
    if (!e._st || e._st.l !== e.lvl) {
      const def = ACTORS[e.type];
      e._st = { l: e.lvl, ...(HUMANS[e.type] ? scaleHuman(def, e.lvl) : scaleEnemy(def, e.lvl)) };
      if (HUMANS[e.type] && e.w) e._st.dmg = itemStats(e.w).dmg;
      this.eliteStats(e, e._st);
    }
    return e._st;
  }
  adef(e) { return ACTORS[e.type]; }

  // ---------------------------------------------------------------- facciones
  isSquad(x) { return !!(x && x.a && !x.type); }
  factionOf(x) { return this.isSquad(x) ? 'squad' : actorFaction(x); }
  attitude(fa, fb) {
    if (fa === fb) return 'allied';
    const k = fa < fb ? fa + '|' + fb : fb + '|' + fa;
    if (this.relations && this.relations[k]) return this.relations[k];
    if (fa === 'squad') return squadAttitude(S, fb);
    if (fb === 'squad') return squadAttitude(S, fa);
    return baseAttitude(fa, fb);
  }
  hostile(x, y) { if (x.surrendered || y.surrendered) return false; return this.attitude(this.factionOf(x), this.factionOf(y)) === 'hostile'; }
  attitudeToSquad(e) { return this.attitude('squad', this.factionOf(e)); }
  // el escuadrón ataca a una facción no hostil: pasa a ser hostil durante la expedición
  provoke(faction) {
    if (faction === 'squad' || faction === 'chebylitas' || this.attitude('squad', faction) === 'hostile') return;
    // Tregua (Comisario): la primera vez por expedición solo es un aviso
    if (!this.truceUsed && this.team.some((o) => this.flag(o, 'truce'))) {
      this.truceUsed = 1;
      this.say(`☮ ${FACTIONS[faction].name} os da un aviso: «¡Alto el fuego!». Una más y será la guerra.`, 'warn');
      return;
    }
    const dipl = this.team.some((o) => this.flag(o, 'diplomat'));
    this.relations = this.relations || {};
    const k = 'squad' < faction ? 'squad|' + faction : faction + '|squad';
    this.relations[k] = 'hostile';
    addRep(S, faction, -(dipl ? 12 : 25));
    for (const o of this.enemies) if (actorFaction(o) === faction) { o.state = 'alerta'; o.mem = 15; }
    this.say(`⚠ Has atacado a ${FACTIONS[faction].name} (${FACTIONS[faction].short}). Ahora son <b class="bad">hostiles</b>.`, 'bad');
    this.fx.push({ type: 'alert' });
  }
  // participantes de combate: agentes en el mapa + actores
  combatants() { return [...this.team, ...this.enemies]; }
  // ¿x puede ver a y? (distancia y línea de visión)
  sees(x, y, range) { return Math.hypot(x.x - y.x, x.y - y.y) <= range && this.los(x.x, x.y, y.x, y.y); }

  // ---------------------------------------------------------------- visibilidad
  // radares (gadgets): botín (alijos y puertas blindadas), chebylitas (nidos identificados y bichos) y otras facciones
  radarSweep() {
    let found = 0, nests = 0;
    for (const sq of this.team) {
      const RL = this.flag(sq, 'radarLoot'), RC = this.flag(sq, 'radarCheb'), RF = this.flag(sq, 'radarFac');
      if (!RL && !RC && !RF) continue;
      const near = (x, y, R) => R && Math.hypot(x - sq.x, y - sq.y) <= R;
      for (const p of this.pois) {
        if (p.radar) continue;
        if (p.type === 'cache' && near(p.x, p.y, RL)) { p.radar = 1; if (!p.seen && !p.found) found++; }
        if (p.type === 'nest' && near(p.x, p.y, RC)) { p.radar = 1; if (!p.cleared) nests++; }
      }
      if (RL) for (let y = Math.max(0, sq.y - RL); y <= Math.min(this.h - 1, sq.y + RL); y++) for (let x = Math.max(0, sq.x - RL); x <= Math.min(this.w - 1, sq.x + RL); x++) {
        const k = this.key(x, y);
        if (this.t[k] === T.ARMORDOOR && !this.explored[k] && near(x, y, RL)) { this.explored[k] = 1; found++; }
      }
      for (const en of this.enemies) {
        if (this.isComp && this.isComp(en)) continue;
        const human = isHuman(en);
        if ((human ? near(en.x, en.y, RF) : near(en.x, en.y, RC))) en.radarT = this.turn;
      }
    }
    if (found) this.say(`📡 El detector marca ${found} punto(s) con botín en el radar (alijos o puertas blindadas).`, 'cyan');
    if (nests) this.say(`📡 El bioradar identifica ${nests} grupo(s) de chebylitas.`, 'cyan');
  }
  computeVisibility(silent = false) {
    const vis = this.visible;
    vis.fill(0);
    // luz: en la oscuridad la visión baja a la mitad (salvo linterna o visor nocturno)
    if (this.lightDirty || !this.lightMap || this.surface || this.flares.length || this.fire.some((f) => f)) this.computeLight();
    const L = this.lightMap;
    const fog = ((this.mods || []).includes('niebla') ? 3 : 0) + (this.surface && this.weather === 'niebla' ? 3 : 0);
    const sources = [];
    for (const sq of this.team) { const R = Math.max(3, this.ast(sq).vision - fog); sources.push([sq.x, sq.y, R, this.darkRadius(sq, R)]); }
    for (const f of this.flares) sources.push([f.x, f.y, 5, 5]);
    for (const d of this.enemies) if (d.type === 'strizh') sources.push([d.x, d.y, 6, 4]);
    // contador de centelleo: vetas y cristales cercanos, aunque haya paredes
    for (const sq of this.team) {
      const r = this.flag(sq, 'scint');
      if (r) for (const o of this.objects) if ((o.kind === 'vein' || o.kind === 'shard') && Math.hypot(o.x - sq.x, o.y - sq.y) <= r) this.explored[this.key(o.x, o.y)] = 1;
    }
    for (const [ox, oy, r, dr] of sources) {
      computeFOV(ox, oy, r, (x, y) => this.opaque(x, y), (x, y, d) => {
        if (!this.inb(x, y)) return;
        const k = this.key(x, y);
        if (d > dr && !L[k]) return; // demasiado oscuro
        const b = Math.max(40, Math.round(255 * (1 - (d / (r + 1)) * 0.75)));
        if (b > vis[k]) vis[k] = b;
        this.explored[k] = 1;
      });
    }
    this.radarSweep(); // radares de gadget
    // puntos de interés vistos: alijos que aparecen en el radar y nidos identificados
    for (const p of this.pois) if (!p.seen && vis[this.key(p.x, p.y)]) p.seen = 1;
    // enemigos recién vistos
    const fresh = [];
    for (const e of this.enemies) {
      if (vis[this.key(e.x, e.y)] && !this.hidden(e)) {
        if (!e.seen) { e.seen = 1; fresh.push(e); if (ENEMIES[e.type]) seeEnemy(e.type); if (ENEMIES[e.type] && ENEMIES[e.type].boss) this.moraleOnBoss(e); }
      }
    }
    // primer avistamiento de cada facción humana en la expedición
    for (const e of fresh) {
      const f = actorFaction(e);
      if (f === 'chebylitas' || (this.facSeen = this.facSeen || {})[f]) continue;
      this.facSeen[f] = 1;
      (S.met = S.met || {})[f] = 1;
      if (this.trigger) this.trigger('seeFaction', { faction: f, type: e.type });
      if (FACTIONS[f] && FACTIONS[f].negotiable && this.attitudeToSquad(e) === 'hostile' && this.cur) this.openDialog('encounter', this.cur, null, e);
    }
    if (fresh.length && !silent) {
      for (const att of ['hostile', 'neutral', 'allied']) {
        const list = fresh.filter((e) => this.attitudeToSquad(e) === att);
        if (!list.length) continue;
        const groups = {};
        for (const e of list) { const k = e.type + '|' + e.lvl + '|' + actorFaction(e); groups[k] = (groups[k] || 0) + 1; }
        const txt = Object.entries(groups).map(([k, n]) => { const [tp, l, f] = k.split('|'); return `<span style="color:${actorColor({ type: tp, lvl: +l, faction: f })}">${n > 1 ? n + '× ' : ''}${ACTORS[tp].name} Nv ${l}</span>`; }).join(', ');
        if (att === 'hostile') { this.say(`¡Contacto! ${txt}`, 'warn'); this.interrupt = true; this.fx.push({ type: 'alert' }); if (list.some((e) => e.elite)) this.fx.push({ type: 'snd', s: 'elite' }); }
        else if (att === 'neutral') { this.say(`Avistas a ${txt} <span class="warn">(neutral)</span>.`, 'o1'); this.interrupt = true; }
        else this.say(`Aliados a la vista: ${txt}.`, 'good');
      }
    }
    this.dirty = true;
    return fresh;
  }

  // ---------------------------------------------------------------- acciones del jugador
  // Cada acción devuelve true si consume el turno
  act(fn) {
    if (this.ended) return false;
    const sq = this.cur;
    if (!sq || !this.inMap(sq) || sq.downed) return false; // fase 23.3: un abatido no actúa
    this.extraTurn = 0;
    // pánico: el agente huye en lugar de obedecer
    if (this.hasAffliction(sq, 'panico') && this.panicStep(sq)) { this.endTurn(); return true; }
    const used = fn(sq);
    if (used) {
      this.endTurn();
      // resbalones (aceite, hielo): el paso cuesta un turno más
      if (this.extraTurn && !this.ended) { this.extraTurn = 0; this.endTurn(); }
    } else this.emit('update');
    return used;
  }

  moveDir(dx, dy) { return this.act((sq) => this.tryMove(sq, sq.x + dx, sq.y + dy, true)); }
  wait() { return this.act((sq) => { this.agentRest(sq); return true; }); }

  agentRest(sq) { /* esperar */ }

  tryMove(sq, nx, ny, bump) {
    if (!this.inb(nx, ny)) return false;
    const ent = this.entityAt(nx, ny);
    // atrapado por una liana: forcejear gasta el turno
    if (sq.rooted > 0 && !(ent && ent.type && this.hostile(sq, ent))) {
      sq.rooted--;
      if (sq === this.cur) this.say(`${this.nm(sq)} forcejea para soltarse${sq.rooted ? '…' : ': ¡libre!'}`, 'warn');
      return true;
    }
    if (ent && ent.type) {
      if (this.hostile(sq, ent)) return this.attack(sq, ent);
      if (!bump) return false;
      if (this.attitudeToSquad(ent) === 'allied') {
        // intercambiar posición con un aliado
        this.occ.delete(this.key(sq.x, sq.y)); this.occ.delete(this.key(ent.x, ent.y));
        [sq.x, ent.x] = [ent.x, sq.x]; [sq.y, ent.y] = [ent.y, sq.y];
        this.occ.set(this.key(sq.x, sq.y), sq); this.occ.set(this.key(ent.x, ent.y), ent);
        sq.lastMove = this.turn;
        return true;
      }
      if (sq === this.cur && this.talkableAt(nx, ny)) return this.interactActor(sq, ent);
      if (sq === this.cur) this.say(`${this.enm(ent)} te bloquea el paso. (Para atacar a un neutral, apunta con <b>T</b>.)`, 'dimt');
      return false;
    }
    if (ent && ent.id) {
      if (!bump) return false;
      // intercambiar posición con un compañero
      this.occ.delete(this.key(sq.x, sq.y)); this.occ.delete(this.key(ent.x, ent.y));
      [sq.x, ent.x] = [ent.x, sq.x]; [sq.y, ent.y] = [ent.y, sq.y];
      this.occ.set(this.key(sq.x, sq.y), sq); this.occ.set(this.key(ent.x, ent.y), ent);
      sq.lastMove = ent.lastMove = this.turn;
      return true;
    }
    const obj = this.blockedObj(nx, ny);
    if (obj) {
      if (!bump) return false;
      if (obj.kind === 'cart') return this.pushCart(sq, obj, nx - sq.x, ny - sq.y);
      return this.interactObj(sq, obj);
    }
    const tt = this.tile(nx, ny);
    // gancho y cuerda: saltar al otro lado de una sima
    if (tt === T.CHASM && bump && this.flag(sq, 'grapple')) {
      const dx = nx - sq.x, dy = ny - sq.y;
      for (let n = 2; n <= 4; n++) {
        const lx = sq.x + dx * n, ly = sq.y + dy * n;
        if (!this.inb(lx, ly) || this.tile(lx, ly) === T.CHASM) continue;
        if (!this.passable(lx, ly) || this.entityAt(lx, ly)) break;
        this.moveEntity(sq, lx, ly);
        this.noise(lx, ly, 3);
        this.say(`${this.nm(sq)} lanza el gancho y cruza la sima de un salto. <span class="dimt">(F junto a ella para bajar)</span>`, 'o1');
        this.onAgentEnter(sq);
        return true;
      }
    }
    if (!TILES[tt].walk) {
      if (bump && (tt === T.ROOTS || tt === T.DEBRIS)) return this.clearObstacle(sq, nx, ny);
      if (bump && TILES[tt].use) return this.useTile(sq, nx, ny);
      if (bump && tt === T.DEEP) this.say('El agua es demasiado profunda.', 'dimt');
      else if (bump && TILES[tt].cover && sq === this.cur) this.say(`${TILES[tt].name}: no se puede atravesar, pero da cobertura.`, 'dimt');
      return false;
    }
    if (tt === T.DOOR) { this.t[this.key(nx, ny)] = T.DOOR_OPEN; this.fx.push({ type: 'door', x: nx, y: ny }); }
    this.moveEntity(sq, nx, ny);
    if (this.onStep(sq, true)) this.extraTurn = 1;
    // fase 23.2: agachado, uno de cada dos pasos cuesta un turno más
    if (sq.crouch) { sq.crouchStep = !sq.crouchStep; if (sq.crouchStep) this.extraTurn = 1; }
    if (this.surface) this.creak(sq);
    this.onAgentEnter(sq);
    return true;
  }

  moveEntity(ent, nx, ny) {
    this.occ.delete(this.key(ent.x, ent.y));
    ent.px = ent.x; ent.py = ent.y;
    ent.x = nx; ent.y = ny;
    this.occ.set(this.key(nx, ny), ent);
    if (ent.id && !ent.type) ent.lastMove = this.turn;
  }

  // primer paso del escuadrón en un sector
  checkSector(sq) {
    if (!sq) return;
    const s = this.sectorAt(sq.x, sq.y);
    if (!s) return;
    this.secSeen = this.secSeen || {};
    if (this.secSeen[s.id]) return;
    this.secSeen[s.id] = 1;
    if (this.turn > 1) this.gainXp(sq, 4, true); // explorar también enseña
    if (this.flag(sq, 'mapper')) {
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) { const k = this.key(x, y); if (TILES[this.t[k]].walk || this.t[k] === T.WALL || this.t[k] === T.MACHINE) this.explored[k] = 1; }
      this.dirty = true;
      if (sq === this.cur) this.say(`▦ ${this.nm(sq)} cartografía el sector ${s.code}.`, 'dimt');
    }
    this.trigger('enterSector', { sector: s }, sq);
  }

  onAgentEnter(sq) {
    const k = this.key(sq.x, sq.y);
    // minas enemigas ocultas
    const mi = (this.mines || []).findIndex((m) => m.x === sq.x && m.y === sq.y);
    if (mi >= 0) {
      const m = this.mines.splice(mi, 1)[0];
      this.say(`💥 ¡${this.nm(sq)} pisa una mina${m.known ? '' : ' oculta'}!`, 'bad');
      this.explode(sq.x, sq.y, 1, [12, 22], null, 0, 0, { noise: 15 });
      this.interrupt = true;
      if (!this.inMap(sq)) return;
    }
    this.checkSector(sq);
    this.pickupEssence(sq, k);
    const items = this.floorItems.get(k);
    if (items && items.length && sq === this.cur) {
      this.say(`En el suelo: ${items.map((it) => `<span style="color:${rarityColor(it.r)}">${esc(itemName(it))}${it.q > 1 ? ' ×' + it.q : ''}</span>`).join(', ')}. <b>G</b> para recoger.`);
    }
    const o = this.objAt(sq.x, sq.y);
    if (o && o.kind === 'corpse' && !o.opened && sq === this.cur) this.say('Un cadáver de liquidador. Pulsa <b>F</b> para registrarlo.', 'dimt');
    if (o && o.kind === 'note' && sq === this.cur) this.say(`Hay una nota en el suelo${o.opened ? ' (ya leída)' : ''}. Pulsa <b>F</b> para leerla.`, 'dimt');
    if (this.exitAt(sq.x, sq.y) && sq === this.cur && !this.evac) this.say('Estás en un punto de extracción. Pulsa <b>F</b> para solicitar evacuación.', 'cyan');
  }

  pickupEssence(sq, k) {
    const ess = this.essence.get(k);
    if (!ess) return;
    const re = this.flag(sq, 'radEss') && this.rad[k] > 0.3 ? this.flag(sq, 'radEss') : 0;
    const gain = Math.max(1, Math.round(ess * (1 + (this.ast(sq).essence + re) / 100) * modEss(this.mods)));
    sq.ess += gain; this.tally.essence += gain;
    this.essence.delete(k);
    this.fx.push({ type: 'essence', x: k % this.w, y: (k / this.w) | 0, n: gain });
    this.say(`${this.nm(sq)} recoge <span class="cyan">${gain} ✦ esencia</span>.`);
    const eh = this.flag(sq, 'essHeal');
    if (eh && gain >= eh) {
      const st = this.ast(sq);
      sq.a.hp = Math.min(st.hpMaxEff, sq.a.hp + Math.floor(gain / eh));
      this.fx.push({ type: 'heal', x: sq.x, y: sq.y, color: ESSENCE_COLOR });
    }
  }

  nm(sq) { return `<span style="color:${sq.a.color}">${esc(sq.a.nick)}</span>`; }

  // ---------------------------------------------------------------- órdenes / control
  setOrder(order) {
    for (const sq of this.squad) if (sq !== this.cur) sq.order = order;
    this.say(`Orden al escuadrón: <b>${ORDERS[order]}</b>.`, 'o1');
    this.emit('update');
  }
  switchActive(i) {
    const team = this.team;
    if (!team.length) return;
    let idx = i;
    if (idx == null) {
      const up = team.filter((q) => !q.downed);
      if (!up.length) return;
      const cur = up.indexOf(this.cur);
      idx = this.squad.indexOf(up[(cur + 1) % up.length]);
    }
    if (!this.inMap(this.squad[idx]) || this.squad[idx].downed) return; // a un abatido no se le controla
    this.active = idx;
    this.emit('switch');
  }

  // ---------------------------------------------------------------- turno
  endTurn() {
    if (this.ended) return;
    // ¡Por la Patria!: el escuadrón actúa y los demás no
    if (this.patria) {
      this.patria = 0;
      for (const sq of this.squad) { if (sq === this.cur || !this.inMap(sq)) continue; this.companionAct(sq); if (this.ended) return; }
      this.tickAbilities();
      this.turn++;
      S.stats.turns++;
      this.computeVisibility();
      this.emit('turn');
      return;
    }
    // compañeros
    for (const sq of this.squad) {
      if (sq === this.cur || !this.inMap(sq)) continue;
      this.companionAct(sq);
      if (this.ended) return;
    }
    // enemigos
    this.dmap = null;
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      if (e.stun > 0) { e.stun--; e.energy = 0; continue; }
      e.energy += this.espeed(e);
      while (e.energy >= 100 && e.hp > 0 && !this.ended) {
        e.energy -= 100;
        this.enemyAct(e);
      }
      if (this.ended) return;
    }
    this.environment();
    if (this.ended) return;
    this.tickAbilities();
    if (this.ended) return;
    this.updateTrack();
    this.turn++;
    S.stats.turns++;
    this.computeVisibility();
    this.trigger('turn', { turn: this.turn });
    this.emit('turn');
  }

  // ---------------------------------------------------------------- final
  finish() {
    if (this.ended) return;
    this.ended = true;
    this.emit('end');
  }
}

// Mezcla de los módulos parciales en la clase principal
for (const Part of [CombatPart, UsePart, ExtractionPart, AIPart, EnvironmentPart, StoryPart, AbilityPart, TerrainPart, FactionPart, CompanionPart, MoralePart, EcologyPart, TacticsPart]) {
  for (const k of Object.getOwnPropertyNames(Part.prototype)) {
    if (k === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(Expedition.prototype, k)) throw new Error('Método duplicado en Expedition: ' + k);
    Object.defineProperty(Expedition.prototype, k, Object.getOwnPropertyDescriptor(Part.prototype, k));
  }
}

export function floorsFor(mapIdx) { return (MAPS[mapIdx] && MAPS[mapIdx].floors) || 1; }
export const floorName = (f) => (f === 0 ? 'superior' : `−${f}`);

export function countItems(a) {
  return Object.values(a.equip).filter(Boolean).length + a.bag.length;
}
