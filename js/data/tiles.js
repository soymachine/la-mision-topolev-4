// Tipos de casilla del mundo subterráneo
export const T = {
  ROCK: 0, WALL: 1, FLOOR: 2, CAVE: 3, DOOR: 4, DOOR_OPEN: 5, WATER: 6, DEEP: 7, RUBBLE: 8, MACHINE: 9, GRATE: 10, PAD: 11,
  // fase 16: casillas con mecánica
  SANDBAG: 12, LOWWALL: 13, BARREL: 14, OIL: 15, CATWALK: 16, GLASS: 17, SAND: 18, PIPE: 19, PIPE_BROKEN: 20,
  ARMORDOOR: 21, TERMINAL: 22, SWITCH: 23, FAN: 24, LIFT: 25, CHASM: 26, UNSTABLE: 27, DEBRIS: 28, GRAPHITE: 29,
  ROOTS: 30, ICE: 31, RAIL: 32, LAMP: 33, LAMP_BROKEN: 34, LIFT_UP: 35, SWITCH_ON: 36, TERMINAL_DONE: 37,
  // fase 17: superficie y zonas nuevas
  GROUND: 38, GRASS: 39, ASPHALT: 40, PINE: 41, DUG: 42, CAR: 43, SWING: 44, HULL: 45, LATTICE: 46, ANTENNA: 47,
  BOAT: 48, ORGWALL: 49, CORIUM: 50, CELL: 51, FENCE: 52, ANTENNA_ON: 53,
  // fase 18: restos de otras expediciones
  TENT: 54, CAMPFIRE: 55,
};

// glyphs: variantes elegidas por hash de posición. fg: variaciones de naranja.
export const TILES = [
  { name: 'Roca', walk: 0, opaque: 1, glyphs: ['▓', '▓', '▒'], fg: ['#6b3210', '#5e2c0e', '#743812'], bg: '#0d0602' },
  { name: 'Muro de hormigón', walk: 0, opaque: 1, glyphs: ['#'], fg: ['#c0601a', '#b25816', '#c96a20'], bg: '#1c0d04' },
  { name: 'Suelo', walk: 1, opaque: 0, glyphs: ['.', '.', '.', '.', ',', '`'], fg: ['#6a3612', '#5c2f10', '#733b14'] },
  { name: 'Suelo de caverna', walk: 1, opaque: 0, glyphs: ['·', '·', '.', ',', '\''], fg: ['#5a2c0e', '#4f270c', '#643212'] },
  { name: 'Puerta cerrada', walk: 1, opaque: 1, glyphs: ['+'], fg: ['#ffb35c'], bg: '#2a1406' },
  { name: 'Puerta abierta', walk: 1, opaque: 0, glyphs: ['\''], fg: ['#c97a2c'] },
  { name: 'Agua contaminada', walk: 1, opaque: 0, glyphs: ['~', '~', '≈'], fg: ['#2e8c7e', '#287a70', '#35a090'], bg: '#03110f', anim: 'water' },
  { name: 'Agua profunda', walk: 0, opaque: 0, glyphs: ['≈'], fg: ['#2a6f9a', '#245f86'], bg: '#020a12', anim: 'water', fly: 1 },
  { name: 'Escombros', walk: 1, opaque: 0, glyphs: [':', ';', ',', '%'], fg: ['#8a4a1c', '#7a4018', '#94521f'] },
  { name: 'Maquinaria', walk: 0, opaque: 0, glyphs: ['Θ', '■', '╬', '¶', '▣', '≡'], fg: ['#d98a3a', '#c97a2c', '#e09a4a'], bg: '#160a02' },
  { name: 'Rejilla metálica', walk: 1, opaque: 0, glyphs: ['≡', '='], fg: ['#7a4518', '#6d3c14'] },
  { name: 'Plataforma', walk: 1, opaque: 0, glyphs: ['▪'], fg: ['#9a6a3a'], bg: '#140b04' },
  // ---- fase 16 ----
  // cover: −% de impacto contra quien está detrás · shoot: se puede disparar (se rompe) · noise: ruido al pisarla
  // slip: resbala · quiet: amortigua los pasos · fuel: inflamable · use: se activa con F estando al lado · light: radio de luz
  { name: 'Sacos terreros', walk: 0, opaque: 0, cover: 25, glyphs: ['▄'], fg: ['#b08a52', '#a07c48'], bg: '#120b04', desc: 'Cobertura media: −25% de impacto a quien se cubre detrás.' },
  { name: 'Consola / muro bajo', walk: 0, opaque: 0, cover: 25, glyphs: ['▬'], fg: ['#c9893c', '#b47a34'], bg: '#170c03', desc: 'Cobertura media. No se puede atravesar.' },
  { name: 'Barril de combustible', walk: 0, opaque: 0, cover: 15, shoot: 'barrel', glyphs: ['◘'], fg: ['#e0502a'], bg: '#1a0602', desc: 'Dispárale: explota (radio 2) e incendia.' },
  { name: 'Charco de aceite', walk: 1, opaque: 0, slip: 1, fuel: 1, glyphs: ['≋'], fg: ['#4a3a2a', '#3e3224'], bg: '#0a0704', desc: 'Inflamable. Resbala: cruzarlo cuesta un turno más.' },
  { name: 'Pasarela metálica', walk: 1, opaque: 0, noise: 5, glyphs: ['═'], fg: ['#9a7a5a', '#8a6c50'], desc: 'Cada paso resuena: despierta a los nidos cercanos.' },
  { name: 'Cristales rotos', walk: 1, opaque: 0, noise: 5, glyphs: ['∴', '⁘', ':'], fg: ['#a8d0d8', '#90b8c0'], desc: 'Crujen al pisarlos. Los exploradores los cruzan en silencio.' },
  { name: 'Arena y serrín', walk: 1, opaque: 0, quiet: 1, glyphs: ['░'], fg: ['#7a5a32', '#6e5030'], desc: 'Amortigua los pasos: los nidos dormidos te notan más tarde.' },
  { name: 'Tubería de vapor', walk: 0, opaque: 1, shoot: 'pipe', glyphs: ['║', '╫'], fg: ['#a0a0a0', '#8a8a8a'], bg: '#101010', desc: 'Si la rompes de un disparo, escupe vapor ardiente a su alrededor.' },
  { name: 'Tubería reventada', walk: 0, opaque: 1, glyphs: ['╫'], fg: ['#d0d0d0'], bg: '#202020', anim: 'steam', desc: 'Vapor a presión: quema a quien esté al lado.' },
  { name: 'Puerta blindada', walk: 0, opaque: 1, use: 'armordoor', glyphs: ['▓'], fg: ['#d0a050'], bg: '#2a1a06', desc: 'Necesita una tarjeta, Técnica 7, un soplete o un terminal.' },
  { name: 'Terminal', walk: 0, opaque: 0, use: 'terminal', glyphs: ['▣'], fg: ['#5fd0ff'], bg: '#04121a', anim: 'blink', desc: 'Hackear (Técnica): abre las puertas blindadas, enciende las luces y descarga el plano del sector.' },
  { name: 'Interruptor de energía', walk: 0, opaque: 0, use: 'switch', glyphs: ['¥'], fg: ['#ffd23f'], bg: '#1a1404', desc: 'Ilumina todo el sector: más visión, pero los enemigos también te ven.' },
  { name: 'Ventilador industrial', walk: 0, opaque: 0, glyphs: ['✣', '✢', '✤'], fg: ['#c0c0c0'], bg: '#0e0e0e', anim: 'fan', desc: 'Dispersa el gas cercano.' },
  { name: 'Montacargas (bajar)', walk: 1, opaque: 0, use: 'lift', glyphs: ['↕'], fg: ['#5ff7ff'], bg: '#03181a', anim: 'blink', desc: 'Baja al piso inferior. Reúne al escuadrón a su lado.' },
  { name: 'Sima', walk: 0, opaque: 0, fly: 1, use: 'chasm', glyphs: [' '], fg: ['#000'], bg: '#000000', desc: 'Una caída al piso inferior. Con cuerda se baja sin daño.' },
  { name: 'Escombros inestables', walk: 1, opaque: 0, glyphs: ['▒'], fg: ['#9a5a2a', '#8a5024'], desc: 'Un ruido fuerte cerca y se vienen abajo.' },
  { name: 'Derrumbe', walk: 0, opaque: 1, glyphs: ['%', '▓'], fg: ['#7a4a22', '#6a4020'], bg: '#100803', desc: 'Escombros que bloquean el paso.' },
  { name: 'Grafito expuesto', walk: 1, opaque: 0, use: 'graphite', glyphs: ['▪'], fg: ['#3a3a3a', '#4a4a4a'], bg: '#0a0a0a', anim: 'graphite', desc: 'Radiación extrema. Se pueden tomar muestras (F).' },
  { name: 'Raíces de la Raíz-madre', walk: 0, opaque: 0, glyphs: ['ψ', 'Ψ', 'ϒ'], fg: ['#6abf3a', '#58a830'], bg: '#061004', desc: 'Crecen y cierran pasillos. Se cortan cuerpo a cuerpo o se queman.' },
  { name: 'Hielo', walk: 1, opaque: 0, slip: 2, glyphs: ['·', '.'], fg: ['#e8f4ff', '#d0e8ff'], bg: '#0a1218', desc: 'Resbala: a veces caes y pierdes un turno.' },
  { name: 'Raíles', walk: 1, opaque: 0, glyphs: ['╪', '┼'], fg: ['#8a6a4a'], desc: 'Vías de las vagonetas.' },
  { name: 'Lámpara de emergencia', walk: 0, opaque: 0, light: 5, shoot: 'lamp', glyphs: ['☼'], fg: ['#ffe08a'], bg: '#1a1404', anim: 'lamp', desc: 'Ilumina a su alrededor. Se rompe de un disparo.' },
  { name: 'Lámpara rota', walk: 0, opaque: 0, glyphs: ['¤'], fg: ['#6a5a3a'], desc: 'Ya no alumbra.' },
  { name: 'Montacargas (subir)', walk: 1, opaque: 0, use: 'liftup', glyphs: ['↕'], fg: ['#9fe8a0'], bg: '#04140a', anim: 'blink', desc: 'Sube al piso superior. Reúne al escuadrón a su lado.' },
  { name: 'Interruptor encendido', walk: 0, opaque: 0, glyphs: ['¥'], fg: ['#fff07a'], bg: '#2a2006', desc: 'El sector está iluminado.' },
  { name: 'Terminal pirateado', walk: 0, opaque: 0, glyphs: ['▣'], fg: ['#2a6a80'], bg: '#020a0e', desc: 'Ya no responde.' },
  // ---- fase 17 ---- (out: casilla de exterior, a cielo abierto)
  { name: 'Tierra', walk: 1, opaque: 0, out: 1, glyphs: ['.', '.', ',', '\'', '`'], fg: ['#5e4a26', '#544222', '#66502a'] },
  { name: 'Hierba seca', walk: 1, opaque: 0, out: 1, glyphs: ['"', ',', '\'', '"'], fg: ['#6a6a2a', '#5e5e24', '#747430'] },
  { name: 'Asfalto agrietado', walk: 1, opaque: 0, out: 1, glyphs: ['·', '.', '·', ':'], fg: ['#5a5650', '#4e4a46'] },
  { name: 'Pino rojo', walk: 0, opaque: 0, half: 1, out: 1, glyphs: ['♠', '♣', '♠'], fg: ['#a8441a', '#943c16', '#b44c1e'], desc: 'Pinos muertos color óxido. Tapan la visión a medias.' },
  { name: 'Tierra removida', walk: 1, opaque: 0, out: 1, use: 'dig', glyphs: ['÷', '≈', '∴'], fg: ['#8a5a2a', '#7a4e24'], bg: '#100a04', desc: 'Una fosa de enterramiento. Muy radiactiva. Se puede excavar (F): a veces hay algo.' },
  { name: 'Coche oxidado', walk: 0, opaque: 0, cover: 25, out: 1, glyphs: ['▬', '◘', '▀'], fg: ['#8a5a3a', '#7a6a5a', '#946040'], bg: '#100804', desc: 'Un «Moskvich» abandonado. Buena cobertura.' },
  { name: 'Columpio', walk: 0, opaque: 0, out: 1, glyphs: ['Ħ'], fg: ['#c8a050'], desc: 'Chirría cuando pasas al lado. Todo lo que hay cerca lo oye.' },
  { name: 'Chapa metálica', walk: 0, opaque: 1, glyphs: ['▒', '▓', '▒'], fg: ['#7a7468', '#6a645a', '#847c70'], bg: '#141210', desc: 'Vagones, cabinas y carrocerías.' },
  { name: 'Celosía metálica', walk: 0, opaque: 0, cover: 10, out: 1, glyphs: ['╳', '╫', '╳'], fg: ['#8aa0b8', '#7a90a8'], desc: 'La estructura de la antena. Algo de cobertura.' },
  { name: 'Consola del radar', walk: 0, opaque: 0, use: 'antenna', glyphs: ['Ψ'], fg: ['#7fb8ff'], bg: '#04101c', anim: 'blink', desc: 'Activar la antena revela todo el mapa durante 30 turnos… y atrae a todo lo que hay.' },
  { name: 'Barca', walk: 1, opaque: 0, out: 1, glyphs: ['◡', '∪'], fg: ['#a07040', '#8a6038'], bg: '#03110f', desc: 'Barcas varadas que hacen de puente sobre el agua profunda.' },
  { name: 'Pared orgánica', walk: 0, opaque: 1, glyphs: ['◦', '○', '●', '◦'], fg: ['#9a4a6a', '#8a3a5a', '#7a5a3a'], bg: '#140608', anim: 'breathe', desc: 'Respira. A veces se abre… y a veces se cierra.' },
  { name: 'Corium', walk: 0, opaque: 0, glyphs: ['≈', '~', '≋'], fg: ['#ff7a20', '#ff9a30', '#e05a10'], bg: '#2a0800', anim: 'lava', desc: 'Combustible nuclear fundido. No se cruza. Radiación letal a su alrededor.' },
  { name: 'Reja de celda', walk: 0, opaque: 0, glyphs: ['╫', '#'], fg: ['#6a8aa0'], bg: '#050a0e', desc: 'Celda de contención. Un terminal la abre… si de verdad quieres abrirla.' },
  { name: 'Alambrada de la zona', walk: 0, opaque: 0, out: 1, glyphs: ['#', '╪', '#'], fg: ['#6a6a60', '#5a5a52'], desc: 'La valla de la zona de exclusión.' },
  { name: 'Antena activa', walk: 0, opaque: 0, glyphs: ['Ψ'], fg: ['#d0e8ff'], bg: '#0a2038', desc: 'La antena zumba. Todo lo que hay en la zona sabe que estáis aquí.' },
  // ---- fase 18 ----
  { name: 'Tienda de campaña', walk: 0, opaque: 1, cover: 0, glyphs: ['Λ'], fg: ['#8a9a6a', '#7a8a5a'], bg: '#0c1006', desc: 'Lona de otra expedición. Dentro no queda nadie.' },
  { name: 'Hoguera', walk: 0, opaque: 0, light: 4, fuel: 1, glyphs: ['*'], fg: ['#ff8a1f'], bg: '#1a0a02', anim: 'campfire', desc: 'Brasas de un campamento reciente. Todavía dan luz.' },
];

export const isWalk = (t) => TILES[t].walk === 1;
export const isOpaque = (t) => TILES[t].opaque === 1;
// estructura cartografiable (para planos y revelado de sectores)
export const isStructure = (t) => t !== T.ROCK;
