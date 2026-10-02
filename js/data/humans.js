// Plantillas de personas (otras expediciones). Usan armas reales del catálogo de objetos.
// acc y ev en puntos (como los agentes: ×2 %). prot resta daño. loot: objetos que pueden soltar además de su arma.
// fase 18: nade (granada que lanzan), surrender (probabilidad de rendirse malheridos), cover (buscan cobertura),
// radio (avisan a su facción al verte), charm (azuzan chebylitas), stealthy (cuesta más verlos), trader (comercian)
const H = (o) => ({ kind: 'human', glyph: '@', speed: 100, abil: [], range: 1, xp: 15, prot: 0, ev: 3, acc: 3, flee: 0.3, surrender: 0.25, cover: 0.5, loot: [], ...o });

export const HUMANS = {
  // ---- RDA (aliados) ----
  rda_rifle: H({ name: 'Fusilero de la NVA', faction: 'rda', hp: 30, acc: 4, ev: 3, prot: 2, weapon: 'akm', xp: 16, loot: ['a_762x39', 'bandage', 'ipp'], lore: 'Soldado del Ejército Popular Nacional. Disciplinado y de pocas palabras.' }),
  rda_officer: H({ name: 'Oficial de la Stasi', faction: 'rda', hp: 26, acc: 5, ev: 4, prot: 1, weapon: 'makarov', xp: 18, loot: ['docs', 'a_9x18'], lore: 'Vigila a sus propios científicos tanto como a los chebylitas.' }),
  rda_scientist: H({ name: 'Científica de Wismut', faction: 'rda', hp: 20, acc: 2, ev: 3, prot: 0, weapon: 'tt33', xp: 10, flee: 0.8, gasImmune: 1, loot: ['geiger', 'graphsample', 'antirad'], lore: 'Experta en uranio de las minas de Sajonia. Mide todo dos veces.' }),
  // ---- Suecia (neutrales) ----
  swe_scientist: H({ name: 'Dosimetrista sueco', faction: 'suecia', hp: 20, acc: 2, ev: 4, prot: 0, weapon: 'tt33', xp: 10, flee: 0.9, gasImmune: 1, loot: ['dosimeter', 'prussian', 'board'], lore: 'Detectó la nube en Forsmark antes que nadie. Ahora quiere ver su origen.' }),
  swe_guard: H({ name: 'Escolta sueco', faction: 'suecia', hp: 30, acc: 4, ev: 4, prot: 2, weapon: 'saigamk', xp: 15, loot: ['a_545', 'ai2'], lore: 'Exmilitar contratado como guía. Educado, pero no dudará en defenderse.' }),
  // ---- EE. UU. (hostiles) ----
  usa_operator: H({ name: 'Operador de la Fuerza Delta', faction: 'usa', hp: 34, acc: 6, ev: 5, prot: 3, weapon: 'ak74', xp: 24, flee: 0.15, surrender: 0.05, cover: 0.8, radio: 1, nade: 'f1', loot: ['a_545', 'ai2', 'f1', 'mre'], lore: 'Armado con material capturado para no dejar rastro. No hace prisioneros.' }),
  usa_elite: H({ name: 'Operador de élite «Nightingale»', faction: 'usa', hp: 46, acc: 7, ev: 6, prot: 4, weapon: 'm16a2', xp: 34, flee: 0.1, surrender: 0.03, cover: 0.9, radio: 1, nade: 'f1', loot: ['a_556', 'intel', 'ai2', 'f1', 'pvs5', 'pasgt'], lore: 'Fuerzas especiales con equipo occidental. Hablan poco y nunca fallan dos veces.' }),
  usa_gunner: H({ name: 'Ametrallador «Nightingale»', faction: 'usa', hp: 50, acc: 5, ev: 3, prot: 4, weapon: 'm60', xp: 32, flee: 0.1, surrender: 0.05, cover: 0.9, radio: 1, loot: ['a_762n', 'pasgtvest', 'mre'], lore: 'Carga la M60 como si fuera un juguete. Cubre a los demás mientras flanquean.' }),
  usa_turret: H({ name: 'Torreta automática', glyph: 'Ŧ', faction: 'usa', hp: 34, acc: 6, ev: 0, prot: 5, weapon: 'rpk', xp: 22, flee: 0, surrender: 0, cover: 0, stationary: 1, mech: 1, noDrop: 1, loot: ['parts', 'parts'], lore: 'Ametralladora con sensor de movimiento. No duerme ni negocia.' }),
  usa_camera: H({ name: 'Cámara de vigilancia', glyph: '◉', faction: 'usa', hp: 8, acc: 0, ev: 0, prot: 1, weapon: null, xp: 6, flee: 0, surrender: 0, cover: 0, stationary: 1, mech: 1, alarm: 1, loot: ['parts'], lore: 'Si te ve, toda la base lo sabrá.' }),
  // ---- Contrabandistas (neutrales) ----
  smuggler: H({ name: 'Contrabandista', faction: 'contrabandistas', hp: 26, acc: 4, ev: 5, prot: 1, weapon: 'toz', xp: 14, flee: 0.5, loot: ['a_12', 'vodka', 'docs'], lore: 'Compra barato, vende caro y no pregunta de dónde sale nada.' }),
  usa_sniper: H({ name: 'Tirador de la CIA', faction: 'usa', hp: 26, acc: 8, ev: 4, prot: 1, weapon: 'svd', xp: 26, flee: 0.4, surrender: 0.1, cover: 0.9, radio: 1, loot: ['a_762', 'docs', 'pso'], lore: 'Dispara desde lejos y cambia de posición después de cada tiro.' }),
  // ---- RDA: más variedad (fase 18)
  rda_sapper: H({ name: 'Zapador de la NVA', faction: 'rda', hp: 30, acc: 4, ev: 3, prot: 2, weapon: 'mpikm', xp: 18, nade: 'rgd5', radio: 1, loot: ['a_762x39', 'redflare', 'rgd5'], lore: 'Lleva la radio de la patrulla y bengalas rojas para pedir apoyo.' }),
  // ---- Cuba (aliados)
  cuba_medic: H({ name: 'Médica de la Brigada «Playa Girón»', faction: 'cuba', hp: 22, acc: 3, ev: 4, prot: 1, weapon: 'makarov', xp: 12, flee: 0.8, trader: 1, loot: ['gironkit', 'habano', 'ipp'], lore: 'Vino a curar niños y se quedó a curar a todos. Fuma puros de Pinar del Río.' }),
  cuba_engineer: H({ name: 'Ingeniero cubano', faction: 'cuba', hp: 28, acc: 4, ev: 4, prot: 2, weapon: 'akm', xp: 15, radio: 1, loot: ['a_762x39', 'habano', 'parts'], lore: 'Repara cualquier cosa con alambre y paciencia caribeña.' }),
  // ---- Checoslovaquia
  cz_miner: H({ name: 'Minero del grupo «Tatra»', faction: 'checos', hp: 32, acc: 4, ev: 3, prot: 2, weapon: 'vz58', xp: 16, nade: 'semtex', trader: 1, loot: ['a_762x39', 'semtex', 'cz75'], lore: 'Ha volado más galerías en Ostrava que tú has pisado.' }),
  cz_sapper: H({ name: 'Zapador checo', faction: 'checos', hp: 26, acc: 5, ev: 5, prot: 1, weapon: 'skorpion', xp: 15, nade: 'semtex', loot: ['a_9x18', 'semtex', 'skorpion'], lore: 'Con el Škorpion en una mano y el detonador en la otra.' }),
  // ---- Finlandia
  fin_scout: H({ name: 'Explorador de la misión «Sisu»', faction: 'finlandia', hp: 28, acc: 6, ev: 7, prot: 1, weapon: 'rk62', xp: 18, stealthy: 1, trader: 1, cover: 0.8, loot: ['a_762x39', 'm62coat', 'skirucksack', 'mapcase'], lore: 'No le oyes llegar. Tampoco le oyes irse.' }),
  // ---- Yugoslavia
  yu_trader: H({ name: 'Comerciante yugoslavo', faction: 'yugo', hp: 24, acc: 3, ev: 4, prot: 1, weapon: 'm70', xp: 12, flee: 0.7, trader: 1, loot: ['rakija', 'a_762x39', 'vodka', 'foreigndiary'], lore: 'Pasaporte de Belgrado, sonrisa de Sarajevo y precios de Trieste.' }),
  yu_guard: H({ name: 'Escolta yugoslavo', faction: 'yugo', hp: 30, acc: 4, ev: 4, prot: 2, weapon: 'm70', xp: 15, loot: ['rakija', 'a_762x39'], lore: 'Cobra por días. Dispara por horas.' }),
  // ---- Reino Unido (hostiles)
  uk_sniper: H({ name: 'Tirador del SAS', faction: 'uk', hp: 26, acc: 9, ev: 5, prot: 1, weapon: 'l42', xp: 30, flee: 0.4, surrender: 0.1, cover: 1, stealthy: 1, loot: ['a_762n', 'smock', 'claymore'], lore: 'Espera. Espera. Espera. Y luego, una sola bala.' }),
  uk_soldier: H({ name: 'Soldado del destacamento «Saxon»', faction: 'uk', hp: 34, acc: 6, ev: 5, prot: 3, weapon: 'sa80', xp: 24, surrender: 0.1, cover: 0.8, radio: 1, nade: 'rgd5', loot: ['a_556', 'hipower', 'claymore', 'smock'], lore: 'Boina, té en el termo y una mina Claymore en cada bolsillo.' }),
  uk_scout: H({ name: 'Explorador del SAS', faction: 'uk', hp: 28, acc: 6, ev: 6, prot: 2, weapon: 'sterling', xp: 22, surrender: 0.1, cover: 0.8, loot: ['a_9p', 'hipower'], lore: 'Rápido, callado y con el subfusil siempre en ráfaga.' }),
  // ---- Merodeadores (hostiles, negociables)
  mar_thug: H({ name: 'Merodeador', faction: 'merodeadores', hp: 22, acc: 3, ev: 4, prot: 0, weapon: 'sawnoff', xp: 10, flee: 0.7, surrender: 0.5, cover: 0.2, loot: ['a_12', 'vodka', 'bandage'], lore: 'Vivía de vender cobre de las casas vacías. Ahora vende lo que te quite.' }),
  mar_gunner: H({ name: 'Merodeador armado', faction: 'merodeadores', hp: 26, acc: 4, ev: 4, prot: 1, weapon: 'ppsh', xp: 13, flee: 0.6, surrender: 0.45, cover: 0.3, loot: ['a_9x18', 'vodka', 'docs'], lore: 'Un PPSh de la Gran Guerra Patria y ninguna patria.' }),
  // ---- Desertores (hostiles, negociables y reclutables)
  des_soldier: H({ name: 'Desertor', faction: 'desertores', hp: 30, acc: 5, ev: 4, prot: 2, weapon: 'ak74', xp: 16, flee: 0.4, surrender: 0.4, cover: 0.7, nade: 'rgd5', loot: ['a_545', 'ssh68', 'rgd5'], lore: 'Le ordenaron evacuar Prípiat. Decidió no volver a obedecer a nadie.' }),
  des_sergeant: H({ name: 'Sargento desertor', faction: 'desertores', hp: 38, acc: 6, ev: 4, prot: 3, weapon: 'rpk', xp: 22, flee: 0.2, surrender: 0.3, cover: 0.8, radio: 1, loot: ['a_545', 'ai2', 'f1'], lore: 'Afganistán, 1983. Chernóbil, 1986. No piensa esperar a la tercera.' }),
  // ---- Congregación de la Ceniza (hostiles)
  cult_acolyte: H({ name: 'Acólito de la Ceniza', faction: 'culto', hp: 24, acc: 3, ev: 5, prot: 0, weapon: 'machete', xp: 14, flee: 0, surrender: 0, cover: 0, gasImmune: 1, loot: ['relic', 'antirad'], lore: 'Se frota la piel con ceniza del reactor. Dice que así los chebylitas le reconocen.' }),
  cult_priest: H({ name: 'Sacerdote de la Ceniza', faction: 'culto', hp: 30, acc: 4, ev: 4, prot: 1, weapon: 'nagant', xp: 30, flee: 0.5, surrender: 0, cover: 0.3, charm: 1, gasImmune: 1, loot: ['relic', 'ashrosary', 'essamp'], lore: 'Canta en una lengua que no existe. Los chebylitas que le oyen se vuelven contra ti.' }),
};

// patrullas tipo de cada facción: [tipo, mín, máx]
export const SQUADS = {
  rda: [['rda_rifle', 2, 3], ['rda_sapper', 0, 1], ['rda_officer', 0, 1], ['rda_scientist', 0, 1]],
  cuba: [['cuba_engineer', 1, 2], ['cuba_medic', 1, 1]],
  checos: [['cz_miner', 1, 2], ['cz_sapper', 1, 2]],
  suecia: [['swe_guard', 1, 2], ['swe_scientist', 1, 2]],
  finlandia: [['fin_scout', 2, 3]],
  yugo: [['yu_trader', 1, 1], ['yu_guard', 1, 2]],
  contrabandistas: [['smuggler', 2, 3]],
  usa: [['usa_operator', 2, 3], ['usa_elite', 0, 1], ['usa_gunner', 0, 1], ['usa_sniper', 0, 1]],
  uk: [['uk_soldier', 1, 2], ['uk_scout', 1, 1], ['uk_sniper', 0, 1]],
  merodeadores: [['mar_thug', 2, 3], ['mar_gunner', 1, 2]],
  desertores: [['des_soldier', 2, 3], ['des_sergeant', 0, 1]],
  culto: [['cult_acolyte', 2, 4], ['cult_priest', 1, 1]],
};
// nivel mínimo de zona (tier) para que aparezca cada facción en las patrullas normales
export const SQUAD_MIN_TIER = { rda: 0, cuba: 0, checos: 1, suecia: 0, finlandia: 1, yugo: 0, contrabandistas: 1, merodeadores: 1, desertores: 2, usa: 3, uk: 3, culto: 4 };

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
