// Logros (fase 24.6). Se guardan fuera de la partida (compartidos entre ranuras, ver core/achievements.js).
// test(S, X): S = partida actual, X = datos derivados (trofeos que tenéis, zonas abiertas, mejor agente…).
// Cada logro: { id, name, desc, glyph, test }. Los secretos (secret: 1) no muestran su descripción hasta lograrlos.
const st = (S) => S.stats || {};
const zoneExt = (S, id) => ((st(S).zones || {})[id] || {}).ext || 0;

export const ACHIEVEMENTS = [
  // extracciones
  { id: 'ext1', glyph: '⇑', name: 'Volver a casa', desc: 'Completa tu primera extracción.', test: (S) => st(S).extractions >= 1 },
  { id: 'ext10', glyph: '⇑', name: 'Rutina de liquidador', desc: '10 extracciones.', test: (S) => st(S).extractions >= 10 },
  { id: 'ext50', glyph: '⇑', name: 'Veterano de la Zona', desc: '50 extracciones.', test: (S) => st(S).extractions >= 50 },
  { id: 'noloss10', glyph: '♥', name: 'Nadie se queda atrás', desc: '10 expediciones seguidas sin bajas.', test: (S) => (st(S).bestNoLoss || 0) >= 10 },
  { id: 'surface', glyph: '☀', name: 'A cielo abierto', desc: 'Extrae en todas las zonas de superficie.', test: (S, X) => X.surface.length > 0 && X.surface.every((id) => zoneExt(S, id) > 0) },
  { id: 'sarc', glyph: '☢', name: 'Bajo el sarcófago', desc: 'Extrae en el Sarcófago — Reactor 4.', test: (S) => zoneExt(S, 'sarcofago') > 0 },
  { id: 'corium', glyph: '☢', name: 'El Útero', desc: 'Extrae en el Útero de Corium.', test: (S) => zoneExt(S, 'corium') > 0 },
  { id: 'allopen', glyph: '▦', name: 'Mapa completo', desc: 'Abre todas las zonas de la región.', test: (S, X) => X.allOpen },
  // combate
  { id: 'kill100', glyph: '✝', name: 'Control de plagas', desc: '100 bajas.', test: (S) => st(S).kills >= 100 },
  { id: 'kill1000', glyph: '✝', name: 'Exterminador', desc: '1000 bajas.', test: (S) => st(S).kills >= 1000 },
  { id: 'boss1', glyph: '☠', name: 'Cazador de leyendas', desc: 'Abate a tu primer jefe.', test: (S) => (st(S).bossKills || 0) >= 1 },
  { id: 'boss10', glyph: '☠', name: 'Diez cabezas', desc: 'Abate a 10 jefes.', test: (S) => (st(S).bossKills || 0) >= 10 },
  { id: 'elite10', glyph: '★', name: 'Élite contra élite', desc: 'Abate a 10 chebylitas élite.', test: (S) => (st(S).eliteKills || 0) >= 10 },
  { id: 'trophy1', glyph: '♛', name: 'Primer trofeo', desc: 'Consigue un trofeo de jefe.', test: (S, X) => X.trophies >= 1 },
  { id: 'trophyall', glyph: '♛', name: 'La vitrina llena', desc: 'Consigue todos los trofeos de jefe.', test: (S, X) => X.trophies >= X.trophiesTotal },
  { id: 'back25', glyph: '🗡', name: 'Sin hacer ruido', desc: '25 ataques por la espalda.', test: (S) => (st(S).backstabs || 0) >= 25 },
  { id: 'kick1', glyph: '🦶', name: 'Devuélvesela', desc: 'Devuelve una granada de una patada.', test: (S) => (st(S).nadesKicked || 0) >= 1 },
  { id: 'species20', glyph: '✎', name: 'Taxonomía de urgencia', desc: 'Abate a 20 especies distintas.', test: (S) => Object.keys(st(S).killsBy || {}).length >= 20 },
  // escuadra
  { id: 'rescue1', glyph: '✚', name: 'Aguanta, camarada', desc: 'Levanta a un agente abatido.', test: (S) => (st(S).rescues || 0) >= 1 },
  { id: 'rescue20', glyph: '✚', name: 'Ángel de la guarda', desc: 'Levanta a 20 agentes abatidos.', test: (S) => (st(S).rescues || 0) >= 20 },
  { id: 'lvl10', glyph: '▲', name: 'Curtido', desc: 'Un agente llega al nivel 10.', test: (S, X) => X.maxLvl >= 10 },
  { id: 'lvl20', glyph: '▲', name: 'Leyenda de Prípiat', desc: 'Un agente llega al nivel 20.', test: (S, X) => X.maxLvl >= 20 },
  { id: 'spec', glyph: '◆', name: 'Especialista', desc: 'Un agente elige especialización.', test: (S) => (S.agents || []).some((a) => a.spec) },
  // economía y base
  { id: 'ess1k', glyph: '✦', name: 'Cuota cumplida', desc: '1000 ✦ de esencia en total.', test: (S) => st(S).essTotal >= 1000 },
  { id: 'ess10k', glyph: '✦', name: 'Estajanovista', desc: '10 000 ✦ de esencia en total.', test: (S) => st(S).essTotal >= 10000 },
  { id: 'essday', glyph: '✦', name: 'Día récord', desc: '400 ✦ de esencia en un solo día.', test: (S) => ((st(S).bestDay || {}).ess || 0) >= 400 },
  { id: 'rub10k', glyph: '₽', name: 'Economía planificada', desc: '10 000 ₽ ganados en total.', test: (S) => st(S).rubTotal >= 10000 },
  { id: 'day30', glyph: '☾', name: 'Un mes en la Zona', desc: 'Llega al día 30.', test: (S) => S.day >= 30 },
  { id: 'day100', glyph: '☾', name: 'Cien días', desc: 'Llega al día 100.', test: (S) => S.day >= 100 },
  { id: 'alert4', glyph: '☢', name: 'Crítico', desc: 'Sigue en pie con la alerta del reactor en «Crítico».', test: (S) => ((S.world || {}).alert || 0) >= 4 },
  { id: 'bestiary', glyph: '✎', name: 'Naturalista', desc: 'Avista 30 especies de chebylitas.', test: (S) => Object.keys(S.bestiary || {}).length >= 30 },
  { id: 'notes', glyph: '✉', name: 'Archivero', desc: 'Lee 25 notas.', test: (S) => Object.keys(S.notesRead || {}).length >= 25 },
  // finales (secretos)
  { id: 'end_partido', glyph: '✪', secret: 1, name: 'Fin: el Partido', desc: 'Ve el final del Partido.', test: (S) => S.ending === 'partido' },
  { id: 'end_sellar', glyph: '✪', secret: 1, name: 'Fin: sellar el reactor', desc: 'Ve el final de sellar.', test: (S) => S.ending === 'sellar' },
  { id: 'end_occidente', glyph: '✪', secret: 1, name: 'Fin: Occidente', desc: 'Ve el final de Occidente.', test: (S) => S.ending === 'occidente' },
  { id: 'end_fusion', glyph: '✪', secret: 1, name: 'Fin: fusión', desc: 'Ve el final de la fusión.', test: (S) => S.ending === 'fusion' },
];
