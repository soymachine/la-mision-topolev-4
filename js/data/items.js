// Definiciones base de objetos
// cat: weapon | mod | ammo | armor | helmet | gadget | backpack | consumable | valuable
// tier: 0..5 (disponibilidad en la intendencia y nivel de aparición)
import { WEAPONS, NEW_AMMO } from './weapons.js';
import { MODS } from './mods.js';

export const CAT_INFO = {
  weapon: { name: 'Arma', glyph: '/' },
  mod: { name: 'Mod de arma', glyph: '¬' },
  ammo: { name: 'Munición', glyph: '"' },
  armor: { name: 'Armadura', glyph: '[' },
  helmet: { name: 'Casco', glyph: '^' },
  gadget: { name: 'Gadget', glyph: '¤' },
  backpack: { name: 'Mochila', glyph: '(' },
  consumable: { name: 'Consumible', glyph: '!' },
  valuable: { name: 'Botín', glyph: '$' },
};

export const AMMO_NAMES = {
  a_9x18: '9×18 mm', a_545: '5,45×39 mm', a_12: 'cal. 12', a_762: '7,62×54R', a_fuel: 'combustible', a_cell: 'celda de esencia',
  a_762x39: '7,62×39 mm', a_9x39: '9×39 mm', a_127: '12,7×108 mm', a_40: 'VOG-25 40 mm', a_rpg: 'cohete PG-7',
};

export const ITEMS = {
  ...WEAPONS,
  ...MODS,
  ...NEW_AMMO,

  // ---------- MUNICIÓN ----------
  a_9x18: { cat: 'ammo', name: 'Munición 9×18 mm', glyph: '"', tier: 0, stack: 120, value: 1, pack: 24, desc: 'Para Makarov y Stechkin.' },
  a_12: { cat: 'ammo', name: 'Cartuchos cal. 12', glyph: '"', tier: 1, stack: 60, value: 3, pack: 12, desc: 'Perdigones para escopetas.' },
  a_545: { cat: 'ammo', name: 'Munición 5,45×39 mm', glyph: '"', tier: 2, stack: 150, value: 2, pack: 30, desc: 'Para la familia AK-74.' },
  a_762: { cat: 'ammo', name: 'Munición 7,62×54R', glyph: '"', tier: 3, stack: 100, value: 4, pack: 20, desc: 'Cartucho de fusil de largo alcance.' },
  a_fuel: { cat: 'ammo', name: 'Combustible LPO', glyph: '"', tier: 4, stack: 30, value: 8, pack: 6, desc: 'Mezcla incendiaria para el LPO-50.' },
  a_cell: { cat: 'ammo', name: 'Celda de esencia', glyph: '"', tier: 5, stack: 40, value: 14, pack: 8, desc: 'Esencia chebylita condensada y estabilizada.' },

  // ---------- ARMADURAS ----------
  overall: { cat: 'armor', name: 'Mono de trabajo', glyph: '[', tier: 0, prot: 0, rad: 5, ev: 0, value: 20, desc: 'Algodón azul de la central. Mejor que nada.' },
  ozk: { cat: 'armor', name: 'Traje OZK', glyph: '[', tier: 0, prot: 1, rad: 30, ev: -1, value: 90, desc: 'Traje de protección química de goma.' },
  b6b2: { cat: 'armor', name: 'Chaleco 6B2', glyph: '[', tier: 1, prot: 3, rad: 5, ev: -1, value: 160, desc: 'Chaleco antibalas de placas de titanio.' },
  l1: { cat: 'armor', name: 'Traje L-1 de liquidador', glyph: '[', tier: 1, prot: 2, rad: 45, ev: -1, value: 180, desc: 'El mismo traje que llevaban los liquidadores.' },
  b6b3: { cat: 'armor', name: 'Chaleco 6B3', glyph: '[', tier: 2, prot: 4, rad: 10, ev: -2, value: 300, desc: 'Chaleco pesado de infantería.' },
  kzm: { cat: 'armor', name: 'Traje químico KZM', glyph: '[', tier: 2, prot: 2, rad: 60, ev: 0, value: 320, desc: 'Traje sellado para zonas contaminadas.' },
  berkut: { cat: 'armor', name: 'Traje «Berkut-R»', glyph: '[', tier: 3, prot: 5, rad: 55, ev: -1, value: 650, desc: 'Combinación experimental de blindaje y aislamiento.' },
  sputnik: { cat: 'armor', name: 'Exoesqueleto «Sputnik»', glyph: '[', tier: 4, prot: 8, rad: 45, ev: -3, hp: 10, value: 1300, desc: 'Servomotores militares y placas de plomo.' },
  graphite: { cat: 'armor', name: 'Coraza de grafito chebylita', glyph: '[', tier: 5, prot: 10, rad: 75, ev: -1, hp: 15, value: 2500, desc: 'Fabricada con caparazones de Gólem de grafito.' },

  // ---------- CASCOS ----------
  cap: { cat: 'helmet', name: 'Gorra de liquidador', glyph: '^', tier: 0, prot: 0, rad: 5, value: 10, desc: 'Tela fina. Moral alta.' },
  gp5: { cat: 'helmet', name: 'Máscara de gas GP-5', glyph: '^', tier: 0, prot: 0, rad: 15, gasImmune: 1, value: 60, desc: 'Inmune al gas de esporas.' },
  ssh68: { cat: 'helmet', name: 'Casco SSh-68', glyph: '^', tier: 1, prot: 1, rad: 0, value: 70, desc: 'Casco de acero reglamentario.' },
  zsh1: { cat: 'helmet', name: 'Casco ZSh-1', glyph: '^', tier: 2, prot: 2, rad: 10, value: 180, desc: 'Casco de titanio con visera.' },
  gp7: { cat: 'helmet', name: 'Máscara GP-7 con filtro', glyph: '^', tier: 2, prot: 0, rad: 25, gasImmune: 1, value: 200, desc: 'Filtros de carbón activo. Inmune al gas.' },
  sfera: { cat: 'helmet', name: 'Casco «Sfera»', glyph: '^', tier: 3, prot: 3, rad: 5, value: 420, desc: 'Casco de las fuerzas especiales.' },
  vityaz: { cat: 'helmet', name: 'Casco «Vityaz» con visor', glyph: '^', tier: 4, prot: 3, rad: 15, vision: 2, value: 800, desc: 'Visor de intensificación de luz.' },
  corona: { cat: 'helmet', name: 'Corona de corium', glyph: '^', tier: 5, prot: 4, rad: 30, vision: 2, gasImmune: 1, value: 1800, desc: 'Lava solidificada del reactor. Brilla en la oscuridad.' },

  // ---------- GADGETS ----------
  // Estáticos: vision, rad, essence, regen, ev, crit, hp, acc, slots, range.
  // cond: efectos solo en una situación (near: aliado a ≤3 · alone: ningún aliado a ≤6 · still: no te moviste · hurt: <50% salud · lowhp: <30%)
  // aura: efectos para ti y tus aliados a r casillas · team: si varios agentes del escuadrón llevan el mismo gadget
  // set: conjunto con otra pieza en el mismo agente (ver GADGET_SETS) · flags: efectos especiales
  torch: { cat: 'gadget', name: 'Linterna KSF', glyph: '¤', tier: 0, vision: 1, value: 40, desc: 'Amplía el campo de visión.' },
  kerosene: { cat: 'gadget', name: 'Lámpara de queroseno', glyph: '¤', tier: 0, aura: { r: 3, mods: { vision: 1 } }, value: 50, desc: 'Ilumina a todo el grupo: +1 visión a ti y a los aliados cercanos.' },
  waders: { cat: 'gadget', name: 'Botas de goma de liquidador', glyph: '¤', tier: 0, rad: 5, flags: { waterproof: 1 }, value: 45, desc: 'El agua contaminada no te irradia.' },
  dosimeter: { cat: 'gadget', name: 'Dosímetro de solapa ID-11', glyph: '¤', tier: 0, rad: 8, set: 'dosimetria', value: 60, desc: 'Pieza del conjunto Dosimetría (con el Contador Geiger DP-5).' },
  talisman: { cat: 'gadget', name: 'Talismán de babushka', glyph: '¤', tier: 0, rad: 5, cond: { when: 'lowhp', mods: { ev: 4 } }, value: 40, desc: 'Un nudo de lana roja. Cuando todo va mal, esquivas mejor.' },
  geiger: { cat: 'gadget', name: 'Contador Geiger DP-5', glyph: '¤', tier: 1, rad: 15, set: 'dosimetria', value: 120, desc: 'Reduce la radiación absorbida. Clic, clic, clic.' },
  compass: { cat: 'gadget', name: 'Brújula de esencia', glyph: '¤', tier: 1, essence: 10, value: 130, desc: 'La aguja apunta a la esencia. Más esencia recogida.' },
  radio: { cat: 'gadget', name: 'Radio de campaña R-126', glyph: '¤', tier: 1, cond: { when: 'near', mods: { acc: 3, ev: 2 } }, value: 140, desc: 'Coordinación: más puntería y agilidad cuando tienes un aliado cerca.' },
  medband: { cat: 'gadget', name: 'Brazalete de sanitario', glyph: '¤', tier: 1, aura: { r: 1, mods: { regen: 1 } }, value: 150, desc: 'Tú y los aliados adyacentes regeneráis salud.' },
  binoc: { cat: 'gadget', name: 'Prismáticos BPC-2', glyph: '¤', tier: 1, cond: { when: 'still', mods: { vision: 3, acc: 4 } }, value: 130, desc: 'Quieto, observas: más visión y puntería si no te moviste el turno anterior.' },
  dielboots: { cat: 'gadget', name: 'Botas dieléctricas', glyph: '¤', tier: 1, flags: { antiAnomaly: 1 }, value: 140, desc: 'Inmune a las anomalías eléctricas.' },
  thornneck: { cat: 'gadget', name: 'Collar de púas de rata', glyph: '¤', tier: 1, flags: { thorns: 3 }, value: 120, desc: 'Quien te muerde cuerpo a cuerpo recibe daño.' },
  harness: { cat: 'gadget', name: 'Arnés de carga', glyph: '¤', tier: 1, slots: 3, ev: -1, value: 110, desc: '+3 huecos de mochila, algo más torpe.' },
  arclamp: { cat: 'gadget', name: 'Linterna de arco', glyph: '¤', tier: 2, vision: 2, value: 220, desc: 'Luz cegadora. Gran campo de visión.' },
  kolba: { cat: 'gadget', name: 'Detector de esencia «Kolba»', glyph: '¤', tier: 2, essence: 20, value: 260, desc: 'Más esencia de cada chebylita y veta.' },
  wolfmedal: { cat: 'gadget', name: 'Medalla del lobo solitario', glyph: '¤', tier: 2, cond: { when: 'alone', mods: { dmgPct: 25, crit: 10 } }, value: 280, desc: 'Separado del grupo (ningún aliado a 6 casillas): +25% daño y +10% crítico.' },
  banner: { cat: 'gadget', name: 'Banderín del regimiento', glyph: '¤', tier: 2, aura: { r: 4, mods: { acc: 3 } }, value: 300, desc: 'Moral alta: tú y los aliados a 4 casillas ganáis puntería.' },
  fang: { cat: 'gadget', name: 'Colmillo de lobo de grafito', glyph: '¤', tier: 2, flags: { killHeal: 3 }, set: 'cazador', value: 240, desc: 'Cada baja te cura. Conjunto Cazador (con la Garra de jabalí).' },
  plate: { cat: 'gadget', name: 'Placa reactiva de pecho', glyph: '¤', tier: 2, cond: { when: 'hurt', mods: { prot: 3 } }, value: 260, desc: 'Herido (<50% salud): +3 protección.' },
  bandolier: { cat: 'gadget', name: 'Bandolera de recarga rápida', glyph: '¤', tier: 2, flags: { quickReload: 1 }, value: 250, desc: 'Recargar no consume turno.' },
  rangefinder: { cat: 'gadget', name: 'Telémetro DS-1', glyph: '¤', tier: 2, range: 2, value: 240, desc: '+2 de alcance a cualquier arma a distancia.' },
  komandirskie: { cat: 'gadget', name: 'Reloj «Komandirskie»', glyph: '¤', tier: 2, team: { min: 2, mods: { dmgPct: 10, acc: 2 } }, value: 200, desc: 'Sincronizados: si 2 o más agentes del escuadrón lo llevan, todos ellos ganan daño y puntería.' },
  rtg: { cat: 'gadget', name: 'Pila de radioisótopo', glyph: '¤', tier: 3, regen: 1, value: 450, desc: 'Calor constante. Regenera salud poco a poco.' },
  magnet: { cat: 'gadget', name: 'Imán de esencia', glyph: '¤', tier: 3, flags: { essMagnet: 2 }, value: 420, desc: 'Atrae la esencia del suelo a 2 casillas de distancia.' },
  condenser: { cat: 'gadget', name: 'Condensador de esencia', glyph: '¤', tier: 3, flags: { essHeal: 5 }, value: 430, desc: 'Cada 5 de esencia recogida te cura 1 de salud.' },
  claw: { cat: 'gadget', name: 'Garra de jabalí de óxido', glyph: '¤', tier: 3, flags: { killFrenzy: 30 }, set: 'cazador', value: 450, desc: 'Tras cada baja: +30% daño durante 3 turnos. Conjunto Cazador.' },
  stgeorge: { cat: 'gadget', name: 'Cruz de San Jorge', glyph: '¤', tier: 3, cond: { when: 'lowhp', mods: { crit: 25, ev: 5 } }, value: 480, desc: 'Último aliento (<30% salud): +25% crítico y +5 agilidad.' },
  ashcloak: { cat: 'gadget', name: 'Capa de ceniza', glyph: '¤', tier: 3, flags: { stealth: 3 }, cond: { when: 'alone', mods: { ev: 3 } }, value: 500, desc: 'Los nidos dormidos te detectan a 3 casillas menos. Separado: +3 agilidad.' },
  autoinj: { cat: 'gadget', name: 'Autoinyector de emergencia', glyph: '¤', tier: 3, flags: { autoInject: 25 }, value: 460, desc: 'Una vez por expedición, al bajar del 25% de salud, cura 25 automáticamente.' },
  amulet: { cat: 'gadget', name: 'Amuleto chebylita', glyph: '¤', tier: 4, ev: 5, crit: 5, value: 700, desc: 'Un ojo petrificado. Los chebylitas parecen dudar.' },
  heart: { cat: 'gadget', name: 'Corazón de Raíz-madre', glyph: '¤', tier: 5, regen: 2, rad: 20, hp: 10, value: 1600, desc: 'Late todavía. Cura heridas y radiación.' },

  // ---------- MOCHILAS ----------
  sack: { cat: 'backpack', name: 'Morral de lona', glyph: '(', tier: 0, slots: 3, value: 20, desc: '+3 huecos de mochila.' },
  rd54: { cat: 'backpack', name: 'Mochila RD-54', glyph: '(', tier: 1, slots: 5, value: 120, desc: '+5 huecos de mochila.' },
  taiga: { cat: 'backpack', name: 'Mochila «Taiga»', glyph: '(', tier: 3, slots: 8, value: 400, desc: '+8 huecos de mochila.' },
  hide: { cat: 'backpack', name: 'Bolsa de piel chebylita', glyph: '(', tier: 5, slots: 11, value: 1100, desc: '+11 huecos de mochila. Huele fatal.' },

  // ---------- CONSUMIBLES ----------
  // curación
  iodine: { cat: 'consumable', name: 'Tintura de yodo', glyph: '!', tier: 0, stack: 10, use: 'heal', heal: 4, value: 5, desc: 'Escuece, pero desinfecta.' },
  bandage: { cat: 'consumable', name: 'Venda', glyph: '!', tier: 0, stack: 10, use: 'heal', heal: 7, value: 8, desc: 'Cura 7 de salud.' },
  ipp: { cat: 'consumable', name: 'Paquete de curas IPP', glyph: '!', tier: 0, stack: 8, use: 'heal', heal: 12, value: 15, desc: 'Paquete individual de primeros auxilios del soldado.' },
  ration: { cat: 'consumable', name: 'Ración seca IRP', glyph: '!', tier: 0, stack: 5, use: 'heal', heal: 5, buff: { name: 'Bien comido', turns: 20, mods: { regen: 1 } }, value: 18, desc: 'Cura 5 y regenera durante 20 turnos.' },
  ai2: { cat: 'consumable', name: 'Botiquín AI-2', glyph: '!', tier: 0, stack: 5, use: 'heal', heal: 22, cure: 1, value: 35, desc: 'Cura 22 de salud y elimina el veneno.' },
  morphine: { cat: 'consumable', name: 'Ampolla de morfina', glyph: '!', tier: 1, stack: 5, use: 'heal', heal: 10, buff: { name: 'Sin dolor', turns: 8, mods: { prot: 2 } }, value: 45, desc: 'Cura 10 y +2 protección durante 8 turnos.' },
  salve: { cat: 'consumable', name: 'Pomada de grafito', glyph: '!', tier: 2, stack: 5, use: 'heal', heal: 4, buff: { name: 'Pomada', turns: 15, mods: { regen: 2 } }, value: 60, desc: 'Regeneración rápida durante 15 turnos.' },
  plasma: { cat: 'consumable', name: 'Bolsa de plasma', glyph: '!', tier: 2, stack: 3, use: 'heal', heal: 35, value: 90, desc: 'Cura 35 de salud.' },
  surgkit: { cat: 'consumable', name: 'Kit quirúrgico', glyph: '!', tier: 3, stack: 3, use: 'heal', heal: 50, cure: 1, value: 160, desc: 'Cura 50 de salud y elimina el veneno.' },
  essamp: { cat: 'consumable', name: 'Ampolla de esencia', glyph: '!', tier: 4, stack: 3, use: 'heal', heal: 40, radHeal: 25, cure: 1, value: 260, desc: 'Cura 40, quita 25 de radiación y el veneno.' },
  serum: { cat: 'consumable', name: 'Suero Topolev', glyph: '!', tier: 5, stack: 3, use: 'heal', heal: 999, cure: 1, radHeal: 60, value: 500, desc: 'Restaura toda la salud y 60 de radiación.' },
  // radiación
  flask: { cat: 'consumable', name: 'Petaca de vodka', glyph: '!', tier: 0, stack: 5, use: 'antirad', radHeal: 12, buff: { name: 'Valor líquido', turns: 10, mods: { acc: -3, ev: 1, crit: 5 } }, value: 15, desc: '−12 radiación. Peor puntería, más valor.' },
  antirad: { cat: 'consumable', name: 'Antirrad (yoduro potásico)', glyph: '!', tier: 0, stack: 8, use: 'antirad', radHeal: 35, value: 25, desc: 'Reduce 35 de radiación acumulada.' },
  cystamine: { cat: 'consumable', name: 'Cistamina B-190', glyph: '!', tier: 1, stack: 5, use: 'buff', buff: { name: 'Radioprotector', turns: 20, mods: { rad: 40 } }, value: 40, desc: '+40% resistencia a la radiación durante 20 turnos.' },
  prussian: { cat: 'consumable', name: 'Azul de Prusia', glyph: '!', tier: 3, stack: 5, use: 'antirad', radHeal: 70, value: 110, desc: 'Reduce 70 de radiación acumulada.' },
  // curas especiales
  antidote: { cat: 'consumable', name: 'Antídoto de esporas', glyph: '!', tier: 1, stack: 5, use: 'buff', cure: 1, buff: { name: 'Inmune al veneno', turns: 15, flags: { poisonImmune: 1 } }, value: 35, desc: 'Elimina el veneno y protege de él durante 15 turnos.' },
  burngel: { cat: 'consumable', name: 'Gel antiquemaduras', glyph: '!', tier: 1, stack: 5, use: 'heal', heal: 6, cureBurn: 1, value: 25, desc: 'Apaga las quemaduras y cura 6.' },
  filter: { cat: 'consumable', name: 'Filtro de recambio GP', glyph: '!', tier: 1, stack: 5, use: 'buff', buff: { name: 'Filtro nuevo', turns: 30, mods: { gasImmune: 1 } }, value: 30, desc: 'Inmune al gas durante 30 turnos.' },
  // potenciadores
  tea: { cat: 'consumable', name: 'Té fuerte con azúcar', glyph: '!', tier: 0, stack: 5, use: 'buff', buff: { name: 'Té', turns: 15, mods: { acc: 3 } }, value: 12, desc: '+3 puntería durante 15 turnos.' },
  caffeine: { cat: 'consumable', name: 'Cafeína en pastillas', glyph: '!', tier: 1, stack: 6, use: 'buff', buff: { name: 'Cafeína', turns: 8, mods: { acc: 6 } }, value: 30, desc: '+6 puntería durante 8 turnos.' },
  valerian: { cat: 'consumable', name: 'Gotas de valeriana', glyph: '!', tier: 1, stack: 6, use: 'buff', buff: { name: 'Calma', turns: 12, mods: { crit: 10, ev: 2 } }, value: 30, desc: '+10% crítico y +2 agilidad durante 12 turnos.' },
  belladona: { cat: 'consumable', name: 'Colirio de belladona', glyph: '!', tier: 1, stack: 5, use: 'buff', buff: { name: 'Pupilas dilatadas', turns: 20, mods: { vision: 3 } }, value: 35, desc: '+3 visión durante 20 turnos.' },
  stim: { cat: 'consumable', name: 'Estimulante «Sangre de Oso»', glyph: '!', tier: 2, stack: 5, use: 'buff', buff: { name: 'Sangre de Oso', turns: 15, mods: { dmgPct: 30, acc: 5 } }, value: 90, desc: '+30% daño y +5 puntería durante 15 turnos.' },
  fenamina: { cat: 'consumable', name: 'Fenamina', glyph: '!', tier: 2, stack: 5, use: 'buff', buff: { name: 'Fenamina', turns: 10, mods: { acc: 4, ev: 4 }, after: { poison: 3 } }, value: 60, desc: '+4 puntería y +4 agilidad 10 turnos. Luego, bajón (veneno).' },
  leadpaste: { cat: 'consumable', name: 'Pasta de plomo', glyph: '!', tier: 2, stack: 5, use: 'buff', buff: { name: 'Pasta de plomo', turns: 20, mods: { prot: 2, rad: 20 } }, value: 70, desc: '+2 protección y +20% resist. radiación durante 20 turnos.' },
  adrenaline: { cat: 'consumable', name: 'Adrenalina', glyph: '!', tier: 3, stack: 4, use: 'buff', buff: { name: 'Adrenalina', turns: 6, mods: { crit: 20, dmgPct: 15 } }, value: 110, desc: '+20% crítico y +15% daño durante 6 turnos.' },
  // arrojadizos
  rg42: { cat: 'consumable', name: 'Granada RG-42', glyph: '•', tier: 0, stack: 6, use: 'throw', blast: 1, dmg: [8, 14], range: 6, value: 30, desc: 'Granada vieja de lata. Radio 1.' },
  molotov: { cat: 'consumable', name: 'Cóctel Molotov', glyph: '•', tier: 0, stack: 6, use: 'throw', blast: 1, fire: 1, dmg: [4, 7], range: 6, value: 30, desc: 'Incendia una zona de radio 1.' },
  flare: { cat: 'consumable', name: 'Bengala', glyph: '•', tier: 0, stack: 6, use: 'throw', lure: 14, light: 1, range: 8, value: 20, desc: 'Ilumina la zona y atrae a los chebylitas cercanos.' },
  bait: { cat: 'consumable', name: 'Carne de cebo', glyph: '•', tier: 0, stack: 5, use: 'throw', lure: 10, range: 6, value: 15, desc: 'Atrae a los chebylitas en silencio, sin iluminar.' },
  rgd5: { cat: 'consumable', name: 'Granada RGD-5', glyph: '•', tier: 1, stack: 6, use: 'throw', blast: 1, dmg: [10, 18], range: 6, value: 45, desc: 'Explosión en radio 1. Alcance 6.' },
  smoke: { cat: 'consumable', name: 'Granada de humo RDG-2', glyph: '•', tier: 1, stack: 5, use: 'throw', smoke: 2, range: 7, value: 35, desc: 'Cortina de humo de radio 2 durante 10 turnos: bloquea la visión de todos.' },
  dynamite: { cat: 'consumable', name: 'Cartucho de dinamita', glyph: '•', tier: 1, stack: 5, use: 'throw', blast: 2, dmg: [14, 26], range: 5, noise: 22, value: 60, desc: 'Radio 2. Se oye en toda la central.' },
  noisemaker: { cat: 'consumable', name: 'Radio señuelo', glyph: '•', tier: 1, stack: 4, use: 'throw', lure: 20, range: 7, value: 50, desc: 'Una radio a todo volumen: atrae a todo lo que esté a 20 casillas.' },
  f1: { cat: 'consumable', name: 'Granada F-1', glyph: '•', tier: 2, stack: 5, use: 'throw', blast: 2, dmg: [16, 28], range: 6, value: 80, desc: 'Explosión de fragmentación en radio 2.' },
  rgo: { cat: 'consumable', name: 'Granada de impacto RGO', glyph: '•', tier: 2, stack: 5, use: 'throw', blast: 2, dmg: [14, 24], range: 7, value: 85, desc: 'Explota al tocar el suelo. Radio 2, alcance 7.' },
  gasgren: { cat: 'consumable', name: 'Granada química K-51', glyph: '•', tier: 2, stack: 4, use: 'throw', gas: 2, range: 6, value: 70, desc: 'Nube tóxica de radio 2. Daña a animales e insectos (y a ti sin máscara).' },
  flash: { cat: 'consumable', name: 'Granada aturdidora «Zarya»', glyph: '•', tier: 2, stack: 4, use: 'throw', stun: 2, blast: 2, range: 7, value: 90, desc: 'Aturde 2 turnos a los chebylitas en radio 2 (los jefes, 1).' },
  rkg3: { cat: 'consumable', name: 'Granada antitanque RKG-3', glyph: '•', tier: 3, stack: 3, use: 'throw', blast: 1, dmg: [30, 45], pierce: 8, range: 5, value: 150, desc: 'Carga hueca: ignora el blindaje. Radio 1.' },
  thermite: { cat: 'consumable', name: 'Granada de termita', glyph: '•', tier: 3, stack: 3, use: 'throw', blast: 2, fire: 2, dmg: [8, 12], range: 6, value: 130, desc: 'Incendio feroz de radio 2.' },
  essgren: { cat: 'consumable', name: 'Granada de esencia', glyph: '•', tier: 5, stack: 3, use: 'throw', blast: 2, dmg: [30, 45], essBoost: 50, range: 7, value: 400, desc: 'Radio 2. Lo que mata suelta un 50% más de esencia.' },
  // trampas (se colocan en una casilla adyacente)
  snare: { cat: 'consumable', name: 'Cepo de cazador', glyph: '×', tier: 0, stack: 4, use: 'trap', trap: { dmg: [6, 10], stun: 4, blast: 0 }, range: 1.5, value: 30, desc: 'Atrapa al primer chebylita que lo pise: daño y 4 turnos inmovilizado.' },
  pmn: { cat: 'consumable', name: 'Mina antipersona PMN', glyph: '×', tier: 2, stack: 4, use: 'trap', trap: { dmg: [20, 30], blast: 1 }, range: 1.5, value: 90, desc: 'Explota (radio 1) cuando un chebylita la pisa.' },
  ozm: { cat: 'consumable', name: 'Mina saltarina OZM-72', glyph: '×', tier: 3, stack: 3, use: 'trap', trap: { dmg: [22, 36], blast: 2 }, range: 1.5, value: 160, desc: 'Salta y explota en radio 2 cuando un chebylita la pisa.' },
  // utilidad
  mapcase: { cat: 'consumable', name: 'Plano del sector', glyph: '?', tier: 0, stack: 3, use: 'reveal', radius: 35, value: 40, desc: 'Cartografía el entorno en un radio de 35 casillas.' },
  ammobox: { cat: 'consumable', name: 'Caja de munición', glyph: '=', tier: 1, stack: 3, use: 'ammo', mags: 2, value: 70, desc: 'Dos cargadores de munición para cada arma equipada.' },
  detector: { cat: 'consumable', name: 'Detector de movimiento «Svetlyachok»', glyph: '¤', tier: 2, stack: 3, use: 'sense', turns: 15, radius: 25, value: 90, desc: 'Muestra a todos los chebylitas a 25 casillas durante 15 turnos, aunque no los veas.' },
  rocket: { cat: 'consumable', name: 'Cohete de señales', glyph: '•', tier: 2, stack: 2, use: 'signal', value: 120, desc: 'Pide una extracción temporal ahora mismo (aparecerá en el radar).' },
  beacon: { cat: 'consumable', name: 'Baliza de extracción', glyph: '•', tier: 3, stack: 2, use: 'beacon', value: 350, desc: 'Abre una extracción temporal donde estés en 6 turnos.' },

  // ---------- BOTÍN (valiosos para vender) ----------
  komsomol: { cat: 'valuable', name: 'Insignia del Komsomol', glyph: '$', tier: 0, value: 15, desc: 'Esmalte rojo y una sonrisa de Lenin.' },
  vodka: { cat: 'valuable', name: 'Botella de Stolichnaya', glyph: '$', tier: 0, value: 25, desc: 'Todavía precintada. Un milagro.' },
  reel: { cat: 'valuable', name: 'Cinta de bobina', glyph: '$', tier: 0, value: 30, desc: 'Grabación de una sala de control. ¿Qué contendrá?' },
  poljot: { cat: 'valuable', name: 'Reloj Poljot', glyph: '$', tier: 1, value: 45, desc: 'Se detuvo a la 1:23.' },
  vef: { cat: 'valuable', name: 'Radio VEF', glyph: '$', tier: 1, value: 55, desc: 'Radio de transistores letona.' },
  medal: { cat: 'valuable', name: 'Medalla «Héroe del Trabajo»', glyph: '$', tier: 1, value: 65, desc: 'Otorgada a un operario de turno.' },
  graphsample: { cat: 'valuable', name: 'Muestra de grafito', glyph: '$', tier: 2, value: 70, desc: 'Bloque del moderador del reactor.' },
  board: { cat: 'valuable', name: 'Placa de circuito RBMK', glyph: '$', tier: 2, value: 85, desc: 'Electrónica de control del reactor.' },
  icon: { cat: 'valuable', name: 'Icono ortodoxo', glyph: '$', tier: 3, value: 110, desc: 'San Jorge contra el dragón. Muy apropiado.' },
  docs: { cat: 'valuable', name: 'Documentos clasificados', glyph: '$', tier: 3, value: 150, desc: 'Sello del KGB. «Prueba de turbina, 25-IV-1986».' },
  crystal: { cat: 'valuable', name: 'Cristal de esencia', glyph: '✧', tier: 2, value: 40, essenceValue: 25, desc: 'Esencia cristalizada. Se puede vender o convertir en esencia en la base.' },
  corium: { cat: 'valuable', name: 'Fragmento de corium', glyph: '$', tier: 4, value: 320, radioactive: 1, desc: 'Muy valioso. Muy radiactivo: irradia a quien lo lleve.' },
};

// Nombres míticos únicos
export const MYTHIC_NAMES = [
  '«Estrella Ajenjo»', '«Pata de Elefante»', '«Ira de Prípiat»', '«Último Liquidador»', '«Sol Negro»',
  '«Lamento de Polesia»', '«Beso de Corium»', '«Noche del 26 de Abril»', '«Ojo de Dyatlov»', '«Bosque Rojo»',
  '«Reactor Cuatro»', '«Canción de Slavutych»', '«Alba Roja»', '«Hijo de la Ceniza»', '«Sarcófago»',
];
export const EPITHETS = [
  '«Camarada»', '«Tormenta»', '«Lobo Gris»', '«Polesia»', '«Hoz»', '«Krasnaya»', '«Taiga»', '«Vostok»',
  '«Plomo»', '«Isótopo»', '«Grafito»', '«Ceniza»', '«Abedul»', '«Baba Yaga»', '«Koschei»', '«Volga»',
  '«Dnipró»', '«Estepa»', '«Proletario»', '«Gagarin»', '«Ushanka»', '«Matrioska»',
];
// Conjuntos de gadgets: bonificación si un agente lleva las dos piezas
export const GADGET_SETS = {
  dosimetria: { name: 'Dosimetría', pieces: ['geiger', 'dosimeter'], mods: { rad: 20, essence: 15 }, desc: '+20% resist. radiación y +15% esencia' },
  cazador: { name: 'Cazador de la taiga', pieces: ['fang', 'claw'], mods: { crit: 10, dmgPct: 10 }, desc: '+10% crítico y +10% daño' },
};
export const UNCOMMON_SUFFIX = ['mejorado', 'de campaña', 'revisado', 'ajustado'];
export const RARE_SUFFIX = ['de élite', 'reforzado', 'de precisión', 'del Spetsnaz'];

// Afijos por categoría. roll(r, rng) devuelve el valor según la rareza.
export const AFFIXES = [
  { id: 'dmgPct', cats: ['weapon'], label: (v) => `+${v}% daño`, roll: (r, g) => g.int(6, 12) + r * 3 },
  { id: 'acc', cats: ['weapon', 'gadget', 'helmet'], label: (v) => `+${v} puntería`, roll: (r, g) => g.int(3, 6) + r },
  { id: 'crit', cats: ['weapon', 'gadget'], label: (v) => `+${v}% crítico`, roll: (r, g) => g.int(3, 6) + r * 2 },
  { id: 'magPct', cats: ['weapon'], label: (v) => `+${v}% cargador`, roll: (r, g) => g.int(20, 35) + r * 5, ranged: 1 },
  { id: 'range', cats: ['weapon'], label: (v) => `+${v} alcance`, roll: (r, g) => g.int(1, 2) + (r >= 4 ? 1 : 0), ranged: 1 },
  { id: 'pierce', cats: ['weapon'], label: (v) => `+${v} perforación`, roll: (r, g) => g.int(1, 2) + Math.floor(r / 2) },
  { id: 'prot', cats: ['armor', 'helmet'], label: (v) => `+${v} protección`, roll: (r, g) => 1 + Math.floor(r / 2) + (g.chance(0.3) ? 1 : 0) },
  { id: 'rad', cats: ['armor', 'helmet', 'gadget'], label: (v) => `+${v}% resist. radiación`, roll: (r, g) => g.int(5, 10) + r * 2 },
  { id: 'ev', cats: ['armor', 'helmet', 'gadget', 'backpack'], label: (v) => `+${v} agilidad`, roll: (r, g) => g.int(1, 2) + Math.floor(r / 2) },
  { id: 'hp', cats: ['armor', 'helmet', 'gadget', 'backpack'], label: (v) => `+${v} salud máx.`, roll: (r, g) => g.int(3, 6) + r * 2 },
  { id: 'vision', cats: ['helmet', 'gadget'], label: (v) => `+${v} visión`, roll: (r, g) => 1 + (r >= 4 ? 1 : 0) },
  { id: 'essence', cats: ['gadget', 'backpack', 'armor'], label: (v) => `+${v}% esencia`, roll: (r, g) => g.int(5, 10) + r * 2 },
  { id: 'regen', cats: ['gadget', 'armor'], label: (v) => `+${v} regeneración`, roll: (r, g) => 1 },
  { id: 'slots', cats: ['backpack'], label: (v) => `+${v} huecos`, roll: (r, g) => 1 + Math.floor(r / 2) },
  { id: 'valuePct', cats: ['valuable'], label: (v) => `+${v}% valor`, roll: (r, g) => g.int(10, 25) + r * 10 },
];
