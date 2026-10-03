// Munición especial (fase 23.4): variantes de cada calibre. El arma usa cualquier munición de su calibre (`base`)
// y recuerda qué tipo lleva cargado; con la tecla N se elige el tipo para la siguiente recarga.
// ap: perforante · inc: incendiaria · hp: expansiva · ess: de esencia
export const AMMO_KINDS = {
  ap: { name: 'perforante', short: 'PERF', color: '#9fb8d0', tier: 1, value: 1.8, desc: 'Ignora 3 puntos de protección, pero hace un 10% menos de daño.' },
  inc: { name: 'incendiaria', short: 'INC', color: '#ff8a1f', tier: 1, value: 2, desc: 'Prende fuego al objetivo (quemaduras 3 turnos).' },
  hp: { name: 'expansiva', short: 'EXP', color: '#e05050', tier: 1, value: 1.6, desc: '+30% de daño contra objetivos sin protección; −50% contra blindados (protección 3 o más).' },
  ess: { name: 'de esencia', short: 'ESS', color: '#5ff7ff', tier: 2, value: 3, desc: '+20% de daño contra chebylitas. Brilla en la oscuridad.' },
};
// calibres con variantes (los demás —combustible, celdas, cohetes, granadas, 12,7— no tienen)
const BASES = {
  a_9x18: { name: '9×18 mm', tier: 0, stack: 120, value: 1, pack: 24 },
  a_545: { name: '5,45×39 mm', tier: 2, stack: 150, value: 2, pack: 30 },
  a_762: { name: '7,62×54R', tier: 3, stack: 100, value: 4, pack: 20 },
  a_762x39: { name: '7,62×39 mm', tier: 2, stack: 120, value: 2, pack: 30 },
  a_12: { name: 'cal. 12', tier: 1, stack: 60, value: 3, pack: 12 },
  a_556: { name: '5,56×45 mm', tier: 3, stack: 120, value: 4, pack: 20, west: 1 },
  a_9p: { name: '9×19 mm', tier: 2, stack: 120, value: 3, pack: 24, west: 1 },
};
export const SPECIAL_AMMO = {};
for (const [b, B] of Object.entries(BASES)) {
  for (const [k, K] of Object.entries(AMMO_KINDS)) {
    if (b === 'a_12' && k === 'ap') continue; // perdigones perforantes: no
    SPECIAL_AMMO[`${b}_${k}`] = {
      cat: 'ammo', name: `Munición ${B.name} ${K.name}`, glyph: '"', tier: Math.min(9, B.tier + K.tier), stack: B.stack, value: Math.max(2, Math.round(B.value * K.value)),
      pack: Math.max(6, Math.round(B.pack * 0.5)), base: b, kind: k, ...(B.west ? { west: 1 } : {}), desc: `Para las armas de ${B.name}. ${K.desc}`,
    };
  }
}
// calibre de un tipo de munición (el propio id si es la normal)
export const caliberOf = (b, ITEMS) => (ITEMS[b] && ITEMS[b].base) || b;
