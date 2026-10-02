// Chebylitas: mutantes nacidos de la radiación a partir de elementos naturales.
// hue: tono propio. A nivel bajo, color tenue; a nivel alto, intenso.
export const ENEMIES = {
  rata: {
    name: 'Rata espinosa', glyph: 'r', hue: 350, origin: 'Animal', hp: 7, dmg: [1, 3], acc: 72, armor: 0, ev: 12, speed: 125,
    range: 1, xp: 4, ess: [2, 4], minL: 1, maxL: 5, group: [3, 6], abil: [],
    lore: 'Ratas de los sótanos cuyas púas se han calcificado con estroncio. Atacan en manada.',
  },
  polilla: {
    name: 'Polilla de ceniza', glyph: 'ж', hue: 72, origin: 'Insecto', hp: 5, dmg: [1, 2], acc: 76, armor: 0, ev: 26, speed: 160,
    range: 1, xp: 4, ess: [2, 3], minL: 1, maxL: 6, group: [3, 7], abil: ['erratic', 'radbite'],
    lore: 'Su polvo de alas es radiactivo. Revolotean sin rumbo hasta que huelen sangre.',
  },
  musgo: {
    name: 'Musgo errante', glyph: 'щ', hue: 118, origin: 'Planta', hp: 16, dmg: [2, 4], acc: 76, armor: 0, ev: 0, speed: 55,
    range: 1, xp: 5, ess: [3, 5], minL: 1, maxL: 8, group: [2, 4], abil: ['poison'],
    lore: 'Colonias de musgo que aprendieron a arrastrarse. Sus filamentos inyectan toxinas.',
  },
  esporangio: {
    name: 'Esporangio', glyph: 'ё', hue: 290, origin: 'Hongo', hp: 9, dmg: [0, 0], acc: 100, armor: 0, ev: 0, speed: 70,
    range: 1, xp: 5, ess: [3, 6], minL: 2, maxL: 8, group: [2, 4], abil: ['explode'],
    lore: 'Hongo hinchado de esporas. Revienta junto a sus víctimas liberando una nube tóxica.',
  },
  lobo: {
    name: 'Lobo de grafito', glyph: 'Л', hue: 196, origin: 'Animal', hp: 14, dmg: [3, 6], acc: 76, armor: 1, ev: 15, speed: 135,
    range: 1, xp: 7, ess: [4, 7], minL: 2, maxL: 9, group: [2, 5], abil: [],
    lore: 'Lobos del Bosque Rojo con escamas de grafito incrustadas. Cazan en jauría.',
  },
  cuervo: {
    name: 'Cuervo de plomo', glyph: 'в', hue: 262, origin: 'Ave', hp: 8, dmg: [2, 4], acc: 80, armor: 0, ev: 30, speed: 150,
    range: 1, xp: 6, ess: [3, 6], minL: 3, maxL: 9, group: [2, 5], abil: ['flying', 'radbite', 'erratic'],
    lore: 'Plumas pesadas como plomo. Vuela sobre el agua contaminada y picotea los ojos.',
  },
  cristal: {
    name: 'Cristal aullante', glyph: 'Ж', hue: 176, origin: 'Mineral', hp: 20, dmg: [4, 7], acc: 72, armor: 2, ev: 0, speed: 100,
    range: 7, xp: 9, ess: [6, 10], minL: 3, maxL: 10, group: [1, 3], abil: ['stationary', 'ranged', 'radbite'],
    lore: 'Formaciones de cuarzo que vibran con la radiación y disparan rayos ionizantes.',
  },
  golem: {
    name: 'Gólem de grafito', glyph: 'Ф', hue: 222, origin: 'Roca', hp: 45, dmg: [6, 11], acc: 70, armor: 3, ev: 0, speed: 70,
    range: 1, xp: 14, ess: [9, 14], minL: 4, maxL: 10, group: [1, 2], abil: [],
    lore: 'Bloques del moderador del reactor fundidos en una forma vagamente humana. Lento e imparable.',
  },
  jabali: {
    name: 'Jabalí de óxido', glyph: 'Б', hue: 322, origin: 'Animal', hp: 30, dmg: [5, 9], acc: 76, armor: 1, ev: 6, speed: 110,
    range: 1, xp: 12, ess: [7, 12], minL: 4, maxL: 10, group: [1, 3], abil: ['charge'],
    lore: 'Su piel se ha convertido en chapa oxidada. Embiste en línea recta a gran velocidad.',
  },
  raiz: {
    name: 'Raíz-madre', glyph: 'Ѱ', hue: 140, origin: 'Planta', hp: 55, dmg: [3, 6], acc: 80, armor: 2, ev: 0, speed: 100,
    range: 2, xp: 18, ess: [14, 22], minL: 5, maxL: 10, group: [1, 1], abil: ['stationary', 'spawn'],
    lore: 'Un nudo de raíces que palpita en el hormigón. Da a luz Musgo errante sin cesar.',
  },
  // ---- JEFES ----
  pastor: {
    name: 'El Pastor de Ceniza', glyph: 'Ω', hue: 2, origin: 'Desconocido', hp: 130, dmg: [8, 14], acc: 76, armor: 3, ev: 8, speed: 100,
    range: 6, xp: 60, ess: [60, 90], minL: 6, maxL: 10, group: [1, 1], abil: ['ranged', 'summon'], boss: 1,
    lore: 'Una figura alta envuelta en ceniza. Los lobos acuden a su llamada. Algunos dicen que fue un operario.',
  },
  coloso: {
    name: 'Coloso de corium', glyph: 'Ѫ', hue: 88, origin: 'Mineral', hp: 210, dmg: [12, 20], acc: 72, armor: 6, ev: 0, speed: 60,
    range: 1, xp: 90, ess: [90, 140], minL: 8, maxL: 10, group: [1, 1], abil: ['aura'], boss: 1,
    lore: 'Masa viva de combustible fundido. Su mera presencia abrasa con radiación.',
  },
};

export const ABIL_TEXT = {
  erratic: 'Movimiento errático', radbite: 'Mordisco radiactivo', poison: 'Veneno', explode: 'Revienta en gas tóxico',
  flying: 'Vuela', stationary: 'Inmóvil', ranged: 'Ataque a distancia', charge: 'Embestida', spawn: 'Engendra musgo',
  summon: 'Invoca lobos', aura: 'Aura de radiación',
};

// Color según tono y nivel (1..10): tenue a bajo nivel, intenso a alto
export function enemyColor(hue, level) {
  const L = Math.max(1, Math.min(10, level));
  const s = 22 + L * 7.8;
  const l = 34 + L * 3.6;
  return `hsl(${hue},${s}%,${l}%)`;
}

// Estadísticas escaladas por nivel
export function scaleEnemy(def, level) {
  const k = level - 1;
  return {
    hp: Math.round(def.hp * (1 + 0.32 * k)),
    dmg: [Math.round(def.dmg[0] * (1 + 0.2 * k)), Math.round(def.dmg[1] * (1 + 0.22 * k))],
    acc: def.acc + 2 * k,
    armor: def.armor + Math.floor(k / 3),
    ev: def.ev + k,
    ess: [Math.round(def.ess[0] * (1 + 0.45 * k)), Math.round(def.ess[1] * (1 + 0.45 * k))],
    xp: Math.round(def.xp * (1 + 0.4 * k)),
  };
}
