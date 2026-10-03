// Ecosistema (fase 22): élites con afijos, alerta del reactor y mundo persistente.

// Afijos de élite al estilo de Diablo. Un élite tiene +50% de salud, el doble de esencia y XP y botín asegurado.
// hp: multiplicador extra · armor / ev: suma · speed: multiplicador de velocidad · abil: habilidades que gana
export const ELITES = {
  blindado: { name: 'Blindado', color: '#9fb8d0', hp: 1.3, armor: 3, desc: '+30% salud y +3 de protección.' },
  veloz: { name: 'Veloz', color: '#ffe066', speed: 1.5, ev: 8, desc: 'Actúa un 50% más rápido y esquiva mejor.' },
  radiactivo: { name: 'Radiactivo', color: '#b8f53d', abil: ['radbite'], aura: 1, desc: 'Muerde con radiación e irradia a quien esté a 2 casillas.' },
  vampirico: { name: 'Vampírico', color: '#e05050', abil: ['drain'], desc: 'Se cura con cada mordisco.' },
  engendrador: { name: 'Engendrador', color: '#c06cff', breeds: 1, desc: 'Cada pocos turnos engendra crías de su especie.' },
  explosivo: { name: 'Explosivo', color: '#ff8a1f', blast: 1, desc: 'Revienta al morir: daño a 2 casillas.' },
  invisible: { name: 'Invisible', color: '#7fb8ff', abil: ['stealth'], desc: 'No se ve hasta tenerlo al lado.' },
  escudero: { name: 'Escudero', color: '#e6dc6a', shield: 1, desc: 'Los suyos a 2 casillas reciben un 40% menos de daño.' },
};
export const ELITE_COLOR = '#ffd23f';

// probabilidad de élite por chebylita según el nivel de la zona y la alerta del reactor
export const eliteChance = (tier, alert) => 0.03 + (tier || 0) * 0.008 + alert * 0.012;

// Nivel de alerta del reactor (0–5): sube con los días. Más élites, nidos más grandes y el pulso antes.
export const ALERT_LEVELS = [
  { name: 'Estable', color: '#3ddc6b', desc: 'El reactor duerme.' },
  { name: 'Inquieto', color: '#b8f53d', desc: 'Más élites. El pulso llega 10 turnos antes.' },
  { name: 'Agitado', color: '#ffd23f', desc: 'Más élites y nidos más numerosos. El pulso llega 20 turnos antes.' },
  { name: 'Peligroso', color: '#ff8a1f', desc: 'Muchos élites; los nidos crecen. El pulso llega 30 turnos antes.' },
  { name: 'Crítico', color: '#ff3b30', desc: 'Los chebylitas suben un nivel. El pulso llega 40 turnos antes.' },
  { name: 'Fusión inminente', color: '#ff00aa', desc: 'Todo lo anterior, y peor. El pulso llega 50 turnos antes.' },
];
export const ALERT_EVERY = 25; // días por nivel de alerta

// mundo persistente: los nidos despejados tardan en volver; las zonas olvidadas crecen
export const CALM_DAYS = 5;    // días que una zona limpia tarda en repoblarse del todo
export const GROW_DAYS = 12;   // cada tantos días sin visitar, la zona sube un nivel (máx. +2)
export const BOSS_RETURN = 10; // días que tarda un jefe abatido en volver a su zona

// Trofeos de jefe (fase 22): gadgets únicos. Solo cae uno si no lo tenéis ya; no salen como botín ni en tiendas.
const TR = { cat: 'gadget', glyph: '♛', tier: 4, noLoot: 1, trophy: 1 };
export const TROPHIES = {
  tr_matriarca: { ...TR, name: 'Colmillo de la Matriarca', value: 600, dmgPct: 8, flags: { killFrenzy: 12 }, desc: 'Del tamaño de un cuchillo. Quien lo lleva no suelta a su presa.' },
  tr_pino: { ...TR, name: 'Anillo de corteza roja', value: 650, hp: 15, rad: 10, flags: { thorns: 4 }, desc: 'Una sección del tronco del Pino Rojo. Todavía pincha.' },
  tr_locomotora: { ...TR, name: 'Silbato de vapor', value: 650, aura: { r: 3, mods: { ev: 3, acc: 2 } }, desc: 'Lo tocas y todo el grupo se pone en marcha.' },
  tr_rey: { ...TR, name: 'Corona de tornillos', value: 700, prot: 3, flags: { quickReload: 1 }, desc: 'Del Rey de la chatarra. Pesa, pero te enseña a recargar con prisa.' },
  tr_siluro: { ...TR, name: 'Bigote del Siluro Abuelo', value: 700, rad: 15, regen: 1, flags: { waterproof: 1 }, desc: 'Tres metros de bigote enrollado. El agua contaminada ya no te hace nada.' },
  tr_pajaro: { ...TR, name: 'Pluma del Pájaro Carpintero', value: 650, vision: 2, acc: 4, desc: 'Una pluma de acero que vibra con la señal del radar.' },
  tr_toporey: { ...TR, name: 'Garra del Topo Rey', value: 700, crit: 8, dmgPct: 6, desc: 'Excava hormigón. Y lo que no es hormigón.' },
  tr_xm7: { ...TR, name: 'Núcleo del XM-7', value: 900, prot: 2, essence: 15, flags: { antiAnomaly: 1 }, desc: 'Electrónica americana alimentada con esencia. Absorbe las descargas.' },
  tr_muestra: { ...TR, name: 'Frasco de la Muestra n.º 7', value: 1000, essence: 25, flags: { essHeal: 8 }, desc: 'Algo se mueve dentro. Cada vez que recoges esencia, te sientes mejor.' },
  tr_corazon: { ...TR, name: 'Latido de la Raíz', value: 900, hp: 20, regen: 2, desc: 'Un nudo de raíz que sigue latiendo. Y tú con él.' },
  tr_pastor: { ...TR, name: 'Cayado de ceniza', value: 800, flags: { stealth: 2 }, cond: { when: 'lowhp', mods: { ev: 6 } }, desc: 'El cayado del Pastor. Los chebylitas no te ven venir.' },
  tr_coloso: { ...TR, name: 'Fragmento del Coloso', value: 1100, rad: 30, prot: 4, dmgPct: 10, desc: 'Corium frío, si eso existe. No lo dejes en la mesilla.' },
};
