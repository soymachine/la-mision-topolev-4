// Rarezas del botín
export const RARITIES = [
  { id: 0, name: 'Común', color: '#c8c8c8', mult: 1.0, affixes: 0, value: 1, w: 60, sym: '·', cb: '#d0d0d0' },
  { id: 1, name: 'No común', color: '#3ddc6b', mult: 1.12, affixes: 1, value: 2.2, w: 26, sym: '+', cb: '#56b4e9' },
  { id: 2, name: 'Raro', color: '#3d8bff', mult: 1.25, affixes: 2, value: 5, w: 10, sym: '◆', cb: '#f0e442' },
  { id: 3, name: 'Épico', color: '#b05cff', mult: 1.42, affixes: 3, value: 11, w: 3.2, sym: '★', cb: '#cc79a7' },
  { id: 4, name: 'Legendario', color: '#ffb02e', mult: 1.65, affixes: 4, value: 25, w: 0.7, sym: '✦', cb: '#e69f00' },
  { id: 5, name: 'Mítico', color: '#ff2b3a', mult: 1.95, affixes: 5, value: 60, w: 0.1, sym: '✪', cb: '#ff6e54' },
];
// fase 24.1: modo daltónico. Cambia la paleta en el propio RARITIES (así cambia en todo el juego)
// a la de Okabe-Ito y antepone un símbolo distinto a cada rareza (rarSym).
for (const r of RARITIES) r.base = r.color;
export let COLORBLIND = false;
export function applyColorblind(on) {
  COLORBLIND = !!on;
  for (const r of RARITIES) r.color = on ? r.cb : r.base;
  if (typeof document !== 'undefined') for (const r of RARITIES) document.documentElement.style.setProperty(`--r${r.id}`, r.color);
}
export const rarSym = (r) => (COLORBLIND ? RARITIES[r].sym + ' ' : '');

// Pesos de rareza según el nivel de la zona (1..10) y una bonificación extra
export function rarityWeights(level, bonus = 0) {
  const f = 1 + (level - 1) * 0.12 + bonus;
  return RARITIES.map((r) => r.w * Math.pow(f, r.id) * (r.id === 0 ? Math.max(0.35, 1 - (level - 1) * 0.07) : 1));
}
