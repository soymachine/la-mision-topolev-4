// Eventos narrativos (motor en core/events.js)
// { id, on, once?, chance?, cond?, effects }
// Disparadores (on):
//   expStart      inicio de expedición            data: {}
//   enterSector   primer paso del escuadrón en un sector  data: { sector }
//   turn          cada turno                       data: { turn }
//   seeFaction    primer avistamiento de una facción en la expedición  data: { faction, type }
//   pickup        el agente coge un objeto         data: { item, rarity }
//   agentHurt     un agente recibe daño            data: { dmg }
//   kill          el escuadrón abate a un actor    data: { type, faction, lvl }
//   baseDay       nuevo día en la base             data: {}
// once: true (una vez por partida) · 'exp' (una vez por expedición) · 'agent' (una vez por agente)
export const EVENTS = [
  // ------------------------------------------------------------ inicio de expedición
  { id: 'first_descent', on: 'expStart', once: true,
    effects: [{ radio: '«Aquí Topolev. Os oigo alto y claro. Recordad: la esencia brilla en azul, los chebylitas no. Si dudáis, volved.»' }] },
  { id: 'deep_warning', on: 'expStart', once: true, cond: { map: [3, 9] },
    effects: [{ radio: '«Estáis más abajo que nadie desde la primera noche. Las lecturas de aquí no tienen sentido. Mantened el canal abierto.»' }] },
  { id: 'veteran_lead', on: 'expStart', once: 'agent', cond: { agentLvl: ['>=', 5] }, chance: 0.5,
    effects: [{ log: '{agent} revisa el equipo de los demás antes de bajar. Nadie se lo ha pedido; nadie se queja.', cls: 'o1' }] },
  { id: 'alone_descent', on: 'expStart', once: 'exp', cond: { alone: true }, chance: 0.6,
    effects: [{ log: '{agent} baja solo. El eco de sus pasos suena como si fueran dos.', cls: 'dimt' }] },

  // frases de los trasfondos (fase 15)
  { id: 'bg_start', on: 'expStart', once: 'exp', chance: 0.6, effects: [{ bgLine: 'random:start' }] },
  { id: 'bg_kill', on: 'kill', chance: 0.06, cond: { not: { faction: 'rda' } }, effects: [{ bgLine: 'kill' }] },
  { id: 'bg_hurt', on: 'agentHurt', once: 'exp', cond: { hpPct: ['<', 0.35] }, chance: 0.5, effects: [{ bgLine: 'hurt' }] },
  { id: 'bg_rad', on: 'turn', once: 'exp', cond: { test: (c) => c.a && c.a.rad >= 70 }, effects: [{ bgLine: 'rad' }] },

  // ------------------------------------------------------------ sectores
  { id: 'sector_flooded', on: 'enterSector', once: 'exp', cond: { zone: 'inundado' }, chance: 0.6,
    effects: [{ log: 'El agua os llega a las rodillas en {sector}. Está tibia. No debería estar tibia.', cls: 'dimt' }] },
  { id: 'sector_cave', on: 'enterSector', once: 'exp', cond: { zone: 'caverna' }, chance: 0.5,
    effects: [{ log: 'En {sector} la roca deja de ser hormigón. Las raíces bajan desde un techo que no veis.', cls: 'dimt' }] },
  { id: 'sector_ruins', on: 'enterSector', once: 'exp', cond: { zone: 'ruinas' }, chance: 0.4,
    effects: [{ log: '{sector}: un calendario de abril de 1986 cuelga de una pared que ya no sujeta nada.', cls: 'dimt' }] },
  { id: 'sector_control', on: 'enterSector', once: true, cond: { test: (c) => c.data.sector && c.data.sector.name === 'Sala de control' },
    effects: [{ log: 'Una sala de control. Los indicadores siguen encendidos, alimentados por algo que no es electricidad.', cls: 'o1' }, { setFlag: 'sawControlRoom' }] },

  // ------------------------------------------------------------ paso del tiempo
  { id: 'long_expedition', on: 'turn', once: 'exp', cond: { turn: ['>=', 220] }, chance: 0.02,
    effects: [{ radio: '«¿Seguís ahí? El dosímetro de la base no deja de subir. No os quedéis más de lo necesario.»' }] },

  // ------------------------------------------------------------ facciones
  { id: 'meet_rda', on: 'seeFaction', once: true, cond: { faction: 'rda' }, effects: [{ dialog: 'radio_rda' }] },
  { id: 'meet_usa', on: 'seeFaction', once: true, cond: { faction: 'usa' }, effects: [{ dialog: 'radio_usa' }] },
  { id: 'meet_suecia', on: 'seeFaction', once: true, cond: { faction: 'suecia' }, effects: [{ dialog: 'radio_suecia' }] },
  { id: 'kill_usa_first', on: 'kill', once: true, cond: { faction: 'usa' },
    effects: [{ radio: '«Uno menos. Registrad el cuerpo: cualquier documento vale su peso en oro para Moscú.»' }, { setFlag: 'killedUSA' }] },
  { id: 'kill_boss', on: 'kill', once: 'exp', cond: { actor: ['pastor', 'coloso'] },
    effects: [{ radio: '«¿Eso que ha dejado de moverse en mis lecturas era…? Dios mío. Buen trabajo, camaradas.»' }, { incFlag: 'bossKills' }] },

  // ------------------------------------------------------------ botín y heridas
  { id: 'legendary_find', on: 'pickup', once: 'exp', cond: { minRarity: 4 },
    effects: [{ log: '{agent} sostiene el hallazgo a la luz de la linterna durante un largo segundo antes de guardarlo.', cls: 'o1' }] },
  { id: 'badly_hurt', on: 'agentHurt', once: 'exp', cond: { hpPct: ['<', 0.25] }, chance: 0.7,
    effects: [{ log: '{agent} aprieta los dientes y se apoya en la pared. «Estoy bien. Estoy bien.»', cls: 'warn' }] },

  // ------------------------------------------------------------ base
  { id: 'rumours_foreign', on: 'baseDay', once: true, cond: { day: ['>=', 3] },
    effects: [{ baseMsg: 'Rumores en el comedor: un camionero dice haber visto matrículas extranjeras en el control de Dityatki. Seguramente no es nada. — Dr. A. Topolev' }, { setFlag: 'rumourForeign' }] },
  { id: 'komitet_visit', on: 'baseDay', once: true, cond: { day: ['>=', 5] }, effects: [{ dialog: 'base_komitet' }] },
  { id: 'widow_letter', on: 'baseDay', once: true, cond: [{ day: ['>=', 4] }, { test: (c) => c.S.fallen.length > 0 }], chance: 0.5, effects: [{ dialog: 'base_letter' }] },
];
