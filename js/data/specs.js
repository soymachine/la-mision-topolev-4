// Especializaciones (fase 15.2): al nivel 5 el agente elige una. Cada una tiene 3 ramas de 4 talentos
// (2 básicos + 2 avanzados; un avanzado exige tener antes un talento de su rama) y una habilidad activa.
//
// Forma de un talento (también la de los generales de data/talents.js):
//   mods  → estadísticas fijas (acc, ev, hp, prot, rad, vision, crit, slots, essence, healPct, meleePct, dmgPct, regen, range, mining)
//   attr  → puntos extra de atributo (pueden pasar de 10)
//   flags → efectos especiales que la expedición consulta con flag() (ver exp/*.js)
//   cond  → { when, mods }: mods solo si se cumple la condición (near, alone, still, hurt, lowhp, moved, irradiated, light, inWater, alliesNear)
//   aura  → { r, mods }: mods para todo el escuadrón a r casillas (incluido el propio agente)
//   syn   → [{ gadget | mod, mods?, flags? }]: sinergia con un gadget equipado o un mod montado en el arma activa
export const SPECS = {
  tirador: {
    name: 'Tirador', glyph: '⌖', color: '#7fd0ff', fantasy: 'Mata desde lejos, sin que le vean.',
    ability: { id: 'mark', name: 'Marcar objetivo', glyph: '◎', cd: 15, target: true, desc: 'Marca a un enemigo visible durante 5 turnos: todo el escuadrón tiene +25% de impacto contra él.' },
    branches: [
      { name: 'Paciencia', talents: ['t_paciencia', 't_respira', 't_zaitsev', 't_nido'] },
      { name: 'Balística', talents: ['t_calculo', 't_selecta', 't_gracia', 't_perfora'] },
      { name: 'Observador', talents: ['t_vigia', 't_marcador', 't_contra', 't_sangre'] },
    ],
  },
  asalto: {
    name: 'Asalto', glyph: '»', color: '#ff7a4a', fantasy: 'Primera línea: entra el primero y sale el último.',
    ability: { id: 'suppress', name: 'Fuego de supresión', glyph: '≫', cd: 12, target: true, desc: 'Barre un cono hacia el objetivo con el arma de fuego: los enemigos del cono pierden su próximo turno. Gasta munición.' },
    branches: [
      { name: 'Fuego', talents: ['a_rafaga', 'a_cambio', 'a_supresor', 'a_lluvia'] },
      { name: 'Choque', talents: ['a_carga', 'a_culata', 'a_chaleco', 'a_trinchera'] },
      { name: 'Cobertura', talents: ['a_cobertura', 'a_infante', 'a_lanza', 'a_ultimo'] },
    ],
  },
  sanitario: {
    name: 'Sanitario', glyph: '+', color: '#6fe89a', fantasy: 'Mantiene vivo al grupo.',
    ability: { id: 'aid', name: 'Primeros auxilios de campaña', glyph: '✚', cd: 20, target: false, desc: 'Cura al agente adyacente más herido (o a sí mismo) un 35% de su salud y elimina veneno y quemaduras. No gasta botiquines.' },
    branches: [
      { name: 'Cirugía', talents: ['s_manos', 's_dosis', 's_rescate', 's_cirujano'] },
      { name: 'Triaje', talents: ['s_triaje', 's_antidoto', 's_morfina', 's_descon'] },
      { name: 'Laboratorio', talents: ['s_bioquim', 's_inmune', 's_suero', 's_autoiny'] },
    ],
  },
  zapador: {
    name: 'Zapador', glyph: '*', color: '#ffb02e', fantasy: 'Explosivos, trampas y máquinas.',
    ability: { id: 'charge', name: 'Colocar carga', glyph: '✱', cd: 18, target: false, desc: 'Deja una carga de demolición en su casilla. Estalla al cabo de 3 turnos (radio 2). Apártate.' },
    branches: [
      { name: 'Explosivos', talents: ['z_bolsillos', 'z_dinamita', 'z_hueca', 'z_brazo', 'z_patada'] },
      { name: 'Trampas', talents: ['z_minador', 'z_desactiva', 'z_cebo', 'z_cables'] },
      { name: 'Máquinas', talents: ['z_mecanico', 'z_chatarra', 'z_ingeniero', 'z_blindaje'] },
    ],
  },
  liquidador: {
    name: 'Liquidador', glyph: '☢', color: '#b8f53d', fantasy: 'Vive en la radiación como en casa.',
    ability: { id: 'wash', name: 'Lavado de campo', glyph: '≋', cd: 20, target: false, desc: 'Descontamina al agente y a los adyacentes (−25 de radiación) y los hace inmunes al gas durante 4 turnos.' },
    branches: [
      { name: 'Plomo', talents: ['l_plomo', 'l_dosim', 'l_reactor', 'l_escudo'] },
      { name: 'Aire', talents: ['l_aliento', 'l_vadeador', 'l_pararrayos', 'l_bombero'] },
      { name: 'Cosecha', talents: ['l_recolector', 'l_vetas', 'l_iman', 'l_cosecha'] },
    ],
  },
  explorador: {
    name: 'Explorador', glyph: '·', color: '#c8a0ff', fantasy: 'Sigilo e información.',
    ability: { id: 'vanish', name: 'Desaparecer', glyph: '░', cd: 18, target: false, desc: 'Durante 3 turnos los enemigos pierden su rastro (salvo los que estén pegados a él) y los nidos casi no lo detectan.' },
    branches: [
      { name: 'Sigilo', talents: ['e_lince', 'e_sombra', 'e_emboscada', 'e_fantasma'] },
      { name: 'Cartografía', talents: ['e_cartografo', 'e_orienta', 'e_rutas', 'e_radio'] },
      { name: 'Rastreo', talents: ['e_rastreador', 'e_cazador', 'e_taiga', 'e_ligero'] },
    ],
  },
  comisario: {
    name: 'Comisario', glyph: '★', color: '#ff5050', fantasy: 'Liderazgo, moral y política.',
    ability: { id: 'patria', name: '¡Por la Patria!', glyph: '☭', cd: 30, target: false, desc: 'El escuadrón gana un turno extra: los enemigos no actúan este turno y todos ganan +2 de precisión durante 3 turnos.' },
    branches: [
      { name: 'Moral', talents: ['c_arenga', 'c_ejemplo', 'c_estandarte', 'c_nipaso'] },
      { name: 'Diplomacia', talents: ['c_negocia', 'c_poliglota', 'c_partido', 'c_tregua'] },
      { name: 'Mando', talents: ['c_ordenes', 'c_veterania', 'c_patriota', 'c_lider'] },
    ],
  },
};
export const SPEC_LEVEL = 5;
export const ABILITIES = Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [s.ability.id, { ...s.ability, spec: k }]));

// tier 1 = básico · tier 2 = avanzado (exige un talento de su rama)
const T = (spec, branch, tier, o) => ({ spec, branch, tier, ...o });
export const SPEC_TALENTS = {
  // ---------------------------------------------------------------- TIRADOR
  t_paciencia: T('tirador', 0, 1, { name: 'Paciencia', glyph: '⌛', desc: '+10% de impacto si no te moviste el turno anterior. Sinergia: bípode (+6% más) y prismáticos (+5% crítico).', flags: { stillAcc: 10 }, syn: [{ mod: 'bipod', flags: { stillAcc: 16 } }, { gadget: 'binoc', mods: { crit: 5 } }] }),
  t_respira: T('tirador', 0, 1, { name: 'Respiración de tirador', glyph: '⌖', desc: '+3 precisión.', mods: { acc: 3 } }),
  t_zaitsev: T('tirador', 0, 2, { name: 'Ojo de Zaitsev', glyph: '◉', desc: 'Los críticos hacen un 60% más de daño.', flags: { critDmg: 60 } }),
  t_nido: T('tirador', 0, 2, { name: 'Nido de tirador', glyph: '▲', desc: 'Quieto: +3 agilidad. Los nidos dormidos te detectan a 2 casillas menos.', cond: { when: 'still', mods: { ev: 3 } }, flags: { stealth: 2 } }),
  t_calculo: T('tirador', 1, 1, { name: 'Cálculo balístico', glyph: '∠', desc: '+2 de alcance con todas las armas. Sinergia: telémetro (+5% crítico).', mods: { range: 2 }, syn: [{ gadget: 'rangefinder', mods: { crit: 5 } }] }),
  t_selecta: T('tirador', 1, 1, { name: 'Munición seleccionada', glyph: '"', desc: '+7% de daño.', mods: { dmgPct: 7 } }),
  t_gracia: T('tirador', 1, 2, { name: 'Tiro de gracia', glyph: '†', desc: '+50% de daño contra enemigos por debajo del 30% de salud.', flags: { execute: 50 } }),
  t_perfora: T('tirador', 1, 2, { name: 'Bala perforante', glyph: '→', desc: 'Tus disparos ignoran 2 puntos más de blindaje.', flags: { pierceAdd: 2 } }),
  t_vigia: T('tirador', 2, 1, { name: 'Vigía', glyph: '◎', desc: '+1 visión y +3% crítico.', mods: { vision: 1, crit: 3 } }),
  t_marcador: T('tirador', 2, 1, { name: 'Marcador experto', glyph: '◎', desc: 'Marcar objetivo dura 8 turnos, da +35% y se recarga 5 turnos antes.', flags: { markPlus: 1 } }),
  t_contra: T('tirador', 2, 2, { name: 'Contratirador', glyph: '@', desc: '+15% de impacto contra personas.', flags: { vsHuman: 15 } }),
  t_sangre: T('tirador', 2, 2, { name: 'Sangre fría', glyph: '❄', desc: '+5% crítico. Separado del grupo: +4 precisión.', mods: { crit: 5 }, cond: { when: 'alone', mods: { acc: 4 } } }),

  // ---------------------------------------------------------------- ASALTO
  a_rafaga: T('asalto', 0, 1, { name: 'Ráfaga controlada', glyph: '≡', desc: 'Las armas que disparan en ráfaga disparan 1 bala más.', flags: { burstPlus: 1 } }),
  a_cambio: T('asalto', 0, 1, { name: 'Cambio de cargador', glyph: '"', desc: 'Recargar no consume turno.', flags: { quickReload: 1 } }),
  a_supresor: T('asalto', 0, 2, { name: 'Supresor nato', glyph: '≫', desc: 'Fuego de supresión inmoviliza 2 turnos y se recarga 4 turnos antes.', flags: { suppressPlus: 1 } }),
  a_lluvia: T('asalto', 0, 2, { name: 'Lluvia de plomo', glyph: '∴', desc: '+10% de daño.', mods: { dmgPct: 10 } }),
  a_carga: T('asalto', 1, 1, { name: 'Carga', glyph: '»', desc: 'Si te moviste este turno: +40% de daño cuerpo a cuerpo.', cond: { when: 'moved', mods: { meleePct: 40 } } }),
  a_culata: T('asalto', 1, 1, { name: 'Culatazo', glyph: '†', desc: '+30% de daño cuerpo a cuerpo.', mods: { meleePct: 30 } }),
  a_chaleco: T('asalto', 1, 2, { name: 'Chaleco remendado', glyph: '[', desc: '+2 protección. Sinergia: placa reactiva (+1 más).', mods: { prot: 2 }, syn: [{ gadget: 'plate', mods: { prot: 1 } }] }),
  a_trinchera: T('asalto', 1, 2, { name: 'Frenesí de trinchera', glyph: '!', desc: 'Cada baja te cura 2 y da +20% de daño durante 3 turnos.', flags: { killHeal: 2, killFrenzy: 20 } }),
  a_cobertura: T('asalto', 2, 1, { name: 'Fuego de cobertura', glyph: '░', desc: 'Aura: el escuadrón a 2 casillas gana +2 agilidad.', aura: { r: 2, mods: { ev: 2 } } }),
  a_infante: T('asalto', 2, 1, { name: 'Aguante de infante', glyph: '♥', desc: '+12 salud máxima.', mods: { hp: 12 } }),
  a_lanza: T('asalto', 2, 2, { name: 'Punta de lanza', glyph: '↑', desc: 'Junto a un aliado (≤3 casillas): +3 precisión y +5% de daño.', cond: { when: 'near', mods: { acc: 3, dmgPct: 5 } } }),
  a_ultimo: T('asalto', 2, 2, { name: 'Último en caer', glyph: '‼', desc: 'Por debajo del 30% de salud: +4 agilidad y +15% de daño.', cond: { when: 'lowhp', mods: { ev: 4, dmgPct: 15 } } }),

  // ---------------------------------------------------------------- SANITARIO
  s_manos: T('sanitario', 0, 1, { name: 'Manos firmes', glyph: '+', desc: 'La primera curación de cada expedición no gasta turno.', flags: { healFree: 1 } }),
  s_dosis: T('sanitario', 0, 1, { name: 'Dosis exacta', glyph: '!', desc: 'Las curaciones curan un 35% más. Sinergia: brazalete de sanitario (+15% más).', mods: { healPct: 35 }, syn: [{ gadget: 'medband', mods: { healPct: 15 } }] }),
  s_rescate: T('sanitario', 0, 2, { name: 'Rescate', glyph: '✚', desc: 'Una vez por expedición, un agente adyacente (o tú) que iba a morir queda con 1 de salud.', flags: { rescue: 1 } }),
  s_cirujano: T('sanitario', 0, 2, { name: 'Cirujano de campaña', glyph: '✚', desc: 'Primeros auxilios cura un 60% y se recarga 6 turnos antes.', flags: { aidPlus: 1 } }),
  s_triaje: T('sanitario', 1, 1, { name: 'Triaje', glyph: '♥', desc: 'Aura: el escuadrón a 2 casillas regenera 1 de salud cada 4 turnos.', aura: { r: 2, mods: { regen: 1 } } }),
  s_antidoto: T('sanitario', 1, 1, { name: 'Antídotos de bolsillo', glyph: '≋', desc: 'Inmune al veneno de esporas.', flags: { poisonImmune: 1 } }),
  s_morfina: T('sanitario', 1, 2, { name: 'Morfina', glyph: '‡', desc: 'Herido (<50%): +3 agilidad y +2 precisión.', cond: { when: 'hurt', mods: { ev: 3, acc: 2 } } }),
  s_descon: T('sanitario', 1, 2, { name: 'Descontaminación', glyph: '☢', desc: 'Aura: el escuadrón a 2 casillas gana +10% de resistencia a la radiación.', aura: { r: 2, mods: { rad: 10 } } }),
  s_bioquim: T('sanitario', 2, 1, { name: 'Bioquímica', glyph: '✦', desc: '+10% de esencia recogida.', mods: { essence: 10 } }),
  s_inmune: T('sanitario', 2, 1, { name: 'Inmunizado', glyph: '☢', desc: '+10% de resistencia a la radiación y +5 de salud máxima.', mods: { rad: 10, hp: 5 } }),
  s_suero: T('sanitario', 2, 2, { name: 'Suero de esencia', glyph: '✧', desc: 'Cada 6 de esencia recogida te cura 1 de salud.', flags: { essHeal: 6 } }),
  s_autoiny: T('sanitario', 2, 2, { name: 'Autoinyector casero', glyph: '‼', desc: 'Una vez por expedición, al bajar del 25% de salud, cura 20.', flags: { autoInject: 20 } }),

  // ---------------------------------------------------------------- ZAPADOR
  z_bolsillos: T('zapador', 0, 1, { name: 'Bolsillos hondos', glyph: '(', desc: 'Al lanzar granadas y explosivos, un 30% de las veces no se gastan.', flags: { thrifty: 30 } }),
  z_dinamita: T('zapador', 0, 1, { name: 'Dinamitero', glyph: '*', desc: 'Tus explosiones hacen un 25% más de daño.', flags: { blastPct: 25 } }),
  z_hueca: T('zapador', 0, 2, { name: 'Carga hueca', glyph: '✱', desc: 'Colocar carga: radio 3 y +50% de daño.', flags: { chargePlus: 1 } }),
  z_brazo: T('zapador', 0, 2, { name: 'Brazo de lanzador', glyph: '↗', desc: '+2 de alcance al lanzar objetos.', flags: { throwRange: 2 } }),
  z_patada: T('zapador', 0, 2, { name: 'Devolución', glyph: '↶', desc: 'F junto a una granada enemiga: la devuelves de una patada 3 casillas más allá.', flags: { kickNade: 1 } }),
  z_minador: T('zapador', 1, 1, { name: 'Minador', glyph: '^', desc: 'Tus trampas hacen un 50% más de daño.', flags: { trapDmg: 50 } }),
  z_desactiva: T('zapador', 1, 1, { name: 'Desactivador', glyph: 'ϟ', desc: 'Inmune a las anomalías eléctricas.', flags: { antiAnomaly: 1 } }),
  z_cebo: T('zapador', 1, 2, { name: 'Cebo', glyph: '¤', desc: 'Tus trampas inmovilizan 2 turnos más.', flags: { trapStun: 2 } }),
  z_cables: T('zapador', 1, 2, { name: 'Cables trampa', glyph: '#', desc: 'Quien te ataca cuerpo a cuerpo recibe 4 de daño.', flags: { thorns: 4 } }),
  z_mecanico: T('zapador', 2, 1, { name: 'Mecánico', glyph: '¤', desc: '+2 Técnica. Compañeros mecánicos: +30% salud y daño, drones con un 50% más de batería y reparaciones un 40% más baratas.', attr: { tec: 2 }, flags: { mechanic: 1 } }),
  z_chatarra: T('zapador', 2, 1, { name: 'Chatarrero', glyph: '(', desc: '+2 huecos de mochila.', mods: { slots: 2 } }),
  z_ingeniero: T('zapador', 2, 2, { name: 'Ingeniero de campaña', glyph: '¤', desc: 'Ajusta tus aparatos: contador Geiger +15% res. radiación, pila de radioisótopo +1 regeneración, radio de campaña +1 visión, linterna de arco +2% crítico.', syn: [{ gadget: 'geiger', mods: { rad: 15 } }, { gadget: 'rtg', mods: { regen: 1 } }, { gadget: 'radio', mods: { vision: 1 } }, { gadget: 'arclamp', mods: { crit: 2 } }] }),
  z_blindaje: T('zapador', 2, 2, { name: 'Blindaje improvisado', glyph: '▓', desc: '+3 protección.', mods: { prot: 3 } }),

  // ---------------------------------------------------------------- LIQUIDADOR
  l_plomo: T('liquidador', 0, 1, { name: 'Forro de plomo', glyph: '☢', desc: '+15% de resistencia a la radiación.', mods: { rad: 15 } }),
  l_dosim: T('liquidador', 0, 1, { name: 'Dosimetrista', glyph: '◐', desc: '+5% res. radiación. Sinergia: dosímetro o contador Geiger (+10% más y +5% esencia).', mods: { rad: 5 }, syn: [{ gadget: 'dosimeter', mods: { rad: 10, essence: 5 } }, { gadget: 'geiger', mods: { rad: 10, essence: 5 } }] }),
  l_reactor: T('liquidador', 0, 2, { name: 'Hijo del reactor', glyph: '☢', desc: 'Con 50 o más de radiación acumulada: +15% de daño y +2 agilidad.', cond: { when: 'irradiated', mods: { dmgPct: 15, ev: 2 } } }),
  l_escudo: T('liquidador', 0, 2, { name: 'Escudo de plomo', glyph: '▓', desc: '+2 protección y +5% res. radiación.', mods: { prot: 2, rad: 5 } }),
  l_aliento: T('liquidador', 1, 1, { name: 'Respiración contenida', glyph: '≋', desc: 'El gas tóxico no te envenena y te hace la mitad de daño.', flags: { gasResist: 1 } }),
  l_vadeador: T('liquidador', 1, 1, { name: 'Vadeador', glyph: '~', desc: 'El agua contaminada no te irradia. +3% res. radiación.', flags: { waterproof: 1 }, mods: { rad: 3 } }),
  l_pararrayos: T('liquidador', 1, 2, { name: 'Pararrayos', glyph: 'ϟ', desc: 'Inmune a las anomalías eléctricas. +1 protección.', flags: { antiAnomaly: 1 }, mods: { prot: 1 } }),
  l_bombero: T('liquidador', 1, 2, { name: 'Bombero de Prípiat', glyph: '^', desc: 'El fuego no te quema.', flags: { fireImmune: 1 } }),
  l_recolector: T('liquidador', 2, 1, { name: 'Recolector', glyph: '✦', desc: '+30% de esencia recogida en casillas radiactivas.', flags: { radEss: 30 } }),
  l_vetas: T('liquidador', 2, 1, { name: 'Minero de vetas', glyph: '✦', desc: 'Extrae esencia de las vetas el doble de rápido.', mods: { mining: 1 } }),
  l_iman: T('liquidador', 2, 2, { name: 'Imán humano', glyph: '✧', desc: 'Atrae la esencia del suelo a 2 casillas.', flags: { essMagnet: 2 } }),
  l_cosecha: T('liquidador', 2, 2, { name: 'Cosecha roja', glyph: '✦', desc: '+15% de esencia recogida.', mods: { essence: 15 } }),

  // ---------------------------------------------------------------- EXPLORADOR
  e_lince: T('explorador', 0, 1, { name: 'Pisada de lince', glyph: '·', desc: 'Los nidos dormidos te detectan a 3 casillas menos. Sinergia: capa de ceniza (+1 más).', flags: { stealth: 3 }, syn: [{ gadget: 'ashcloak', flags: { stealth: 4 } }] }),
  e_sombra: T('explorador', 0, 1, { name: 'Sombra', glyph: '░', desc: 'Separado del grupo: +3 agilidad.', cond: { when: 'alone', mods: { ev: 3 } } }),
  e_emboscada: T('explorador', 0, 2, { name: 'Emboscada', glyph: '†', desc: '+50% de daño contra enemigos dormidos o que merodean sin haberte visto.', flags: { ambush: 50 } }),
  e_fantasma: T('explorador', 0, 2, { name: 'Fantasma', glyph: '░', desc: 'Desaparecer dura 5 turnos y se recarga 6 turnos antes.', flags: { vanishPlus: 1 } }),
  e_cartografo: T('explorador', 1, 1, { name: 'Cartógrafo', glyph: '▦', desc: 'Al entrar en un sector nuevo, lo cartografías entero.', flags: { mapper: 1 } }),
  e_orienta: T('explorador', 1, 1, { name: 'Orientación', glyph: '◉', desc: '+1 visión. Sinergia: brújula de esencia (+5% esencia).', mods: { vision: 1 }, syn: [{ gadget: 'compass', mods: { essence: 5 } }] }),
  e_rutas: T('explorador', 1, 2, { name: 'Rutas de escape', glyph: '⌂', desc: 'Las extracciones temporales duran 12 turnos más.', flags: { exitPlus: 12 } }),
  e_radio: T('explorador', 1, 2, { name: 'Radiotelegrafista', glyph: '📻', desc: 'La evacuación llega 2 turnos antes.', flags: { evacFast: 2 } }),
  e_rastreador: T('explorador', 2, 1, { name: 'Rastreador', glyph: '∴', desc: 'Percibe a los enemigos a 7 casillas aunque no los vea.', flags: { tracker: 7 } }),
  e_cazador: T('explorador', 2, 1, { name: 'Cazador', glyph: '⌖', desc: '+2 precisión y +3% crítico.', mods: { acc: 2, crit: 3 } }),
  e_taiga: T('explorador', 2, 2, { name: 'Ojo de taiga', glyph: '∴', desc: 'Percibe a los enemigos a 13 casillas aunque no los vea.', flags: { tracker: 13 } }),
  e_ligero: T('explorador', 2, 2, { name: 'Equipaje ligero', glyph: '≈', desc: 'Con la mochila a la mitad o menos: +3 agilidad.', cond: { when: 'light', mods: { ev: 3 } } }),

  // ---------------------------------------------------------------- COMISARIO
  c_arenga: T('comisario', 0, 1, { name: 'Arenga', glyph: '☭', desc: 'Aura: el escuadrón a 3 casillas gana +2 precisión.', aura: { r: 3, mods: { acc: 2 } } }),
  c_ejemplo: T('comisario', 0, 1, { name: 'Predicar con el ejemplo', glyph: '★', desc: 'Junto a un aliado (≤3 casillas): +2 precisión y +2 agilidad.', cond: { when: 'near', mods: { acc: 2, ev: 2 } } }),
  c_estandarte: T('comisario', 0, 2, { name: 'Estandarte', glyph: '⚑', desc: 'Aura: el escuadrón a 4 casillas gana +5% de daño. Sinergia: banderín del regimiento (+5% más).', aura: { r: 4, mods: { dmgPct: 5 } }, syn: [{ gadget: 'banner', mods: { dmgPct: 5 } }] }),
  c_nipaso: T('comisario', 0, 2, { name: '¡Ni un paso atrás!', glyph: '‼', desc: 'Aura: el escuadrón a 3 casillas gana +1 protección.', aura: { r: 3, mods: { prot: 1 } } }),
  c_negocia: T('comisario', 1, 1, { name: 'Negociador', glyph: '☏', desc: 'Desbloquea opciones de diálogo y reduce a la mitad la reputación perdida al provocar a una facción.', flags: { negotiator: 1, diplomat: 1 } }),
  c_poliglota: T('comisario', 1, 1, { name: 'Políglota', glyph: '¶', desc: 'Las mejoras de reputación son un 50% mayores.', flags: { polyglot: 50 } }),
  c_partido: T('comisario', 1, 2, { name: 'Contactos en el Partido', glyph: '☭', desc: 'Mientras esté en plantilla, la Intendencia cobra un 10% menos.', flags: { partyDiscount: 10 } }),
  c_tregua: T('comisario', 1, 2, { name: 'Tregua', glyph: '☮', desc: 'Una vez por expedición, atacar a un neutral o aliado no rompe la relación (solo un aviso).', flags: { truce: 1 } }),
  c_ordenes: T('comisario', 2, 1, { name: 'Órdenes claras', glyph: '!', desc: 'Aura: el escuadrón a 6 casillas gana +1 precisión y +1 agilidad.', aura: { r: 6, mods: { acc: 1, ev: 1 } } }),
  c_veterania: T('comisario', 2, 1, { name: 'Veteranía', glyph: '★', desc: 'Todo el escuadrón gana un 15% más de experiencia.', flags: { xpBonus: 15 } }),
  c_patriota: T('comisario', 2, 2, { name: 'Patriotismo', glyph: '☭', desc: '¡Por la Patria! se recarga 10 turnos antes.', flags: { patriaPlus: 1 } }),
  c_lider: T('comisario', 2, 2, { name: 'Líder nato', glyph: '★', desc: 'Aura: el escuadrón a 4 casillas gana +3% crítico y +1 precisión.', aura: { r: 4, mods: { crit: 3, acc: 1 } } }),
};
// coste de volver a tirar una oferta de talentos
export const rerollCost = (lvl) => 60 + lvl * 40;
