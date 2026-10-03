// Mundo persistente y alerta del reactor (fase 22): los nidos despejados tardan días en volver,
// las zonas olvidadas crecen y suben de nivel, los jefes abatidos tardan en volver y el reactor se agita con los días.
import { S, addMessage } from './state.js';
import { MAPS } from '../data/world.js';
import { ENEMIES } from '../data/enemies.js';
import { ALERT_LEVELS, ALERT_EVERY, CALM_DAYS, GROW_DAYS, BOSS_RETURN } from '../data/ecosystem.js';
import { chronicle } from './story.js';

export function worldDefaults(d) {
  d.world = d.world || { zones: {}, bossDown: {}, alert: 0 };
  d.world.zones = d.world.zones || {};
  d.world.bossDown = d.world.bossDown || {};
  if (d.world.alert == null) d.world.alert = 0;
}

// nivel de alerta del reactor (0–5): sube cada ALERT_EVERY días
// (en «1987» con el modificador de alerta, empieza un nivel más arriba)
export const reactorAlert = (day = S.day) => Math.max(0, Math.min(ALERT_LEVELS.length - 1, Math.floor(((day || 1) - 1) / ALERT_EVERY) + ((S && S.ng && S.ng.alert) || 0)));
export const alertInfo = (lvl = reactorAlert()) => ({ lvl, ...ALERT_LEVELS[lvl] });

export const homeBossOf = (zoneId) => Object.keys(ENEMIES).find((k) => ENEMIES[k].boss && ENEMIES[k].home === zoneId) || null;

// estado de una zona para generar el mapa: nestK (nidos que quedan, 0.4–1), grow (+niveles), bossAway, alert
export function zoneWorld(zoneId) {
  worldDefaults(S);
  const z = S.world.zones[zoneId] || {};
  const out = { nestK: 1, grow: 0, alert: reactorAlert(), bossAway: false, calmLeft: 0 };
  if (z.calmDay != null && S.day - z.calmDay < CALM_DAYS) {
    out.nestK = 0.4 + (0.6 * (S.day - z.calmDay)) / CALM_DAYS;
    out.calmLeft = CALM_DAYS - (S.day - z.calmDay);
  } else if (z.lastVisit != null) out.grow = Math.min(2, Math.floor((S.day - z.lastVisit) / GROW_DAYS));
  if (S.ng && S.ng.lvl) out.grow += S.ng.lvl; // fase 24.7: «1987», chebylitas un nivel más
  const hb = homeBossOf(zoneId);
  if (hb && S.world.bossDown[hb] != null && S.day - S.world.bossDown[hb] < BOSS_RETURN) out.bossAway = true;
  return out;
}

// al volver de una expedición: ¿se limpiaron los nidos? ¿cayó algún jefe?
export function recordExpedition(exp) {
  worldDefaults(S);
  const id = exp.def && exp.def.id;
  for (const t of exp.bossesDown || []) S.world.bossDown[t] = S.day;
  if (!id || !MAPS.some((m) => m.id === id)) return null; // zonas de evento y defensa: no cuentan
  const z = (S.world.zones[id] = S.world.zones[id] || {});
  z.lastVisit = S.day;
  const pois = [...(exp.pois || [])];
  for (const st of exp.floorStore || []) if (st && st.pois) pois.push(...st.pois);
  const nests = pois.filter((p) => p.type === 'nest');
  const cleared = nests.filter((p) => p.cleared).length;
  if (nests.length && cleared / nests.length >= 0.6) {
    z.calmDay = S.day;
    return `Los nidos de ${exp.def.name} tardarán ${CALM_DAYS} días en volver a llenarse.`;
  }
  return null;
}

// cada día: ¿sube la alerta del reactor?
export function worldDayTick() {
  worldDefaults(S);
  const a = reactorAlert();
  if (a > S.world.alert) {
    S.world.alert = a;
    const A = ALERT_LEVELS[a];
    const txt = `☢ Alerta del reactor: «${A.name}». ${A.desc}`;
    addMessage(txt); chronicle(txt);
    return txt;
  }
  return null;
}
