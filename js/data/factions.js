// Facciones y actitudes entre ellas
// postura: hostile (se atacan a la vista) · neutral (se ignoran; se vuelven hostiles si se les ataca) · allied (cooperan)
export const FACTIONS = {
  squad: { name: 'Puesto Pripyat-7', short: 'URSS', country: 'URSS', color: '#ff8a1f', bg: null, desc: 'Tu escuadrón.' },
  chebylitas: { name: 'Chebylitas', short: 'CHEB', country: '—', color: '#9fe870', bg: null, desc: 'Mutantes nacidos de la radiación. Atacan a todo lo que se mueve.' },
  rda: { name: 'Expedición «Wismut»', short: 'RDA', country: 'República Democrática Alemana', color: '#e6dc6a', bg: '#1e1d06', desc: 'Soldados de la NVA y científicos del uranio de Wismut. Aliados del Pacto de Varsovia.' },
  suecia: { name: 'Equipo «Forsmark»', short: 'SUE', country: 'Suecia', color: '#7fb8ff', bg: '#08162a', desc: 'Los científicos que detectaron la nube. Van a lo suyo; no buscan pelea.' },
  usa: { name: 'Operación «Nightingale»', short: 'EE. UU.', country: 'Estados Unidos', color: '#ff5050', bg: '#2a0606', desc: 'CIA y fuerzas especiales. Buscan la esencia y disparan a la vista.' },
};

const BASE = {
  'squad|chebylitas': 'hostile', 'squad|rda': 'allied', 'squad|suecia': 'neutral', 'squad|usa': 'hostile',
  'chebylitas|rda': 'hostile', 'chebylitas|suecia': 'hostile', 'chebylitas|usa': 'hostile',
  'rda|suecia': 'neutral', 'rda|usa': 'hostile', 'suecia|usa': 'neutral',
};
export function baseAttitude(a, b) {
  if (a === b) return 'allied';
  return BASE[a + '|' + b] || BASE[b + '|' + a] || 'neutral';
}
export const ATTITUDE_TEXT = { hostile: 'hostil', neutral: 'neutral', allied: 'aliado' };
export const ATTITUDE_CLASS = { hostile: 'bad', neutral: 'warn', allied: 'good' };
