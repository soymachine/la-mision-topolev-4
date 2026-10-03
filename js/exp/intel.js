// Información del radar: qué se sabe de cada punto del mapa.
// - Salidas permanentes: el radar las triangula al cabo de unos turnos (antes, solo si se han visto).
// - Grupos de chebylitas: un «?» hasta identificar la especie (verla, abatir bastantes de su especie o un radar de chebylitas).
// - Alijos y puertas blindadas: ocultos hasta verlos, que los marque la radio o que los detecte un radar de botín.
// Funciones sueltas (no métodos) para que también sirvan con la vista de solo lectura de otros pisos.
import { S } from '../core/state.js';

export const NEST_ID_KILLS = 5; // bajas de una especie para reconocer sus nidos en el radar
export const exitRevealTurn = () => Math.max(6, 24 - ((S && S.modules && S.modules.radar) || 0) * 3);

export function exitKnown(e, ex) {
  if (!ex.perm || ex.known) return true; // las temporales las anuncia la radio
  if (e.explored && e.explored[ex.y * e.w + ex.x]) return true;
  return e.turn >= exitRevealTurn();
}
export function speciesKnown(type) {
  const b = S && S.bestiary && S.bestiary[type];
  return !!(b && (b.kills || 0) >= NEST_ID_KILLS);
}
export function nestIdentified(p) {
  return !!(p.seen || p.radar || speciesKnown(p.boss || p.enemy));
}
// ¿se dibuja este punto de interés?
export function poiKnown(e, p) {
  if (p.type === 'cache') return !!(p.found || p.seen || p.radar);
  return true;
}
// casillas de puerta blindada (dan a una cámara con botín) conocidas
export function doorKnown(e, k) {
  return !!((e.explored && e.explored[k]) || (e.doorsFound && e.doorsFound.includes(k)));
}
