// Expedición · Compañeros mecánicos (fase 19): perro robot Laika-M, drones y torreta «Gnomo»
// (métodos mezclados en Expedition: ver expedition.js)
import { rng, cheb } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { ITEMS } from '../data/items.js';
import { ACTORS } from '../data/actors.js';
import { DOG_ORDERS } from '../data/companions.js';
import { createItem, itemName, itemValue, mergeInto } from '../core/items.js';
import { bagCapacity } from '../core/agents.js';
import { esc } from '../util/dom.js';
import { S } from '../core/state.js';
import { astar } from './path.js';
import { D8 } from './shared.js';

const ORDER_CYCLE = ['seguir', 'quedarse', 'buscar', 'atacar'];

export class CompanionPart {
  // tormenta electromagnética sin radar… salvo con un dron Relé
  stormOn() { return (this.mods || []).includes('tormenta') && !this.team.some((q) => q.a.equip.comp && q.a.equip.comp.b === 'rele' && !q.a.equip.comp.broken); }
  // ---------------------------------------------------------------- utilidades
  isComp(e) { return !!(e && e.type && ACTORS[e.type] && ACTORS[e.type].companion); }
  compOwner(e) { return e && e.ownerId ? this.squad.find((q) => q.id === e.ownerId && q.alive && !q.out) || null : null; }
  compItemOf(e) { const sq = e && e.ownerId ? this.squad.find((q) => q.id === e.ownerId) : null; return sq && sq.a ? sq.a.equip.comp : null; }
  dogOf(sq) { return this.enemies.find((e) => e.type === 'laika' && e.ownerId === sq.id) || null; }
  droneOf(sq) { return this.enemies.find((e) => ACTORS[e.type].drone && e.ownerId === sq.id) || null; }
  dogMods(e) { const it = this.compItemOf(e); return new Set(((it && it.dmods) || []).map((m) => m.b)); }
  compMech(e) { const o = this.compOwner(e); return o ? this.flag(o, 'mechanic') : 0; }
  // estadísticas de combate (las usa est())
  compStats(e) {
    const def = ACTORS[e.type];
    const mods = e.type === 'laika' ? this.dogMods(e) : new Set();
    const k = (mods.has('dm_jaw') ? 2 : 1) * (this.compMech(e) ? 1.3 : 1) * (e.type === 'laika' && S.research && S.research.r_laika ? 1.2 : 1);
    return { l: e.lvl, hp: e.hpMax, dmg: [Math.round(def.dmg[0] * k), Math.round(def.dmg[1] * k)], acc: 4, armor: def.armor + (mods.has('dm_lead') ? 3 : 0), ev: def.ev, ess: [0, 0], xp: 0 };
  }

  // ---------------------------------------------------------------- al empezar la expedición
  spawnCompanions() {
    for (const sq of this.team) {
      const it = sq.a.equip.comp;
      if (!it) continue;
      const d = ITEMS[it.b];
      it.used = 0; it.out = 0;
      if (it.b === 'rele' && !it.broken) this.nextTemp = Math.max(this.turn + 5, this.nextTemp - 15);
      if (d.kind !== 'dog' || it.broken) continue;
      const spot = this.freeNear(sq.x, sq.y, 3);
      if (!spot) continue;
      const e = this.spawnEnemy('laika', 1, spot[0], spot[1], 'errante', null, 'squad');
      const max = this.compMaxHpFor(it, sq);
      e.hpMax = max; e.hp = Math.max(1, Math.min(max, it.hp == null ? max : it.hp));
      e.ownerId = sq.id; e.order = 'seguir'; e.cargo = []; e.charges = 30; e.seen = 1;
    }
  }
  compMaxHpFor(it, sq) {
    let hp = ITEMS[it.b].hp || 0;
    for (const m of it.dmods || []) hp += ITEMS[m.b].hp || 0;
    if (sq && this.flag(sq, 'mechanic')) hp = Math.round(hp * 1.3);
    if (S.research && S.research.r_laika && ITEMS[it.b].kind === 'dog') hp = Math.round(hp * 1.2);
    return hp;
  }
  freeNear(x, y, r = 3, flying = false) {
    for (let d = 1; d <= r; d++) for (const [dx, dy] of D8) {
      const nx = x + dx * d, ny = y + dy * d;
      if (!this.inb(nx, ny) || this.entityAt(nx, ny)) continue;
      if (this.passable(nx, ny) || (flying && this.tile(nx, ny) === T.DEEP)) return [nx, ny];
    }
    return null;
  }

  // ---------------------------------------------------------------- tecla J (compañero)
  // perro: cambia de orden · Strizh/Mula: lanzar o recoger · Eco/Kamikadze: la interfaz pide destino
  dogOrder(sq, order) {
    const dog = this.dogOf(sq);
    if (!dog) { this.say('Laika no está contigo.', 'dimt'); return false; }
    const range = this.flag(sq, 'remote') ? 30 : 15;
    if (cheb(dog.x, dog.y, sq.x, sq.y) > range) { this.say(`Laika está demasiado lejos para oír la orden (${range} casillas${this.flag(sq, 'remote') ? '' : '; el mando a distancia lo duplica'}).`, 'warn'); return false; }
    dog.order = order || ORDER_CYCLE[(ORDER_CYCLE.indexOf(dog.order) + 1) % ORDER_CYCLE.length];
    dog.fetch = null;
    this.say(`§ Laika: ${DOG_ORDERS[dog.order]}. ${{ seguir: 'Va detrás de su dueño.', quedarse: 'Se queda vigilando aquí.', buscar: 'Busca botín y lo trae (4 huecos).', atacar: 'Ataca al hostil más cercano.' }[dog.order]}`, 'cyan');
    this.dirty = true;
    this.emit('update');
    return false; // dar órdenes no gasta turno
  }
  launchDrone(sq) {
    const it = sq.a.equip.comp;
    if (!it) { this.say('Este agente no lleva compañero (ranura COMPAÑERO).', 'dimt'); return false; }
    const d = ITEMS[it.b];
    if (it.broken) { this.say(`${d.name}: está destrozado. Se repara en el Garaje.`, 'bad'); return false; }
    if (d.kind === 'dog') return this.dogOrder(sq);
    if (d.drone === 'rele') { this.say('El Relé funciona desde la ranura: mantiene el radar y el contacto con la base.', 'dimt'); return false; }
    const flying = this.droneOf(sq);
    if (flying) { flying.recall = 1; this.say(`${ACTORS[flying.type].name}: vuelve con su dueño.`, 'cyan'); return false; }
    if (d.drone === 'mula') {
      if (it.used) { this.say('La Mula ya ha hecho su viaje en esta expedición.', 'dimt'); return false; }
      const ex = this.exits.slice().sort((a, b) => Math.hypot(a.x - sq.x, a.y - sq.y) - Math.hypot(b.x - sq.x, b.y - sq.y))[0];
      if (!ex) { this.say('No hay ninguna extracción en este piso: la Mula no tiene adónde ir.', 'bad'); return false; }
      const load = sq.a.bag.filter((x) => ITEMS[x.b].cat !== 'ammo').sort((a, b) => itemValue(b) - itemValue(a)).slice(0, ITEMS[it.b].carry);
      if (!load.length) { this.say('No hay nada en la mochila que enviar.', 'dimt'); return false; }
      const spot = this.freeNear(sq.x, sq.y, 2, true);
      if (!spot) return false;
      for (const x of load) sq.a.bag.splice(sq.a.bag.indexOf(x), 1);
      const e = this.spawnEnemy('mula', 1, spot[0], spot[1], 'errante', null, 'squad');
      e.ownerId = sq.id; e.load = load; e.dest = [ex.x, ex.y]; e.seen = 1;
      it.used = 1; it.out = 1;
      this.say(`ˇ La Mula despega con ${load.map((x) => esc(itemName(x))).join(', ')} rumbo a la extracción.`, 'cyan');
      return true;
    }
    if (d.drone === 'strizh') {
      const spot = this.freeNear(sq.x, sq.y, 2, true);
      if (!spot) return false;
      const e = this.spawnEnemy('strizh', 1, spot[0], spot[1], 'errante', null, 'squad');
      const k = (this.flag(sq, 'remote') ? 1.5 : 1) * (this.flag(sq, 'mechanic') ? 1.5 : 1) * (S.research && S.research.r_drones ? 1.25 : 1);
      e.ownerId = sq.id; e.battery = Math.round(d.battery * k) + (it.batBonus || 0); e.seen = 1;
      it.out = 1;
      this.say(`ˇ ${this.nm(sq)} lanza el Strizh (${e.battery} turnos de batería). Clic en el radar para mandarlo a un punto; <b>J</b> para que vuelva.`, 'cyan');
      this.computeVisibility(true);
      return true;
    }
    return false;
  }
  // Eco: vuela a un punto y hace de señuelo
  launchEco(sq, x, y) {
    const it = sq.a.equip.comp;
    if (!it || ITEMS[it.b].drone !== 'eco') return false;
    if (this.droneOf(sq)) { this.say('El Eco ya está en el aire.', 'dimt'); return false; }
    if (Math.hypot(x - sq.x, y - sq.y) > 16) { this.say('Demasiado lejos (16 casillas).', 'bad'); return false; }
    const spot = this.freeNear(sq.x, sq.y, 2, true);
    if (!spot) return false;
    const e = this.spawnEnemy('eco', 1, spot[0], spot[1], 'errante', null, 'squad');
    const k = (this.flag(sq, 'remote') ? 1.5 : 1) * (this.flag(sq, 'mechanic') ? 1.5 : 1) * (S.research && S.research.r_drones ? 1.25 : 1);
    e.ownerId = sq.id; e.dest = [x, y]; e.battery = Math.round(ITEMS[it.b].battery * k) + (it.batBonus || 0); e.seen = 1;
    it.out = 1;
    this.say(`ˇ El Eco vuela hacia el punto marcado. Allí sonará y brillará durante ${e.battery} turnos.`, 'cyan');
    return true;
  }
  // Kamikadze: se estrella contra un objetivo
  kamikaze(sq, x, y) {
    const it = sq.a.equip.comp;
    if (!it || ITEMS[it.b].drone !== 'kamikadze') return false;
    const d = ITEMS[it.b];
    const range = d.range + (this.flag(sq, 'remote') ? 6 : 0);
    if (Math.hypot(x - sq.x, y - sq.y) > range) { this.say(`Demasiado lejos (${range} casillas).`, 'bad'); return false; }
    sq.a.equip.comp = null;
    this.fx.push({ type: 'throw', x0: sq.x, y0: sq.y, x1: x, y1: y, glyph: 'ˇ' });
    this.say(`ˇ ¡El Kamikadze se lanza en picado!`, 'warn');
    const k = this.flag(sq, 'mechanic') ? 1.3 : 1;
    this.explode(x, y, d.blast, [Math.round(d.dmg[0] * k), Math.round(d.dmg[1] * k)], sq, 0, 300, { noise: 16 });
    return true;
  }

  // ---------------------------------------------------------------- IA
  mechAct(e) {
    const def = ACTORS[e.type];
    if (e.type === 'laika') return this.dogAct(e);
    if (def.turret) return this.turretAct(e);
    return this.droneAct(e);
  }
  stepTo(e, x, y) {
    if (cheb(e.x, e.y, x, y) === 0) return false;
    const flying = ACTORS[e.type].abil.includes('flying');
    const path = astar(this.w, this.h, e.x, e.y, x, y, (xx, yy) => ((this.passable(xx, yy) || (flying && this.tile(xx, yy) === T.DEEP)) && !(this.entityAt(xx, yy) && !(xx === x && yy === y)) ? 1 : Infinity), 3000);
    if (path && path.length && !this.entityAt(path[0][0], path[0][1])) { this.enemyStepTo(e, path[0][0], path[0][1]); return true; }
    return this.greedyStep(e, x, y);
  }
  dogAct(e) {
    const owner = this.compOwner(e) || this.cur;
    const mods = this.dogMods(e);
    // botiquín: cura a los agentes adyacentes
    if (mods.has('dm_medkit') && e.charges > 0) for (const q of this.team) if (cheb(q.x, q.y, e.x, e.y) <= 1 && q.a.hp < this.ast(q).hpMaxEff) { q.a.hp = Math.min(this.ast(q).hpMaxEff, q.a.hp + 2); e.charges--; if (e.charges % 10 === 0) this.fx.push({ type: 'heal', x: q.x, y: q.y }); }
    // detector: marca chebylitas a 15 casillas
    if (mods.has('dm_detector')) for (const o of this.enemies) if (!this.isComp(o) && o.faction === 'chebylitas' && Math.hypot(o.x - e.x, o.y - e.y) <= 15) o.pingT = this.turn;
    // sensor de radiación: focos a 10 casillas
    if (mods.has('dm_rad') && this.turn % 3 === 0) {
      this.radKnown = this.radKnown || new Uint8Array(this.w * this.h);
      for (let y = e.y - 10; y <= e.y + 10; y++) for (let x = e.x - 10; x <= e.x + 10; x++) { if (!this.inb(x, y)) continue; const k = this.key(x, y); if (this.rad[k] > 1.2) { this.radKnown[k] = 1; this.explored[k] = 1; } }
    }
    const [tgt, td] = this.pickTarget(e, e.order === 'atacar' ? 12 : 7);
    // lanzabengalas: ilumina al hostil más cercano si está a oscuras
    if (mods.has('dm_flare') && tgt && !(e.flareCd > this.turn) && !this.isLit(tgt.x, tgt.y)) {
      e.flareCd = this.turn + 15;
      this.flares.push({ x: tgt.x, y: tgt.y, t: 12 }); this.lightDirty = true;
      this.fx.push({ type: 'flare', x: tgt.x, y: tgt.y });
      this.say('§ Laika dispara una bengala sobre el enemigo.', 'dimt');
      return;
    }
    if (tgt && e.order !== 'buscar') {
      const st = this.est(e);
      // ametralladora montada
      if (mods.has('dm_mg') && td <= 7 && td > 1.5 && this.los(e.x, e.y, tgt.x, tgt.y) && this.takeDogAmmo(e, 2)) {
        const m = ITEMS.dm_mg;
        e.ld = 2;
        this.humanShoot(e, tgt, { wtype: 'mg', dmg: m.dmg.map((v) => Math.round(v * (this.compMech(e) ? 1.3 : 1))), acc: 66, range: m.range, burst: 2, crit: 5, noise: 12, pierce: 0 });
        return;
      }
      if (td <= 1.5) { this.humanShoot(e, tgt, { wtype: 'melee', dmg: st.dmg, acc: 74, range: 1, burst: 1, crit: 8, noise: 2, pierce: mods.has('dm_jaw') ? 2 : 0 }); return; }
      if (e.order === 'atacar' || (e.order === 'seguir' && td <= 4)) { this.stepTo(e, tgt.x, tgt.y); return; }
    }
    if (e.order === 'quedarse') return;
    if (e.order === 'buscar') {
      if ((e.cargo || []).length >= ITEMS.laika.cargo) { e.order = 'seguir'; this.say('§ Laika vuelve con la carga llena (F a su lado para cogerla).', 'cyan'); }
      else {
        const items = this.floorAt(e.x, e.y);
        if (items.length) {
          const it = items.shift();
          e.cargo.push(it); this.cleanFloor();
          if (this.isVisible(e.x, e.y)) this.say(`§ Laika recoge ${esc(itemName(it))}.`, 'dimt');
          return;
        }
        if (!e.fetch || !this.floorAt(e.fetch[0], e.fetch[1]).length) {
          let best = null, bd = 13;
          for (const [k, list] of this.floorItems) {
            if (!list.length) continue;
            const x = k % this.w, y = (k / this.w) | 0;
            const d = Math.hypot(x - e.x, y - e.y);
            if (d < bd && this.explored[k]) { bd = d; best = [x, y]; }
          }
          e.fetch = best;
          if (!best) { e.order = 'seguir'; this.say('§ Laika no encuentra nada más que traer.', 'dimt'); }
        }
        if (e.fetch) { if (!this.stepTo(e, e.fetch[0], e.fetch[1])) e.fetch = null; return; }
      }
    }
    // seguir al dueño
    if (cheb(e.x, e.y, owner.x, owner.y) > 2) this.stepTo(e, owner.x, owner.y);
  }
  takeDogAmmo(e, n) {
    const fromCargo = (e.cargo || []).find((x) => x.b === 'a_545' && x.q > 0);
    const owner = this.compOwner(e);
    const fromBag = owner && owner.a.bag.find((x) => x.b === 'a_545' && x.q > 0);
    const src = fromCargo || fromBag;
    if (!src) return false;
    src.q -= Math.min(n, src.q);
    if (src.q <= 0) { if (fromCargo) e.cargo.splice(e.cargo.indexOf(src), 1); else owner.a.bag.splice(owner.a.bag.indexOf(src), 1); }
    return true;
  }
  turretAct(e) {
    const [tgt, td] = this.pickTarget(e, 8);
    if (!tgt || td > 7.5) return;
    if (!(e.ammo > 0)) { if (!e.dryWarn) { e.dryWarn = 1; this.say('Ŧ La torreta «Gnomo» se ha quedado sin munición.', 'warn'); } return; }
    e.ld = Math.min(2, e.ammo);
    e.ammo -= e.ld;
    const st = this.est(e);
    this.humanShoot(e, tgt, { wtype: 'mg', dmg: st.dmg, acc: 64, range: 7, burst: 2, crit: 5, noise: 13, pierce: 0 });
  }
  droneAct(e) {
    const def = ACTORS[e.type];
    const owner = this.compOwner(e);
    if (e.type === 'mula') {
      if (cheb(e.x, e.y, e.dest[0], e.dest[1]) <= 1) {
        (this.sentHome = this.sentHome || []).push(...e.load);
        this.say(`ˇ La Mula llega a la extracción: ${e.load.length} objeto(s) enviados a la base.`, 'good');
        e.load = [];
        this.dismissActor(e);
        return;
      }
      this.stepTo(e, e.dest[0], e.dest[1]);
      return;
    }
    // la batería se gasta por turno, no por movimiento (los drones se mueven varias veces por turno)
    if (e.batTurn !== this.turn) { e.batTurn = this.turn; e.battery = (e.battery || 0) - 1; }
    if (e.type === 'eco') {
      if (e.dest && cheb(e.x, e.y, e.dest[0], e.dest[1]) > 0) { if (!this.stepTo(e, e.dest[0], e.dest[1])) e.dest = null; return; }
      e.dest = null;
      if (e.pulseTurn === this.turn) return;
      e.pulseTurn = this.turn;
      this.noise(e.x, e.y, 10);
      this.flares.push({ x: e.x, y: e.y, t: 2 }); this.lightDirty = true;
      for (const o of this.enemies) if (o.faction === 'chebylitas' && Math.hypot(o.x - e.x, o.y - e.y) <= 15 && !ACTORS[o.type].abil.includes('stationary')) { o.lure = { x: e.x, y: e.y, t: 3 }; if (o.state === 'dormido') o.state = 'errante'; }
      if (e.battery <= 0) this.landDrone(e, 'El Eco se queda sin batería y aterriza. Se puede recoger.');
      return;
    }
    // Strizh: explora, vuelve con poca batería
    if (e.recall || e.battery <= 8 || !owner) {
      const o = owner || this.cur;
      if (cheb(e.x, e.y, o.x, o.y) <= 1 || e.battery <= 0) {
        if (e.battery <= 0 && cheb(e.x, e.y, o.x, o.y) > 1) return this.landDrone(e, 'El Strizh se queda sin batería y cae. Hay que ir a recogerlo.');
        const it = this.compItemOf(e); if (it) it.out = 0;
        this.dismissActor(e);
        this.say('ˇ El Strizh vuelve a manos de su dueño.', 'cyan');
        return;
      }
      this.stepTo(e, o.x, o.y);
      return;
    }
    if (e.target) {
      if (cheb(e.x, e.y, e.target[0], e.target[1]) <= 1 || !this.stepTo(e, e.target[0], e.target[1])) e.target = null;
      return;
    }
    // casilla sin explorar más cercana (búsqueda en espiral acotada)
    if (!e.goal || this.explored[this.key(e.goal[0], e.goal[1])]) {
      e.goal = null;
      for (let r = 4; r <= 40 && !e.goal; r += 3) {
        for (let i = 0; i < 24; i++) {
          const a = rng.float(0, Math.PI * 2);
          const x = Math.round(e.x + Math.cos(a) * r), y = Math.round(e.y + Math.sin(a) * r);
          if (this.inb(x, y) && !this.explored[this.key(x, y)] && TILES[this.tile(x, y)].walk) { e.goal = [x, y]; break; }
        }
      }
    }
    if (e.goal) { if (!this.stepTo(e, e.goal[0], e.goal[1])) e.goal = null; }
    else this.randomStep(e);
    void def;
  }
  // un dron se posa: queda como objeto en el suelo
  landDrone(e, msg) {
    const sq = this.squad.find((q) => q.id === e.ownerId);
    const it = sq && sq.a.equip.comp;
    if (it && ITEMS[it.b].drone === e.type) { sq.a.equip.comp = null; it.out = 0; this.addFloor(e.x, e.y, it); }
    this.dismissActor(e);
    this.say(`ˇ ${msg}`, 'warn');
  }
  // el compañero cae en combate
  companionDown(e) {
    const def = ACTORS[e.type];
    this.dismissActor(e);
    if (def.turret) { this.say('Ŧ La torreta «Gnomo» salta en pedazos.', 'bad'); this.fx.push({ type: 'explosion', x: e.x, y: e.y, r: 1 }); return; }
    const sq = this.squad.find((q) => q.id === e.ownerId);
    const it = sq && sq.a.equip.comp;
    for (const c of e.cargo || []) this.addFloor(e.x, e.y, c);
    for (const c of e.load || []) this.addFloor(e.x, e.y, c);
    if (it && (ITEMS[it.b].kind === 'dog' ? e.type === 'laika' : ITEMS[it.b].drone === e.type)) {
      it.broken = 1; it.hp = 0; it.out = 0;
      sq.a.equip.comp = null;
      this.addFloor(e.x, e.y, it);
    }
    this.fx.push({ type: 'explosion', x: e.x, y: e.y, r: 0 });
    this.say(`${def.glyph} ¡${def.name} ha caído! ${e.type === 'laika' ? 'Queda su chasis: recogedlo y el Garaje lo reparará.' : 'Quedan los restos: se pueden recoger y reparar en el Garaje.'}`, 'bad');
    this.interrupt = true;
  }
  // F junto a la torreta (recoger) o al perro (su carga)
  interactComp(sq, e) {
    if (ACTORS[e.type].turret) {
      const it = createItem('gnomo', 0, rng); it.ammo = e.ammo || 0;
      if (mergeInto(sq.a.bag, it, bagCapacity(sq.a))) { this.say('Mochila llena: no cabe la torreta.', 'bad'); return false; }
      this.dismissActor(e);
      this.say(`${this.nm(sq)} desmonta la torreta «Gnomo» (${it.ammo} balas).`, 'o1');
      return true;
    }
    if (e.type === 'laika') {
      if (sq === this.cur) this.emit('loot', { obj: { kind: 'dogcargo', x: e.x, y: e.y, items: e.cargo || (e.cargo = []), opened: true } });
      return false;
    }
    return false;
  }
  // torreta desplegable
  deployTurret(sq, it) {
    const spot = this.freeNear(sq.x, sq.y, 1);
    if (!spot) { this.say('No hay sitio para la torreta.', 'bad'); return false; }
    const e = this.spawnEnemy('gnomo', 1, spot[0], spot[1], 'errante', null, 'squad');
    e.ammo = it.ammo != null ? it.ammo : ITEMS.gnomo.ammoMax; e.seen = 1; e.ownerId = sq.id;
    const k = this.flag(sq, 'mechanic') ? 1.3 : 1;
    e.hpMax = Math.round(e.hpMax * k); e.hp = e.hpMax;
    this.say(`Ŧ ${this.nm(sq)} despliega la torreta «Gnomo» (${e.ammo} balas). F a su lado para recogerla.`, 'o1');
    this.fx.push({ type: 'open', x: spot[0], y: spot[1] });
    return true;
  }

  // ---------------------------------------------------------------- pisos y final
  takeCompanionsAlong() {
    const out = this.enemies.filter((e) => this.isComp(e) && !ACTORS[e.type].turret && this.compOwner(e));
    for (const e of out) this.dismissActor(e);
    return out;
  }
  placeCompanions(list) {
    for (const e of list) {
      const o = this.compOwner(e) || this.cur;
      const spot = this.freeNear(o.x, o.y, 4, ACTORS[e.type].abil.includes('flying'));
      if (!spot) { this.companionLost(e); continue; }
      e.x = spot[0]; e.y = spot[1]; e.goal = null; e.target = null; e.fetch = null;
      if (e.type === 'mula' && this.exits.length) { const ex = this.exits[0]; e.dest = [ex.x, ex.y]; }
      this.enemies.push(e); this.occ.set(this.key(e.x, e.y), e);
    }
  }
  companionLost(e) { const it = this.compItemOf(e); if (it) it.out = 0; }
  // al terminar: el perro vuelve con su carga, los drones en vuelo regresan
  finishCompanions() {
    const back = [];
    for (const e of this.enemies.filter((x) => this.isComp(x))) {
      const sq = this.squad.find((q) => q.id === e.ownerId);
      const it = sq && sq.a.equip.comp;
      if (e.type === 'laika' && it) {
        it.hp = e.hp;
        if (sq.out) back.push(...(e.cargo || []));
      }
      if (e.type === 'mula' && e.load) back.push(...e.load);
      if (it) it.out = 0;
    }
    return [...back, ...(this.sentHome || [])];
  }
}
