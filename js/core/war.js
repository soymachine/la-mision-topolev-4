// Fase 27: la nube y la Zona en guerra.
// - La nube (a prueba; se apaga en CONFIGURACIÓN): una mancha radiactiva que el viento arrastra por el mapa de la región
//   cada día. Las zonas bajo ella irradian más; en superficie, lluvia negra. El equipo que vuelve de ella llega
//   contaminado y lavarlo cuesta rublos.
// - Dueño y presión de cada zona: los chebylitas (presión 0–100: crece si no se visita, baja al limpiar nidos), una
//   facción o vosotros (liberada). Los nidos fuertes se extienden a las zonas vecinas; los EE. UU., el culto o los
//   merodeadores lanzan ofensivas (las decide el Narrador) que, si nadie las frena, se quedan con la zona.
// - Frente: si cae una zona junto al Puesto, los ataques a la base se multiplican.
// - Incendios forestales en las zonas de bosque, durante unos días.
import { S, settings, addMessage } from './state.js';
import { MAPS, zoneOpen, mapIndex } from '../data/world.js';
import { FACTIONS } from '../data/factions.js';
import { chronicle } from './story.js';

export const RW = 64, RH = 22; // tamaño del mapa de la región (ui/region.js)
export const BASE_POS = [36, 9]; // el Puesto Pripyat-7, junto a la central
export const FRONT_ZONES = ['admin', 'pripyat']; // las zonas que rodean el Puesto
const HOSTILE_FACS = ['usa', 'culto', 'merodeadores'];
const ALLY_FACS = ['rda', 'cuba', 'checos'];
// dueños iniciales: casi todo es de los chebylitas; Fénix, de los EE. UU.; Wismut, de la RDA; Objeto 7, del culto
const START_OWNER = { fenix: 'usa', wismut: 'rda', objeto7: 'culto' };

export const ownerInfo = (o) => (o === 'cheb' ? { name: 'Chebylitas', short: 'chebylitas', color: '#ff5050', glyph: '☣' } : o === 'squad' ? { name: 'Liberada', short: 'liberada', color: '#5ff7ff', glyph: '★' } : FACTIONS[o] ? { name: FACTIONS[o].name, short: FACTIONS[o].short, color: FACTIONS[o].color || '#ffd23f', glyph: '⚑' } : { name: o, short: o, color: '#ccc', glyph: '?' });
export const cloudEnabled = () => settings.cloud !== false;

export function warDefaults(d) {
  d.war = d.war || {};
  const W = d.war;
  W.zones = W.zones || {};
  for (const m of MAPS) if (!W.zones[m.id]) W.zones[m.id] = { owner: START_OWNER[m.id] || 'cheb', pressure: m.social ? 0 : 35 + Math.round((m.tier || 0) * 5) };
  W.offensives = W.offensives || [];
  W.fires = W.fires || {};
  // la nube nace al este de la central y tarda unos días en llegar a las primeras zonas
  if (!W.cloud) W.cloud = { x: 54, y: 12, dx: -1.2, dy: 0, r: 7, windDay: 5 };
  return W;
}
// vecinas en el mapa de la región (a menos de 12 casillas)
const NEIGH = {};
for (const a of MAPS) NEIGH[a.id] = MAPS.filter((b) => b !== a && Math.hypot(a.pos[0] - b.pos[0], (a.pos[1] - b.pos[1]) * 1.6) <= 12).map((b) => b.id);
export const neighbors = (id) => NEIGH[id] || [];

// intensidad de la nube (0–1) en un punto del mapa de la región
export function cloudAt(x, y) {
  if (!S || !S.war || !cloudEnabled()) return 0;
  const c = S.war.cloud;
  const d = Math.hypot(x - c.x, (y - c.y) * 1.8) / c.r;
  return d >= 1 ? 0 : Math.round((1 - d * d) * 100) / 100;
}
// estado de una zona para la base y para generar la expedición
export function zoneWar(id) {
  if (!S) return null;
  const W = warDefaults(S);
  const z = W.zones[id];
  if (!z) return null;
  const m = MAPS.find((x) => x.id === id);
  const off = W.offensives.find((o) => o.zone === id);
  const cloud = m ? cloudAt(m.pos[0], m.pos[1]) : 0;
  return { ...z, info: ownerInfo(z.owner), cloud, offensive: off || null, fire: W.fires[id] && W.fires[id] > S.day ? W.fires[id] - S.day : 0 };
}
// facciones que patrullan la zona según su dueño (sustituye al fpool de la zona)
export function zoneFpool(id, base) {
  const z = zoneWar(id);
  if (!z) return base;
  if (z.offensive) return [z.offensive.fac, z.offensive.fac];
  if (z.owner === 'squad') return ['rda', 'cuba', ...(base || []).filter((f) => ALLY_FACS.includes(f))];
  if (FACTIONS[z.owner]) return [z.owner, z.owner, ...(base || [])];
  return base;
}
// ¿está el frente junto al Puesto? (si cae una zona vecina, los ataques se multiplican)
export function frontLine() {
  if (!S || !S.war) return false;
  return FRONT_ZONES.some((id) => { const z = S.war.zones[id]; return z && z.owner !== 'squad' && (z.owner !== 'cheb' || z.pressure >= 80); });
}

// ---------------------------------------------------------------- cada día
export function warDay() {
  const W = warDefaults(S);
  const out = [];
  // la nube: el viento la arrastra; cada pocos días cambia de dirección
  const c = W.cloud;
  if (S.day >= c.windDay) {
    const ang = Math.random() * Math.PI * 2;
    c.dx = Math.cos(ang) * (1 + Math.random() * 1.5); c.dy = Math.sin(ang) * 0.8;
    c.windDay = S.day + 3 + Math.floor(Math.random() * 3);
    if (cloudEnabled()) out.push(`Parte meteorológico: el viento rola. La nube radiactiva se desplaza hacia el ${dirName(c.dx, c.dy)}.`);
  }
  c.x = Math.max(4, Math.min(RW - 5, c.x + c.dx)); c.y = Math.max(2, Math.min(RH - 3, c.y + c.dy));
  if (c.x <= 4 || c.x >= RW - 5) c.dx = -c.dx;
  if (c.y <= 2 || c.y >= RH - 3) c.dy = -c.dy;
  // presión: crece en las zonas de los chebylitas; los nidos fuertes se extienden a las vecinas
  const spread = [];
  for (const m of MAPS) {
    const z = W.zones[m.id];
    if (m.social || !z) continue;
    if (z.owner === 'cheb') { z.pressure = Math.min(100, z.pressure + 1.5 + (m.tier || 0) * 0.2); if (z.pressure >= 80) spread.push(m.id); }
    else if (z.owner === 'squad') z.pressure = Math.max(0, z.pressure - 1);
  }
  for (const id of spread) for (const n of neighbors(id)) {
    const z = W.zones[n];
    if (!z || MAPS[mapIndex(n)].social) continue;
    z.pressure = Math.min(100, z.pressure + 2);
    // una zona liberada puede volver a caer
    if (z.owner === 'squad' && z.pressure >= 60) {
      z.owner = 'cheb';
      const txt = `☣ Los chebylitas de las zonas vecinas han recuperado ${MAPS[mapIndex(n)].name}.`;
      out.push(txt); chronicle(txt);
    }
  }
  // ofensivas: si nadie las frena a tiempo, la facción se queda con la zona
  for (const o of [...W.offensives]) {
    if (o.until > S.day) continue;
    W.offensives.splice(W.offensives.indexOf(o), 1);
    const z = W.zones[o.zone];
    if (!z) continue;
    z.owner = o.fac; z.pressure = 70;
    const txt = `⚔ ${FACTIONS[o.fac] ? FACTIONS[o.fac].name : o.fac} se ha hecho con ${MAPS[mapIndex(o.zone)].name}. Sus patrullas controlan ahora la zona.`;
    out.push(txt); chronicle(txt);
  }
  // incendios que se apagan
  for (const [id, until] of Object.entries(W.fires)) if (until <= S.day) { delete W.fires[id]; out.push(`El incendio de ${MAPS[mapIndex(id)].name} se ha apagado. Queda un paisaje de ceniza.`); }
  // un incendio forestal de vez en cuando en verano y otoño
  if (Math.random() < 0.04) startFire();
  for (const t of out) addMessage(t);
  return out;
}
const dirName = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'este' : 'oeste') : dy > 0 ? 'sur' : 'norte');
export function startFire(id = null) {
  const W = warDefaults(S);
  const pool = MAPS.filter((m, i) => m.zones && (m.zones.bosque || 0) > 0 && zoneOpen(S, i) && !W.fires[m.id]);
  const m = id ? MAPS.find((x) => x.id === id) : pool[Math.floor(Math.random() * pool.length)];
  if (!m) return null;
  W.fires[m.id] = S.day + 3 + Math.floor(Math.random() * 3);
  addMessage(`🔥 Incendio forestal en ${m.name}: arde durante unos días. Humo, fuego y pinos que caen.`);
  chronicle(`Incendio en ${m.name}.`);
  return m.id;
}
// ofensiva de una facción hostil contra una zona (la lanza el Narrador)
export function startOffensive(fac = null, zone = null) {
  const W = warDefaults(S);
  fac = fac || HOSTILE_FACS[Math.floor(Math.random() * HOSTILE_FACS.length)];
  const open = MAPS.filter((m, i) => zoneOpen(S, i) && !m.social && !W.offensives.some((o) => o.zone === m.id) && W.zones[m.id] && W.zones[m.id].owner !== fac);
  if (!open.length) return null;
  // prefiere las liberadas y las que rodean el Puesto
  const score = (m) => (W.zones[m.id].owner === 'squad' ? 3 : 0) + (FRONT_ZONES.includes(m.id) ? 2 : 0) + Math.random() * 2;
  const target = zone ? MAPS.find((m) => m.id === zone) : open.sort((a, b) => score(b) - score(a))[0];
  if (!target) return null;
  const o = { fac, zone: target.id, day: S.day, until: S.day + 4 };
  W.offensives.push(o);
  addMessage(`⚔ Radio: ${FACTIONS[fac] ? FACTIONS[fac].name : fac} lanza una ofensiva sobre ${target.name}. Si nadie la frena en 4 días (una expedición allí con éxito), se quedará con la zona.`);
  chronicle(`Ofensiva de ${FACTIONS[fac] ? FACTIONS[fac].short : fac} en ${target.name}.`);
  return o;
}
// los nidos fuertes de una zona empujan a sus vecinas (lo decide el Narrador)
export function migration() {
  const W = warDefaults(S);
  const src = MAPS.filter((m) => W.zones[m.id] && W.zones[m.id].owner === 'cheb' && !m.social).sort((a, b) => W.zones[b.id].pressure - W.zones[a.id].pressure)[0];
  if (!src) return null;
  for (const n of neighbors(src.id)) if (W.zones[n] && !MAPS[mapIndex(n)].social) W.zones[n].pressure = Math.min(100, W.zones[n].pressure + 15);
  addMessage(`☣ Migración: los chebylitas de ${src.name} se extienden a las zonas vecinas (+15 de presión).`);
  return src.id;
}

// ---------------------------------------------------------------- al volver de una expedición
// result: 'success' | 'partial' | 'fail' · cleared: fracción de nidos limpios (0–1) · bosses: jefes abatidos
export function warOnExpedition(id, { result, cleared = 0, bosses = 0, items = 0, agents = [] } = {}) {
  const W = warDefaults(S);
  const z = W.zones[id];
  const news = [];
  if (!z) return news;
  const m = MAPS[mapIndex(id)];
  if (result !== 'fail') {
    z.pressure = Math.max(0, z.pressure - Math.round(10 + cleared * 45 + bosses * 25));
    // una ofensiva en curso queda frenada
    const off = W.offensives.find((o) => o.zone === id);
    if (off) { W.offensives.splice(W.offensives.indexOf(off), 1); news.push(`⚔ Habéis frenado la ofensiva de ${FACTIONS[off.fac] ? FACTIONS[off.fac].name : off.fac} en ${m.name}.`); }
    // liberar: poca presión y una salida con éxito
    if (z.owner !== 'squad' && z.pressure <= 20 && result === 'success') {
      const prev = z.owner;
      z.owner = 'squad';
      news.push(`★ ${m.name} queda LIBERADA${prev !== 'cheb' ? ` (antes, de ${ownerInfo(prev).short})` : ''}: menos nidos y patrullas aliadas.`);
      chronicle(`${m.name}, liberada.`);
    }
  } else z.pressure = Math.min(100, z.pressure + 5);
  // equipo contaminado por la nube: lavarlo cuesta rublos
  const cl = zoneWar(id).cloud;
  if (cl >= 0.3 && items > 0) {
    const cost = Math.round(items * 4 * cl);
    if (S.rub >= cost) { S.rub -= cost; news.push(`☁ Descontaminación del equipo que volvió de la nube: −${cost} ₽.`); }
    else {
      const dose = Math.round(10 * cl);
      for (const a of agents) a.rad = (a.rad || 0) + dose;
      news.push(`☁ No hay rublos para lavar el equipo que volvió de la nube: los agentes acumulan +${dose} de radiación.`);
    }
  }
  for (const t of news) addMessage(t);
  return news;
}
