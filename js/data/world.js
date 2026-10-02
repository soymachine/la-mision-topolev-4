// Mapas (localizaciones), módulos de la base, nombres y rasgos

export const MAPS = [
  {
    id: 'admin', name: 'Bloque Administrativo', short: 'ADMIN', lvl: [1, 2], w: 104, h: 66, sx: 3, sy: 2,
    zones: { industrial: 0.75, ruinas: 0.25 }, enemies: ['rata', 'polilla', 'musgo', 'esporangio'],
    ambientRad: 0, nests: [4, 5], veins: [3, 4], caches: [3, 4], hazards: [2, 3],
    desc: 'Oficinas, archivos y vestuarios del personal. La puerta de entrada a las profundidades.',
  },
  {
    id: 'turbinas', name: 'Sala de Turbinas', short: 'TURB', lvl: [3, 4], w: 122, h: 74, sx: 3, sy: 3,
    zones: { industrial: 0.55, ruinas: 0.3, caverna: 0.15 }, enemies: ['rata', 'polilla', 'musgo', 'esporangio', 'lobo', 'cuervo', 'cristal', 'golem'],
    ambientRad: 0.15, nests: [5, 6], veins: [3, 5], caches: [4, 5], hazards: [3, 4],
    desc: 'Naves gigantescas con turbinas destripadas. El techo gotea agua radiactiva.',
  },
  {
    id: 'refrig', name: 'Canales de Refrigeración', short: 'REFR', lvl: [5, 6], w: 136, h: 82, sx: 4, sy: 3,
    zones: { inundado: 0.45, industrial: 0.25, caverna: 0.3 }, enemies: ['musgo', 'esporangio', 'lobo', 'cuervo', 'cristal', 'golem', 'jabali', 'raiz'],
    ambientRad: 0.3, nests: [6, 7], veins: [4, 5], caches: [4, 6], hazards: [4, 5],
    desc: 'Túneles inundados por donde el agua de refrigeración huyó del reactor.',
  },
  {
    id: 'galerias', name: 'Galerías Profundas', short: 'GAL', lvl: [7, 8], w: 146, h: 88, sx: 4, sy: 3,
    zones: { caverna: 0.6, inundado: 0.2, ruinas: 0.2 }, enemies: ['esporangio', 'lobo', 'cuervo', 'cristal', 'golem', 'jabali', 'raiz', 'pastor'],
    ambientRad: 0.5, nests: [6, 8], veins: [5, 6], caches: [5, 6], hazards: [5, 6],
    desc: 'Grietas abiertas por la explosión bajo los cimientos. Aquí los chebylitas anidan.',
  },
  {
    id: 'sarcofago', name: 'Sarcófago — Reactor 4', short: 'SARC', lvl: [9, 10], w: 156, h: 94, sx: 4, sy: 4,
    zones: { ruinas: 0.4, caverna: 0.35, industrial: 0.25 }, enemies: ['cuervo', 'cristal', 'golem', 'jabali', 'raiz', 'lobo', 'pastor', 'coloso'],
    ambientRad: 0.9, nests: [7, 9], veins: [6, 7], caches: [6, 7], hazards: [6, 8],
    desc: 'El corazón de la catástrofe. El corium late. Nadie ha vuelto con vida... todavía.',
  },
];

export const SECTOR_NAMES = {
  industrial: ['Sala de control', 'Archivo', 'Vestuarios', 'Comedor', 'Taller eléctrico', 'Laboratorio dosimétrico', 'Sala de bombas', 'Oficinas', 'Almacén técnico', 'Pasillo de servicio', 'Subestación', 'Sala de cables'],
  ruinas: ['Ala derrumbada', 'Escombrera', 'Nave colapsada', 'Forjado caído', 'Sala calcinada', 'Pasarela rota'],
  caverna: ['Gruta', 'Fisura', 'Cavidad colapsada', 'Sima', 'Galería natural', 'Nido de raíces'],
  inundado: ['Canal', 'Colector', 'Piscina de supresión', 'Depósito', 'Esclusa', 'Cisterna'],
};

// Módulos de la base. Nivel 0..5
export const MODULES = [
  { id: 'armeria', name: 'Armería', glyph: '╦', desc: 'Desbloquea armas más potentes en la intendencia.', eff: (l) => `Armas de nivel ${l} disponibles` },
  { id: 'polvorin', name: 'Polvorín', glyph: '≡', desc: 'Producción de munición: munición gratis al partir y descuentos.', eff: (l) => `${l * 15}% de descuento en munición · ${l} cargadores gratis por agente` },
  { id: 'blindaje', name: 'Taller de blindaje', glyph: '▓', desc: 'Desbloquea armaduras y cascos superiores.', eff: (l) => `Protecciones de nivel ${l} disponibles` },
  { id: 'enfermeria', name: 'Enfermería', glyph: '+', desc: 'Medicinas mejores, recuperación entre expediciones y tratamientos baratos.', eff: (l) => `Consumibles nivel ${l} · recuperación ${30 + l * 14}%/día · tratamiento −${l * 12}%` },
  { id: 'taller', name: 'Taller de gadgets', glyph: '¤', desc: 'Desbloquea gadgets, granadas y mochilas.', eff: (l) => `Gadgets de nivel ${l} disponibles` },
  { id: 'radar', name: 'Radar subterráneo', glyph: '◎', desc: 'Más extracciones temporales y más información en el minimapa.', eff: (l) => ['Nidos y extracciones', '+ extracciones temporales', '+ rareza de los alijos', '+ chebylitas errantes en el radar', '+ planos parciales del mapa', '+ extracción permanente extra'][l] },
  { id: 'barracones', name: 'Barracones', glyph: '⌂', desc: 'Más agentes en plantilla y escuadrones más grandes.', eff: (l) => `Plantilla ${4 + l * 2} · escuadrón de ${squadSize(l)}` },
  { id: 'almacen', name: 'Almacén', glyph: '▤', desc: 'Más capacidad para guardar objetos en la base.', eff: (l) => `Capacidad ${stashSize(l)} objetos` },
  { id: 'laboratorio', name: 'Laboratorio de esencia', glyph: '✦', desc: 'Extrae más esencia de cada chebylita y desbloquea la tecnología de esencia.', eff: (l) => `+${l * 10}% esencia${l >= 3 ? ' · celdas de esencia' : ''}` },
];
export const MODULE_MAX = 5;
export function squadSize(l) { return l >= 4 ? 4 : l >= 2 ? 3 : 2; }
export function rosterSize(l) { return 4 + l * 2; }
export function stashSize(l) { return 40 + l * 20; }
export function moduleCost(id, lvl) {
  // coste para pasar de lvl a lvl+1
  const ess = [40, 120, 300, 650, 1300][lvl];
  const rub = [150, 400, 900, 1800, 3500][lvl];
  const f = { armeria: 1, polvorin: 0.7, blindaje: 1, enfermeria: 0.8, taller: 0.9, radar: 1.1, barracones: 1.2, almacen: 0.6, laboratorio: 1.3 }[id] || 1;
  return { ess: Math.round(ess * f), rub: Math.round(rub * f) };
}

export const FIRST_NAMES_M = ['Yuri', 'Aleksei', 'Dmitri', 'Sergei', 'Nikolai', 'Iván', 'Mijaíl', 'Víktor', 'Pável', 'Oleg', 'Borís', 'Grigori', 'Anatoli', 'Vasili', 'Fiódor', 'Leonid', 'Andréi', 'Konstantín', 'Stepán', 'Tarás', 'Bogdán', 'Mykola', 'Arkadi', 'Valeri'];
export const FIRST_NAMES_F = ['Natalia', 'Olga', 'Tatiana', 'Irina', 'Svetlana', 'Liudmila', 'Valentina', 'Yelena', 'Oksana', 'Galina', 'Vera', 'Nadezhda', 'Zoya', 'Larisa', 'Daria', 'Anastasia'];
export const LAST_NAMES = ['Petrenko', 'Kovalenko', 'Sokolov', 'Morozov', 'Volkov', 'Lébedev', 'Kuznetsov', 'Shevchenko', 'Bondarenko', 'Tkachenko', 'Melnyk', 'Záitsev', 'Orlov', 'Kozlov', 'Pávlov', 'Belov', 'Grómov', 'Ivanenko', 'Diachenko', 'Sidorov', 'Yákovlev', 'Fiódorov', 'Rybakov', 'Zhukov', 'Antonov', 'Karpenko'];
export const NICKNAMES = ['Lobo', 'Geiger', 'Oso', 'Cuervo', 'Pala', 'Sombra', 'Chispa', 'Plomo', 'Kalash', 'Zorro', 'Tundra', 'Lince', 'Topo', 'Grafito', 'Abuelo', 'Sputnik', 'Cosaco', 'Halcón', 'Isótopo', 'Ceniza', 'Bisonte', 'Yodo'];

export const TRAITS = [
  { id: 'tirador', name: 'Tirador de Afganistán', desc: '+4 puntería', mod: { acc: 4 } },
  { id: 'robusto', name: 'Robusto', desc: '+8 salud máx.', mod: { hp: 8 } },
  { id: 'liquidador', name: 'Liquidador veterano', desc: '+20% resistencia a la radiación', mod: { rad: 20 } },
  { id: 'agil', name: 'Ágil', desc: '+3 agilidad', mod: { ev: 3 } },
  { id: 'carronero', name: 'Carroñero', desc: '+3 huecos de mochila', mod: { slots: 3 } },
  { id: 'supersticioso', name: 'Supersticioso', desc: '+15% esencia recogida', mod: { essence: 15 } },
  { id: 'sanitario', name: 'Sanitario', desc: 'Las curaciones curan un 50% más', mod: { healPct: 50 } },
  { id: 'minero', name: 'Minero del Donbás', desc: 'Extrae esencia de las vetas el doble de rápido', mod: { mining: 1 } },
  { id: 'nervioso', name: 'Nervioso', desc: '−3 puntería, +3 agilidad', mod: { acc: -3, ev: 3 } },
  { id: 'fumador', name: 'Fumador empedernido', desc: '−5 salud máx., +2 puntería', mod: { hp: -5, acc: 2 } },
  { id: 'ojoagudo', name: 'Ojo agudo', desc: '+1 visión, +2% crítico', mod: { vision: 1, crit: 2 } },
  { id: 'bruto', name: 'Bruto', desc: '+25% daño cuerpo a cuerpo', mod: { meleePct: 25 } },
];
