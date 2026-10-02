// Expedición · Extracción: puntos de salida, evacuación
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

import { BACKGROUNDS } from '../data/backgrounds.js';
export class ExtractionPart {
  // ---------------------------------------------------------------- extracción
  exitAt(x, y) { return this.exits.find((ex) => cheb(ex.x, ex.y, x, y) <= 1 && (ex.perm || ex.expires > this.turn)); }
  requestEvac(sq, ex) {
    if (this.evac) { this.say(`La evacuación ya está en marcha (${this.evac.left} turnos).`, 'cyan'); return false; }
    const fast = Math.max(0, ...this.team.map((o) => this.flag(o, 'evacFast')));
    this.evac = { x: ex.x, y: ex.y, left: Math.max(1, 3 - fast), name: ex.name };
    if (!ex.perm) ex.expires = Math.max(ex.expires, this.turn + 5);
    this.say(`Evacuación solicitada en ${ex.name}. Mantened la posición <b>${this.evac.left} turnos</b>: todos los agentes en la zona serán extraídos.`, 'cyan');
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
    const B = BACKGROUNDS[sq.a.bg];
    if (B && rng.chance(0.4)) this.say(`<span style="color:${sq.a.color}">${esc(sq.a.nick)}</span>: <i>${esc(rng.pick(B.lines.extract))}</i>`, 'o1');
  }
}
