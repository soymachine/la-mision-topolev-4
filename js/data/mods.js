// Mods de armas: cada arma tiene ranuras según su tipo y cada mod solo encaja en ciertos tipos
export const MOD_SLOTS = {
  optic: { name: 'Óptica', glyph: '⌖' },
  muzzle: { name: 'Boca', glyph: '»' },
  grip: { name: 'Empuñadura', glyph: '╤' },
  mag: { name: 'Cargador', glyph: '▮' },
  stock: { name: 'Culata', glyph: '◣' },
  under: { name: 'Bajo cañón', glyph: '┬' },
};

// ranuras por tipo de arma
export const WTYPE_SLOTS = {
  melee: [],
  pistol: ['optic', 'muzzle', 'mag', 'under'],
  smg: ['optic', 'muzzle', 'grip', 'mag', 'stock', 'under'],
  shotgun: ['muzzle', 'grip', 'mag', 'stock', 'under'],
  rifle: ['optic', 'muzzle', 'grip', 'mag', 'stock', 'under'],
  sniper: ['optic', 'muzzle', 'grip', 'mag', 'stock'],
  mg: ['optic', 'muzzle', 'grip', 'stock'],
  flame: [],
  launcher: ['optic'],
  energy: ['optic'],
};
// excepciones por arma concreta (silenciador integrado, revólveres, tambores fijos…)
export const WEAPON_NO_SLOT = {
  pb: ['muzzle'], asval: ['muzzle'], vss: ['muzzle'], nagant: ['muzzle', 'mag'], ots38: ['muzzle', 'mag'],
  sawnoff: ['stock', 'mag', 'grip'], toz: ['mag'], mosin: ['mag'], mosinpu: ['optic', 'mag'], ppsh: ['mag'], bizon: ['mag'],
  rpd: ['mag'], dp27: ['optic'], pecheneg: ['muzzle'], groza: ['stock', 'under'], gp25: ['optic'],
};
export function weaponSlots(id, wtype) {
  const no = WEAPON_NO_SLOT[id] || [];
  return (WTYPE_SLOTS[wtype] || []).filter((s) => !no.includes(s));
}

const M = (o) => ({ cat: 'mod', glyph: '¬', stack: 1, ...o });
// Efectos: acc (precisión %), range, crit, noise, magPct, dmgPct, pierce, scope (penaliza a quemarropa),
// still (precisión extra si no te moviste el turno anterior), vision (visión del agente), bayonet (puñalada extra adyacente)
export const MODS = {
  // ---- ÓPTICAS ----
  kobra: M({ name: 'Colimador «Kobra» EKP-1', slot: 'optic', fits: ['pistol', 'smg', 'rifle', 'mg'], tier: 1, acc: 8, value: 140, desc: 'Punto rojo. Apuntar rápido en pasillos.' }),
  p1p29: M({ name: 'Colimador 1P29 «Tulip»', slot: 'optic', fits: ['smg', 'rifle', 'mg'], tier: 2, acc: 10, range: 1, value: 260, desc: 'Óptica de infantería de 2,7 aumentos.' }),
  pu: M({ name: 'Mira PU 3,5×', slot: 'optic', fits: ['rifle', 'sniper'], tier: 1, acc: 5, range: 4, scope: 1, value: 200, desc: 'Mira de tirador de la Gran Guerra. Convierte un fusil en arma de tirador.' }),
  pso: M({ name: 'Mira óptica PSO-1 4×', slot: 'optic', fits: ['rifle', 'sniper', 'smg'], tier: 2, acc: 6, range: 5, crit: 5, scope: 1, value: 400, desc: 'Convierte una carabina en un fusil de tirador: más alcance y crítico, peor a quemarropa.' }),
  pso6: M({ name: 'Mira PSO-1M2 6×', slot: 'optic', fits: ['rifle', 'sniper'], tier: 3, acc: 8, range: 7, crit: 8, scope: 1, value: 650, desc: 'Retícula con telémetro. Para disparos muy largos.' }),
  nspu: M({ name: 'Mira nocturna NSPU', slot: 'optic', fits: ['rifle', 'sniper', 'mg'], tier: 3, acc: 5, range: 3, vision: 2, scope: 1, value: 700, desc: 'Intensificador de imagen: +2 de visión al agente que la lleve.' }),
  quadrant: M({ name: 'Alza de cuadrante', slot: 'optic', fits: ['launcher'], tier: 3, acc: 12, range: 2, value: 380, desc: 'Calcula la parábola de granadas y cohetes.' }),
  topoleye: M({ name: 'Mira de esencia «Ojo de Topolev»', slot: 'optic', fits: ['rifle', 'sniper', 'energy', 'launcher'], tier: 5, acc: 12, range: 6, crit: 12, value: 1800, desc: 'Una lente de cristal aullante. Ve lo que aún no se ha movido.' }),

  // ---- BOCAS ----
  pbs1: M({ name: 'Silenciador PBS-1', slot: 'muzzle', fits: ['pistol', 'smg', 'rifle'], tier: 1, noise: -7, dmgPct: -5, value: 180, desc: 'Reduce mucho el ruido a costa de algo de potencia.' }),
  pbs4: M({ name: 'Silenciador PBS-4', slot: 'muzzle', fits: ['smg', 'rifle', 'sniper'], tier: 3, noise: -9, value: 450, desc: 'Silenciador moderno sin pérdida de potencia.' }),
  tgp: M({ name: 'Silenciador TGP-A', slot: 'muzzle', fits: ['smg', 'rifle', 'sniper'], tier: 4, noise: -10, acc: 3, value: 800, desc: 'De las fuerzas especiales. Silencio absoluto.' }),
  comp: M({ name: 'Compensador de AK', slot: 'muzzle', fits: ['smg', 'rifle', 'mg'], tier: 1, acc: 5, value: 120, desc: 'Controla el retroceso en ráfagas.' }),
  hider: M({ name: 'Apagallamas', slot: 'muzzle', fits: ['rifle', 'mg', 'sniper'], tier: 2, acc: 3, crit: 3, value: 160, desc: 'Oculta el fogonazo y estabiliza el tiro.' }),
  dtk: M({ name: 'Freno de boca DTK', slot: 'muzzle', fits: ['rifle', 'mg', 'sniper'], tier: 3, acc: 8, value: 420, desc: 'Reduce el retroceso de armas pesadas.' }),
  choke: M({ name: 'Estrangulador de escopeta', slot: 'muzzle', fits: ['shotgun'], tier: 1, acc: 5, range: 1, value: 120, desc: 'Agrupa los perdigones: más alcance.' }),
  spreader: M({ name: 'Dispersor de perdigones', slot: 'muzzle', fits: ['shotgun'], tier: 2, dmgPct: 12, range: -1, value: 200, desc: 'Abre el haz de perdigones. Brutal de cerca.' }),

  // ---- EMPUÑADURAS ----
  vgrip: M({ name: 'Empuñadura vertical RK-0', slot: 'grip', fits: ['smg', 'rifle', 'shotgun', 'mg'], tier: 1, acc: 5, value: 110, desc: 'Más control en el tiro.' }),
  rgrip: M({ name: 'Empuñadura de goma', slot: 'grip', fits: ['smg', 'rifle', 'shotgun'], tier: 0, acc: 3, crit: 3, value: 60, desc: 'Agarre firme incluso con guantes de plomo.' }),
  bipod: M({ name: 'Bípode plegable', slot: 'grip', fits: ['mg', 'sniper', 'rifle'], tier: 2, still: 14, value: 260, desc: '+14% de precisión si el agente no se movió el turno anterior.' }),

  // ---- CARGADORES ----
  extmag: M({ name: 'Cargador ampliado', slot: 'mag', fits: ['pistol', 'smg', 'rifle'], tier: 1, magPct: 50, value: 140, desc: '+50% de capacidad.' }),
  drum: M({ name: 'Tambor de 75 cartuchos', slot: 'mag', fits: ['rifle', 'mg', 'smg'], tier: 2, magPct: 150, acc: -4, value: 320, desc: 'Mucha munición, algo de peso.' }),
  tube: M({ name: 'Tubo de cartuchos extendido', slot: 'mag', fits: ['shotgun'], tier: 1, magPct: 60, value: 130, desc: 'Más cartuchos para la escopeta.' }),
  clips: M({ name: 'Peines de carga rápida', slot: 'mag', fits: ['sniper'], tier: 2, magPct: 30, crit: 4, value: 220, desc: 'Recarga ordenada y más disparos.' }),
  apmag: M({ name: 'Cargador de puntas perforantes', slot: 'mag', fits: ['pistol', 'smg', 'rifle', 'sniper', 'mg'], tier: 3, pierce: 2, magPct: -20, value: 500, desc: 'Balas de núcleo de acero: ignoran 2 de blindaje.' }),
  tracer: M({ name: 'Cargador de trazadoras', slot: 'mag', fits: ['smg', 'rifle', 'mg'], tier: 2, acc: 4, crit: 5, value: 240, desc: 'Ves dónde van las balas.' }),

  // ---- CULATAS ----
  fold: M({ name: 'Culata plegable de AKS', slot: 'stock', fits: ['smg', 'rifle'], tier: 0, acc: 4, value: 70, desc: 'Apoyo al hombro sin estorbar en pasillos.' }),
  cheek: M({ name: 'Culata de tirador con carrillera', slot: 'stock', fits: ['sniper', 'rifle'], tier: 2, acc: 6, crit: 6, value: 280, desc: 'Ojo siempre alineado con la mira.' }),
  pad: M({ name: 'Culata con amortiguador', slot: 'stock', fits: ['shotgun', 'mg'], tier: 1, acc: 5, value: 120, desc: 'Absorbe el retroceso de armas brutas.' }),

  // ---- BAJO CAÑÓN ----
  bayo: M({ name: 'Bayoneta acoplada 6Kh5', slot: 'under', fits: ['rifle', 'smg', 'shotgun'], tier: 1, bayonet: 1, value: 120, desc: 'Al disparar a un enemigo adyacente añade una puñalada (4–8).' }),
  light: M({ name: 'Linterna táctica', slot: 'under', fits: ['pistol', 'smg', 'rifle', 'shotgun'], tier: 1, acc: 3, vision: 1, value: 120, desc: '+1 de visión al agente y algo de precisión.' }),
  laser: M({ name: 'Puntero láser LTs-1', slot: 'under', fits: ['pistol', 'smg', 'rifle', 'shotgun'], tier: 3, acc: 8, value: 420, desc: 'Prototipo militar. El punto rojo asusta hasta a los lobos.' }),
};
