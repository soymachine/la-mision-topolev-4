// Rarezas del botín
export const RARITIES = [
  { id: 0, name: 'Común', color: '#c8c8c8', mult: 1.0, affixes: 0, value: 1, w: 60 },
  { id: 1, name: 'No común', color: '#3ddc6b', mult: 1.12, affixes: 1, value: 2.2, w: 26 },
  { id: 2, name: 'Raro', color: '#3d8bff', mult: 1.25, affixes: 2, value: 5, w: 10 },
  { id: 3, name: 'Épico', color: '#b05cff', mult: 1.42, affixes: 3, value: 11, w: 3.2 },
  { id: 4, name: 'Legendario', color: '#ffb02e', mult: 1.65, affixes: 4, value: 25, w: 0.7 },
  { id: 5, name: 'Mítico', color: '#ff2b3a', mult: 1.95, affixes: 5, value: 60, w: 0.1 },
];

// Pesos de rareza según el nivel de la zona (1..10) y una bonificación extra
export function rarityWeights(level, bonus = 0) {
  const f = 1 + (level - 1) * 0.12 + bonus;
  return RARITIES.map((r) => r.w * Math.pow(f, r.id) * (r.id === 0 ? Math.max(0.35, 1 - (level - 1) * 0.07) : 1));
}
