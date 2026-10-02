// Tipos de casilla del mundo subterráneo
export const T = { ROCK: 0, WALL: 1, FLOOR: 2, CAVE: 3, DOOR: 4, DOOR_OPEN: 5, WATER: 6, DEEP: 7, RUBBLE: 8, MACHINE: 9, GRATE: 10, PAD: 11 };

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
];

export const isWalk = (t) => TILES[t].walk === 1;
export const isOpaque = (t) => TILES[t].opaque === 1;
