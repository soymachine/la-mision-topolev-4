// Árboles de diálogo (motor en core/events.js)
// Diálogo: { title, speaker, color, nodes: { start: { text, opts: [ { label, cond?, show?, hint?, effects?, goto?, turn? } ] } } }
//  · cond  → la opción aparece desactivada si no se cumple (hint explica por qué)
//  · show  → la opción ni siquiera aparece si no se cumple
//  · goto  → nodo siguiente (sin goto ni efecto `dialog`, el diálogo termina)
//  · turn  → elegirla gasta el turno del agente activo (solo en expedición)
import { SURVIVOR_LINES } from './lore.js';
import { S } from '../core/state.js';
import { ITEMS } from './items.js';
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
        text: (c) => `«Precio de camaradas.»${(S.rep.rda || 0) >= 25 ? ' Os hace un guiño: sois amigos de la RDA y se nota en la cuenta.' : ''} Tenéis ${S.rub} ₽.`,
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
            { label: cost ? `CURAR A TODO EL EQUIPO (${cost} ₽)` : 'CURAR A TODO EL EQUIPO (GRATIS: SOIS AMIGOS DE LA RDA)', cond: { rub: ['>=', cost] }, hint: `no tenéis ${cost} ₽`, cls: 'good', turn: true, effects: [{ rub: -cost }, { run: (cc) => healTeam(cc, 1, 0) }, { log: 'La doctora Brandt cose, venda y maldice en alemán. El equipo sale como nuevo.', cls: 'good' }] },
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
          buyOpt('m1911', 520), buyOpt('rem870', 950), buyOpt('m16', 1200), buyOpt('a_45', 45, 14), buyOpt('a_556', 70, 20), buyOpt('a_12', 45, 12), buyOpt('vodka', 30),
          { label: 'VOLVER', goto: 'start' },
        ],
      },
      sell: {
        text: '«Pago en efectivo. Mejor que el Estado, peor que tu madre.»',
        opts: () => [sellOpt('parts', 1), sellOpt('intel', 1), sellOpt('blackbox', 0.9), sellOpt('firecoat', 0.9), sellOpt('docs', 0.8), { label: 'VOLVER', goto: 'start' }],
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
const discount = (p) => Math.round(p * ((S.rep.rda || 0) >= 25 ? 0.8 : 1));
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
function buyOpt(b, price, q) {
  const p = discount(price), d = ITEMS[b];
  return { label: `${d.name.toUpperCase()}${q ? ' ×' + q : ''} — ${p} ₽`, cond: { rub: ['>=', p] }, hint: `no tenéis ${p} ₽`, effects: [{ rub: -p }, { give: { item: b, q } }], goto: 'buy' };
}
function sellOpt(b, k) {
  return {
    label: (c) => { const n = countItem(c, b); return `${ITEMS[b].name.toUpperCase()}${n ? ' ×' + n : ''} — ${Math.round(ITEMS[b].value * k)} ₽ c/u`; },
    show: { hasItem: b },
    effects: [{ run: (c) => { const n = countItem(c, b); takeItem(c, b, n); S.rub += Math.round(ITEMS[b].value * k) * n; c.exp && c.exp.say(`Vendéis ${n} × ${ITEMS[b].name} por ${Math.round(ITEMS[b].value * k) * n} ₽.`, 'good'); } }],
    goto: 'sell',
  };
}
function medicCost(c) {
  if ((S.rep.rda || 0) >= 25) return 0;
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
