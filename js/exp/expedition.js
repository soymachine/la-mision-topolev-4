// Simulación de una expedición por turnos (núcleo: creación, guardado, visibilidad, movimiento, turno)
// Los demás métodos están en combat.js, use.js, extraction.js, ai.js y environment.js
import { RNG, rng, clamp, cheb, line, uid } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { MAPS } from '../data/world.js';
import { ENEMIES, scaleEnemy, enemyColor } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { generateMap } from './mapgen.js';
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
import { FACTIONS, baseAttitude, ATTITUDE_TEXT } from '../data/factions.js';
import { CombatPart } from './combat.js';
import { UsePart } from './use.js';
import { ExtractionPart } from './extraction.js';
import { AIPart } from './ai.js';
import { EnvironmentPart } from './environment.js';
import { StoryPart } from './story.js';
import { AbilityPart } from './abilities.js';
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
  static create(mapIdx, agents) {
    const def = MAPS[mapIdx];
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const m = generateMap(def, mapIdx, seed, { radar: S.modules.radar });
    const e = new Expedition();
    e.mapIdx = mapIdx; e.seed = seed;
    e.w = m.w; e.h = m.h; e.t = m.t; e.sec = m.sec; e.sectors = m.sectors;
    e.exits = m.exits; e.pois = m.pois; e.objects = m.objects; e.vents = m.vents;
    e.rad = m.radField; e.anomaly = m.anomaly;
    e.start = m.start;
    e.floorItems = new Map();
    for (const f of m.floor) e.addFloor(f.x, f.y, f.item);
    e.essence = new Map();
    e.gas = new Uint8Array(e.w * e.h); e.fire = new Uint8Array(e.w * e.h); e.smoke = new Uint8Array(e.w * e.h);
    e.traps = []; e.sense = 0; e.senseR = 0;
    e.explored = new Uint8Array(e.w * e.h);
    e.turn = 1;
    e.log = [];
    e.evac = null;
    e.pending = [];
    e.flares = [];
    e.tally = { kills: 0, essence: 0, items: 0, dmgDealt: 0, dmgTaken: 0 };
    const g = new RNG(seed ^ 0x5bd1e995);
    e.surgeAt = 300 + mapIdx * 40 + g.int(0, 60);
    e.nextTemp = 40 + g.int(10, 50) - S.modules.radar * 5;
    e.nextRadio = 25 + g.int(0, 40);
    // escuadrón
    e.squad = [];
    const startCells = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    agents.forEach((a, i) => {
      const [dx, dy] = startCells[i];
      e.squad.push({ id: a.id, a, x: e.start[0] + dx, y: e.start[1] + dy, alive: true, out: false, ess: 0, order: 'seguir', poison: 0, burn: 0, buffs: [], lastMove: -9, autoUsed: false, regenT: 0, cur: a.equip.w1 ? 'w1' : 'w2', kills: 0, xp: 0, lvl0: a.lvl, startItems: countItems(a) });
    });
    e.active = 0;
    // enemigos
    e.enemies = [];
    for (const sp of m.spawns) e.spawnEnemy(sp.type, sp.lvl, sp.x, sp.y, sp.state, sp.poi);
    e.init();
    // planos parciales gracias al radar
    if (S.modules.radar >= 4) {
      for (let k = 0; k < e.w * e.h; k++) if (TILES[e.t[k]].walk && rng.chance(0.35)) e.explored[k] = 1;
    }
    e.computeVisibility(true);
    e.say(`Inserción en <b>${def.name}</b>. Nivel medio ${def.lvl[0]}–${def.lvl[1]}. Recolectad esencia y salid por un punto de extracción.`, 'o1');
    e.say('Los puntos de extracción (<span class="cyan">⌂</span>) están marcados en el radar. Pulsa <b>?</b> para ver los controles.', 'dimt');
    e.trigger('expStart');
    e.checkSector(e.cur);
    return e;
  }

  static load(d) {
    const e = new Expedition();
    Object.assign(e, d);
    e.t = unb64(d.t); e.sec = unb64(d.sec); e.explored = unb64(d.explored);
    const N = e.w * e.h;
    e.rad = new Float32Array(N); for (const [k, v] of d.rad) e.rad[k] = v / 100;
    e.anomaly = new Uint8Array(N); for (const k of d.anomaly) e.anomaly[k] = 1;
    e.gas = new Uint8Array(N); for (const [k, v] of d.gas) e.gas[k] = v;
    e.fire = new Uint8Array(N); for (const [k, v] of d.fire) e.fire[k] = v;
    e.smoke = new Uint8Array(N); for (const [k, v] of d.smoke || []) e.smoke[k] = v;
    e.traps = d.traps || []; e.sense = d.sense || 0; e.senseR = d.senseR || 0;
    for (const sq of e.squad) { sq.buffs = sq.buffs || []; if (sq.lastMove == null) sq.lastMove = -9; }
    e.floorItems = new Map(d.floorItems);
    e.essence = new Map(d.essence);
    for (const sq of e.squad) sq.a = S.agents.find((a) => a.id === sq.id) || sq.snap || null;
    e.init();
    e.computeVisibility(true);
    return e;
  }

  serialize() {
    const sparse = (arr, mul = 1) => { const o = []; for (let k = 0; k < arr.length; k++) if (arr[k]) o.push(mul === 1 ? [k, arr[k]] : [k, Math.round(arr[k] * mul)]); return o; };
    const an = []; for (let k = 0; k < this.anomaly.length; k++) if (this.anomaly[k]) an.push(k);
    return {
      mapIdx: this.mapIdx, seed: this.seed, w: this.w, h: this.h, t: b64(this.t), sec: b64(this.sec), explored: b64(this.explored),
      sectors: this.sectors, exits: this.exits, pois: this.pois, objects: this.objects, vents: this.vents, start: this.start,
      rad: sparse(this.rad, 100), anomaly: an, gas: sparse(this.gas), fire: sparse(this.fire), smoke: sparse(this.smoke),
      traps: this.traps, sense: this.sense, senseR: this.senseR, relations: this.relations || {},
      eventsDone: this.eventsDone || {}, secSeen: this.secSeen || {}, facSeen: this.facSeen || {}, dlg: this.dlg || null, dlgQueue: this.dlgQueue || [],
      charges: this.charges || [], patria: this.patria || 0, truceUsed: this.truceUsed || 0,
      floorItems: [...this.floorItems.entries()], essence: [...this.essence.entries()],
      turn: this.turn, log: this.log.slice(-60), evac: this.evac, pending: this.pending, flares: this.flares, tally: this.tally,
      surgeAt: this.surgeAt, nextTemp: this.nextTemp, nextRadio: this.nextRadio, active: this.active,
      squad: this.squad.map((sq) => { const { a, ...rest } = sq; return rest; }),
      enemies: this.enemies.map(({ _st, ...r }) => r),
    };
  }

  init() {
    this.def = MAPS[this.mapIdx];
    this.ambient = this.def.ambientRad * 0.25;
    this.visible = new Uint8Array(this.w * this.h);
    this.fx = [];
    this.occ = new Map();
    for (const e of this.enemies) this.occ.set(this.key(e.x, e.y), e);
    for (const sq of this.squad) if (sq.alive && !sq.out) this.occ.set(this.key(sq.x, sq.y), sq);
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
    return TILES[this.t[k]].opaque === 1 || this.smoke[k] > 0;
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
  say(s, cls = '') { this.log.push({ t: this.turn, s, c: cls }); if (this.log.length > 200) this.log.shift(); this.emit('log'); }
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
      e.w = createItem(def.weapon, rng.chance(0.25) ? 1 : 0, rng);
      e.ld = itemStats(e.w).mag || 0;
      e.home = [x, y];
      if (state === 'dormido') e.state = 'errante';
    }
    this.enemies.push(e);
    if (this.occ) this.occ.set(this.key(x, y), e);
    return e;
  }
  est(e) {
    if (!e._st || e._st.l !== e.lvl) {
      const def = ACTORS[e.type];
      e._st = { l: e.lvl, ...(HUMANS[e.type] ? scaleHuman(def, e.lvl) : scaleEnemy(def, e.lvl)) };
      if (HUMANS[e.type] && e.w) e._st.dmg = itemStats(e.w).dmg;
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
    return baseAttitude(fa, fb);
  }
  hostile(x, y) { return this.attitude(this.factionOf(x), this.factionOf(y)) === 'hostile'; }
  attitudeToSquad(e) { return this.attitude('squad', this.factionOf(e)); }
  // el escuadrón ataca a una facción no hostil: pasa a ser hostil durante la expedición
  provoke(faction) {
    if (faction === 'chebylitas' || this.attitude('squad', faction) === 'hostile') return;
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
    S.rep = S.rep || {};
    S.rep[faction] = (S.rep[faction] || 0) - (dipl ? 12 : 25);
    for (const o of this.enemies) if (actorFaction(o) === faction) { o.state = 'alerta'; o.mem = 15; }
    this.say(`⚠ Has atacado a ${FACTIONS[faction].name} (${FACTIONS[faction].short}). Ahora son <b class="bad">hostiles</b>.`, 'bad');
    this.fx.push({ type: 'alert' });
  }
  // participantes de combate: agentes en el mapa + actores
  combatants() { return [...this.team, ...this.enemies]; }
  // ¿x puede ver a y? (distancia y línea de visión)
  sees(x, y, range) { return Math.hypot(x.x - y.x, x.y - y.y) <= range && this.los(x.x, x.y, y.x, y.y); }

  // ---------------------------------------------------------------- visibilidad
  computeVisibility(silent = false) {
    const vis = this.visible;
    vis.fill(0);
    const sources = [];
    for (const sq of this.team) sources.push([sq.x, sq.y, this.ast(sq).vision]);
    for (const f of this.flares) sources.push([f.x, f.y, 5]);
    for (const [ox, oy, r] of sources) {
      computeFOV(ox, oy, r, (x, y) => this.opaque(x, y), (x, y, d) => {
        if (!this.inb(x, y)) return;
        const k = this.key(x, y);
        const b = Math.max(40, Math.round(255 * (1 - (d / (r + 1)) * 0.75)));
        if (b > vis[k]) vis[k] = b;
        this.explored[k] = 1;
      });
    }
    // enemigos recién vistos
    const fresh = [];
    for (const e of this.enemies) {
      if (vis[this.key(e.x, e.y)]) {
        if (!e.seen) { e.seen = 1; fresh.push(e); if (ENEMIES[e.type]) seeEnemy(e.type); }
      }
    }
    // primer avistamiento de cada facción humana en la expedición
    for (const e of fresh) {
      const f = actorFaction(e);
      if (f === 'chebylitas' || (this.facSeen = this.facSeen || {})[f]) continue;
      this.facSeen[f] = 1;
      if (this.trigger) this.trigger('seeFaction', { faction: f, type: e.type });
    }
    if (fresh.length && !silent) {
      for (const att of ['hostile', 'neutral', 'allied']) {
        const list = fresh.filter((e) => this.attitudeToSquad(e) === att);
        if (!list.length) continue;
        const groups = {};
        for (const e of list) { const k = e.type + '|' + e.lvl + '|' + actorFaction(e); groups[k] = (groups[k] || 0) + 1; }
        const txt = Object.entries(groups).map(([k, n]) => { const [tp, l, f] = k.split('|'); return `<span style="color:${actorColor({ type: tp, lvl: +l, faction: f })}">${n > 1 ? n + '× ' : ''}${ACTORS[tp].name} Nv ${l}</span>`; }).join(', ');
        if (att === 'hostile') { this.say(`¡Contacto! ${txt}`, 'warn'); this.interrupt = true; this.fx.push({ type: 'alert' }); }
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
    if (!sq || !this.inMap(sq)) return false;
    const used = fn(sq);
    if (used) this.endTurn();
    else this.emit('update');
    return used;
  }

  moveDir(dx, dy) { return this.act((sq) => this.tryMove(sq, sq.x + dx, sq.y + dy, true)); }
  wait() { return this.act((sq) => { this.agentRest(sq); return true; }); }

  agentRest(sq) { /* esperar */ }

  tryMove(sq, nx, ny, bump) {
    if (!this.inb(nx, ny)) return false;
    const ent = this.entityAt(nx, ny);
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
    if (obj) { if (bump) return this.interactObj(sq, obj); return false; }
    const tt = this.tile(nx, ny);
    if (!TILES[tt].walk) {
      if (bump && tt === T.DEEP) this.say('El agua es demasiado profunda.', 'dimt');
      return false;
    }
    if (tt === T.DOOR) { this.t[this.key(nx, ny)] = T.DOOR_OPEN; this.fx.push({ type: 'door', x: nx, y: ny }); }
    this.moveEntity(sq, nx, ny);
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
    const gain = Math.max(1, Math.round(ess * (1 + (this.ast(sq).essence + re) / 100)));
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
      const cur = team.indexOf(this.cur);
      idx = this.squad.indexOf(team[(cur + 1) % team.length]);
    }
    if (!this.inMap(this.squad[idx])) return;
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
      e.energy += ACTORS[e.type].speed;
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
for (const Part of [CombatPart, UsePart, ExtractionPart, AIPart, EnvironmentPart, StoryPart, AbilityPart]) {
  for (const k of Object.getOwnPropertyNames(Part.prototype)) {
    if (k === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(Expedition.prototype, k)) throw new Error('Método duplicado en Expedition: ' + k);
    Object.defineProperty(Expedition.prototype, k, Object.getOwnPropertyDescriptor(Part.prototype, k));
  }
}

export function countItems(a) {
  return Object.values(a.equip).filter(Boolean).length + a.bag.length;
}
