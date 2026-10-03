// Árboles de diálogo (motor en core/events.js)
// Diálogo: { title, speaker, color, nodes: { start: { text, opts: [ { label, cond?, show?, hint?, effects?, goto?, turn? } ] } } }
//  · cond  → la opción aparece desactivada si no se cumple (hint explica por qué)
//  · show  → la opción ni siquiera aparece si no se cumple
//  · goto  → nodo siguiente (sin goto ni efecto `dialog`, el diálogo termina)
//  · turn  → elegirla gasta el turno del agente activo (solo en expedición)
import { SURVIVOR_LINES } from './lore.js';
import { S } from '../core/state.js';
import { ITEMS } from './items.js';
import { repOf, addRep, FACTIONS, squadAttitude, foreignTrade } from './factions.js';
import { ACTORS, actorFaction } from './actors.js';
import { createItem } from '../core/items.js';
import { agentStats } from '../core/agents.js';

const SURVIVOR_STORY = [
  'Llevaba la cuenta de los días rayando la pared con una hebilla. Dejó de hacerlo cuando las rayas empezaron a moverse. «Las paredes respiran, camaradas. De noche se oye cómo respiran.»',
  '«La primera noche subimos al tejado del bloque 3. El grafito brillaba como carbón de samovar. Nadie nos dijo nada. Nadie nos dijo nada…» Se mira las manos.',
  '«En el laboratorio teníamos muestras de todo lo que crecía aquí abajo. El tercer día, las muestras ya no estaban en los frascos.» Aprieta más la carpeta.',
  '«Éramos once. Nos mandaron a bajar los cables. Las ratas… no eran ratas. Corrí. Les dejé atrás. Repito sus nombres para que alguien los recuerde.»',
];

export const DIALOGS = {
  // ------------------------------------------------------------ expedición
  survivor: {
    title: 'SUPERVIVIENTE', speaker: 'Superviviente', color: '#a0e8a0',
    nodes: {
      start: {
        text: (c) => SURVIVOR_LINES[((c.obj && c.obj.line) || 0) % SURVIVOR_LINES.length],
        opts: [
          { label: 'PREGUNTARLE QUÉ OCURRIÓ', goto: 'story' },
          {
            label: 'DARLE MEDICINAS', cond: { hasUse: 'heal' }, hint: 'no lleváis ninguna curación', cls: 'good', turn: true,
            effects: [
              { consumeUse: 'heal' },
              { loot: { n: [1, 2], lvlBonus: 1, rarityBonus: 0.7, catW: { ammo: 4, consumable: 6, valuable: 10 } } },
              { if: { chance: 0.5 }, essence: (c) => (6 + Math.floor(Math.random() * 9)) * ((c.obj && c.obj.lvl) || 1) },
              { xp: (c) => 25 + ((c.obj && c.obj.lvl) || 1) * 5 },
              { log: '«Gracias, camarada. Tomad esto, a mí ya no me sirve.» El superviviente deja su equipo a los pies de {agent}.', cls: 'good' },
              { incFlag: 'survivorsSaved' },
              { log: 'El superviviente se arrastra hacia la superficie.', cls: 'dimt' },
              { removeObj: true },
            ],
          },
          {
            label: 'PEDIRLE UN PLANO', turn: true,
            effects: [
              { reveal: 30 },
              { log: (c) => `«Escuchad: conozco estos túneles.» Os dibuja un plano en un trozo de cartón (${c.revealed || 0} casillas cartografiadas).`, cls: 'o1' },
              { log: 'El superviviente se arrastra hacia la superficie.', cls: 'dimt' },
              { removeObj: true },
            ],
          },
          { label: 'DEJARLO', turn: true, effects: [{ log: 'Lo dejáis atrás. Sus ojos os siguen en la oscuridad.', cls: 'dimt' }, { incFlag: 'survivorsLeft' }] },
        ],
      },
      story: {
        text: (c) => SURVIVOR_STORY[((c.obj && c.obj.line) || 0) % SURVIVOR_STORY.length],
        opts: [{ label: 'VOLVER', goto: 'start2' }],
      },
      start2: {
        text: '«¿Y ahora qué? ¿Me vais a sacar de aquí, o sois otro sueño?»',
        opts: null, // se rellena abajo con las opciones de «start» salvo la de la historia
      },
    },
  },

  radio_rda: {
    title: 'RADIO · BASE TOPOLEV', speaker: 'Dr. A. Topolev', color: '#ff9a3c',
    nodes: {
      start: {
        text: '«Esa insignia… son camaradas de la República Democrática Alemana. La Expedición «Wismut» bajó hace dos semanas con permiso del Ministerio. Cooperad con ellos: un enemigo común nos hace hermanos. Y no les disparéis, por el amor de Dios, que luego el papeleo lo hago yo.»',
        opts: [
          { label: 'ENTENDIDO, DOCTOR', effects: [{ setFlag: 'metRDA' }] },
          { label: '¿QUÉ BUSCAN AQUÍ ABAJO?', goto: 'why' },
        ],
      },
      why: {
        text: '«Uranio no, desde luego: de eso tienen de sobra en Sajonia. Buscan lo mismo que nosotros, me temo. Esencia. Berlín la quiere para sus propios laboratorios. Que la encuentren… pero que la encontremos nosotros antes.»',
        opts: [{ label: 'ENTENDIDO', effects: [{ setFlag: 'metRDA' }, { setFlag: 'rdaWantsEssence' }] }],
      },
    },
  },

  radio_usa: {
    title: 'RADIO · BASE TOPOLEV', speaker: 'Dr. A. Topolev', color: '#ff9a3c',
    nodes: {
      start: {
        text: '«¡Silencio de radio a partir de ahora! Ese equipo no es nuestro. Americanos: Operación «Nightingale». No están aquí para salvar a nadie. Os dispararán en cuanto os vean. Haced vosotros lo mismo.»',
        opts: [
          { label: 'RECIBIDO', effects: [{ setFlag: 'metUSA' }, { interrupt: true }] },
          { label: '¿CÓMO HAN LLEGADO HASTA AQUÍ?', goto: 'how' },
        ],
      },
      how: {
        text: '«Alguien en Kiev ha vendido los planos de la central. O alguien en Moscú. Eso ya lo averiguará el KGB. Vosotros preocupaos de volver vivos y, si podéis, traed sus documentos.»',
        opts: [{ label: 'RECIBIDO', effects: [{ setFlag: 'metUSA' }, { setFlag: 'usaDocsWanted' }, { interrupt: true }] }],
      },
    },
  },

  radio_suecia: {
    title: 'RADIO · BASE TOPOLEV', speaker: 'Dr. A. Topolev', color: '#ff9a3c',
    nodes: {
      start: {
        text: '«Suecos. El Equipo «Forsmark»: fueron sus dosímetros los que dieron la alarma al mundo entero cuando nosotros aún lo negábamos. Son neutrales. No os atacarán si no les dais motivos. No les deis motivos.»',
        opts: [
          { label: 'LES DEJAREMOS EN PAZ', effects: [{ setFlag: 'metSuecia' }] },
          { label: '¿PODRÍAMOS NEGOCIAR CON ELLOS?', goto: 'trade' },
          { label: '[NEGOCIADOR] PROPONEDLES COMPARTIR LECTURAS', show: { squadFlag: 'negotiator' }, cls: 'good', effects: [{ setFlag: 'metSuecia' }, { setFlag: 'sueciaDataDeal' }, { rep: ['suecia', 15] }], goto: 'deal' },
        ],
      },
      deal: {
        text: '«¿Intercambiar lecturas dosimétricas con Forsmark? Arriesgado… pero brillante. Hacedlo con discreción: lo que Moscú no sabe, no lo prohíbe.»',
        opts: [{ label: 'ENTENDIDO' }],
      },
      trade: {
        text: '«Quizá. Los neutrales comercian con quien les trata bien. Si os ganáis su confianza, puede que algún día compartan lo que saben. Pero eso es política, y la política se hace arriba.»',
        opts: [{ label: 'ENTENDIDO', effects: [{ setFlag: 'metSuecia' }, { setFlag: 'sueciaTradeIdea' }] }],
      },
    },
  },

  // ------------------------------------------------------------ Campamento «Wismut» (fase 17)
  wismut_trader: {
    title: 'INTENDENCIA · CAMPAMENTO WISMUT', speaker: 'Feldwebel Kranz, intendente', color: '#e6c86a',
    nodes: {
      start: {
        text: (c) => `Detrás de un mostrador hecho con cajas de munición, un sargento de la RDA con gafas de culo de botella. «Rublos, marcos, esencia… aquí todo vale, camarada. Todo menos las promesas.»${night(c) ? ' Habla bajo y no deja de mirar los pozos de ventilación.' : ''}`,
        opts: [
          { label: 'COMPRAR', goto: 'buy' },
          { label: 'VENDER', goto: 'sell' },
          { label: '¿QUÉ SE CUENTA POR AQUÍ?', goto: 'talk' },
          { label: 'MARCHARSE' },
        ],
      },
      buy: {
        text: (c) => `«Precio de camaradas.»${repOf(S, 'rda') >= 50 ? ' Os hace un guiño: sois aliados de la RDA y se nota en la cuenta.' : ''} Tenéis ${S.rub} ₽.`,
        opts: () => [
          buyOpt('ai2', 60), buyOpt('ipp', 30, 2), buyOpt('antirad', 40, 2), buyOpt('ration', 25, 2),
          buyOpt('a_9x18', 25, 24), buyOpt('a_545', 55, 30), buyOpt('a_12', 40, 12), buyOpt('filter', 50),
          { label: 'VOLVER', goto: 'start' },
        ],
      },
      sell: {
        text: '«Compro chatarra útil y papeles interesantes. Lo demás, a la central de compras de vuestra base.»',
        opts: () => [
          sellOpt('parts', 0.9), sellOpt('intel', 0.7), sellOpt('docs', 0.7), sellOpt('blackbox', 0.6),
          { label: 'VOLVER', goto: 'start' },
        ],
      },
      talk: {
        text: (c) => pick(WISMUT_TALK, c),
        opts: [{ label: 'VOLVER', goto: 'start' }],
      },
    },
  },

  wismut_medic: {
    title: 'ENFERMERÍA · CAMPAMENTO WISMUT', speaker: 'Dra. Ilse Brandt', color: '#ff8a8a',
    nodes: {
      start: {
        text: (c) => `Una camilla, una lámpara de quirófano alimentada con una dinamo y una doctora que no ha dormido en días. «Sentaos. ¿Quién sangra más?»${hurtList(c)}`,
        opts: (c) => {
          const cost = medicCost(c);
          return [
            { label: cost ? `CURAR A TODO EL EQUIPO (${cost} ₽)` : 'CURAR A TODO EL EQUIPO (GRATIS: SOIS ALIADOS DE LA RDA)', cond: { rub: ['>=', cost] }, hint: `no tenéis ${cost} ₽`, cls: 'good', turn: true, effects: [{ rub: -cost }, { run: (cc) => healTeam(cc, 1, 0) }, { log: 'La doctora Brandt cose, venda y maldice en alemán. El equipo sale como nuevo.', cls: 'good' }] },
            { label: `TRATAR LA RADIACIÓN (${cost + 30} ₽)`, cond: { rub: ['>=', cost + 30] }, hint: `no tenéis ${cost + 30} ₽`, turn: true, effects: [{ rub: -(cost + 30) }, { run: (cc) => healTeam(cc, 0, 45) }, { log: 'Yoduro, lavado gástrico y una charla muy seria sobre los dosímetros. −45 de radiación a todo el equipo.', cls: 'good' }] },
            { label: '[SANITARIO] AYUDARLA CON LOS HERIDOS', show: { spec: 'sanitario' }, turn: true, effects: [{ rep: ['rda', 6] }, { xp: 40 }, { give: { item: 'surgkit' } }, { log: '{agent} pasa una hora en la enfermería. La doctora le regala un kit quirúrgico «de los buenos».', cls: 'good' }] },
            { label: 'MARCHARSE' },
          ];
        },
      },
    },
  },

  wismut_board: {
    title: 'TABLÓN DEL CAMPAMENTO', speaker: 'Tablón de anuncios', color: '#c8b48c',
    nodes: {
      start: {
        text: (c) => `Clavados con chinchetas oxidadas: turnos de guardia, una foto de Dresde, un mapa a lápiz y una nota escrita a máquina.<br><br>«${pick(RUMORS, c, S.day)}»`,
        opts: [
          { label: 'TRABAJO: ENTREGAR 5 PIEZAS DE RECAMBIO (180 ₽)', cond: { test: (c) => countItem(c, 'parts') >= 5 }, hint: 'necesitáis 5 piezas de recambio', cls: 'good', turn: true, effects: [{ run: (c) => takeItem(c, 'parts', 5) }, { rub: 180 }, { rep: ['rda', 4] }, { incFlag: 'wismutJobs' }, { log: 'El intendente cuenta las piezas dos veces y os paga 180 ₽. «Con esto arreglamos el generador.»', cls: 'good' }] },
          { label: 'TRABAJO: ENTREGAR INFORMES OCCIDENTALES (250 ₽ + REPUTACIÓN)', cond: { hasItem: 'intel' }, hint: 'no lleváis informes de inteligencia', cls: 'good', turn: true, effects: [{ run: (c) => takeItem(c, 'intel', 1) }, { rub: 250 }, { rep: ['rda', 10] }, { incFlag: 'wismutJobs' }, { log: 'Un oficial de la Stasi se lleva los papeles sin decir palabra. Al día siguiente os llega el pago.', cls: 'good' }] },
          { label: 'COPIAR EL MAPA A LÁPIZ', show: { notFlag: 'wismutMap' }, turn: true, effects: [{ setFlag: 'wismutMap' }, { reveal: 40 }, { log: (c) => `Copiáis el plano del campamento y alrededores (${c.revealed || 0} casillas).`, cls: 'o1' }] },
          { label: 'SEGUIR' },
        ],
      },
    },
  },

  // ------------------------------------------------------------ Objeto 7 (fase 17)
  objeto7_archive: {
    title: 'ARCHIVO DEL OBJETO 7', speaker: 'Expedientes del KGB', color: '#e05050',
    nodes: {
      start: {
        text: 'Un armario ignífugo con el sello del Comité de Seguridad del Estado. La cerradura cede con un chasquido. Dentro: carpetas grises, una cinta magnética y una foto de un hombre joven con bata. Al dorso, a lápiz: «A. T., 1971».',
        opts: [
          { label: 'LEER EL EXPEDIENTE «TOPOLEV, A.»', goto: 'file' },
          { label: 'LLEVARSE LAS CARPETAS SIN LEERLAS', show: { notFlag: 'topolevPast' }, turn: true, effects: [{ give: { item: 'docs' } }, { give: { item: 'intel' } }, { setFlag: 'archiveTaken' }, { run: (c) => { if (c.obj) c.obj.opened = true; } }] },
          { label: 'CERRAR EL ARMARIO' },
        ],
      },
      file: {
        text: '«Topolev, Arkadi Semiónovich. Físico nuclear. Reclutado en 1969 para el Programa “Ceniza”: estudio de la radiorresistencia biológica.» Hay fotos de placas de Petri con algo que crece en círculos concéntricos. «Muestra n.º 7, recuperada del accidente de Kyshtym (1957). Responde a la radiación ionizante con crecimiento acelerado.»',
        opts: [{ label: 'SEGUIR LEYENDO', goto: 'file2' }],
      },
      file2: {
        text: '«1979. El sujeto Topolev solicita la suspensión del programa por razones éticas. Denegado. 1982. La muestra n.º 7 es trasladada a la central V. I. Lenin, nivel −4, para “pruebas de exposición prolongada”. Responsable científico: A. S. Topolev.» Debajo, otra letra, temblorosa: «Yo firmé el traslado. Yo la traje aquí.»',
        opts: [{ label: 'SEGUIR LEYENDO', goto: 'file3' }],
      },
      file3: {
        text: 'La última hoja es una orden del 27 de abril de 1986: «Ante la pérdida de contención, el Objeto 7 queda sellado. El personal científico se considera prescindible. No se informará a Moscú.» Alguien ha tachado “prescindible” hasta romper el papel. Las chebylitas no salieron del reactor. Salieron de aquí.',
        opts: [
          { label: 'GUARDAR EL EXPEDIENTE PARA EL DOCTOR', turn: true, effects: [{ setFlag: 'topolevPast' }, { give: { item: 'docs' } }, { xp: 60 }, { run: (c) => { if (c.obj) c.obj.opened = true; } }, { log: 'Guardáis el expediente. El doctor tendrá que dar muchas explicaciones.', cls: 'warn' }] },
          { label: 'QUEMARLO', turn: true, effects: [{ setFlag: 'topolevPast' }, { setFlag: 'topolevBurned' }, { xp: 40 }, { run: (c) => { if (c.obj) c.obj.opened = true; } }, { log: 'El papel arde rápido. Lo que sabéis, ya no lo puede saber nadie más.', cls: 'dimt' }] },
        ],
      },
    },
  },

  // ------------------------------------------------------------ Mercado negro (fase 17)
  smuggler_trader: {
    title: 'MERCADO NEGRO', speaker: 'Vasyl «el Tuerto», contrabandista', color: '#d9a066',
    nodes: {
      start: {
        text: `Una lona sobre un Moskvitch sin ruedas y, debajo, de todo: vaqueros, discos de los Beatles, cigarrillos Marlboro… y armas que no deberían estar en la URSS. «Sin preguntas, sin recibos, sin rencores.»`,
        opts: [
          { label: 'VER LA MERCANCÍA', goto: 'buy' },
          { label: 'VENDER', goto: 'sell' },
          { label: 'MARCHARSE' },
        ],
      },
      buy: {
        text: () => `«Material americano. Recién caído del cielo, como quien dice.» Tenéis ${S.rub} ₽.`,
        opts: () => [
          buyOpt('m1911', 520, undefined, 'contrabandistas'), buyOpt('rem870', 950, undefined, 'contrabandistas'), buyOpt('m16', 1200, undefined, 'contrabandistas'), buyOpt('a_45', 45, 14, 'contrabandistas'), buyOpt('a_556', 70, 20, 'contrabandistas'), buyOpt('a_12', 45, 12, 'contrabandistas'), buyOpt('vodka', 30, undefined, 'contrabandistas'),
          { label: 'VOLVER', goto: 'start' },
        ],
      },
      sell: {
        text: '«Pago en efectivo. Mejor que el Estado, peor que tu madre.»',
        opts: () => [sellOpt('parts', 1, 'contrabandistas'), sellOpt('intel', 1, 'contrabandistas'), sellOpt('blackbox', 0.9, 'contrabandistas'), sellOpt('firecoat', 0.9, 'contrabandistas'), sellOpt('docs', 0.8, 'contrabandistas'), { label: 'VOLVER', goto: 'start' }],
      },
    },
  },

  // ------------------------------------------------------------ Fase 18: encuentros con otras expediciones
  encounter: {
    title: (c) => (FACTIONS[facOf(c)] || {}).name ? FACTIONS[facOf(c)].name.toUpperCase() : 'ENCUENTRO',
    speaker: (c) => (c.actor ? ACTORS[c.actor.type].name : ''),
    color: (c) => (FACTIONS[facOf(c)] || {}).color || '#ff9a3c',
    nodes: {
      start: {
        text: (c) => greeting(c),
        opts: (c) => (hostileNow(c) ? hostileOpts(c) : friendlyOpts(c)),
      },
      trade: {
        text: (c) => `${tradeLine(c)} Tenéis ${S.rub} ₽.${foreignNote(c)}`,
        opts: (c) => [...(STOCK[facOf(c)] || []).map(([b, p, q]) => tradeBuy(c, b, p, q)), ...(BUYS[facOf(c)] || []).map(([b, k]) => tradeSell(c, b, k)), { label: 'VOLVER', goto: 'start' }],
      },
      recruit: {
        text: '«¿Volver al Ejército? ¿Con vosotros?» El desertor se lo piensa. «Si me dais un fusil y una ración caliente… y nadie pregunta por qué me fui.»',
        opts: [
          { label: 'ACEPTADO: SE UNE AL PUESTO', cls: 'good', effects: [{ run: (c) => { if (c.actor) c.exp.recruitActor(c.actor); } }, { rep: ['desertores', 6] }, { log: 'El desertor se une a vosotros. Se presentará en la base cuando volváis.', cls: 'good' }] },
          { label: 'MEJOR NO', goto: 'start' },
        ],
      },
    },
  },

  prisoner: {
    title: 'PRISIONERO',
    speaker: (c) => (c.actor ? `${ACTORS[c.actor.type].name} · ${(FACTIONS[facOf(c)] || {}).name || ''}` : ''),
    color: (c) => (FACTIONS[facOf(c)] || {}).color || '#ff9a3c',
    nodes: {
      start: {
        text: (c) => `De rodillas, con las manos detrás de la cabeza. ${pick(PRISONER_LINES[facOf(c)] || PRISONER_LINES.default, c)} ¿Qué hacéis con él?`,
        opts: (c) => [
          { label: 'DEJARLO MARCHAR', cls: 'good', effects: [{ rep: [facOf(c), 5] }, { log: 'Le dejáis ir. Se aleja sin mirar atrás. Su gente se enterará de esto.', cls: 'good' }, { run: (cc) => cc.exp.dismissActor(cc.actor) }] },
          { label: 'INTERROGARLO', turn: true, effects: [{ reveal: 40 }, { run: (cc) => { for (const o of cc.exp.enemies) if (actorFaction(o) === facOf(cc)) { o.seen = 1; cc.exp.explored[cc.exp.key(o.x, o.y)] = 1; } } }, { rep: [facOf(c), -3] }, { log: (cc) => `Habla. Marca en el plano las posiciones de los suyos (${cc.revealed || 0} casillas cartografiadas). Luego le soltáis.`, cls: 'o1' }, { run: (cc) => cc.exp.dismissActor(cc.actor) }] },
          { label: 'REQUISAR SU EQUIPO', turn: true, effects: [{ run: (cc) => cc.exp.stripActor(cc.actor) }, { rep: [facOf(c), -6] }, { log: 'Le quitáis todo lo que lleva y le echáis a patadas.', cls: 'warn' }, { run: (cc) => { cc.exp.dismissActor(cc.actor); cc.exp.emit('loot', { floor: true, x: cc.actor.x, y: cc.actor.y }); } }] },
          { label: '[COMISARIO] RECLUTARLO PARA EL PUESTO', show: [{ any: [{ spec: 'comisario' }, { squadFlag: 'negotiator' }] }, { test: (cc) => facOf(cc) === 'desertores' || facOf(cc) === 'merodeadores' }], cls: 'good', effects: [{ run: (cc) => cc.exp.recruitActor(cc.actor) }, { rep: [facOf(c), 6] }, { log: '«Patria o muerte, ¿no?» Se une a vosotros. Se presentará en la base.', cls: 'good' }] },
          { label: 'ENTREGARLO AL KGB (150 ₽ AL VOLVER)', effects: [{ run: (cc) => cc.exp.takePrisoner(cc.actor) }, { rep: [facOf(c), -8] }, { log: 'Le atáis las manos. El KGB recogerá «el paquete» en el punto de extracción.', cls: 'warn' }] },
          { label: 'EJECUTARLO', cls: 'bad', effects: [{ rep: [facOf(c), -15] }, { incFlag: 'executions' }, { agentFlag: 'executioner' }, { log: '{agent} aprieta el gatillo. Nadie dice nada durante un buen rato.', cls: 'bad' }, { run: (cc) => { cc.actor.surrendered = 0; cc.exp.killEnemy(cc.actor, cc.sq); } }] },
        ],
      },
    },
  },

  // ------------------------------------------------------------ base
  base_komitet: {
    title: 'VISITA DEL COMITÉ', speaker: 'Camarada Zhdánov, enviado del Comité', color: '#e05050',
    nodes: {
      start: {
        text: 'Un Volga negro aparca frente a la base. El hombre del abrigo gris no se quita el sombrero. «Doctor Topolev. Moscú está muy interesado en sus progresos. Tan interesado que estamos dispuestos a comprarle una muestra de esencia. Ahora. En efectivo.»',
        opts: [
          { label: 'VENDERLE 40 ✦ POR 260 ₽', cond: { ess: ['>=', 40] }, hint: 'no tenéis 40 ✦ de esencia', cls: 'good', effects: [{ ess: -40 }, { rub: 260 }, { setFlag: 'komitetSold' }, { baseMsg: 'Vendidos 40 ✦ de esencia al Comité por 260 ₽. Zhdánov se ha ido satisfecho.' }], goto: 'sold' },
          { label: 'LA ESENCIA NO ESTÁ EN VENTA', effects: [{ setFlag: 'komitetRefused' }], goto: 'refused' },
          { label: '¿PARA QUÉ LA QUIERE MOSCÚ?', goto: 'why' },
        ],
      },
      why: {
        text: '«Doctor, usted pregunta demasiado para alguien cuya base depende de nuestro presupuesto.» Sonríe sin enseñar los dientes. «Digamos que hay departamentos que creen que el futuro de la energía soviética está ahí abajo. Y otros que creen que el futuro de la defensa soviética está ahí abajo.»',
        opts: [
          { label: 'VENDERLE 40 ✦ POR 260 ₽', cond: { ess: ['>=', 40] }, hint: 'no tenéis 40 ✦ de esencia', cls: 'good', effects: [{ ess: -40 }, { rub: 260 }, { setFlag: 'komitetSold' }, { setFlag: 'komitetMilitary' }, { baseMsg: 'Vendidos 40 ✦ de esencia al Comité por 260 ₽.' }], goto: 'sold' },
          { label: 'NO', effects: [{ setFlag: 'komitetRefused' }, { setFlag: 'komitetMilitary' }], goto: 'refused' },
        ],
      },
      sold: { text: '«Un placer, doctor. Volveremos.» El Volga se aleja levantando polvo radiactivo.', opts: [{ label: 'CERRAR' }] },
      refused: { text: '«Como quiera.» Apunta algo en una libreta pequeña. «Volveremos, doctor. Siempre volvemos.»', opts: [{ label: 'CERRAR' }] },
    },
  },

  kgb_commissar: {
    title: 'VISITA DEL DIRECTORIO 9', speaker: 'Comisario Orlov, KGB', color: '#e05050',
    nodes: {
      start: {
        text: () => `El comisario deja una carpeta sobre la mesa sin sentarse. «He leído los informes, doctor. ${S.foreignTrade || 0} tratos con extranjeros. Suecos. Finlandeses. Contrabandistas.» Pasa una hoja. «¿Debo seguir leyendo, o prefiere que hablemos de su presupuesto?»`,
        opts: [
          { label: 'ACEPTAR LA SANCIÓN (−20% DE LOS RUBLOS)', effects: [{ run: () => { S.rub = Math.round(S.rub * 0.8); } }, { rep: ['kgb', 15] }, { baseMsg: 'Sanción del KGB: el puesto pierde el 20% de su presupuesto.' }], goto: 'done' },
          { label: 'ENTREGARLE DOCUMENTOS DEL ALMACÉN', cond: { test: () => S.stash.some((it) => KGB_DOCS.includes(it.b)) }, hint: 'no hay informes, documentos ni diarios en el almacén', cls: 'good', effects: [{ run: () => { const i = S.stash.findIndex((it) => KGB_DOCS.includes(it.b)); if (i >= 0) S.stash.splice(i, 1); } }, { rep: ['kgb', 22] }, { baseMsg: 'Entregados documentos al KGB. El comisario Orlov se marcha satisfecho.' }], goto: 'done' },
          { label: 'SOBORNARLE (300 ₽)', cond: { rub: ['>=', 300] }, hint: 'no tenéis 300 ₽', effects: [{ rub: -300 }, { rep: ['kgb', 12] }, { setFlag: 'kgbBribed' }], goto: 'done' },
          { label: '[COMISARIO] HABLAR DE IDEOLOGÍA CON ÉL', show: { test: () => S.agents.some((a) => a.spec === 'comisario') }, cls: 'good', effects: [{ rep: ['kgb', 20] }, { baseMsg: 'Vuestro comisario y Orlov hablan dos horas de Lenin. El KGB se va convencido de vuestra lealtad.' }], goto: 'done' },
          { label: 'NEGARLO TODO', cls: 'bad', effects: [{ run: () => { S.rub = Math.round(S.rub * 0.65); } }, { rep: ['kgb', -10] }, { baseMsg: 'El KGB recorta el presupuesto del puesto un 35%. «Volveremos, doctor.»' }], goto: 'done' },
        ],
      },
      done: { text: '«Estamos en contacto, doctor.» El Volga negro se aleja. Nadie del puesto respira hasta que deja de oírse.', opts: [{ label: 'CERRAR' }] },
    },
  },

  // ------------------------------------------------------------ Fase 21.6: ataque a la base
  base_attack: {
    title: '¡ATAQUE AL PUESTO!', speaker: 'Sargento Kravets', color: '#ff3b30',
    nodes: {
      start: {
        text: () => { const A = ATTACK_INFO(); return `Suenan las sirenas. Kravets entra corriendo con el fusil en la mano: «¡${A ? A.name : 'Nos atacan'}!» ${A ? A.desc : ''} «Los que estén en la base, a las armas. O nos encerramos en el refugio y que se lleven lo que quieran.»`; },
        opts: [
          { label: 'DEFENDER EL PUESTO (MISIÓN TÁCTICA CON LOS AGENTES DE LA BASE)', cls: 'good', cond: { test: () => S.agents.some((a) => a.hp > 10 && !(a.awayUntil > S.day)) }, hint: 'no hay agentes en condiciones', effects: [{ run: () => { if (S.attack) S.attack.go = 1; } }] },
          { label: 'ENCERRARSE EN EL REFUGIO (PERDER RUBLOS, ESENCIA Y OBJETOS)', cls: 'bad', effects: [{ run: () => { if (basecoreMod) basecoreMod.yieldAttack(); } }] },
        ],
      },
    },
  },

  // ------------------------------------------------------------ Fase 20: el final
  finale: {
    title: 'EL ÚTERO DE CORIUM', speaker: 'Dr. A. Topolev', color: '#5ff7ff',
    nodes: {
      start: {
        text: () => `Habéis vuelto del Útero. Topolev escucha el informe con los ojos cerrados. Cuando abre la boca, le tiembla la voz. «Lo que hay ahí abajo puede alimentar a un país… o borrarlo. Moscú llama cada hora. Los americanos pagarían cualquier precio. Y yo…» No termina. «Decidid vosotros. Yo ya decidí una vez, en 1982, y mirad lo que pasó.»<br><br><span class="dimt">(Confianza de Topolev: ${S.trust}/100 · esencia en la base: ${S.ess} ✦)</span>`,
        opts: [
          { label: 'ENTREGAR LA ESENCIA AL PARTIDO (500 ✦)', cond: { ess: ['>=', 500] }, hint: 'hace falta tener 500 ✦ que entregar', effects: [{ ess: -500 }, { run: () => endGameLazy('partido') }], goto: 'end' },
          { label: 'DESTRUIR EL ÚTERO: SELLAR LA CENTRAL PARA SIEMPRE', cls: 'good', effects: [{ run: () => endGameLazy('sellar') }], goto: 'end' },
          { label: 'HUIR A OCCIDENTE CON LAS MUESTRAS', cond: { any: [{ rep: ['suecia', '>=', 40] }, { rep: ['finlandia', '>=', 40] }, { rep: ['contrabandistas', '>=', 30] }] }, hint: 'necesitáis a alguien que os saque: suecos, finlandeses o contrabandistas (reputación 40/40/30)', effects: [{ run: () => endGameLazy('occidente') }], goto: 'end' },
          { label: '[TOPOLEV] BAJAR CON ÉL HASTA EL FINAL', show: { test: () => !!S.flags.topolevPast && (S.trust || 0) >= 70 }, cls: 'cyan', effects: [{ run: () => endGameLazy('fusion') }], goto: 'end' },
          { label: 'TODAVÍA NO: SEGUIR TRABAJANDO (SE VOLVERÁ A PLANTEAR TRAS OTRA BAJADA AL ÚTERO)' },
        ],
      },
      end: { text: '«Que así sea.» El doctor se pone el abrigo. Fuera empieza a nevar ceniza.', opts: [{ label: 'CONTINUAR' }] },
    },
  },

  base_letter: {
    title: 'CORRESPONDENCIA', speaker: 'Carta sin remite', color: '#c8b48c',
    nodes: {
      start: {
        text: (c) => {
          const f = S.fallen[0] || null; // el más reciente va primero
          const who = f ? f.name : 'alguien de mi familia';
          return `Un sobre arrugado, con matasellos de Kiev. «Camarada director: me han dicho que ${who} no volverá. No me dicen dónde está ni cómo murió. Solo le pido una cosa: que alguien me diga que no fue en vano.»`;
        },
        opts: [
          { label: 'ENVIAR 120 ₽ Y UNA CARTA', cond: { rub: ['>=', 120] }, hint: 'no tenéis 120 ₽', cls: 'good', effects: [{ rub: -120 }, { setFlag: 'letterAnswered' }, { baseMsg: 'Has enviado una carta y 120 ₽ a la familia de un agente caído.' }], goto: 'sent' },
          { label: 'ESCRIBIR SOLO UNA CARTA', effects: [{ setFlag: 'letterAnswered' }], goto: 'sent' },
          { label: 'GUARDAR LA CARTA EN UN CAJÓN', effects: [{ setFlag: 'letterIgnored' }] },
        ],
      },
      sent: { text: 'Escribes hasta tarde. Tachas más de lo que escribes. Al final, solo pones la verdad que puedes contar: que fue valiente, y que los demás volvieron gracias a ese valor.', opts: [{ label: 'CERRAR' }] },
    },
  },
};

// el nodo de vuelta del superviviente reutiliza las opciones de «start» salvo la de la historia
DIALOGS.survivor.nodes.start2.opts = DIALOGS.survivor.nodes.start.opts.slice(1);

// ------------------------------------------------------------ utilidades de comercio (fase 17)
const night = (c) => !!(c.exp && c.exp.isNight && c.exp.isNight());
const pick = (list, c, seed) => list[Math.abs(((seed ?? 0) + ((c.obj && c.obj.x) || 0) * 7 + ((c.exp && c.exp.turn) || 0)) | 0) % list.length];
const discount = (p) => Math.round(p * (repOf(S, 'rda') >= 50 ? 0.8 : 1));
function countItem(c, b) { return c.a ? c.a.bag.filter((it) => it.b === b).reduce((n, it) => n + (it.q || 1), 0) : 0; }
function takeItem(c, b, n) {
  for (const it of c.a.bag) {
    if (n <= 0) break;
    if (it.b !== b) continue;
    const mv = Math.min(it.q || 1, n);
    n -= mv;
    if (it.q !== undefined) it.q -= mv; else it.q = 0;
  }
  c.a.bag = c.a.bag.filter((it) => !(it.b === b && it.q !== undefined && it.q <= 0));
}
function buyOpt(b, price, q, fac = null) {
  const p = fac ? price : discount(price), d = ITEMS[b];
  return { label: `${d.name.toUpperCase()}${q ? ' ×' + q : ''} — ${p} ₽`, cond: { rub: ['>=', p] }, hint: `no tenéis ${p} ₽`, effects: [{ rub: -p }, { give: { item: b, q } }, ...(fac ? [{ run: () => foreignTrade(S, fac) }] : [])], goto: 'buy' };
}
function sellOpt(b, k, fac = null) {
  return {
    label: (c) => { const n = countItem(c, b); return `${ITEMS[b].name.toUpperCase()}${n ? ' ×' + n : ''} — ${Math.round(ITEMS[b].value * k)} ₽ c/u`; },
    show: { hasItem: b },
    effects: [{ run: (c) => { const n = countItem(c, b); takeItem(c, b, n); S.rub += Math.round(ITEMS[b].value * k) * n; if (fac) foreignTrade(S, fac); c.exp && c.exp.say(`Vendéis ${n} × ${ITEMS[b].name} por ${Math.round(ITEMS[b].value * k) * n} ₽.`, 'good'); } }],
    goto: 'sell',
  };
}
function medicCost(c) {
  if (repOf(S, 'rda') >= 50) return 0;
  const team = c.exp ? c.exp.team : [];
  return 15 + team.reduce((n, q) => n + Math.max(0, agentStats(q.a).hpMaxEff - q.a.hp), 0);
}
function hurtList(c) {
  const team = c.exp ? c.exp.team : [];
  const hurt = team.filter((q) => q.a.hp < agentStats(q.a).hpMaxEff);
  return hurt.length ? '' : ' Os mira de arriba abajo. «Estáis enteros. Volved cuando no lo estéis.»';
}
function healTeam(c, hp, rad) {
  for (const q of c.exp ? c.exp.team : []) {
    const a = q.a;
    if (rad) a.rad = Math.max(0, a.rad - rad);
    if (hp) { a.hp = agentStats(a).hpMaxEff; q.poison = 0; q.burn = 0; }
  }
  if (c.exp) c.exp.emit('update');
}
const WISMUT_TALK = [
  '«De día esto es casi Leipzig: café de achicoria, partidas de skat, alguien toca la armónica. De noche… de noche cerramos las escotillas y rezamos, aunque el Partido diga que no hay a quién.»',
  '«Los suecos pasan a veces a cambiar filtros por tabaco. Los americanos no pasan. Los americanos disparan.»',
  '«Bajamos ciento doce. Quedamos cuarenta y tres. No me pidáis que os cuente los otros sesenta y nueve.»',
  '«El Objeto 7 no sale en ningún plano. Por eso sabemos que existe.»',
];
const RUMORS = [
  'Se busca voluntario para revisar el pozo n.º 3. Ruidos de rascado desde el martes. Recompensa: doble ración de café.',
  'Dicen que en el estanque de refrigeración hay un siluro del tamaño de un Trabant. El cabo Riedel jura que se llevó su barca entera.',
  'La antena Duga sigue zumbando. Quien la enciende ve toda la zona… y toda la zona le ve a él.',
  'Por las vías de Yanov pasa un tren a medianoche. No tiene maquinista. No para en ninguna estación.',
  'En Rassokha los robots de limpieza se han vuelto a encender. Siguen limpiando. Limpian cualquier cosa.',
  'En el Bosque Rojo la tierra está blanda donde enterraron los pinos. Hay cosas enterradas que no son pinos.',
  'El sótano del hospital n.º 126 de Prípiat: no toquéis la ropa. NO TOQUÉIS LA ROPA.',
  'Un convoy de la Stasi lleva tres días sin dar señales al sur de la central. Recompensa por la carga.',
];

// ------------------------------------------------------------ encuentros (fase 18)
const facOf = (c) => (c.actor ? actorFaction(c.actor) : (c.data && c.data.faction) || 'rda');
const hostileNow = (c) => !!(c.exp && c.actor && c.exp.attitudeToSquad(c.actor) === 'hostile');
const talked = (c, k) => !!(c.exp && c.exp.facState().talked[facOf(c) + ':' + k]);
const markTalk = (k) => ({ run: (c) => { c.exp.facState().talked[facOf(c) + ':' + k] = 1; } });
const nearMates = (c, r = 6) => (c.exp ? c.exp.enemies.filter((o) => !o.surrendered && actorFaction(o) === facOf(c) && Math.hypot(o.x - c.actor.x, o.y - c.actor.y) <= r) : []);
const GREET = {
  rda: ['«Genossen! ¡Camaradas! Por fin una cara amiga.» El soldado de la NVA baja el fusil.', '«Wismut, segunda patrulla. ¿Necesitáis algo? Vamos justos, pero compartimos.»'],
  cuba: ['«¡Compañeros soviéticos! ¿Alguien herido? Siéntense, siéntense.»', '«Aquí abajo hace un frío que no es normal, chico. ¿Un tabaquito?»'],
  checos: ['«Dobrý den. Grupo «Tatra». Si buscáis explosivos, habéis encontrado a los checos adecuados.»', '«Praga dice que somos aliados. Ostrava dice que primero se paga.»'],
  suecia: ['«God dag. Somos científicos. Solo científicos.» El dosimetrista sueco no deja de mirar vuestras armas.', '«Nuestras lecturas… no tienen sentido. ¿Las vuestras sí?»'],
  finlandia: ['No le habéis oído llegar. El finlandés os mira desde dos metros, inmóvil como un abedul. «Hei.»', '«Sisu. Significa no rendirse. Aquí abajo es lo único que funciona.»'],
  yugo: ['«¡Prijatelji! Amigos. Todo se vende, todo se compra. Hoy, precios de amigo.»', '«Belgrado no está ni con Moscú ni con Washington. Está con quien paga.»'],
  contrabandistas: ['«Sin preguntas, sin recibos.» El contrabandista os enseña la mercancía.'],
  merodeadores: ['«Quietos ahí. Esto es nuestro territorio. Las mochilas al suelo… o hablamos de precio.»'],
  desertores: ['«¡Alto! No disparéis.» Uniformes soviéticos rotos y miradas cansadas. «No queremos volver. Pero tampoco queremos morir aquí.»'],
};
function greeting(c) {
  const f = facOf(c), v = repOf(S, f);
  const g = pick(GREET[f] || ['«…»'], c);
  const mood = v >= 50 ? ' Os saludan como a viejos amigos.' : v <= -15 && !hostileNow(c) ? ' Os miran con desconfianza.' : '';
  return `${g}${mood} <span class="dimt">(${FACTIONS[f].name}: reputación ${v > 0 ? '+' : ''}${v})</span>`;
}
function hostileOpts(c) {
  const f = facOf(c), lvl = (c.actor && c.actor.lvl) || 1, bribe = 40 + lvl * 15;
  const threat = Math.min(0.85, 0.2 + 0.1 * (c.exp ? c.exp.team.length : 1) + ((c.a && (c.a.attr || {}).fue) || 3) / 40 + (c.exp && c.exp.team.some((q) => q.a.spec === 'comisario') ? 0.2 : 0));
  return [
    { label: `SOBORNARLES (${bribe} ₽)`, cond: { rub: ['>=', bribe] }, hint: `no tenéis ${bribe} ₽`, effects: [{ rub: -bribe }, { relation: [f, 'neutral'] }, { rep: [f, 8] }, { log: 'Cuentan los billetes dos veces y se apartan. «Por hoy, no os hemos visto.»', cls: 'good' }] },
    { label: '[COMISARIO] HABLAR DE SOLDADO A SOLDADO', show: [{ any: [{ spec: 'comisario' }, { squadFlag: 'negotiator' }] }, { test: () => f === 'desertores' }], cls: 'good', effects: [{ relation: [f, 'neutral'] }, { rep: [f, 12] }], goto: 'recruit' },
    { label: `AMENAZARLES (${Math.round(threat * 100)}%)`, effects: [{ run: (cc) => { if (Math.random() < threat) { cc.exp.relations = cc.exp.relations || {}; cc.exp.relations[['squad', f].sort().join('|')] = 'neutral'; addRep(S, f, -3); cc.exp.say('Se lo piensan mejor y retroceden. «Esta vez, no.»', 'good'); } else { cc.exp.say('«¿Ah, sí?» Echan mano a las armas.', 'bad'); cc.exp.interrupt = true; } } }] },
    { label: 'PREPARARSE PARA COMBATIR', effects: [{ interrupt: true }] },
  ];
}
function friendlyOpts(c) {
  const f = facOf(c), v = repOf(S, f), allied = c.exp && c.actor && c.exp.attitudeToSquad(c.actor) === 'allied';
  const mapCost = allied || v >= 15 ? 0 : 50;
  const out = [];
  if (f === 'contrabandistas') out.push({ label: 'VER LA MERCANCÍA', effects: [{ dialog: 'smuggler_trader' }] });
  else if (STOCK[f]) out.push({ label: 'INTERCAMBIAR', goto: 'trade' });
  out.push({ label: mapCost ? `COMPARTIR MAPAS (${mapCost} ₽)` : 'COMPARTIR MAPAS', show: { not: { test: (cc) => talked(cc, 'map') } }, cond: { rub: ['>=', mapCost] }, hint: `no tenéis ${mapCost} ₽`, turn: true, effects: [{ rub: -mapCost }, { reveal: 45 }, markTalk('map'), { rep: [f, 3] }, { log: (cc) => `Cambiáis planos y anotaciones (${cc.revealed || 0} casillas cartografiadas).`, cls: 'o1' }] });
  out.push({ label: 'PEDIR AYUDA', show: { not: { test: (cc) => talked(cc, 'help') } }, cond: { test: () => allied || v >= 25 }, hint: 'no os conocen lo bastante (reputación 25)', effects: [markTalk('help'), { run: (cc) => { const m = nearMates(cc); for (const o of m) o.escort = 40; cc.exp.say(`${m.length} de ellos os acompañarán un rato.`, 'good'); } }, { rep: [f, -2] }] });
  if (f === 'cuba') out.push({ label: 'TRATAMIENTO MÉDICO (20 ₽)', cond: { rub: ['>=', 20] }, hint: 'no tenéis 20 ₽', turn: true, effects: [{ rub: -20 }, { run: (cc) => healTeam(cc, 1, 20) }, { rep: [f, 2] }, { log: '«Esto no es nada, compañero.» Os cosen, os vendan y os quitan algo de radiación.', cls: 'good' }] });
  if (f === 'suecia') out.push({ label: 'COMPARTIR LECTURAS DE RADIACIÓN', show: { not: { test: (cc) => talked(cc, 'data') } }, turn: true, effects: [markTalk('data'), { rep: [f, 6] }, { xp: 25 }, { give: { item: 'antirad', q: 2 } }, { run: () => foreignTrade(S, f) }, { log: 'Comparáis dosímetros. Os regalan yoduro potásico. (El KGB no aprobaría esto.)', cls: 'o1' }] });
  if (f === 'desertores') out.push({ label: 'RECLUTAR A UNO', show: { any: [{ spec: 'comisario' }, { squadFlag: 'negotiator' }, { rep: ['desertores', '>=', 25] }] }, goto: 'recruit' });
  if (!allied) out.push({ label: 'AMENAZAR', turn: true, effects: [{ run: (cc) => {
    const def = ACTORS[cc.actor.type];
    if (Math.random() < 0.45) { const b = (def.loot || [])[0]; if (b) cc.exp.addFloor(cc.actor.x, cc.actor.y, createItem(b, 0, undefined, ITEMS[b].cat === 'ammo' ? ITEMS[b].pack : undefined)); addRep(S, f, -10); cc.exp.say('Os entregan algo de mala gana. No lo olvidarán (−10 de reputación).', 'warn'); }
    else { cc.exp.say('«¿Nos amenazáis? ¿Aquí abajo?»', 'bad'); cc.exp.provoke(f); }
  } }] });
  out.push({ label: 'DESPEDIRSE' });
  return out;
}
const STOCK = {
  rda: [['mpikm', 380], ['a_762x39', 30, 30], ['redflare', 45, 2], ['ai2', 55], ['antirad', 35, 2]],
  cuba: [['gironkit', 90], ['habano', 35, 2], ['ipp', 25, 2], ['redflare', 50]],
  checos: [['vz58', 480], ['skorpion', 340], ['cz75', 400], ['semtex', 150], ['a_9p', 45, 24]],
  suecia: [['rados', 330], ['antirad', 30, 2], ['m45', 420], ['a_9p', 45, 24]],
  finlandia: [['m62coat', 420], ['skirucksack', 380], ['mapcase', 60], ['rk62', 720], ['a_762x39', 35, 30]],
  yugo: [['m70', 430], ['rakija', 30, 2], ['a_762x39', 35, 30], ['vodka', 25], ['mre', 40], ['habano', 40], ['a_9p', 50, 24]],
  desertores: [['ak74', 360], ['a_545', 40, 30], ['rgd5', 45], ['ssh68', 70]],
};
const BUYS = {
  rda: [['parts', 0.9], ['intel', 0.6]], cuba: [['parts', 0.8], ['vodka', 1]], checos: [['parts', 1]],
  suecia: [['graphsample', 1.6], ['crystal', 1.3], ['essamp', 1]], finlandia: [['foreigndiary', 1.2], ['docs', 0.8]],
  yugo: [['docs', 0.9], ['icon', 0.9], ['medal', 0.9], ['vodka', 1.1], ['parts', 0.9]], desertores: [['vodka', 1.4], ['ai2', 1]],
};
const TRADE_LINE = { rda: '«Material del Pacto, precio del Pacto.»', cuba: '«Lo que tenemos es suyo, compañero. Bueno… casi.»', checos: '«Calidad de Brno. No hay devoluciones.»', suecia: '«Pagamos bien por muestras. Muy bien.»', finlandia: '«Buen equipo para el frío. Y para el silencio.»', yugo: '«¡Precios del día! Mañana, otros.»', desertores: '«Lo que nos llevamos del cuartel. No preguntéis.»' };
const tradeLine = (c) => TRADE_LINE[facOf(c)] || '«Echad un vistazo.»';
const foreignNote = (c) => (FACTIONS[facOf(c)].bloc === 'varsovia' ? '' : ' <span class="warn">(El KGB anota cada trato con extranjeros.)</span>');
function priceK(c) {
  const f = facOf(c), v = repOf(S, f);
  let k = v >= 50 ? 0.85 : v < 0 ? 1.25 : 1;
  if (f === 'yugo') k *= 0.8 + ((S.day * 7 + 3) % 7) / 10; // precios variables
  return k;
}
function tradeBuy(c, b, price, q) {
  const f = facOf(c), p = Math.max(1, Math.round(price * priceK(c))), d = ITEMS[b];
  return { label: `${d.name.toUpperCase()}${q ? ' ×' + q : ''} — ${p} ₽`, cond: { rub: ['>=', p] }, hint: `no tenéis ${p} ₽`, effects: [{ rub: -p }, { give: { item: b, q } }, { run: () => foreignTrade(S, f) }], goto: 'trade' };
}
function tradeSell(c, b, k) {
  const f = facOf(c), unit = Math.round(ITEMS[b].value * k / priceK(c));
  return {
    label: (cc) => `VENDER ${ITEMS[b].name.toUpperCase()} ×${countItem(cc, b)} — ${unit} ₽ c/u`,
    show: { hasItem: b },
    effects: [{ run: (cc) => { const n = countItem(cc, b); takeItem(cc, b, n); S.rub += unit * n; foreignTrade(S, f); addRep(S, f, 1); cc.exp && cc.exp.say(`Vendéis ${n} × ${ITEMS[b].name} por ${unit * n} ₽.`, 'good'); } }],
    goto: 'trade',
  };
}
const PRISONER_LINES = {
  default: ['«Tengo familia. Por favor.»', '«No sé nada, lo juro. Solo me pagaban por cargar cajas.»'],
  usa: ['«Name, rank and serial number. That\'s all you get.» Luego, en un ruso torpe: «No… disparar.»', '«Tell my wife…» No termina la frase.'],
  uk: ['«Ya está, ya está. Me rindo. ¿Tenéis té?», dice en un ruso de academia militar.'],
  merodeadores: ['«¡Solo buscábamos chatarra! ¡Chatarra!»', '«Os lo devuelvo todo, todo. Y os digo dónde guardamos lo demás.»'],
  desertores: ['«Me fui porque nos mandaban a morir. ¿Vosotros no os habéis ido aún?»', '«Fusiladme si queréis. Ya estoy medio muerto.»'],
  culto: ['«La Ceniza os verá arder.» Sonríe con los dientes negros.'],
};

const KGB_DOCS = ['intel', 'docs', 'blackbox', 'foreigndiary'];

// el final se resuelve en core/story.js (import diferido para no crear un ciclo al cargar)
let storyMod = null;
import('../core/story.js').then((m) => { storyMod = m; });
function endGameLazy(id) { if (storyMod) storyMod.endGame(id); }

let basecoreMod = null;
import('../core/basecore.js').then((m) => { basecoreMod = m; });
import('../data/basedata.js').then((m) => { ATTACKS_REF = m.ATTACKS; });
let ATTACKS_REF = null;
const ATTACK_INFO = () => (S.attack && ATTACKS_REF ? ATTACKS_REF[S.attack.kind] : null);
