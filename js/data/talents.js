// Atributos y talentos de los agentes (fase 14.2, adelanto de la fase 15)
// Al subir de nivel: +1 punto de atributo. Cada 3 niveles: elegir 1 de 3 talentos al azar.

// Cada punto se suma a las estadísticas del agente (ver agentStats)
export const ATTRS = [
  { id: 'pun', name: 'Puntería', glyph: '⌖', desc: '+1 precisión (+2% de impacto)', per: { acc: 1 } },
  { id: 'agi', name: 'Agilidad', glyph: '≈', desc: '+1 agilidad (esquiva)', per: { ev: 1 } },
  { id: 'fue', name: 'Fortaleza', glyph: '■', desc: '+4 salud máx. · +4% daño cuerpo a cuerpo · +1 hueco cada 3 puntos', per: { hp: 4, meleePct: 4 }, every: [3, { slots: 1 }] },
  { id: 'agu', name: 'Aguante', glyph: '☢', desc: '+3% resistencia a la radiación · +2 salud máx.', per: { rad: 3, hp: 2 } },
  { id: 'per', name: 'Percepción', glyph: '◉', desc: '+1% crítico · +1 visión cada 3 puntos', per: { crit: 1 }, every: [3, { vision: 1 }] },
  { id: 'tec', name: 'Técnica', glyph: '¤', desc: '+3% esencia recogida · +5% curación', per: { essence: 3, healPct: 5 } },
];
export const ATTR_MAX = 10; // puntos extra por atributo

// mods → estadísticas estáticas · flags → efectos especiales de expedición (los mismos que los gadgets)
export const TALENTS = {
  pulso: { name: 'Pulso de cirujano', glyph: '⌖', desc: '+3 precisión.', mods: { acc: 3 } },
  reflejos: { name: 'Reflejos de liquidador', glyph: '≈', desc: '+2 agilidad.', mods: { ev: 2 } },
  corpulento: { name: 'Corpulento', glyph: '■', desc: '+10 salud máxima.', mods: { hp: 10 } },
  plomo: { name: 'Piel de plomo', glyph: '☢', desc: '+12% resistencia a la radiación.', mods: { rad: 12 } },
  halcon: { name: 'Ojo de halcón', glyph: '◉', desc: '+1 visión y +3% crítico.', mods: { vision: 1, crit: 3 } },
  carronero: { name: 'Bolsillos de carroñero', glyph: '(', desc: '+2 huecos de mochila.', mods: { slots: 2 } },
  buscador: { name: 'Zahorí de esencia', glyph: '✦', desc: '+12% esencia recogida.', mods: { essence: 12 } },
  calibre: { name: 'Calibrador', glyph: '/', desc: '+8% daño con todas las armas.', mods: { dmgPct: 8 } },
  brutal: { name: 'Brutalidad', glyph: '†', desc: '+30% daño cuerpo a cuerpo.', mods: { meleePct: 30 } },
  botiquin: { name: 'Manos de sanitaria', glyph: '+', desc: 'Las curaciones curan un 30% más.', mods: { healPct: 30 } },
  instinto: { name: 'Cuerpo de hierro', glyph: '♥', desc: 'Regenera 1 de salud cada 4 turnos.', mods: { regen: 1 } },
  matarife: { name: 'Matarife', glyph: '♣', desc: 'Cada baja te cura 3 de salud.', flags: { killHeal: 3 } },
  furia: { name: 'Furia de Stalingrado', glyph: '!', desc: 'Tras cada baja: +15% de daño durante 3 turnos.', flags: { killFrenzy: 15 } },
  recarga: { name: 'Recarga de campo', glyph: '"', desc: 'Recargar no consume turno.', flags: { quickReload: 1 } },
  minero: { name: 'Pulmones de minero', glyph: '≋', desc: 'Inmune al veneno de esporas.', flags: { poisonImmune: 1 } },
  aislante: { name: 'Aislado', glyph: 'ϟ', desc: 'Inmune a las anomalías eléctricas.', flags: { antiAnomaly: 1 } },
  botas: { name: 'Pies de pantano', glyph: '~', desc: 'El agua contaminada no te irradia.', flags: { waterproof: 1 } },
  adrenalina: { name: 'Adrenalina', glyph: '‼', desc: 'Una vez por expedición, al bajar del 25% de salud, cura 15.', flags: { autoInject: 15 } },
  sigilo: { name: 'Paso de lince', glyph: '·', desc: 'Los nidos dormidos te detectan a 2 casillas menos.', flags: { stealth: 2 } },
  comunion: { name: 'Comunión con la esencia', glyph: '✧', desc: 'Cada 8 de esencia recogida te cura 1 de salud.', flags: { essHeal: 8 } },
};
export const TALENT_EVERY = 3; // niveles entre elecciones de talento
