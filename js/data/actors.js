// Registro común de actores no jugadores (chebylitas + personas)
import { ENEMIES, enemyColor } from './enemies.js';
import { HUMANS } from './humans.js';
import { FACTIONS } from './factions.js';
import { COMPANION_ACTORS } from './companions.js';

export const ACTORS = { ...ENEMIES, ...HUMANS, ...COMPANION_ACTORS };
export const isCompanion = (e) => !!(COMPANION_ACTORS[e.type]);
export const actorDef = (e) => ACTORS[e.type];
export const isHuman = (e) => !!HUMANS[e.type];
export function actorFaction(e) { return e.faction || (ACTORS[e.type] && ACTORS[e.type].faction) || 'chebylitas'; }
export function actorColor(e, lvl = e.lvl) {
  const d = ACTORS[e.type];
  if (d.color) return d.color;
  if (HUMANS[e.type]) return FACTIONS[actorFaction(e)].color;
  return enemyColor(d.hue, lvl);
}
