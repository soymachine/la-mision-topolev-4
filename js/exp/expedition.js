// Simulación de una expedición por turnos
import { RNG, rng, clamp, cheb, line, uid } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { MAPS } from '../data/world.js';
import { ENEMIES, scaleEnemy, enemyColor } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { generateMap } from './mapgen.js';
import { computeFOV, hasLOS } from './fov.js';
import { astar, dijkstra } from './path.js';
import { itemStats, itemName, createItem, rollLoot, mergeInto, rarityColor } from '../core/items.js';
import { agentStats, agentName, giveXp, bagCapacity } from '../core/agents.js';
import { S, seeEnemy, killEnemy as bestiaryKill } from '../core/state.js';
import { esc } from '../util/dom.js';

const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const FISTS = { dmg: [1, 3], acc: 82, range: 1, crit: 5, pierce: 0, burst: 1, noise: 1, wtype: 'melee' };
const BLOCKING_OBJ = { vein: 1, cache: 1, locker: 1, crate: 1 };
export const ORDERS = { seguir: 'SEGUIR', mantener: 'MANTENER', pasivo: 'NO DISPARAR' };
export const ESSENCE_COLOR = '#5ff7ff';

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
    e.gas = new Uint8Array(e.w * e.h); e.fire = new Uint8Array(e.w * e.h);
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
    // escuadrón
    e.squad = [];
    const startCells = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    agents.forEach((a, i) => {
      const [dx, dy] = startCells[i];
      e.squad.push({ id: a.id, a, x: e.start[0] + dx, y: e.start[1] + dy, alive: true, out: false, ess: 0, order: 'seguir', poison: 0, burn: 0, stim: 0, regenT: 0, cur: a.equip.w1 ? 'w1' : 'w2', kills: 0, xp: 0, lvl0: a.lvl, startItems: countItems(a) });
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
      rad: sparse(this.rad, 100), anomaly: an, gas: sparse(this.gas), fire: sparse(this.fire),
      floorItems: [...this.floorItems.entries()], essence: [...this.essence.entries()],
      turn: this.turn, log: this.log.slice(-60), evac: this.evac, pending: this.pending, flares: this.flares, tally: this.tally,
      surgeAt: this.surgeAt, nextTemp: this.nextTemp, active: this.active,
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
  opaque(x, y) { return !this.inb(x, y) || TILES[this.t[this.key(x, y)]].opaque === 1; }
  walkTile(x, y) { return this.inb(x, y) && TILES[this.t[this.key(x, y)]].walk === 1; }
  blockedObj(x, y) { const o = this.objMap.get(this.key(x, y)); return o && BLOCKING_OBJ[o.kind] ? o : null; }
  passable(x, y) { return this.walkTile(x, y) && !this.blockedObj(x, y); }
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
  ast(sq) { return agentStats(sq.a); }
  weapon(sq) { return sq.a.equip[sq.cur] || null; }
  weaponStats(sq) { const w = this.weapon(sq); return w ? itemStats(w) : FISTS; }

  spawnEnemy(type, lvl, x, y, state = 'alerta', poi = null) {
    const def = ENEMIES[type];
    const st = scaleEnemy(def, lvl);
    const e = { uid: uid('e'), type, lvl, x, y, hp: st.hp, hpMax: st.hp, energy: rng.int(0, 99), state, mem: state === 'alerta' ? 15 : 0, poi, cd: 0, cd2: 0, poison: 0, burn: 0, seen: 0, kids: 0 };
    this.enemies.push(e);
    if (this.occ) this.occ.set(this.key(x, y), e);
    return e;
  }
  est(e) { if (!e._st || e._st.l !== e.lvl) e._st = { l: e.lvl, ...scaleEnemy(ENEMIES[e.type], e.lvl) }; return e._st; }

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
        if (!e.seen) { e.seen = 1; fresh.push(e); seeEnemy(e.type); }
      }
    }
    if (fresh.length && !silent) {
      const groups = {};
      for (const e of fresh) { const k = e.type + '|' + e.lvl; groups[k] = (groups[k] || 0) + 1; }
      const txt = Object.entries(groups).map(([k, n]) => { const [tp, l] = k.split('|'); return `<span style="color:${enemyColor(ENEMIES[tp].hue, +l)}">${n > 1 ? n + '× ' : ''}${ENEMIES[tp].name} Nv ${l}</span>`; }).join(', ');
      this.say(`¡Contacto! ${txt}`, 'warn');
      this.interrupt = true;
      this.fx.push({ type: 'alert' });
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
    if (ent && ent.type) { return this.attack(sq, ent); }
    if (ent && ent.id) {
      if (!bump) return false;
      // intercambiar posición con un compañero
      this.occ.delete(this.key(sq.x, sq.y)); this.occ.delete(this.key(ent.x, ent.y));
      [sq.x, ent.x] = [ent.x, sq.x]; [sq.y, ent.y] = [ent.y, sq.y];
      this.occ.set(this.key(sq.x, sq.y), sq); this.occ.set(this.key(ent.x, ent.y), ent);
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
  }

  onAgentEnter(sq) {
    const k = this.key(sq.x, sq.y);
    const ess = this.essence.get(k);
    if (ess) {
      const gain = Math.max(1, Math.round(ess * (1 + this.ast(sq).essence / 100)));
      sq.ess += gain; this.tally.essence += gain;
      this.essence.delete(k);
      this.fx.push({ type: 'essence', x: sq.x, y: sq.y, n: gain });
      this.say(`${this.nm(sq)} recoge <span class="cyan">${gain} ✦ esencia</span>.`);
    }
    const items = this.floorItems.get(k);
    if (items && items.length && sq === this.cur) {
      this.say(`En el suelo: ${items.map((it) => `<span style="color:${rarityColor(it.r)}">${esc(itemName(it))}${it.q > 1 ? ' ×' + it.q : ''}</span>`).join(', ')}. <b>G</b> para recoger.`);
    }
    const o = this.objAt(sq.x, sq.y);
    if (o && o.kind === 'corpse' && !o.opened && sq === this.cur) this.say('Un cadáver de liquidador. Pulsa <b>F</b> para registrarlo.', 'dimt');
    if (this.exitAt(sq.x, sq.y) && sq === this.cur && !this.evac) this.say('Estás en un punto de extracción. Pulsa <b>F</b> para solicitar evacuación.', 'cyan');
  }

  nm(sq) { return `<span style="color:${sq.a.color}">${esc(sq.a.nick)}</span>`; }

  // ---------------------------------------------------------------- combate
  hitChance(sq, e, ws = this.weaponStats(sq)) {
    const st = this.ast(sq);
    const es = this.est(e);
    const d = Math.hypot(e.x - sq.x, e.y - sq.y);
    let h = ws.acc + st.acc * 2 + (sq.stim > 0 ? 10 : 0) - es.ev;
    if (ws.wtype !== 'melee') {
      if (d > ws.range) h -= (d - ws.range) * 7;
      if (ws.wtype === 'sniper' && d < 2) h -= 20;
    }
    return clamp(Math.round(h), 5, 97);
  }
  canShoot(sq, e) {
    const ws = this.weaponStats(sq);
    const d = Math.hypot(e.x - sq.x, e.y - sq.y);
    if (ws.wtype === 'melee') return cheb(sq.x, sq.y, e.x, e.y) <= 1 ? 'ok' : 'melee';
    const w = this.weapon(sq);
    if (!w || w.ld <= 0) return cheb(sq.x, sq.y, e.x, e.y) <= 1 ? 'ok' : 'empty';
    if (d > ws.range * 2 + 0.5) return 'range';
    if (!hasLOS(sq.x, sq.y, e.x, e.y, (x, y) => this.opaque(x, y) || (this.blockedObj(x, y) != null))) return 'los';
    return 'ok';
  }

  attack(sq, e) {
    const reason = this.canShoot(sq, e);
    if (reason !== 'ok') {
      if (sq === this.cur) {
        const msg = { melee: 'Arma cuerpo a cuerpo: acércate al objetivo.', empty: 'Cargador vacío. Pulsa <b>R</b> para recargar.', range: 'Fuera de alcance.', los: 'No hay línea de tiro.' }[reason];
        this.say(msg, 'bad');
      }
      return false;
    }
    const w = this.weapon(sq);
    let ws = this.weaponStats(sq);
    // sin munición a quemarropa: culatazo
    if (ws.wtype !== 'melee' && (!w || w.ld <= 0)) ws = { ...FISTS, dmg: [2, 4] };
    const st = this.ast(sq);
    this.flash(sq);
    if (ws.wtype === 'flame') return this.flameAttack(sq, e, w, ws, st);
    if (ws.wtype === 'melee') {
      this.resolveHit(sq, e, ws, st, true);
      this.noise(sq.x, sq.y, ws.noise);
      return true;
    }
    const shots = Math.min(ws.burst, w.ld);
    for (let i = 0; i < shots; i++) {
      w.ld--;
      if (e.hp <= 0) break;
      if (ws.pierce >= 99) { this.pierceShot(sq, e, ws, st, i); continue; }
      this.resolveHit(sq, e, ws, st, false, i);
    }
    this.noise(sq.x, sq.y, ws.noise);
    if (w.ld === 0 && sq === this.cur) this.say('Cargador vacío.', 'warn');
    return true;
  }

  flash(sq) { this.fx.push({ type: 'muzzle', x: sq.x, y: sq.y }); }

  rollDmg(ws, st, sq, e, melee, d) {
    let dmg = rng.int(ws.dmg[0], ws.dmg[1]);
    if (melee) dmg *= 1 + (st.meleePct || 0) / 100;
    if (sq.stim > 0) dmg *= 1.3;
    if (ws.wtype === 'shotgun' && d > ws.range) dmg *= Math.max(0.35, 1 - 0.18 * (d - ws.range));
    const crit = rng.chance((ws.crit + (st.crit || 0)) / 100);
    if (crit) dmg *= 1.8;
    const es = this.est(e);
    dmg = Math.max(1, Math.round(dmg - Math.max(0, es.armor - ws.pierce)));
    return { dmg, crit };
  }

  resolveHit(sq, e, ws, st, melee, idx = 0) {
    const d = Math.hypot(e.x - sq.x, e.y - sq.y);
    const hc = this.hitChance(sq, e, ws);
    const hit = rng.int(1, 100) <= hc;
    this.fx.push({ type: melee ? 'slash' : 'shot', x0: sq.x, y0: sq.y, x1: e.x, y1: e.y, hit, delay: idx * 70, wtype: ws.wtype });
    if (!hit) {
      if (idx === 0 && sq === this.cur) this.say(`${this.nm(sq)} falla contra ${this.enm(e)}.`, 'dimt');
      this.fx.push({ type: 'miss', x: e.x, y: e.y, delay: idx * 70 + 90 });
      return;
    }
    const { dmg, crit } = this.rollDmg(ws, st, sq, e, melee, d);
    this.damageEnemy(e, dmg, sq, crit, idx * 70 + 90);
    if (ws.chain) {
      let from = e, hits = 0;
      const done = new Set([e.uid]);
      while (hits < ws.chain) {
        const nxt = this.enemies.find((o) => !done.has(o.uid) && o.hp > 0 && cheb(o.x, o.y, from.x, from.y) <= 3 && this.isVisible(o.x, o.y));
        if (!nxt) break;
        done.add(nxt.uid); hits++;
        this.fx.push({ type: 'arc', x0: from.x, y0: from.y, x1: nxt.x, y1: nxt.y, delay: 120 + hits * 80 });
        this.damageEnemy(nxt, Math.round(dmg * 0.6), sq, false, 160 + hits * 80);
        from = nxt;
      }
    }
  }

  pierceShot(sq, e, ws, st, idx) {
    const dx = e.x - sq.x, dy = e.y - sq.y;
    const len = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const ex = Math.round(sq.x + (dx / len) * ws.range), ey = Math.round(sq.y + (dy / len) * ws.range);
    const pts = line(sq.x, sq.y, ex, ey).slice(1);
    let last = [sq.x, sq.y];
    for (const [x, y] of pts) {
      if (this.opaque(x, y)) break;
      last = [x, y];
      const t = this.enemyAt(x, y);
      if (t && t.hp > 0) {
        const { dmg, crit } = this.rollDmg(ws, st, sq, t, false, Math.hypot(x - sq.x, y - sq.y));
        this.damageEnemy(t, dmg, sq, crit, 120);
      }
    }
    this.fx.push({ type: 'beam', x0: sq.x, y0: sq.y, x1: last[0], y1: last[1] });
  }

  flameAttack(sq, e, w, ws, st) {
    w.ld--;
    const dx = e.x - sq.x, dy = e.y - sq.y;
    const len = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const ex = Math.round(sq.x + (dx / len) * ws.range), ey = Math.round(sq.y + (dy / len) * ws.range);
    const pts = line(sq.x, sq.y, ex, ey).slice(1);
    let i = 0;
    for (const [x, y] of pts) {
      if (this.opaque(x, y) || !this.walkTile(x, y)) break;
      i++;
      this.igniteCell(x, y, 5);
      const t = this.enemyAt(x, y);
      if (t && t.hp > 0) {
        const { dmg, crit } = this.rollDmg(ws, st, sq, t, false, 0);
        t.burn = Math.max(t.burn, 3);
        this.damageEnemy(t, dmg, sq, crit, i * 40);
      }
      this.fx.push({ type: 'flame', x, y, delay: i * 40 });
    }
    this.noise(sq.x, sq.y, ws.noise);
    return true;
  }

  igniteCell(x, y, n) {
    if (!this.walkTile(x, y)) return;
    const tt = this.tile(x, y);
    if (tt === T.WATER || tt === T.DEEP) return;
    const k = this.key(x, y);
    this.fire[k] = Math.max(this.fire[k], n);
  }

  enm(e) { return `<span style="color:${enemyColor(ENEMIES[e.type].hue, e.lvl)}">${ENEMIES[e.type].name}</span>`; }

  damageEnemy(e, dmg, src, crit = false, delay = 0) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    this.tally.dmgDealt += dmg;
    this.fx.push({ type: 'dmg', x: e.x, y: e.y, n: dmg, crit, delay, color: crit ? '#ffffff' : '#ffd23f' });
    if (e.state !== 'alerta') { e.state = 'alerta'; e.mem = 15; this.alertNest(e); }
    if (src && src.id && crit) this.say(`¡Crítico! ${this.nm(src)} inflige ${dmg} a ${this.enm(e)}.`, 'o1');
    if (e.hp <= 0) this.killEnemy(e, src, delay);
  }

  killEnemy(e, src, delay = 0) {
    const def = ENEMIES[e.type];
    const es = this.est(e);
    e.hp = 0;
    const ei = this.enemies.indexOf(e);
    if (ei < 0) return;
    this.enemies.splice(ei, 1);
    if (this.occ.get(this.key(e.x, e.y)) === e) this.occ.delete(this.key(e.x, e.y));
    this.fx.push({ type: 'kill', x: e.x, y: e.y, glyph: def.glyph, color: enemyColor(def.hue, e.lvl), delay, boss: !!def.boss });
    // esencia
    let ess = rng.int(es.ess[0], es.ess[1]);
    if (e.spawned) ess = Math.ceil(ess * 0.3);
    const k = this.key(e.x, e.y);
    this.essence.set(k, (this.essence.get(k) || 0) + ess);
    // botín
    const dropChance = def.boss ? 1 : 0.08 + e.lvl * 0.012;
    if (rng.chance(dropChance)) {
      const n = def.boss ? 2 + rng.int(0, 1) : 1;
      for (let i = 0; i < n; i++) this.addFloor(e.x, e.y, rollLoot(e.lvl, rng, { rarityBonus: def.boss ? 0.8 : 0 }));
    }
    if (def.boss) this.addFloor(e.x, e.y, createItem('crystal', rng.int(2, 4), rng));
    this.tally.kills++;
    S.stats.kills++;
    bestiaryKill(e.type);
    if (src && src.id) {
      src.kills++;
      src.a.kills = (src.a.kills || 0) + 1;
      src.xp += es.xp;
      const ups = giveXp(src.a, es.xp);
      if (ups) { this.say(`★ ${this.nm(src)} sube a nivel ${src.a.lvl}.`, 'good'); this.fx.push({ type: 'levelup', x: src.x, y: src.y }); }
    }
    this.say(`${src && src.id ? this.nm(src) + ' elimina' : 'Muere'} ${this.enm(e)} (Nv ${e.lvl}).`, def.boss ? 'warn' : '');
    if (def.boss) this.say(`☠ ¡${def.name} ha caído! Su esencia brilla en el suelo.`, 'warn');
    // nido despejado
    if (e.poi != null && this.pois[e.poi] && this.pois[e.poi].type === 'nest') {
      const p = this.pois[e.poi];
      if (!p.cleared && !this.enemies.some((o) => o.poi === e.poi && !o.spawned)) {
        p.cleared = true;
        this.say(`✓ ${p.name} despejado.`, 'good');
      }
    }
  }

  alertNest(e) {
    if (e.poi == null) return;
    for (const o of this.enemies) if (o.poi === e.poi && o.state === 'dormido' && cheb(o.x, o.y, e.x, e.y) <= 12) { o.state = 'alerta'; o.mem = 15; }
  }

  noise(x, y, r) {
    if (r <= 0) return;
    for (const e of this.enemies) {
      if (e.state === 'alerta') { if (Math.hypot(e.x - x, e.y - y) <= r) e.mem = Math.max(e.mem, 12); continue; }
      if (Math.hypot(e.x - x, e.y - y) <= r) { e.state = 'alerta'; e.mem = 12; }
    }
  }

  damageAgent(sq, dmg, cause, srcE = null, delay = 0) {
    if (!this.inMap(sq)) return;
    sq.a.hp -= dmg;
    this.tally.dmgTaken += dmg;
    this.fx.push({ type: 'dmg', x: sq.x, y: sq.y, n: dmg, delay, color: '#ff3b30', agent: true });
    this.fx.push({ type: 'hurt', x: sq.x, y: sq.y, delay });
    this.interrupt = true;
    if (sq.a.hp <= 0) this.agentDies(sq, cause);
  }

  agentDies(sq, cause) {
    const a = sq.a;
    a.hp = 0;
    sq.alive = false;
    sq.snap = { id: a.id, first: a.first, last: a.last, nick: a.nick, lvl: a.lvl, color: a.color, hp: 0, rad: a.rad, equip: {}, bag: [], baseHp: a.baseHp, acc: a.acc, ev: a.ev, trait: a.trait };
    this.occ.delete(this.key(sq.x, sq.y));
    this.fx.push({ type: 'death', x: sq.x, y: sq.y, color: a.color });
    this.say(`✝ ${this.nm(sq)} ha muerto (${cause}). Todo su equipo se pierde en las profundidades.`, 'bad');
    const i = S.agents.indexOf(a);
    if (i >= 0) S.agents.splice(i, 1);
    S.fallen.unshift({ name: agentName(a), lvl: a.lvl, day: S.day, map: this.def.name, cause, kills: a.kills || 0, missions: a.missions || 0 });
    S.stats.deaths++;
    this.emit('death', sq);
    this.checkActive();
  }

  checkActive() {
    if (!this.team.length) { this.finish(); return; }
    if (!this.inMap(this.cur)) {
      this.active = this.squad.indexOf(this.team[0]);
      this.emit('switch');
    }
  }

  // ---------------------------------------------------------------- objetos e interacción
  interact() {
    return this.act((sq) => {
      // 1. extracción
      const ex = this.exitAt(sq.x, sq.y);
      if (ex) return this.requestEvac(sq, ex);
      // 2. contenedor / veta adyacentes o en la casilla
      for (const [dx, dy] of [[0, 0], ...D8]) {
        const o = this.objAt(sq.x + dx, sq.y + dy);
        if (o && (o.kind === 'vein' ? o.amount > 0 : !o.opened || (o.items && o.items.length))) return this.interactObj(sq, o);
      }
      // 3. objetos en el suelo
      if (this.floorAt(sq.x, sq.y).length) { this.emit('loot', { floor: true, x: sq.x, y: sq.y }); return false; }
      this.say('No hay nada con lo que interactuar.', 'dimt');
      return false;
    });
  }

  interactObj(sq, o) {
    if (o.kind === 'vein') return this.mine(sq, o);
    if (!o.opened) {
      o.opened = true;
      const names = { cache: 'el alijo', locker: 'la taquilla', crate: 'la caja', corpse: 'el cadáver' };
      this.say(`${this.nm(sq)} registra ${names[o.kind]}${o.items.length ? '.' : ': vacío.'}`);
      this.fx.push({ type: 'open', x: o.x, y: o.y });
      this.noise(sq.x, sq.y, 2);
      if (o.kind === 'cache') { const p = this.pois.find((pp) => pp.type === 'cache' && pp.x === o.x && pp.y === o.y); if (p) p.cleared = true; }
      if (o.items.length && sq === this.cur) this.emit('loot', { obj: o });
      this.dirty = true;
      return true;
    }
    if (o.items && o.items.length && sq === this.cur) { this.emit('loot', { obj: o }); return false; }
    return false;
  }

  mine(sq, o) {
    if (o.amount <= 0) { this.say('La veta está agotada.', 'dimt'); return false; }
    const st = this.ast(sq);
    let n = rng.int(3, 6) * (st.mining ? 2 : 1);
    n = Math.min(n, o.amount);
    o.amount -= n;
    const gain = Math.max(1, Math.round(n * (1 + st.essence / 100)));
    sq.ess += gain; this.tally.essence += gain;
    this.fx.push({ type: 'mine', x: o.x, y: o.y, tx: sq.x, ty: sq.y, n: gain });
    this.noise(o.x, o.y, 7);
    this.say(`${this.nm(sq)} extrae <span class="cyan">${gain} ✦</span> de la veta${o.amount <= 0 ? ' (agotada)' : ` (quedan ~${o.amount})`}. El ruido resuena por los túneles...`);
    if (o.amount <= 0) { const p = this.pois.find((pp) => pp.type === 'vein' && pp.x === o.x && pp.y === o.y); if (p) p.cleared = true; }
    this.dirty = true;
    return true;
  }

  // mover objeto de un contenedor/suelo a la mochila del agente activo (sin coste de turno)
  bagFull(sq) { return sq.a.bag.length >= bagCapacity(sq.a); }
  takeItem(sq, list, it) {
    const i = list.indexOf(it);
    if (i < 0) return false;
    const rest = mergeInto(sq.a.bag, it, bagCapacity(sq.a));
    if (rest) { this.say('Mochila llena.', 'bad'); return false; }
    list.splice(i, 1);
    this.tally.items++;
    this.say(`${this.nm(sq)} coge <span style="color:${rarityColor(it.r)}">${esc(itemName(it))}${it.q > 1 ? ' ×' + it.q : ''}</span>.`);
    this.fx.push({ type: 'pickup', x: sq.x, y: sq.y, color: rarityColor(it.r) });
    this.cleanFloor();
    this.emit('update');
    return true;
  }
  cleanFloor() { for (const [k, v] of this.floorItems) if (!v.length) this.floorItems.delete(k); this.dirty = true; }
  dropItem(sq, it) {
    const a = sq.a;
    let i = a.bag.indexOf(it);
    if (i >= 0) a.bag.splice(i, 1);
    else {
      const slot = Object.keys(a.equip).find((s) => a.equip[s] === it);
      if (!slot) return false;
      a.equip[slot] = null;
    }
    this.addFloor(sq.x, sq.y, it);
    this.say(`${this.nm(sq)} suelta ${esc(itemName(it))}.`, 'dimt');
    this.dirty = true;
    this.emit('update');
    return true;
  }

  // ---------------------------------------------------------------- objetos usables
  reload(sq = this.cur, silent = false) {
    const w = this.weapon(sq);
    if (!w) return false;
    const ws = itemStats(w);
    if (!ws.mag) { if (!silent) this.say('Esta arma no usa munición.', 'dimt'); return false; }
    if (w.ld >= ws.mag) { if (!silent) this.say('El cargador ya está lleno.', 'dimt'); return false; }
    let need = ws.mag - w.ld;
    let got = 0;
    for (const it of sq.a.bag) {
      if (it.b !== ws.ammo || need <= 0) continue;
      const mv = Math.min(it.q, need);
      it.q -= mv; need -= mv; got += mv;
    }
    sq.a.bag = sq.a.bag.filter((it) => !(it.q !== undefined && it.q <= 0));
    if (!got) { if (!silent) this.say(`Sin munición de ${ITEMS[ws.ammo].name.replace('Munición ', '')} en la mochila.`, 'bad'); return false; }
    w.ld += got;
    this.fx.push({ type: 'reload', x: sq.x, y: sq.y });
    if (!silent || sq === this.cur) this.say(`${this.nm(sq)} recarga (${w.ld}/${ws.mag}).`, 'dimt');
    return true;
  }
  ammoFor(sq, w = this.weapon(sq)) {
    if (!w) return 0;
    const ws = itemStats(w);
    if (!ws.ammo) return 0;
    return sq.a.bag.reduce((s, it) => s + (it.b === ws.ammo ? it.q : 0), 0);
  }
  swapWeapon() {
    const sq = this.cur;
    const other = sq.cur === 'w1' ? 'w2' : 'w1';
    if (!sq.a.equip[other] && !sq.a.equip[sq.cur]) return false;
    sq.cur = other;
    const w = this.weapon(sq);
    this.say(`${this.nm(sq)} empuña ${w ? esc(itemName(w)) : 'los puños'}.`, 'dimt');
    this.emit('update');
    return false;
  }

  useItem(sq, it) {
    const d = ITEMS[it.b];
    if (d.cat !== 'consumable') return false;
    const a = sq.a;
    const st = this.ast(sq);
    if (d.use === 'heal') {
      const heal = d.heal >= 999 ? 999 : Math.round(d.heal * (1 + st.healPct / 100));
      const before = a.hp;
      a.hp = Math.min(st.hpMaxEff, a.hp + heal);
      if (d.cure) sq.poison = 0;
      if (d.radHeal) a.rad = Math.max(0, a.rad - d.radHeal);
      this.say(`${this.nm(sq)} usa ${d.name} (+${a.hp - before} salud).`, 'good');
      this.fx.push({ type: 'heal', x: sq.x, y: sq.y });
    } else if (d.use === 'antirad') {
      a.rad = Math.max(0, a.rad - d.radHeal);
      this.say(`${this.nm(sq)} toma ${d.name} (−${d.radHeal} rad).`, 'good');
      this.fx.push({ type: 'heal', x: sq.x, y: sq.y, color: '#b8f53d' });
    } else if (d.use === 'stim') {
      sq.stim = d.turns;
      this.say(`${this.nm(sq)} se inyecta ${d.name}. ¡Furia!`, 'warn');
      this.fx.push({ type: 'heal', x: sq.x, y: sq.y, color: '#ff5050' });
    } else if (d.use === 'beacon') {
      this.pending.push({ x: sq.x, y: sq.y, at: this.turn + 6 });
      this.say('Baliza activada. Extracción de emergencia en 6 turnos en esta posición.', 'cyan');
    } else return false;
    this.consume(sq, it);
    return true;
  }
  consume(sq, it) {
    it.q = (it.q || 1) - 1;
    if (it.q <= 0) sq.a.bag.splice(sq.a.bag.indexOf(it), 1);
  }

  throwAt(sq, it, tx, ty) {
    const d = ITEMS[it.b];
    if (Math.hypot(tx - sq.x, ty - sq.y) > d.range + 0.5) { this.say('Demasiado lejos.', 'bad'); return false; }
    if (!hasLOS(sq.x, sq.y, tx, ty, (x, y) => this.opaque(x, y))) { this.say('No hay línea de lanzamiento.', 'bad'); return false; }
    this.consume(sq, it);
    this.fx.push({ type: 'throw', x0: sq.x, y0: sq.y, x1: tx, y1: ty, glyph: d.glyph });
    if (d.lure) {
      this.flares.push({ x: tx, y: ty, t: 20 });
      for (const e of this.enemies) if (Math.hypot(e.x - tx, e.y - ty) <= 14 && !ENEMIES[e.type].abil.includes('stationary')) { e.lure = { x: tx, y: ty, t: 10 }; if (e.state === 'dormido') e.state = 'errante'; }
      this.say(`${this.nm(sq)} lanza una bengala. La luz atrae a los chebylitas.`, 'o1');
      this.fx.push({ type: 'flare', x: tx, y: ty, delay: 250 });
      this.computeVisibility();
      return true;
    }
    this.say(`${this.nm(sq)} lanza ${d.name}.`, 'o1');
    this.explode(tx, ty, d.blast, d.dmg, sq, !!d.fire, 260);
    return true;
  }

  explode(x, y, r, dmgR, src, fire = false, delay = 0) {
    this.fx.push({ type: 'explosion', x, y, r, delay, fire });
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (!this.inb(xx, yy) || Math.hypot(xx - x, yy - y) > r + 0.5) continue;
      if (!hasLOS(x, y, xx, yy, (a, b) => this.opaque(a, b))) continue;
      if (fire) this.igniteCell(xx, yy, 6);
      const ent = this.entityAt(xx, yy);
      if (!ent) continue;
      const dmg = rng.int(dmgR[0], dmgR[1]);
      if (ent.type) { this.damageEnemy(ent, Math.max(1, dmg - this.est(ent).armor), src, false, delay + 60); if (fire && ent.hp > 0) ent.burn = 3; }
      else if (ent.id) this.damageAgent(ent, Math.max(1, dmg - this.ast(ent).prot), 'explosión', null, delay + 60);
    }
    this.noise(x, y, 14);
  }

  equipItem(sq, it, slot) {
    const a = sq.a;
    const bi = a.bag.indexOf(it);
    const prev = a.equip[slot];
    const fromSlot = Object.keys(a.equip).find((s) => a.equip[s] === it);
    if (fromSlot) { a.equip[fromSlot] = prev; a.equip[slot] = it; }
    else if (bi >= 0) { a.bag.splice(bi, 1); a.equip[slot] = it; if (prev) a.bag.push(prev); }
    else return false;
    const st = agentStats(a);
    if (a.hp > st.hpMaxEff) a.hp = st.hpMaxEff;
    return true;
  }

  // ---------------------------------------------------------------- extracción
  exitAt(x, y) { return this.exits.find((ex) => cheb(ex.x, ex.y, x, y) <= 1 && (ex.perm || ex.expires > this.turn)); }
  requestEvac(sq, ex) {
    if (this.evac) { this.say(`La evacuación ya está en marcha (${this.evac.left} turnos).`, 'cyan'); return false; }
    this.evac = { x: ex.x, y: ex.y, left: 3, name: ex.name };
    if (!ex.perm) ex.expires = Math.max(ex.expires, this.turn + 5);
    this.say(`Evacuación solicitada en ${ex.name}. Mantened la posición <b>3 turnos</b>: todos los agentes en la zona serán extraídos.`, 'cyan');
    this.fx.push({ type: 'evac', x: ex.x, y: ex.y });
    this.noise(ex.x, ex.y, 9);
    return true;
  }

  spawnTempExit(x, y, dur, name) {
    this.exits.push({ x, y, perm: false, expires: this.turn + dur, appeared: this.turn, name });
    this.fx.push({ type: 'newexit', x, y });
    this.emit('tempexit', { x, y, dur, name });
  }

  findTempExitSpot() {
    const team = this.team;
    for (let i = 0; i < 600; i++) {
      const x = rng.int(3, this.w - 4), y = rng.int(3, this.h - 4);
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) {
        const tt = this.tile(x + dx, y + dy);
        if (!TILES[tt].walk || tt === T.WATER || tt === T.DOOR || this.blockedObj(x + dx, y + dy)) ok = false;
      }
      if (!ok) continue;
      const dmin = Math.min(...team.map((s) => Math.hypot(s.x - x, s.y - y)));
      if (dmin < 10 || dmin > 50) continue;
      return [x, y];
    }
    return null;
  }

  extract(sq) {
    sq.out = true;
    this.occ.delete(this.key(sq.x, sq.y));
    this.fx.push({ type: 'extract', x: sq.x, y: sq.y, color: sq.a.color });
    this.say(`⇑ ${this.nm(sq)} ha sido extraído con ${sq.ess} ✦.`, 'cyan');
  }

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
      e.energy += ENEMIES[e.type].speed;
      while (e.energy >= 100 && e.hp > 0 && !this.ended) {
        e.energy -= 100;
        this.enemyAct(e);
      }
      if (this.ended) return;
    }
    this.environment();
    if (this.ended) return;
    this.turn++;
    S.stats.turns++;
    this.computeVisibility();
    this.emit('turn');
  }

  // ---------------------------------------------------------------- IA de compañeros
  companionAct(sq) {
    const a = sq.a;
    const st = this.ast(sq);
    // curarse si está mal
    if (a.hp < st.hpMaxEff * 0.35) {
      const heal = a.bag.filter((it) => ITEMS[it.b].use === 'heal').sort((x, y) => ITEMS[x.b].heal - ITEMS[y.b].heal)[0];
      if (heal) { this.useItem(sq, heal); return; }
    }
    const ws = this.weaponStats(sq);
    const w = this.weapon(sq);
    // disparar
    if (sq.order !== 'pasivo') {
      let best = null, bd = 1e9;
      for (const e of this.enemies) {
        if (!this.isVisible(e.x, e.y)) continue;
        const d = Math.hypot(e.x - sq.x, e.y - sq.y);
        if (d < bd && this.canShoot(sq, e) === 'ok' && (ws.wtype !== 'melee' ? d <= ws.range * 1.5 : true)) { best = e; bd = d; }
      }
      if (best) { this.attack(sq, best); return; }
      // recargar si está vacío y hay enemigos cerca
      if (w && ws.mag && w.ld < ws.mag * 0.3 && this.ammoFor(sq) > 0) { this.reload(sq, true); return; }
      // cambiar a la otra arma si esta está seca
      if (w && ws.mag && w.ld === 0 && this.ammoFor(sq) === 0) {
        const other = sq.cur === 'w1' ? 'w2' : 'w1';
        if (a.equip[other]) { sq.cur = other; return; }
      }
    }
    if (sq.order === 'mantener') return;
    // seguir al líder (o acudir a la evacuación)
    let lead = this.cur;
    let near = 2;
    if (this.evac) {
      if (cheb(sq.x, sq.y, this.evac.x, this.evac.y) <= 1) return;
      lead = { x: this.evac.x, y: this.evac.y };
      near = 0;
    }
    const d = cheb(sq.x, sq.y, lead.x, lead.y);
    if (d <= near) return;
    const path = astar(this.w, this.h, sq.x, sq.y, lead.x, lead.y, (x, y) => (this.passable(x, y) && !this.enemyAt(x, y) ? (this.agentAt(x, y) ? 4 : this.hazardCost(x, y)) : Infinity), 2500);
    if (path && (path.length > 1 || (this.evac && path.length))) {
      const [nx, ny] = path[0];
      if (!this.entityAt(nx, ny)) {
        if (this.tile(nx, ny) === T.DOOR) this.t[this.key(nx, ny)] = T.DOOR_OPEN;
        this.moveEntity(sq, nx, ny); this.onAgentEnter(sq);
      }
    }
  }
  hazardCost(x, y) {
    const k = this.key(x, y);
    return 1 + (this.fire[k] ? 8 : 0) + (this.gas[k] ? 4 : 0) + (this.anomaly[k] ? 5 : 0) + (this.rad[k] > 1 ? 2 : 0);
  }

  // ---------------------------------------------------------------- IA enemiga
  getDmap() {
    if (!this.dmap) {
      const goals = this.team.map((s) => [s.x, s.y]);
      this.dmap = dijkstra(this.w, this.h, goals, (x, y) => this.walkTile(x, y) && !this.blockedObj(x, y), 60);
    }
    return this.dmap;
  }
  canEnemyStep(e, x, y) {
    if (!this.inb(x, y)) return false;
    const tt = this.tile(x, y);
    const def = ENEMIES[e.type];
    if (!TILES[tt].walk && !(tt === T.DEEP && def.abil.includes('flying'))) return false;
    if (this.blockedObj(x, y)) return false;
    if (this.entityAt(x, y)) return false;
    return true;
  }
  enemyStepTo(e, x, y) {
    if (this.tile(x, y) === T.DOOR) { this.t[this.key(x, y)] = T.DOOR_OPEN; this.dirty = true; }
    this.moveEntity(e, x, y);
  }
  enemyLOS(e, sq) { return hasLOS(e.x, e.y, sq.x, sq.y, (x, y) => this.opaque(x, y)); }

  enemyAct(e) {
    const def = ENEMIES[e.type];
    const abil = def.abil;
    const st = this.est(e);
    // objetivo visible más cercano
    let tgt = null, td = 1e9;
    const sight = e.state === 'dormido' ? 4 + Math.floor(e.lvl / 3) : 11;
    for (const sq of this.team) {
      const d = Math.hypot(sq.x - e.x, sq.y - e.y);
      if (d <= sight && d < td && this.enemyLOS(e, sq)) { tgt = sq; td = d; }
    }
    if (e.state === 'dormido') {
      if (tgt) { e.state = 'alerta'; e.mem = 15; this.alertNest(e); this.fx.push({ type: 'wake', x: e.x, y: e.y }); }
      return;
    }
    if (tgt) { e.state = 'alerta'; e.mem = 15; e.lure = null; }
    // señuelo
    if (e.lure && e.lure.t > 0 && !tgt) {
      e.lure.t--;
      this.greedyStep(e, e.lure.x, e.lure.y);
      return;
    }
    if (e.state === 'errante' && !tgt) { this.wander(e); return; }
    if (!tgt) {
      e.mem--;
      if (e.mem <= 0) { e.state = 'errante'; return; }
      if (!abil.includes('stationary')) this.followDmap(e);
      return;
    }
    // habilidades
    const adj = cheb(e.x, e.y, tgt.x, tgt.y) <= 1;
    if (abil.includes('explode') && adj) { this.sporeBurst(e); return; }
    if (abil.includes('spawn')) {
      e.cd = (e.cd || 0) - 1;
      if (e.cd <= 0 && e.kids < 4) {
        e.cd = 6;
        const spot = D8.map(([dx, dy]) => [e.x + dx, e.y + dy]).find(([x, y]) => this.canEnemyStep(e, x, y));
        if (spot) {
          const c = this.spawnEnemy('musgo', e.lvl, spot[0], spot[1], 'alerta', e.poi);
          c.spawned = 1; e.kids++;
          this.fx.push({ type: 'spawn', x: spot[0], y: spot[1] });
          if (this.isVisible(e.x, e.y)) this.say(`${this.enm(e)} engendra un ${this.enm(c)}.`, 'warn');
          return;
        }
      }
    }
    if (abil.includes('summon')) {
      e.cd = (e.cd || 0) - 1;
      if (e.cd <= 0) {
        e.cd = 8;
        let n = 0;
        for (const [dx, dy] of rng.shuffle([...D8])) {
          if (n >= 2) break;
          const x = e.x + dx * 2, y = e.y + dy * 2;
          if (this.canEnemyStep(e, x, y)) { const c = this.spawnEnemy('lobo', Math.max(1, e.lvl - 2), x, y, 'alerta', e.poi); c.spawned = 1; n++; this.fx.push({ type: 'spawn', x, y }); }
        }
        if (n) { this.say(`${this.enm(e)} aúlla: ¡acuden lobos de grafito!`, 'warn'); return; }
      }
    }
    if (abil.includes('charge') && !adj) {
      e.cd2 = (e.cd2 || 0) - 1;
      const dx = tgt.x - e.x, dy = tgt.y - e.y;
      const straight = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
      if (straight && td <= 5 && e.cd2 <= 0) {
        e.cd2 = 4;
        const sx = Math.sign(dx), sy = Math.sign(dy);
        let moved = 0;
        while (cheb(e.x, e.y, tgt.x, tgt.y) > 1 && this.canEnemyStep(e, e.x + sx, e.y + sy)) { this.enemyStepTo(e, e.x + sx, e.y + sy); moved++; }
        this.fx.push({ type: 'charge', x: e.x, y: e.y });
        if (cheb(e.x, e.y, tgt.x, tgt.y) <= 1) { this.enemyMelee(e, tgt, 1.6, 'embestida'); return; }
        if (moved) return;
      }
    }
    const reach = def.range;
    if (abil.includes('ranged') && td <= reach && !(adj && reach <= 1)) { this.enemyRanged(e, tgt); return; }
    if (td <= (reach >= 2 && !abil.includes('ranged') ? reach + 0.5 : 1.5)) { this.enemyMelee(e, tgt); return; }
    if (abil.includes('stationary')) return;
    if (abil.includes('erratic') && rng.chance(0.3)) { this.randomStep(e); return; }
    this.followDmap(e);
  }

  followDmap(e) {
    const dm = this.getDmap();
    const cur = dm[this.key(e.x, e.y)];
    let best = null, bv = cur;
    for (const [dx, dy] of rng.shuffle([...D8])) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!this.canEnemyStep(e, nx, ny)) continue;
      const v = dm[this.key(nx, ny)];
      if (v < bv) { bv = v; best = [nx, ny]; }
    }
    if (best) this.enemyStepTo(e, best[0], best[1]);
    else if (cur === 32767) this.wander(e);
  }
  greedyStep(e, tx, ty) {
    let best = null, bd = Math.hypot(tx - e.x, ty - e.y);
    for (const [dx, dy] of D8) {
      const nx = e.x + dx, ny = e.y + dy;
      if (!this.canEnemyStep(e, nx, ny)) continue;
      const d = Math.hypot(tx - nx, ty - ny);
      if (d < bd - 0.01) { bd = d; best = [nx, ny]; }
    }
    if (best) { this.enemyStepTo(e, best[0], best[1]); return true; }
    return false;
  }
  randomStep(e) {
    const opts = D8.map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => this.canEnemyStep(e, x, y));
    if (opts.length) { const [x, y] = rng.pick(opts); this.enemyStepTo(e, x, y); }
  }
  wander(e) {
    if (ENEMIES[e.type].abil.includes('stationary')) return;
    if (ENEMIES[e.type].abil.includes('erratic') && rng.chance(0.5)) { this.randomStep(e); return; }
    if (!e.wt || (e.x === e.wt[0] && e.y === e.wt[1]) || rng.chance(0.04)) {
      for (let i = 0; i < 20; i++) {
        const x = e.x + rng.int(-12, 12), y = e.y + rng.int(-12, 12);
        if (this.passable(x, y)) { e.wt = [x, y]; break; }
      }
    }
    if (rng.chance(0.5)) return; // los errantes se mueven despacio
    if (e.wt && !this.greedyStep(e, e.wt[0], e.wt[1])) { e.wt = null; this.randomStep(e); }
  }

  enemyMelee(e, sq, mult = 1, verb = null) {
    const def = ENEMIES[e.type];
    const st = this.est(e);
    const ast = this.ast(sq);
    const hc = clamp(st.acc - ast.ev * 2, 5, 95);
    this.fx.push({ type: 'bite', x0: e.x, y0: e.y, x1: sq.x, y1: sq.y, color: enemyColor(def.hue, e.lvl) });
    if (rng.int(1, 100) > hc) { this.fx.push({ type: 'miss', x: sq.x, y: sq.y, delay: 80 }); return; }
    let dmg = Math.round(rng.int(st.dmg[0], st.dmg[1]) * mult);
    dmg = Math.max(1, dmg - ast.prot);
    if (sq === this.cur || def.boss) this.say(`${this.enm(e)} ${verb ? 'te golpea con una ' + verb : 'ataca a'} ${this.nm(sq)}: <span class="bad">−${dmg}</span>.`);
    this.damageAgent(sq, dmg, `${def.name} Nv ${e.lvl}`, e, 80);
    if (!this.inMap(sq)) return;
    if (def.abil.includes('poison')) { sq.poison = Math.min(12, sq.poison + 2 + Math.floor(e.lvl / 3)); }
    if (def.abil.includes('radbite')) sq.a.rad += (2 + e.lvl) * (1 - ast.rad / 100);
  }
  enemyRanged(e, sq) {
    const def = ENEMIES[e.type];
    const st = this.est(e);
    const ast = this.ast(sq);
    const d = Math.hypot(sq.x - e.x, sq.y - e.y);
    const hc = clamp(st.acc - ast.ev * 2 - Math.max(0, d - 4) * 3, 5, 95);
    const hit = rng.int(1, 100) <= hc;
    this.fx.push({ type: 'ebolt', x0: e.x, y0: e.y, x1: sq.x, y1: sq.y, hit, color: enemyColor(def.hue, Math.max(6, e.lvl)) });
    if (!hit) { this.fx.push({ type: 'miss', x: sq.x, y: sq.y, delay: 140 }); return; }
    const dmg = Math.max(1, rng.int(st.dmg[0], st.dmg[1]) - ast.prot);
    this.say(`${this.enm(e)} alcanza a ${this.nm(sq)}: <span class="bad">−${dmg}</span>.`);
    this.damageAgent(sq, dmg, `${def.name} Nv ${e.lvl}`, e, 140);
    if (this.inMap(sq) && def.abil.includes('radbite')) sq.a.rad += (2 + e.lvl * 0.8) * (1 - ast.rad / 100);
  }
  sporeBurst(e) {
    const r = 2;
    for (let y = e.y - r; y <= e.y + r; y++) for (let x = e.x - r; x <= e.x + r; x++) {
      if (this.walkTile(x, y) && Math.hypot(x - e.x, y - e.y) <= r + 0.5) this.gas[this.key(x, y)] = Math.max(this.gas[this.key(x, y)], 7);
    }
    this.fx.push({ type: 'spores', x: e.x, y: e.y });
    if (this.isVisible(e.x, e.y)) this.say(`¡${this.enm(e)} revienta en una nube de esporas!`, 'warn');
    for (const sq of this.team) if (cheb(sq.x, sq.y, e.x, e.y) <= 1) this.damageAgent(sq, Math.max(1, rng.int(2, 4) + e.lvl - this.ast(sq).prot), 'esporas');
    this.killEnemy(e, null);
  }

  // ---------------------------------------------------------------- entorno
  environment() {
    const N = this.w * this.h;
    // respiraderos de gas
    for (const v of this.vents) {
      if (rng.chance(0.5)) {
        for (let i = 0; i < 4; i++) {
          const x = v.x + rng.int(-2, 2), y = v.y + rng.int(-2, 2);
          if (this.walkTile(x, y)) this.gas[this.key(x, y)] = Math.max(this.gas[this.key(x, y)], rng.int(3, 6));
        }
      }
    }
    // gas: difusión y disipación
    const ng = new Uint8Array(this.gas);
    for (let k = 0; k < N; k++) {
      const g = this.gas[k];
      if (!g) continue;
      ng[k] = Math.max(0, ng[k] - 1);
      if (g > 2 && rng.chance(0.5)) {
        const x = k % this.w, y = (k / this.w) | 0;
        const [dx, dy] = rng.pick(D8);
        if (this.walkTile(x + dx, y + dy)) { const nk = this.key(x + dx, y + dy); ng[nk] = Math.max(ng[nk], g - 2); }
      }
    }
    this.gas = ng;
    // fuego
    for (let k = 0; k < N; k++) {
      const f = this.fire[k];
      if (!f) continue;
      this.fire[k] = f - 1;
      if (f > 3 && rng.chance(0.08)) {
        const x = k % this.w, y = (k / this.w) | 0;
        const [dx, dy] = rng.pick(D8);
        this.igniteCell(x + dx, y + dy, f - 2);
      }
    }
    // bengalas
    for (const f of this.flares) f.t--;
    this.flares = this.flares.filter((f) => f.t > 0);
    // pulso del reactor
    const surge = this.turn >= this.surgeAt ? 1 + Math.floor((this.turn - this.surgeAt) / 40) : 0;
    if (this.turn === this.surgeAt - 60) this.say('☢ El dosímetro de la base detecta actividad en el reactor. Pulso estimado en 60 turnos.', 'warn');
    if (this.turn === this.surgeAt - 20) this.say('☢ ¡PULSO INMINENTE! 20 turnos. Buscad una extracción.', 'bad');
    if (this.turn === this.surgeAt) { this.say('☢☢ ¡PULSO DEL REACTOR! La radiación ambiente aumenta sin parar.', 'bad'); this.fx.push({ type: 'surge' }); }
    // agentes
    for (const sq of this.team) {
      const a = sq.a, st = this.ast(sq), k = this.key(sq.x, sq.y);
      // radiación
      let r = this.rad[k] + this.ambient + surge * 0.45;
      for (const e of this.enemies) if (ENEMIES[e.type].abil.includes('aura') && cheb(e.x, e.y, sq.x, sq.y) <= 2) r += 3 + e.lvl * 0.4;
      for (const it of a.bag) if (ITEMS[it.b].radioactive) r += 0.6;
      a.rad = Math.min(150, a.rad + r * (1 - st.rad / 100));
      if (a.rad >= 100) this.damageAgent(sq, 1, 'envenenamiento por radiación');
      if (!this.inMap(sq)) continue;
      if (this.gas[k] && !st.gasImmune) { sq.poison = Math.min(12, sq.poison + 1); this.damageAgent(sq, 1, 'gas de esporas'); }
      if (!this.inMap(sq)) continue;
      if (this.fire[k]) { sq.burn = 2; this.damageAgent(sq, rng.int(2, 5), 'quemaduras'); }
      if (!this.inMap(sq)) continue;
      if (this.anomaly[k] && rng.chance(0.5)) { this.fx.push({ type: 'zap', x: sq.x, y: sq.y }); this.damageAgent(sq, rng.int(4, 9), 'anomalía eléctrica'); if (sq === this.cur) this.say('¡Descarga eléctrica!', 'bad'); }
      if (!this.inMap(sq)) continue;
      if (sq.poison > 0) { sq.poison--; this.damageAgent(sq, 1, 'veneno'); }
      if (!this.inMap(sq)) continue;
      if (sq.burn > 0) { sq.burn--; this.damageAgent(sq, 2, 'quemaduras'); }
      if (!this.inMap(sq)) continue;
      if (sq.stim > 0) sq.stim--;
      if (st.regen > 0) {
        sq.regenT++;
        if (sq.regenT >= Math.max(1, 6 - st.regen * 2)) { sq.regenT = 0; a.hp = Math.min(st.hpMaxEff, a.hp + 1); }
      }
      if (a.hp > st.hpMaxEff) a.hp = st.hpMaxEff;
    }
    if (this.ended) return;
    // enemigos
    for (const e of [...this.enemies]) {
      const k = this.key(e.x, e.y);
      const def = ENEMIES[e.type];
      if (this.fire[k]) e.burn = Math.max(e.burn, 2);
      if (this.gas[k] && def.origin !== 'Hongo' && def.origin !== 'Planta' && def.origin !== 'Mineral') this.damageEnemy(e, 1, null);
      if (e.hp > 0 && this.anomaly[k] && rng.chance(0.4)) { this.fx.push({ type: 'zap', x: e.x, y: e.y }); this.damageEnemy(e, rng.int(4, 9), null); }
      if (e.hp > 0 && e.burn > 0) { e.burn--; this.damageEnemy(e, rng.int(2, 4), null); }
    }
    // extracciones temporales
    for (const ex of this.exits) {
      if (!ex.perm && ex.expires === this.turn + 5) this.say(`La extracción temporal «${ex.name}» se cerrará en 5 turnos.`, 'warn');
    }
    this.exits = this.exits.filter((ex) => ex.perm || ex.expires > this.turn || (this.evac && this.evac.x === ex.x && this.evac.y === ex.y));
    for (const p of [...this.pending]) {
      if (p.at <= this.turn) {
        this.pending.splice(this.pending.indexOf(p), 1);
        this.spawnTempExit(p.x, p.y, 15, 'Baliza de emergencia');
        this.say('⌂ La baliza ha abierto una extracción de emergencia.', 'cyan');
      }
    }
    if (this.turn >= this.nextTemp) {
      this.nextTemp = this.turn + rng.int(70, 120) - S.modules.radar * 9;
      const spot = this.findTempExitSpot();
      if (spot) {
        const names = ['Grieta al exterior', 'Montacargas de emergencia', 'Conducto de ventilación', 'Escalera de incendios', 'Pozo de drenaje'];
        const dur = rng.int(28, 42) + S.modules.radar * 4;
        const nm = rng.pick(names);
        const s = this.sectorAt(spot[0], spot[1]);
        this.spawnTempExit(spot[0], spot[1], dur, nm);
        this.say(`📻 RADIO: «Extracción temporal abierta: <span class="cyan">${nm}</span>${s ? ' en el sector ' + s.code : ''}. Disponible ${dur} turnos.»`, 'cyan');
      }
    }
    // evacuación
    if (this.evac) {
      this.evac.left--;
      if (this.evac.left <= 0) {
        const ev = this.evac;
        this.evac = null;
        const inZone = this.team.filter((sq) => cheb(sq.x, sq.y, ev.x, ev.y) <= 1);
        if (!inZone.length) this.say('La evacuación llega... pero no hay nadie en la zona. Se retira.', 'bad');
        for (const sq of inZone) this.extract(sq);
        this.checkActive();
      } else this.say(`Evacuación en ${this.evac.left}...`, 'cyan');
    }
  }

  // ---------------------------------------------------------------- final
  finish() {
    if (this.ended) return;
    this.ended = true;
    this.emit('end');
  }
}

export function countItems(a) {
  return Object.values(a.equip).filter(Boolean).length + a.bag.length;
}
