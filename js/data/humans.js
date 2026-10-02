// Plantillas de personas (otras expediciones). Usan armas reales del catálogo de objetos.
// acc y ev en puntos (como los agentes: ×2 %). prot resta daño. loot: objetos que pueden soltar además de su arma.
const H = (o) => ({ kind: 'human', glyph: '@', speed: 100, abil: [], range: 1, xp: 15, prot: 0, ev: 3, acc: 3, flee: 0.3, loot: [], ...o });

export const HUMANS = {
  // ---- RDA (aliados) ----
  rda_rifle: H({ name: 'Fusilero de la NVA', faction: 'rda', hp: 30, acc: 4, ev: 3, prot: 2, weapon: 'akm', xp: 16, loot: ['a_762x39', 'bandage', 'ipp'], lore: 'Soldado del Ejército Popular Nacional. Disciplinado y de pocas palabras.' }),
  rda_officer: H({ name: 'Oficial de la Stasi', faction: 'rda', hp: 26, acc: 5, ev: 4, prot: 1, weapon: 'makarov', xp: 18, loot: ['docs', 'a_9x18'], lore: 'Vigila a sus propios científicos tanto como a los chebylitas.' }),
  rda_scientist: H({ name: 'Científica de Wismut', faction: 'rda', hp: 20, acc: 2, ev: 3, prot: 0, weapon: 'tt33', xp: 10, flee: 0.8, gasImmune: 1, loot: ['geiger', 'graphsample', 'antirad'], lore: 'Experta en uranio de las minas de Sajonia. Mide todo dos veces.' }),
  // ---- Suecia (neutrales) ----
  swe_scientist: H({ name: 'Dosimetrista sueco', faction: 'suecia', hp: 20, acc: 2, ev: 4, prot: 0, weapon: 'tt33', xp: 10, flee: 0.9, gasImmune: 1, loot: ['dosimeter', 'prussian', 'board'], lore: 'Detectó la nube en Forsmark antes que nadie. Ahora quiere ver su origen.' }),
  swe_guard: H({ name: 'Escolta sueco', faction: 'suecia', hp: 30, acc: 4, ev: 4, prot: 2, weapon: 'saigamk', xp: 15, loot: ['a_545', 'ai2'], lore: 'Exmilitar contratado como guía. Educado, pero no dudará en defenderse.' }),
  // ---- EE. UU. (hostiles) ----
  usa_operator: H({ name: 'Operador de la Fuerza Delta', faction: 'usa', hp: 34, acc: 6, ev: 5, prot: 3, weapon: 'ak74', xp: 24, flee: 0.15, loot: ['a_545', 'ai2', 'f1'], lore: 'Armado con material capturado para no dejar rastro. No hace prisioneros.' }),
  usa_sniper: H({ name: 'Tirador de la CIA', faction: 'usa', hp: 26, acc: 8, ev: 4, prot: 1, weapon: 'svd', xp: 26, flee: 0.4, loot: ['a_762', 'docs', 'pso'], lore: 'Dispara desde lejos y cambia de posición después de cada tiro.' }),
};

// estadísticas escaladas por nivel
export function scaleHuman(def, level) {
  const k = level - 1;
  return {
    hp: Math.round(def.hp * (1 + 0.18 * k)),
    acc: def.acc + Math.floor(k * 0.6),
    ev: (def.ev + k * 0.5) * 2, // en % (como la esquiva de los chebylitas)
    armor: def.prot + Math.floor(k / 3),
    ess: [0, 0],
    xp: Math.round(def.xp * (1 + 0.3 * k)),
    dmg: [0, 0],
  };
}
