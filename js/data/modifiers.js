// Modificadores de zona (fase 16.4): cada día, cada zona sale con 0–2. Se ven al elegir destino.
// risk: lo que empeora · reward: lo que mejora. Los efectos se aplican en la generación (mapgen) y en la expedición.
// ess: multiplicador de la esencia recogida · loot: bonus de rareza del botín · rad: radiación ambiente extra
export const MODIFIERS = {
  apagon: { name: 'Apagón', glyph: '●', color: '#8a8aa0', risk: 'Sin iluminación de emergencia: todo a oscuras.', reward: 'Botín de mejor rareza.', loot: 0.45 },
  inundacion: { name: 'Inundación', glyph: '≈', color: '#35a090', risk: 'Mucha más agua contaminada.', reward: '+15% de esencia.', ess: 1.15 },
  tormenta: { name: 'Tormenta electromagnética', glyph: 'ϟ', color: '#7fb8ff', risk: 'Sin radar: el minimapa no muestra puntos de interés ni enemigos.', reward: '+25% de esencia.', ess: 1.25 },
  esporas: { name: 'Plaga de esporas', glyph: '≋', color: '#c06cff', risk: 'El doble de fugas de esporas y más esporangios.', reward: '+10% de esencia y mejor botín.', ess: 1.1, loot: 0.2 },
  inquietos: { name: 'Nidos inquietos', glyph: '▲', color: '#ff6a6a', risk: 'Los nidos empiezan despiertos.', reward: '+30% de esencia.', ess: 1.3 },
  vetamadre: { name: 'Veta madre', glyph: '✦', color: '#5ff7ff', risk: 'Las vetas están más vigiladas.', reward: 'Vetas y cristales con un 50% más de esencia.' },
  extranjeros: { name: 'Presencia extranjera', glyph: '@', color: '#e6dc6a', risk: 'Hay otras expediciones en la zona (aliadas, neutrales… y hostiles).', reward: 'Equipo y documentos de otros países.' },
  lluvia: { name: 'Lluvia radiactiva', glyph: '☢', color: '#b8f53d', risk: 'Radiación ambiente mucho más alta.', reward: '+20% de esencia.', ess: 1.2, rad: 0.35 },
  niebla: { name: 'Niebla', glyph: '░', color: '#a0a0a0', risk: '−3 de visión para todos.', reward: 'Los nidos dormidos tardan más en notarte; mejor botín.', loot: 0.2 },
  pulso: { name: 'Pulso temprano', glyph: '☢', color: '#ff3b30', risk: 'El pulso del reactor llega 150 turnos antes.', reward: '+35% de esencia.', ess: 1.35 },
  helada: { name: 'Helada', glyph: '❄', color: '#d0e8ff', risk: 'El agua se ha congelado: el hielo resbala.', reward: 'Sin agua radiactiva; +10% de esencia.', ess: 1.1 },
};

// modificadores del día para una zona (deterministas: misma partida, mismo día, misma zona)
export function rollZoneMods(created, day, mapIdx) {
  let h = (created ^ (day * 2654435761) ^ (mapIdx * 40503)) >>> 0;
  const rnd = () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (day <= 1 && mapIdx === 0) return [];
  const r = rnd();
  const n = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
  const pool = Object.keys(MODIFIERS);
  const out = [];
  while (out.length < n) {
    const m = pool[Math.floor(rnd() * pool.length)];
    if (out.includes(m)) continue;
    if ((m === 'inundacion' && out.includes('helada')) || (m === 'helada' && out.includes('inundacion'))) continue;
    out.push(m);
  }
  return out;
}
export const modEss = (mods) => (mods || []).reduce((k, m) => k * (MODIFIERS[m] && MODIFIERS[m].ess ? MODIFIERS[m].ess : 1), 1);
export const modLoot = (mods) => (mods || []).reduce((k, m) => k + ((MODIFIERS[m] && MODIFIERS[m].loot) || 0), 0);
export const modRad = (mods) => (mods || []).reduce((k, m) => k + ((MODIFIERS[m] && MODIFIERS[m].rad) || 0), 0);
