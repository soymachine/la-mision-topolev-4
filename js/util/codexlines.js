// Trozos de texto compartidos por la documentación (admin.js) y la enciclopedia del juego (ui/codex.js), fase 24.8.
// Solo dependen de los datos: se pueden importar desde las dos páginas sin arrastrar la interfaz.
import { ITEMS } from '../data/items.js';
import { ENEMIES, ABIL_TEXT } from '../data/enemies.js';
import { MAPS } from '../data/world.js';

export const escHTML = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ZONE_TYPE = { industrial: 'Industrial', ruinas: 'Ruinas', caverna: 'Caverna', inundado: 'Inundado', ciudad: 'Ciudad', bosque: 'Bosque', ferroviario: 'Ferroviario', chatarreria: 'Chatarrería', antena: 'Antena', lago: 'Lago', metro: 'Metro', campamento: 'Campamento', base: 'Base militar', laboratorio: 'Laboratorio', organico: 'Orgánico', corium: 'Corium' };
// líneas de ecosistema de un chebylita: dieta, a quién sigue, jefe de zona, fases y trofeo.
// nm(id) da el nombre del chebylita (la enciclopedia lo cambia por «???» si no se ha visto)
export function ecoLines(d, nm = (id) => (ENEMIES[id] ? ENEMIES[id].name : id)) {
  const esc = escHTML;
  const L = [];
  if (d.diet) L.push(`<div class="desc">🍖 Caza: ${d.diet.map(nm).join(', ')}</div>`);
  if (d.follows) L.push(`<div class="desc">Sigue a: ${nm(d.follows)}</div>`);
  if (d.home) L.push(`<div class="desc" style="color:var(--bad)">Jefe de ${esc(MAPS.find((m) => m.id === d.home).name)} (piso más profundo)</div>`);
  if (d.phases) L.push(`<div class="desc"><b>Fases</b>: ${d.phases.map((p) => `≤${Math.round(p.at * 100)}% → ${[p.summon ? `invoca ${p.summon[1]}× ${nm(p.summon[0])}` : '', p.add ? p.add.map((a) => ABIL_TEXT[a]).join(', ') : '', p.heal ? `se cura un ${Math.round(p.heal * 100)}%` : ''].filter(Boolean).join('; ')}`).join(' · ')}</div>`);
  if (d.trophy && ITEMS[d.trophy]) L.push(`<div class="desc" style="color:#ffd23f">♛ Trofeo: ${esc(ITEMS[d.trophy].name)}</div>`);
  return L.join('');
}
// zonas donde vive un chebylita (por id de la zona)
export const zonesOf = (enemyId) => MAPS.filter((m) => m.enemies.includes(enemyId) || ENEMIES[enemyId].home === m.id).map((m) => m.id);
