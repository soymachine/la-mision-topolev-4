// Expedición · Uso de objetos: interactuar, recoger, consumibles, lanzar, trampas, equipar
// (métodos mezclados en Expedition: ver expedition.js)
/* eslint-disable no-unused-vars */
import { RNG, rng, clamp, cheb, line, uid } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { MAPS } from '../data/world.js';
import { ENEMIES, scaleEnemy, enemyColor } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { computeFOV, hasLOS } from './fov.js';
import { astar, dijkstra } from './path.js';
import { itemStats, itemName, createItem, rollLoot, mergeInto, rarityColor, gadgetExtras, caseRefusal, caseUsed } from '../core/items.js';
import { agentStats, agentName, giveXp, bagCapacity } from '../core/agents.js';
import { S, seeEnemy, killEnemy as bestiaryKill } from '../core/state.js';
import { esc } from '../util/dom.js';
import { RADIO } from '../data/lore.js';
import { D8, FISTS, BLOCKING_OBJ, ESSENCE_COLOR } from './shared.js';
import { ACTORS } from '../data/actors.js';

export class UsePart {
  // ---------------------------------------------------------------- objetos e interacción
  interact() {
    return this.act((sq) => {
      // 1. extracción
      const ex = this.exitAt(sq.x, sq.y);
      if (ex) return this.requestEvac(sq, ex);
      // 2. contenedor / veta adyacentes o en la casilla
      for (const [dx, dy] of [[0, 0], ...D8]) {
        const o = this.objAt(sq.x + dx, sq.y + dy);
        if (!o) continue;
        const usable = o.kind === 'vein' ? o.amount > 0 : o.kind === 'note' ? dx === 0 && dy === 0 : o.kind === 'survivor' ? true : !o.opened || (o.items && o.items.length);
        if (usable) return this.interactObj(sq, o);
      }
      // 3. objetos en el suelo
      if (this.floorAt(sq.x, sq.y).length) { this.emit('loot', { floor: true, x: sq.x, y: sq.y }); return false; }
      this.say('No hay nada con lo que interactuar.', 'dimt');
      return false;
    });
  }

  interactObj(sq, o) {
    if (o.kind === 'vein') return this.mine(sq, o);
    if (o.kind === 'note') {
      o.opened = true; this.dirty = true;
      if (sq === this.cur) this.emit('note', o);
      return false;
    }
    if (o.kind === 'survivor') {
      if (sq === this.cur) this.openDialog('survivor', sq, o);
      return false;
    }
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
    this.trigger('pickup', { item: it.b, rarity: it.r }, sq);
    this.cleanFloor();
    this.emit('update');
    return true;
  }
  cleanFloor() { for (const [k, v] of this.floorItems) if (!v.length) this.floorItems.delete(k); this.dirty = true; }
  dropItem(sq, it) {
    const a = sq.a;
    if (it === a.equip.case) { if (sq === this.cur) this.say('El contenedor va sellado a tu equipo hasta volver a la base.', 'dimt'); return false; }
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
    const quick = this.flag(sq, 'quickReload');
    if (!silent || sq === this.cur) this.say(`${this.nm(sq)} recarga (${w.ld}/${ws.mag})${quick ? ' al instante' : ''}.`, 'dimt');
    return !quick;
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
    const parts = [];
    switch (d.use) {
      case 'heal': case 'antirad': case 'buff': {
        if (d.heal) {
          const heal = d.heal >= 999 ? 999 : Math.round(d.heal * (1 + st.healPct / 100));
          const before = a.hp;
          a.hp = Math.min(st.hpMaxEff, a.hp + heal);
          parts.push(`+${a.hp - before} salud`);
        }
        if (d.cure && sq.poison) { sq.poison = 0; parts.push('sin veneno'); }
        if (d.cureBurn && sq.burn) { sq.burn = 0; parts.push('sin quemaduras'); }
        if (d.radHeal) { a.rad = Math.max(0, a.rad - d.radHeal); parts.push(`−${d.radHeal} rad`); }
        if (d.buff) { this.addBuff(sq, d.buff); parts.push(`${d.buff.name} ${d.buff.turns}t`); }
        this.fx.push({ type: 'heal', x: sq.x, y: sq.y, color: d.use === 'antirad' ? '#b8f53d' : d.use === 'buff' ? '#ffb02e' : null });
        this.say(`${this.nm(sq)} usa ${d.name}${parts.length ? ` (${parts.join(', ')})` : ''}.`, 'good');
        break;
      }
      case 'beacon':
        this.pending.push({ x: sq.x, y: sq.y, at: this.turn + 6 });
        this.say('Baliza activada. Extracción de emergencia en 6 turnos en esta posición.', 'cyan');
        break;
      case 'signal':
        this.nextTemp = this.turn;
        this.say(`${this.nm(sq)} dispara un cohete de señales. La base responde por radio...`, 'cyan');
        this.fx.push({ type: 'flare', x: sq.x, y: sq.y });
        break;
      case 'reveal': {
        let n = 0;
        for (let y = sq.y - d.radius; y <= sq.y + d.radius; y++) for (let x = sq.x - d.radius; x <= sq.x + d.radius; x++) {
          if (!this.inb(x, y) || Math.hypot(x - sq.x, (y - sq.y) * 1.3) > d.radius) continue;
          const k = this.key(x, y);
          const tt = this.t[k];
          if (TILES[tt].walk || tt === T.WALL || tt === T.MACHINE) { if (!this.explored[k]) n++; this.explored[k] = 1; }
        }
        this.dirty = true;
        this.say(`${this.nm(sq)} consulta el plano: ${n} casillas cartografiadas.`, 'o1');
        break;
      }
      case 'sense':
        this.sense = Math.max(this.sense, d.turns); this.senseR = d.radius;
        this.say(`${this.nm(sq)} enciende el detector de movimiento: ${d.turns} turnos.`, 'cyan');
        break;
      case 'ammo': {
        let n = 0;
        for (const slot of ['w1', 'w2']) {
          const w = a.equip[slot];
          if (!w || !ITEMS[w.b].ammo) continue;
          const ws = itemStats(w);
          const ammo = createItem(ws.ammo, 0, rng, ws.mag * d.mags);
          n += ammo.q;
          const rest = mergeInto(a.bag, ammo, this.ast(sq).slots);
          if (rest) this.addFloor(sq.x, sq.y, rest);
        }
        if (!n) { this.say('Ninguna arma equipada usa munición.', 'bad'); return false; }
        this.say(`${this.nm(sq)} abre la caja: +${n} balas.`, 'good');
        this.fx.push({ type: 'reload', x: sq.x, y: sq.y });
        break;
      }
      default: return false;
    }
    this.consume(sq, it);
    return true;
  }
  consume(sq, it) {
    it.q = (it.q || 1) - 1;
    if (it.q <= 0) sq.a.bag.splice(sq.a.bag.indexOf(it), 1);
  }

  trapAt(x, y) { return this.traps.find((t) => t.x === x && t.y === y); }
  throwAt(sq, it, tx, ty) {
    const d = ITEMS[it.b];
    if (d.use === 'trap') {
      if (cheb(sq.x, sq.y, tx, ty) !== 1 || !this.passable(tx, ty) || this.entityAt(tx, ty) || this.trapAt(tx, ty)) { this.say('Coloca la trampa en una casilla libre adyacente.', 'bad'); return false; }
      this.consume(sq, it);
      this.traps.push({ x: tx, y: ty, b: it.b, dmg: d.trap.dmg, blast: d.trap.blast || 0, stun: d.trap.stun || 0 });
      this.say(`${this.nm(sq)} coloca ${d.name}.`, 'o1');
      this.fx.push({ type: 'open', x: tx, y: ty });
      return true;
    }
    if (Math.hypot(tx - sq.x, ty - sq.y) > d.range + 0.5) { this.say('Demasiado lejos.', 'bad'); return false; }
    if (!this.los(sq.x, sq.y, tx, ty)) { this.say('No hay línea de lanzamiento.', 'bad'); return false; }
    this.consume(sq, it);
    this.fx.push({ type: 'throw', x0: sq.x, y0: sq.y, x1: tx, y1: ty, glyph: d.glyph });
    const cells = (r) => {
      const out = [];
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (this.walkTile(x, y) && Math.hypot(x - tx, y - ty) <= r + 0.5) out.push(this.key(x, y));
      return out;
    };
    if (d.lure) {
      if (d.light) this.flares.push({ x: tx, y: ty, t: 20 });
      let n = 0;
      for (const e of this.enemies) if (Math.hypot(e.x - tx, e.y - ty) <= d.lure && !ACTORS[e.type].abil.includes('stationary')) { e.lure = { x: tx, y: ty, t: 10 }; if (e.state === 'dormido') e.state = 'errante'; n++; }
      this.say(`${this.nm(sq)} lanza ${d.name}. ${n ? 'Algo se mueve hacia allí...' : 'Nada parece reaccionar.'}`, 'o1');
      if (d.light) { this.fx.push({ type: 'flare', x: tx, y: ty, delay: 250 }); this.computeVisibility(); }
      return true;
    }
    if (d.smoke) {
      for (const k of cells(d.smoke)) this.smoke[k] = 10;
      this.say(`${this.nm(sq)} lanza ${d.name}. Una cortina de humo lo cubre todo.`, 'o1');
      this.fx.push({ type: 'smoke', x: tx, y: ty, r: d.smoke, delay: 250 });
      this.noise(tx, ty, 4);
      this.computeVisibility(true);
      return true;
    }
    if (d.gas) {
      for (const k of cells(d.gas)) this.gas[k] = Math.max(this.gas[k], 8);
      this.say(`${this.nm(sq)} lanza ${d.name}. Una nube tóxica se extiende.`, 'o1');
      this.fx.push({ type: 'spores', x: tx, y: ty, delay: 250 });
      this.noise(tx, ty, 6);
      return true;
    }
    if (d.stun) {
      let n = 0;
      for (const e of this.enemies) if (Math.hypot(e.x - tx, e.y - ty) <= d.blast + 0.5 && this.los(tx, ty, e.x, e.y)) { e.stun = Math.max(e.stun || 0, ACTORS[e.type].boss ? 1 : d.stun); if (e.state === 'dormido') e.state = 'alerta'; e.mem = 15; n++; }
      this.say(`${this.nm(sq)} lanza ${d.name}: ${n} chebylita(s) aturdido(s).`, 'o1');
      this.fx.push({ type: 'flash', x: tx, y: ty, r: d.blast, delay: 250 });
      this.noise(tx, ty, 12);
      return true;
    }
    this.say(`${this.nm(sq)} lanza ${d.name}.`, 'o1');
    this.explode(tx, ty, d.blast, d.dmg, sq, d.fire || 0, 260, { pierce: d.pierce || 0, essBoost: d.essBoost || 0, noise: d.noise || 14 });
    return true;
  }

  // guardar un objeto en el contenedor de seguridad (1 turno; queda sellado hasta la base)
  stowItem(sq, it) {
    const a = sq.a, c = a.equip.case;
    if (!c) { this.say('No llevas contenedor de seguridad.', 'dimt'); return false; }
    const why = caseRefusal(c, it);
    if (why) { this.say(`No cabe: ${why}.`, 'bad'); return false; }
    const bi = a.bag.indexOf(it);
    const slot = bi < 0 ? Object.keys(a.equip).find((s) => a.equip[s] === it) : null;
    if (bi >= 0) a.bag.splice(bi, 1);
    else if (slot && slot !== 'case') a.equip[slot] = null;
    else return false;
    c.vault.push(it);
    this.say(`${this.nm(sq)} guarda <span style="color:${rarityColor(it.r)}">${esc(itemName(it))}</span> en el contenedor y lo sella <span class="dimt">[▣ ${caseUsed(c)}/${ITEMS[c.b].caseSlots}]</span>.`, 'o1');
    this.fx.push({ type: 'pickup', x: sq.x, y: sq.y, color: '#ffd23f' });
    return true;
  }

  equipItem(sq, it, slot) {
    const a = sq.a;
    if (slot === 'case' || it === a.equip.case) { this.say('El contenedor solo se cambia en la base.', 'dimt'); return false; }
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
}
