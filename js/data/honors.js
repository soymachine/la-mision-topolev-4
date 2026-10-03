// Experiencias que marcan a los agentes (fase 15.3): rasgos adquiridos, heridas persistentes y condecoraciones.
// Los efectos usan la misma forma que los talentos (mods, cond, flags, attr).

// Rasgos adquiridos: se ganan por lo que les pasa (ver core/campaign.js y exp/combat.js)
export const ACQUIRED = {
  // fase 20: moral
  venganza: { name: 'Venganza', glyph: '🔥', how: 'Ver morir a un amigo (afinidad ≥ 30) a manos de un chebylita o una persona.', desc: '+15% de daño contra la especie que lo mató.' },
  adicto: { name: 'Adicto al vodka', glyph: '¡', how: 'Beber vodka 6 veces para quitarse el miedo.', desc: '−1 precisión; sin vodka a mano, +2 de estrés al día.', mods: { acc: -1 } },
  superviviente: { name: 'Superviviente', glyph: '♥', how: 'Volver de una expedición tras haber bajado del 5% de salud.', desc: '+6 salud máxima.', mods: { hp: 6 } },
  lobos: { name: 'Traumatizado por lobos', glyph: 'w', how: 'Caer por debajo del 25% de salud por mordiscos de lobo.', desc: '−10% de impacto contra lobos de grafito; +1 agilidad (siempre alerta).', flags: { vsLobo: -10 }, mods: { ev: 1 } },
  rda: { name: 'Amigo de la RDA', glyph: '☭', how: 'Volver de una expedición con reputación ≥ 30 con la RDA tras haberlos visto.', desc: 'Con aliados humanos cerca: +2 precisión y +2 agilidad.', cond: { when: 'alliesNear', mods: { acc: 2, ev: 2 } } },
  agua: { name: 'Fobia al agua', glyph: '~', how: 'Caer por debajo del 25% de salud dentro del agua.', desc: 'En el agua: −3 agilidad y −2 precisión.', cond: { when: 'inWater', mods: { ev: -3, acc: -2 } } },
  jefes: { name: 'Cazador de jefes', glyph: '☠', how: 'Abatir a un jefe.', desc: '+15% de daño contra jefes.', flags: { vsBoss: 15 } },
  irradiado: { name: 'Irradiado', glyph: '☢', how: 'Volver de una expedición con 100 o más de radiación.', desc: '+10% resistencia a la radiación, −3 salud máxima.', mods: { rad: 10, hp: -3 } },
  carnicero: { name: 'Carnicero', glyph: '†', how: 'Llegar a 50 bajas.', desc: '+3% crítico.', mods: { crit: 3 } },
  veterano: { name: 'Veterano de la Zona', glyph: '★', how: 'Completar 10 extracciones.', desc: '+1 precisión y +1 agilidad.', mods: { acc: 1, ev: 1 } },
  solitario: { name: 'Lobo solitario', glyph: '·', how: 'Ser el único superviviente de un escuadrón.', desc: 'Separado del grupo: +2 precisión y +2 agilidad.', cond: { when: 'alone', mods: { acc: 2, ev: 2 } } },
};

// Heridas persistentes: −1 a un atributo hasta tratarlas en la Enfermería
export const WOUNDS = [
  { id: 'brazo', name: 'Cicatriz en el brazo', attr: 'pun' },
  { id: 'rodilla', name: 'Rodilla rota mal soldada', attr: 'agi' },
  { id: 'costillas', name: 'Costillas fisuradas', attr: 'fue' },
  { id: 'pulmon', name: 'Pulmón quemado', attr: 'agu' },
  { id: 'ojo', name: 'Ojo dañado', attr: 'per' },
  { id: 'mano', name: 'Dedos amputados', attr: 'tec' },
];
export const WOUND_CHANCE = 0.35; // al bajar del 15% de salud (una vez por expedición)
export const woundCost = (enf) => Math.max(60, 220 - enf * 30);

// Condecoraciones: se conceden al volver de una expedición (core/campaign.js)
export const MEDALS = {
  estrella: { name: 'Orden de la Estrella Roja', glyph: '✪', color: '#ff5050', how: 'Abatir a un jefe y volver para contarlo.', desc: '+1 precisión y +3% crítico.', mods: { acc: 1, crit: 3 } },
  valor: { name: 'Medalla al Valor', glyph: '✦', color: '#ffd23f', how: '8 bajas o más en una sola expedición.', desc: '+5 salud máxima.', mods: { hp: 5 } },
  servicio: { name: 'Medalla «Por servicios de combate»', glyph: '◆', color: '#c0c0c0', how: '5 extracciones.', desc: '+5% de esencia recogida.', mods: { essence: 5 } },
  lenin: { name: 'Orden de Lenin', glyph: '☭', color: '#ffb02e', how: 'Extraer 1000 ✦ de esencia en total.', desc: '+5% esencia y +5% res. radiación.', mods: { essence: 5, rad: 5 } },
  liquidador: { name: 'Medalla «Liquidador de Chernóbil»', glyph: '☢', color: '#b8f53d', how: 'Volver de 3 expediciones de nivel medio 5 o más.', desc: '+10% resistencia a la radiación.', mods: { rad: 10 } },
  camarada: { name: 'Medalla «Por salvar a un camarada»', glyph: '✚', color: '#6fe89a', how: 'Salvar a un agente de la muerte (Rescate) o curar a compañeros 100 puntos de salud.', desc: '+10% de curación.', mods: { healPct: 10 } },
};

// Retiro de veteranos como instructores
export const RETIRE_LEVEL = 8;
export const MAX_INSTRUCTORS = 3;
export const INSTRUCTOR_XP = 15; // % de XP extra por instructor para los agentes de nivel ≤ ROOKIE_LEVEL
export const ROOKIE_LEVEL = 6;
