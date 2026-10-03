// Expedición · Entorno: gas, fuego, humo, radiación, pulso, estados, extracciones temporales
// (métodos mezclados en Expedition: ver expedition.js)
/* eslint-disable no-unused-vars */
import { RNG, rng, clamp, cheb, line, uid } from '../util/rng.js';
import { T, TILES } from '../data/tiles.js';
import { MAPS } from '../data/world.js';
import { ENEMIES, scaleEnemy, enemyColor } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { computeFOV, hasLOS } from './fov.js';
import { astar, dijkstra } from './path.js';
import { itemStats, itemName, createItem, rollLoot, mergeInto, rarityColor, gadgetExtras } from '../core/items.js';
import { agentStats, agentName, giveXp, bagCapacity } from '../core/agents.js';
import { S, seeEnemy, killEnemy as bestiaryKill } from '../core/state.js';
import { esc } from '../util/dom.js';
import { RADIO } from '../data/lore.js';
import { D8, FISTS, BLOCKING_OBJ, ESSENCE_COLOR } from './shared.js';
import { ACTORS } from '../data/actors.js';

import { addStress } from '../core/story.js';
export class EnvironmentPart {
  // ---------------------------------------------------------------- entorno
  environment() {
    const N = this.w * this.h;
    this.downedTick(); // fase 23.3: los abatidos se desangran
    if (this.ended) return;
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
    // casillas con mecánica: vapor, ventiladores, aceite, raíces
    this.terrainTick();
    if (this.ended) return;
    this.zoneTick();
    // defensa de la base: cuando no quedan atacantes, se gana
    if (this.def.special === 'defensa' && !this.defenseWon && this.turn > 3 && !this.enemies.some((e) => e.attacker && e.hp > 0)) {
      this.defenseWon = 1;
      this.say('★ ¡El Puesto resiste! No queda ni un atacante en pie.', 'good');
      for (const sq of [...this.team]) this.extract(sq);
      this.checkActive();
      return;
    }
    this.factionTick();
    this.moraleTick();
    this.contractTick();
    if (this.ended) return;
    // humo y detector
    for (let k = 0; k < N; k++) if (this.smoke[k]) this.smoke[k]--;
    if (this.sense > 0) this.sense--;
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
      if (this.surface && this.weather === 'lluvia' && this.outdoors(sq.x, sq.y)) r += this.flag(sq, 'rainShield') ? 0.05 : 0.25;
      // invierno: hipotermia al raso sin abrigo
      if (this.season === 'invierno' && this.surface && this.outdoors(sq.x, sq.y) && !this.flag(sq, 'warm') && this.turn % 12 === 0) {
        const armor = sq.a.equip.armor;
        if (!(armor && (ITEMS[armor.b].rad || 0) >= 25)) { this.damageAgent(sq, 1, 'hipotermia'); addStress(sq.a, 1); if (sq === this.cur && this.turn % 48 === 0) this.say(`${this.nm(sq)} tirita: el frío del invierno cala hasta los huesos (abrigo de invierno o un traje grueso lo evitan).`, 'warn'); if (!this.inMap(sq)) continue; }
      }
      const tt = this.t[k];
      if ((tt === T.WATER || tt === T.DEEP) && this.flag(sq, 'waterproof')) r = Math.max(0, r - 0.5 - this.def.ambientRad * 0.5);
      for (const e of this.enemies) if (ACTORS[e.type].abil.includes('aura') && cheb(e.x, e.y, sq.x, sq.y) <= 2) r += 3 + e.lvl * 0.4;
      for (const it of a.bag) if (ITEMS[it.b].radioactive) r += 0.6;
      a.rad = Math.min(150, a.rad + r * (1 - st.rad / 100));
      if (a.rad >= 100) this.damageAgent(sq, 1, 'envenenamiento por radiación');
      if (!this.inMap(sq)) continue;
      if (this.gas[k] && !st.gasImmune) {
        if (this.flag(sq, 'gasResist')) { if (this.turn % 2) this.damageAgent(sq, 1, 'gas tóxico'); }
        else { this.addPoison(sq, 1); this.damageAgent(sq, 1, 'gas tóxico'); }
      }
      if (!this.inMap(sq)) continue;
      if (this.fire[k] && !this.flag(sq, 'fireImmune')) { sq.burn = 2; this.damageAgent(sq, rng.int(2, 5), 'quemaduras'); }
      if (!this.inMap(sq)) continue;
      if (this.anomaly[k] && !this.flag(sq, 'antiAnomaly') && rng.chance(0.5)) { this.fx.push({ type: 'zap', x: sq.x, y: sq.y }); this.damageAgent(sq, rng.int(4, 9), 'anomalía eléctrica'); if (sq === this.cur) this.say('¡Descarga eléctrica!', 'bad'); }
      if (!this.inMap(sq)) continue;
      if (sq.poison > 0) { sq.poison--; this.damageAgent(sq, 1, 'veneno'); }
      if (!this.inMap(sq)) continue;
      if (sq.burn > 0) { sq.burn--; if (!this.flag(sq, 'fireImmune')) this.damageAgent(sq, 2, 'quemaduras'); }
      if (!this.inMap(sq)) continue;
      // efectos temporales
      if (sq.buffs && sq.buffs.length) {
        for (const b of sq.buffs) b.turns--;
        for (const b of sq.buffs.filter((x) => x.turns <= 0)) {
          if (sq === this.cur) this.say(`Se acaba el efecto «${b.name}».`, 'dimt');
          if (b.after && b.after.poison) this.addPoison(sq, b.after.poison);
        }
        sq.buffs = sq.buffs.filter((x) => x.turns > 0);
      }
      // imán de esencia
      const mag = this.flag(sq, 'essMagnet');
      if (mag && this.essence.size) {
        for (let y = sq.y - mag; y <= sq.y + mag; y++) for (let x = sq.x - mag; x <= sq.x + mag; x++) if (this.inb(x, y) && this.essence.has(this.key(x, y))) this.pickupEssence(sq, this.key(x, y));
      }
      if (st.regen > 0) {
        sq.regenT++;
        if (sq.regenT >= Math.max(1, 6 - st.regen * 2)) { sq.regenT = 0; a.hp = Math.min(st.hpMaxEff, a.hp + Math.max(1, st.regen - 2)); }
      }
      if (a.hp > st.hpMaxEff) a.hp = st.hpMaxEff;
    }
    if (this.ended) return;
    // enemigos
    for (const e of [...this.enemies]) {
      const k = this.key(e.x, e.y);
      const def = ACTORS[e.type];
      if (this.fire[k]) e.burn = Math.max(e.burn, 2);
      if (this.gas[k] && !def.gasImmune && !def.mech && def.origin !== 'Hongo' && def.origin !== 'Planta' && def.origin !== 'Mineral' && def.origin !== 'Máquina') this.damageEnemy(e, Math.max(1, Math.floor(this.gas[k] / 3)), null);
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
        const dur = rng.int(28, 42) + S.modules.radar * 4 + Math.max(0, ...this.team.map((o) => this.flag(o, 'exitPlus')));
        const nm = rng.pick(names);
        const s = this.sectorAt(spot[0], spot[1]);
        this.spawnTempExit(spot[0], spot[1], dur, nm);
        this.say(`📻 RADIO: «Extracción temporal abierta: <span class="cyan">${nm}</span>${s ? ' en el sector ' + s.code : ''}. Disponible ${dur} turnos.»`, 'cyan');
      }
    }
    // radio ambiental
    if (this.turn >= this.nextRadio) {
      this.nextRadio = this.turn + rng.int(60, 110);
      if (!this.interceptRadio()) this.say(`📻 ${rng.pick(RADIO)}`, 'dimt');
    }
    // evacuación
    if (this.evac) {
      this.evac.left--;
      if (this.evac.left <= 0) {
        const ev = this.evac;
        this.evac = null;
        const inZone = this.team.filter((sq) => !sq.downed && cheb(sq.x, sq.y, ev.x, ev.y) <= 1); // un abatido no sube solo
        if (!inZone.length) this.say('La evacuación llega... pero no hay nadie en la zona. Se retira.', 'bad');
        for (const sq of inZone) this.extract(sq);
        this.checkActive();
      } else this.say(`Evacuación en ${this.evac.left}...`, 'cyan');
    }
  }
}
