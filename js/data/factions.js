// Facciones y actitudes entre ellas (fase 18: 15 facciones, reputación −100…+100)
// postura: hostile (se atacan a la vista) · neutral (se ignoran; se vuelven hostiles si se les ataca) · allied (cooperan)
// rep0: reputación al empezar · bloc: pacto (varsovia / otan / no alineados) · talk: se puede hablar con ellos
// negotiable: aunque empiecen hostiles, la reputación puede volverlos neutrales · combat: false → no aparece en el mapa
export const FACTIONS = {
  squad: { name: 'Puesto Pripyat-7', short: 'URSS', country: 'URSS', color: '#ff8a1f', bg: null, desc: 'Tu escuadrón.' },
  chebylitas: { name: 'Chebylitas', short: 'CHEB', country: '—', color: '#9fe870', bg: null, desc: 'Mutantes nacidos de la radiación. Atacan a todo lo que se mueve.' },
  rda: { name: 'Expedición «Wismut»', short: 'RDA', country: 'República Democrática Alemana', color: '#e6dc6a', bg: '#1e1d06', rep0: 35, bloc: 'varsovia', talk: 1, desc: 'Soldados de la NVA y científicos del uranio de Wismut. Aliados del Pacto de Varsovia.', offers: 'Comercio (MPi-KM, munición, medicinas, bengalas rojas), encargos e información de mapa.' },
  cuba: { name: 'Brigada «Playa Girón»', short: 'CUBA', country: 'Cuba', color: '#5fd0ff', bg: '#061a22', rep0: 35, bloc: 'varsovia', talk: 1, desc: 'Médicos e ingenieros cubanos llegados con la ayuda a los niños de Chernóbil.', offers: 'Tratamientos baratos, botiquines «Playa Girón» y puros.' },
  checos: { name: 'Grupo «Tatra»', short: 'ČSSR', country: 'Checoslovaquia', color: '#c0a0ff', bg: '#140e22', rep0: 15, bloc: 'varsovia', talk: 1, desc: 'Ingenieros de minas de Ostrava. Cumplen con el Pacto… a su manera.', offers: 'Armas (vz. 58, Škorpion, ČZ 75) y explosivos (Semtex).' },
  suecia: { name: 'Equipo «Forsmark»', short: 'SUE', country: 'Suecia', color: '#7fb8ff', bg: '#08162a', rep0: 0, bloc: 'neutral', talk: 1, desc: 'Los científicos que detectaron la nube. Van a lo suyo; huyen si los atacas.', offers: 'Datos de radiación y compra de muestras a buen precio.' },
  finlandia: { name: 'Misión «Sisu»', short: 'FIN', country: 'Finlandia', color: '#e8f4ff', bg: '#101820', rep0: 0, bloc: 'neutral', talk: 1, desc: 'Exploradores finlandeses, silenciosos como la nieve.', offers: 'Mapas, mochilas y ropa de abrigo.' },
  yugo: { name: 'Observadores no alineados', short: 'YUG', country: 'Yugoslavia', color: '#ff9ad0', bg: '#220a18', rep0: 5, bloc: 'neutral', talk: 1, desc: 'Comerciantes ambulantes con pasaporte de Belgrado. Venden a todos.', offers: 'Mercado de todo un poco a precios variables.' },
  contrabandistas: { name: 'Contrabandistas de la Zona', short: 'CONTR.', country: 'Sin bandera', color: '#d9a066', bg: '#1e1408', rep0: 0, talk: 1, desc: 'Saqueadores y traficantes. Neutrales mientras haya negocio.', offers: 'Armas occidentales en el mercado negro.' },
  usa: { name: 'Operación «Nightingale»', short: 'EE. UU.', country: 'Estados Unidos', color: '#ff5050', bg: '#2a0606', rep0: -70, bloc: 'otan', desc: 'CIA y fuerzas especiales Delta. Buscan la esencia y disparan a la vista.', offers: 'Al morir: M16A2, M60, MP5, visores nocturnos, documentos de inteligencia.' },
  uk: { name: 'Destacamento «Saxon»', short: 'R. U.', country: 'Reino Unido', color: '#ff7a5a', bg: '#220c06', rep0: -55, bloc: 'otan', desc: 'Francotiradores del SAS. Emboscadas, minas y paciencia.', offers: 'Al morir: L42A1, SA80, Sterling, minas Claymore.' },
  merodeadores: { name: 'Merodeadores', short: 'MER.', country: 'Locales', color: '#b08a5a', bg: '#1a1006', rep0: -40, negotiable: 1, talk: 1, desc: 'Saqueadores mal armados: atacan en grupo y huyen en cuanto la cosa se tuerce.', offers: 'Botín robado. A veces se les puede pagar para que se aparten.' },
  desertores: { name: 'Desertores del Ejército Rojo', short: 'DES.', country: 'URSS', color: '#c86a4a', bg: '#1e0a06', rep0: -30, negotiable: 1, talk: 1, desc: 'Soldados que huyeron de la evacuación. Con un Comisario se puede negociar… o reclutar a alguno.', offers: 'Armamento soviético y agentes reclutables.' },
  culto: { name: 'Congregación de la Ceniza', short: 'CULTO', country: '—', color: '#c06cff', bg: '#16061e', rep0: -100, desc: 'Culto que adora a los chebylitas. Sus sacerdotes los azuzan contra los demás.', offers: 'Reliquias de esencia, rosarios de dientes y lore.' },
  kgb: { name: 'KGB, Directorio 9', short: 'KGB', country: 'URSS', color: '#e05050', bg: '#200606', rep0: 20, combat: false, desc: 'No aparece en combate: exige informes y castiga la colaboración con extranjeros.', offers: 'Presupuesto, recompensas por informes y documentos.' },
};

// actitudes base entre facciones (sin contar al escuadrón, que depende de la reputación)
const BASE = {
  'squad|chebylitas': 'hostile',
  'chebylitas|culto': 'neutral',
  'usa|uk': 'allied', 'rda|cuba': 'allied', 'rda|checos': 'allied', 'cuba|checos': 'allied',
  'merodeadores|desertores': 'neutral',
};
const WARSAW = ['rda', 'cuba', 'checos'], NATO = ['usa', 'uk'], NEUTRAL = ['suecia', 'finlandia', 'yugo', 'contrabandistas'];
export function baseAttitude(a, b) {
  if (a === b) return 'allied';
  const k = BASE[a + '|' + b] || BASE[b + '|' + a];
  if (k) return k;
  if (a === 'chebylitas' || b === 'chebylitas' || a === 'culto' || b === 'culto') return 'hostile';
  const ab = [a, b];
  if (ab.some((x) => WARSAW.includes(x)) && ab.some((x) => NATO.includes(x))) return 'hostile';
  if (ab.includes('merodeadores') || ab.includes('desertores')) return ab.some((x) => NEUTRAL.includes(x)) ? 'neutral' : 'hostile';
  return 'neutral';
}
export const ATTITUDE_TEXT = { hostile: 'hostil', neutral: 'neutral', allied: 'aliado' };
export const ATTITUDE_CLASS = { hostile: 'bad', neutral: 'warn', allied: 'good' };

// ---- reputación (fase 18.2)
export const REP_MIN = -100, REP_MAX = 100;
export const REP_LEVELS = [
  { id: 'hostil', name: 'Hostil', min: -100, cls: 'bad' },
  { id: 'desconfiada', name: 'Desconfiada', min: -49, cls: 'warn' },
  { id: 'neutral', name: 'Neutral', min: -14, cls: 'dimt' },
  { id: 'amistosa', name: 'Amistosa', min: 15, cls: 'good' },
  { id: 'aliada', name: 'Aliada', min: 50, cls: 'good' },
];
export const repLevel = (v) => [...REP_LEVELS].reverse().find((l) => v >= l.min) || REP_LEVELS[0];
export const repOf = (st, f) => (st && st.rep && st.rep[f] != null ? st.rep[f] : (FACTIONS[f] && FACTIONS[f].rep0) || 0);
export function addRep(st, f, n) {
  st.rep = st.rep || {};
  st.rep[f] = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(repOf(st, f) + n)));
  return st.rep[f];
}
// actitud del escuadrón hacia una facción según la reputación
export function squadAttitude(st, f) {
  if (f === 'chebylitas') return 'hostile';
  const F = FACTIONS[f];
  if (!F || f === 'squad') return 'allied';
  const v = repOf(st, f);
  if (f === 'usa' || f === 'uk' || f === 'culto') return v >= 50 ? 'neutral' : 'hostile'; // «hostiles a la vista»
  if (v <= -50) return 'hostile';
  if (F.negotiable) return v >= 50 ? 'allied' : v >= 0 ? 'neutral' : 'hostile';
  if (v >= 15 && (F.bloc === 'varsovia' || v >= 50)) return 'allied';
  return 'neutral';
}
// facciones que aparecen en los mapas
export const COMBAT_FACTIONS = Object.keys(FACTIONS).filter((f) => f !== 'squad' && f !== 'chebylitas' && FACTIONS[f].combat !== false);

// comerciar con extranjeros que no son del Pacto: el KGB (Directorio 9) toma nota
export function foreignTrade(st, f) {
  const F = FACTIONS[f];
  if (!F || F.bloc === 'varsovia' || f === 'kgb' || f === 'squad') return false;
  st.foreignTrade = (st.foreignTrade || 0) + 1;
  addRep(st, 'kgb', -3);
  return true;
}
