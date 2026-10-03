// Mapas (localizaciones), módulos de la base, nombres y rasgos

export const MAPS = [
  {
    id: 'admin', name: 'Bloque Administrativo', short: 'ADMIN', lvl: [1, 2], w: 104, h: 66, sx: 3, sy: 2,
    zones: { industrial: 0.75, ruinas: 0.25 }, enemies: ['rata', 'polilla', 'musgo', 'esporangio'],
    ambientRad: 0, nests: [4, 5], veins: [3, 4], caches: [3, 4], hazards: [2, 3],
    desc: 'Oficinas, archivos y vestuarios del personal. La puerta de entrada a las profundidades.',
    tier: 0, stratum: 'sub', floors: 2, req: [], fpool: ['rda', 'suecia', 'cuba'], pos: [33, 12],
  },
  {
    id: 'turbinas', name: 'Sala de Turbinas', short: 'TURB', lvl: [3, 4], w: 122, h: 74, sx: 3, sy: 3,
    zones: { industrial: 0.55, ruinas: 0.3, caverna: 0.15 }, enemies: ['rata', 'polilla', 'musgo', 'esporangio', 'lobo', 'cuervo', 'cristal', 'golem'],
    ambientRad: 0.15, nests: [5, 6], veins: [3, 5], caches: [4, 5], hazards: [3, 4],
    desc: 'Naves gigantescas con turbinas destripadas. El techo gotea agua radiactiva.',
    tier: 2, stratum: 'sub', floors: 2, req: ['admin'], fpool: ['rda', 'suecia', 'checos', 'merodeadores'], pos: [37, 12],
  },
  {
    id: 'refrig', name: 'Canales de Refrigeración', short: 'REFR', lvl: [5, 6], w: 136, h: 82, sx: 4, sy: 3,
    zones: { inundado: 0.45, industrial: 0.25, caverna: 0.3 }, enemies: ['musgo', 'esporangio', 'lobo', 'cuervo', 'cristal', 'golem', 'jabali', 'raiz'],
    ambientRad: 0.3, nests: [6, 7], veins: [4, 5], caches: [4, 6], hazards: [4, 5],
    desc: 'Túneles inundados por donde el agua de refrigeración huyó del reactor.',
    tier: 4, stratum: 'sub', floors: 2, req: ['turbinas'], fpool: ['rda', 'cuba', 'checos', 'desertores', 'usa'], pos: [38, 15],
  },
  {
    id: 'galerias', name: 'Galerías Profundas', short: 'GAL', lvl: [7, 8], w: 146, h: 88, sx: 4, sy: 3,
    zones: { caverna: 0.6, inundado: 0.2, ruinas: 0.2 }, enemies: ['esporangio', 'lobo', 'cuervo', 'cristal', 'golem', 'jabali', 'raiz', 'pastor'],
    ambientRad: 0.5, nests: [6, 8], veins: [5, 6], caches: [5, 6], hazards: [5, 6],
    desc: 'Grietas abiertas por la explosión bajo los cimientos. Aquí los chebylitas anidan.',
    tier: 6, stratum: 'sub', floors: 3, req: ['refrig'], fpool: ['rda', 'usa', 'desertores', 'culto'], pos: [32, 15],
  },
  {
    id: 'sarcofago', name: 'Sarcófago — Reactor 4', short: 'SARC', lvl: [9, 10], w: 156, h: 94, sx: 4, sy: 4,
    zones: { ruinas: 0.4, caverna: 0.35, industrial: 0.25 }, enemies: ['cuervo', 'cristal', 'golem', 'jabali', 'raiz', 'lobo', 'pastor', 'coloso'],
    ambientRad: 0.9, nests: [7, 9], veins: [6, 7], caches: [6, 7], hazards: [6, 8],
    desc: 'El corazón de la catástrofe. El corium late. Nadie ha vuelto con vida... todavía.',
    tier: 8, stratum: 'sub', floors: 3, req: ['galerias'], fpool: ['usa', 'culto', 'desertores'], pos: [35, 14],
  },
  // ======================================================== FASE 17: SUPERFICIE
  {
    id: 'pripyat', name: 'Prípiat, la ciudad dormida', short: 'PRIP', lvl: [2, 3], w: 124, h: 78, sx: 3, sy: 3,
    zones: { ciudad: 1 }, enemies: ['rata', 'polilla', 'cuervo', 'lobo', 'musgo', 'esporangio'],
    ambientRad: 0.1, nests: [4, 5], veins: [2, 3], caches: [4, 5], hazards: [2, 3],
    desc: 'Bloques de viviendas vacíos, la noria, la piscina Azure, el hospital n.º 126. Cuarenta y nueve mil personas se fueron en tres horas.',
    tier: 1, stratum: 'sup', floors: 2, floorNames: ['Calles', 'Sótano del hospital n.º 126'], req: ['admin'], fpool: ['merodeadores', 'yugo', 'desertores', 'suecia'], pos: [42, 5],
  },
  {
    id: 'bosque', name: 'El Bosque Rojo', short: 'BOSQ', lvl: [3, 5], w: 128, h: 80, sx: 3, sy: 3,
    zones: { bosque: 1 }, enemies: ['lobo', 'cuervo', 'polilla', 'musgo', 'jabali', 'liana', 'raiz'],
    ambientRad: 0.45, nests: [5, 6], veins: [3, 5], caches: [3, 4], hazards: [4, 5],
    desc: 'Pinos muertos color óxido y fosas donde enterraron el bosque contaminado. La tierra todavía quema.',
    tier: 3, stratum: 'sup', floors: 1, req: ['pripyat'], fpool: ['finlandia', 'culto', 'uk', 'merodeadores'], pos: [25, 11],
  },
  {
    id: 'yanov', name: 'Estación de Yanov', short: 'YANOV', lvl: [4, 5], w: 132, h: 76, sx: 4, sy: 3,
    zones: { ferroviario: 0.75, industrial: 0.25 }, enemies: ['rata', 'lobo', 'cuervo', 'jabali', 'golem', 'robot'],
    ambientRad: 0.25, nests: [5, 6], veins: [3, 4], caches: [4, 6], hazards: [3, 4],
    desc: 'Depósito ferroviario con vagones abandonados entre largos pasillos de chapa. Los ferroviarios hablan de un tren que todavía circula.',
    tier: 3, stratum: 'sup', floors: 1, req: ['pripyat'], fpool: ['merodeadores', 'desertores', 'cuba', 'yugo'], pos: [39, 8], special: 'tren',
  },
  {
    id: 'rassokha', name: 'Cementerio de vehículos de Rassokha', short: 'RASS', lvl: [5, 6], w: 130, h: 80, sx: 4, sy: 3,
    zones: { chatarreria: 1 }, enemies: ['robot', 'cuervo', 'jabali', 'golem', 'cristal', 'lobo'],
    ambientRad: 0.65, nests: [5, 6], veins: [3, 4], caches: [5, 6], hazards: [4, 6],
    desc: 'Helicópteros Mi-8, camiones y blindados de los liquidadores aparcados para siempre. Muy radiactivo… y lleno de piezas.',
    tier: 4, stratum: 'sup', floors: 1, req: ['yanov'], fpool: ['checos', 'merodeadores', 'uk', 'desertores'], pos: [14, 19],
  },
  {
    id: 'estanque', name: 'Estanque de refrigeración', short: 'ESTQ', lvl: [5, 7], w: 128, h: 80, sx: 3, sy: 3,
    zones: { lago: 1 }, enemies: ['cuervo', 'musgo', 'esporangio', 'cristal', 'raiz', 'lobo'],
    ambientRad: 0.4, nests: [4, 5], veins: [3, 4], caches: [5, 6], hazards: [3, 4],
    desc: 'El lago artificial junto a la central. Barcas varadas, plataformas e islotes. Algo enorme se mueve bajo el agua.',
    tier: 5, stratum: 'sup', floors: 1, req: ['bosque', 'refrig'], fpool: ['suecia', 'finlandia', 'uk'], pos: [44, 17], special: 'lago',
  },
  {
    id: 'duga', name: 'Radar Duga-3 «El Pájaro Carpintero»', short: 'DUGA', lvl: [6, 7], w: 132, h: 82, sx: 4, sy: 3,
    zones: { antena: 0.6, bosque: 0.4 }, enemies: ['cuervo', 'cristal', 'lobo', 'jabali', 'golem', 'liana'],
    ambientRad: 0.35, nests: [6, 7], veins: [4, 5], caches: [5, 6], hazards: [5, 6],
    desc: 'La antena gigantesca que interfería las radios de medio mundo. Sus cables todavía chisporrotean. Desde la sala de control se ve todo… y todo te ve.',
    tier: 5, stratum: 'sup', floors: 1, req: ['rassokha', 'bosque'], fpool: ['uk', 'usa', 'finlandia'], pos: [9, 4], special: 'antena',
  },
  // ======================================================== FASE 17: SUBSUELO NUEVO
  {
    id: 'wismut', name: 'Campamento «Wismut» (RDA)', short: 'WISM', lvl: [5, 7], w: 78, h: 50, sx: 2, sy: 2,
    zones: { campamento: 1 }, enemies: ['rata', 'lobo', 'golem', 'jabali'],
    ambientRad: 0.15, nests: [0, 0], veins: [1, 2], caches: [0, 0], hazards: [0, 1],
    desc: 'Una galería minera reconvertida por la Expedición «Wismut». Comercio, enfermería, encargos y rumores. Aquí no se dispara… salvo que algo baje del techo.',
    tier: 4, stratum: 'sub', floors: 1, req: ['refrig', 'yanov'], fpool: ['cuba', 'checos'], pos: [41, 10], social: 1,
  },
  {
    id: 'metro2', name: 'Metro-2: la línea secreta', short: 'MET2', lvl: [6, 8], w: 140, h: 80, sx: 4, sy: 3,
    zones: { metro: 0.8, industrial: 0.2 }, enemies: ['rata', 'lobo', 'golem', 'robot', 'cristal', 'jabali'],
    ambientRad: 0.3, nests: [5, 7], veins: [4, 5], caches: [5, 6], hazards: [4, 5],
    desc: 'Túneles militares que no aparecen en ningún plano. Andenes, vagones y puertas estancas. Todas las expediciones acaban cruzándose aquí.',
    tier: 6, stratum: 'sub', floors: 2, req: ['wismut', 'duga'], fpool: ['rda', 'suecia', 'usa', 'contrabandistas', 'cuba', 'checos', 'yugo', 'uk', 'desertores'], pos: [24, 16], factions: 1,
  },
  {
    id: 'fenix', name: 'Estación avanzada «Fénix» (EE. UU.)', short: 'FENIX', lvl: [7, 9], w: 132, h: 80, sx: 4, sy: 3,
    zones: { base: 0.8, caverna: 0.2 }, enemies: ['lobo', 'golem', 'cristal', 'jabali'],
    ambientRad: 0.3, nests: [2, 3], veins: [3, 4], caches: [6, 7], hazards: [3, 4],
    desc: 'Una base estadounidense camuflada bajo el bosque. Cámaras, torretas y soldados de élite. Dentro, equipo occidental y documentos de inteligencia.',
    tier: 7, stratum: 'sub', floors: 2, req: ['metro2'], fpool: ['usa', 'uk'], pos: [19, 8], special: 'fenix',
  },
  {
    id: 'objeto7', name: 'Objeto 7: el laboratorio del KGB', short: 'OBJ7', lvl: [7, 9], w: 136, h: 82, sx: 4, sy: 3,
    zones: { laboratorio: 0.7, industrial: 0.3 }, enemies: ['cristal', 'golem', 'esporangio', 'raiz', 'robot', 'lobo'],
    ambientRad: 0.5, nests: [6, 7], veins: [4, 5], caches: [5, 7], hazards: [5, 6],
    desc: 'Una instalación secreta construida mucho antes de 1986, con celdas de contención. Los archivos llevan una firma que conocéis.',
    tier: 7, stratum: 'sub', floors: 2, req: ['metro2'], fpool: ['culto', 'usa'], pos: [13, 7], special: 'objeto7',
  },
  {
    id: 'raices', name: 'Las Raíces', short: 'RAIZ', lvl: [8, 10], w: 140, h: 86, sx: 4, sy: 3,
    zones: { organico: 1 }, enemies: ['raiz', 'musgo', 'esporangio', 'liana', 'golem', 'cristal', 'pastor'],
    ambientRad: 0.8, nests: [7, 8], veins: [5, 7], caches: [5, 6], hazards: [6, 7],
    desc: 'La red de cavernas orgánicas de la Raíz-madre. Las paredes respiran y el mapa cambia mientras lo recorres.',
    tier: 8, stratum: 'sub', floors: 2, req: ['galerias', 'objeto7'], fpool: ['culto'], pos: [29, 18], special: 'raices',
  },
  {
    id: 'corium', name: 'El Útero de Corium', short: 'CORIUM', lvl: [10, 10], w: 120, h: 80, sx: 3, sy: 3,
    zones: { corium: 0.7, caverna: 0.3 }, enemies: ['coloso', 'cristal', 'golem', 'raiz', 'pastor', 'jabali'],
    ambientRad: 1.4, nests: [7, 9], veins: [6, 8], caches: [6, 7], hazards: [7, 9],
    desc: 'Bajo el reactor, la masa fundida forma galerías vivas. El final del camino.',
    tier: 9, stratum: 'sub', floors: 3, req: ['sarcofago', 'raices'], fpool: ['culto', 'usa'], pos: [34, 17], special: 'corium',
  },
];
export const STRATA = { sup: 'Superficie', sub: 'Subsuelo' };
// definición de cada piso: más nivel, mapas algo más pequeños; bajo la superficie, edificios y sótanos
export function floorDef(base, f) {
  if (!f) return { ...base, surface: base.stratum === 'sup' };
  const d = { ...base, lvl: [Math.min(10, base.lvl[0] + f), Math.min(10, base.lvl[1] + f)], w: Math.round(base.w * (1 - 0.1 * f)), h: Math.round(base.h * (1 - 0.1 * f)), nests: base.nests.map((n) => n + f), caches: base.caches.map((n) => n + f), surface: false };
  if (base.stratum === 'sup') d.zones = base.floorZones || { industrial: 0.6, ruinas: 0.4 };
  return d;
}
export const mapIndex = (id) => MAPS.findIndex((m) => m.id === id);
// ¿zona accesible? (sin requisitos, o se ha extraído con éxito de alguna de las que la preceden)
export function zoneOpen(st, i) {
  const m = MAPS[i];
  if (!m || !st) return false;
  if (st.unlockAll) return true;
  return !m.req.length || m.req.some((r) => (st.cleared[r] || 0) > 0);
}
// Zonas de evento temporales (fase 17.3): aparecen en el mapa de la región unos días y desaparecen.
// Se generan sobre una zona base ya abierta (base) con cambios (over); son de un solo uso.
export const EVENT_ZONES = {
  heli: {
    name: 'Helicóptero estrellado', glyph: '✈', base: 'bosque', days: [2, 3], w: 3, pos: [[20, 6], [27, 4], [16, 14], [23, 18]],
    over: { zones: { bosque: 0.75, ruinas: 0.25 }, w: 100, h: 66, nests: [3, 4], caches: [2, 3], veins: [2, 3], special: 'heli' },
    desc: 'Un Mi-8 de los liquidadores ha caído al oeste de la central. La caja negra sigue a bordo… y algo ya ha olido la sangre.',
  },
  convoy: {
    name: 'Convoy perdido', glyph: '▬', base: 'yanov', days: [2, 4], w: 3, pos: [[46, 12], [21, 15], [11, 17], [57, 15]],
    over: { zones: { chatarreria: 0.6, bosque: 0.4 }, w: 110, h: 66, nests: [4, 5], caches: [2, 3], special: 'convoy' },
    desc: 'Una columna de camiones de evacuación dejó de responder por radio en mitad de la carretera. Su carga sigue ahí.',
  },
  spyplane: {
    name: 'Avión espía', glyph: '✈', base: 'duga', days: [2, 3], w: 1, pos: [[6, 9], [48, 2], [59, 8], [3, 15]],
    over: { zones: { bosque: 0.7, ruinas: 0.3 }, w: 104, h: 66, nests: [3, 4], caches: [2, 3], special: 'spyplane' },
    desc: 'Un avión de reconocimiento occidental ha caído en territorio soviético. Los americanos ya vienen a por él. Llegad antes.',
  },
  nido: {
    name: 'Nido migratorio', glyph: '▲', base: 'galerias', days: [2, 3], w: 2, pos: [[30, 8], [36, 20], [27, 12]],
    over: { zones: { caverna: 0.7, organico: 0.3 }, w: 100, h: 64, nests: [8, 10], veins: [6, 8], caches: [2, 3], special: 'nido' },
    desc: 'Una colonia de chebylitas ha excavado un nido de paso. Mucha esencia… y muchísimos dientes.',
  },
  mercado: {
    name: 'Mercado negro', glyph: '$', base: 'pripyat', days: [1, 2], w: 2, pos: [[47, 9], [18, 18], [44, 2]],
    over: { zones: { ciudad: 1 }, w: 90, h: 60, nests: [1, 2], caches: [1, 2], veins: [1, 2], special: 'mercado' },
    desc: 'Los contrabandistas montan su mercado una noche en un patio de Prípiat. Armas americanas, vaqueros y vodka sin preguntas.',
  },
};
// definición sintética de una zona de evento (una sola planta, sin requisitos)
export function eventDef(ev) {
  const Z = EVENT_ZONES[ev.kind];
  const base = MAPS[mapIndex(Z.base)];
  return { ...base, ...Z.over, id: 'ev_' + ev.kind, name: Z.name, short: 'EVENTO', desc: Z.desc, floors: 1, req: [], pos: ev.pos, event: ev.kind, floorNames: null };
}
export const openCount = (st) => MAPS.filter((m, i) => zoneOpen(st, i)).length;

export const SECTOR_NAMES = {
  industrial: ['Sala de control', 'Archivo', 'Vestuarios', 'Comedor', 'Taller eléctrico', 'Laboratorio dosimétrico', 'Sala de bombas', 'Oficinas', 'Almacén técnico', 'Pasillo de servicio', 'Subestación', 'Sala de cables'],
  ruinas: ['Ala derrumbada', 'Escombrera', 'Nave colapsada', 'Forjado caído', 'Sala calcinada', 'Pasarela rota'],
  caverna: ['Gruta', 'Fisura', 'Cavidad colapsada', 'Sima', 'Galería natural', 'Nido de raíces'],
  inundado: ['Canal', 'Colector', 'Piscina de supresión', 'Depósito', 'Esclusa', 'Cisterna'],
  ciudad: ['Avenida Lenin', 'Plaza central', 'Parque de atracciones', 'Piscina Azure', 'Supermercado', 'Hospital n.º 126', 'Bloque 17', 'Escuela n.º 3', 'Palacio de Cultura «Energetik»', 'Hotel «Polesie»', 'Calle de los Constructores', 'Estadio «Avangard»'],
  bosque: ['Fosa de enterramiento', 'Pinar rojo', 'Claro de óxido', 'Cortafuegos', 'Pinar quemado', 'Senda de los liquidadores', 'Hondonada'],
  ferroviario: ['Vía muerta', 'Cocheras', 'Andén de Yanov', 'Playa de vías', 'Taller de locomotoras', 'Depósito de carbón'],
  chatarreria: ['Fila de helicópteros', 'Fila de camiones', 'Parque de blindados', 'Desguace', 'Hangar de lavado', 'Campa de ambulancias'],
  antena: ['Celosía norte', 'Celosía sur', 'Sala de control del radar', 'Bosque de cables', 'Base de la antena', 'Subestación del radar'],
  lago: ['Orilla norte', 'Islote', 'Embarcadero', 'Canal de descarga', 'Plataforma de bombeo', 'Aguas profundas'],
  metro: ['Andén «Objeto 4»', 'Túnel de servicio', 'Cocheras secretas', 'Esclusa estanca', 'Ramal militar', 'Pozo de ventilación'],
  campamento: ['Plaza del campamento', 'Enfermería', 'Barracones', 'Almacén', 'Taller', 'Puesto de radio'],
  base: ['Hangar', 'Centro de mando', 'Armería', 'Comedor', 'Laboratorio de campaña', 'Barracón', 'Puesto de control'],
  laboratorio: ['Celdas de contención', 'Quirófano', 'Archivo del KGB', 'Sala de muestras', 'Centrifugadoras', 'Despacho del director', 'Cámara frigorífica'],
  organico: ['Garganta palpitante', 'Cámara de raíces', 'Corazón verde', 'Galería viva', 'Ventrículo', 'Tráquea'],
  corium: ['Pata de elefante', 'Lago de corium', 'Cámara del reactor', 'Galería fundida', 'Burbujeo', 'El latido'],
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
  { id: 'garaje', name: 'Garaje', glyph: 'Ш', desc: 'Compra, mejora y repara compañeros mecánicos: el perro «Laika-M» y los drones.', eff: (l) => ['Sin garaje', 'Laika-M, Strizh y módulos básicos · reparaciones', '+ dron Mula, Eco y más módulos', '+ Kamikadze y Relé', 'reparaciones −25%', 'reparaciones −50%'][l] },
  { id: 'banya', name: 'Banya', glyph: '♨', desc: 'Sauna rusa: vapor, abedul y silencio. El mejor remedio contra el estrés.', eff: (l) => (l ? `−${6 + l * 5} de estrés al día por agente` : 'Sin banya') },
  { id: 'comedor', name: 'Comedor', glyph: '☕', desc: 'Pelmeni, té y conversación. Las escenas del comedor alivian más el estrés y suben la afinidad.', eff: (l) => (l ? `comedor: −${4 + l * 3} de estrés tras cada expedición · +${l} de afinidad entre supervivientes` : 'Se cena de pie') },
  { id: 'invernadero', name: 'Invernadero', glyph: '♣', desc: 'Hidroponía bajo lámparas: raciones y medicinas de hierbas cada día.', eff: (l) => (l ? `cada día: ${l} objeto(s) (raciones, yodo, vendas, té)` : 'Sin invernadero') },
  { id: 'contencion', name: 'Celda de contención', glyph: '#', desc: 'Para los chebylitas capturados vivos: producen esencia cada día… y a veces se escapan.', eff: (l) => (l ? `${l * 2} celda(s) · fugas ${Math.max(1, 5 - l)}% al día por espécimen` : 'Sin celdas') },
  { id: 'refugio', name: 'Refugio antirradiación', glyph: '☢', desc: 'Búnker de plomo: los agentes eliminan más radiación al descansar.', eff: (l) => (l ? `−${l * 6} de radiación extra al día` : 'Sin refugio') },
  { id: 'taller_fab', name: 'Taller de fabricación', glyph: '⚒', desc: 'Fabricar munición, medicinas, mods y mejoras con materiales; desmontar objetos.', eff: (l) => (l ? `recetas de nivel ${Math.min(3, l)}${l >= 4 ? ' · desmontar da un 50% más' : ''}` : 'Sin taller') },
  { id: 'sala_radio', name: 'Sala de radio', glyph: '╪', desc: 'Antenas y descifradores: más mensajes interceptados, mejor reputación y mejores precios del KGB.', eff: (l) => (l ? `+${l * 10}% interceptaciones · +${l} de reputación ganada · KGB +${l * 5}%` : 'Radio de mano') },
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
  const f = { armeria: 1, polvorin: 0.7, blindaje: 1, enfermeria: 0.8, taller: 0.9, radar: 1.1, barracones: 1.2, almacen: 0.6, laboratorio: 1.3, garaje: 0.9, banya: 0.6, comedor: 0.5, invernadero: 0.7, contencion: 1.0, refugio: 0.8, taller_fab: 0.9, sala_radio: 0.8 }[id] || 1;
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
