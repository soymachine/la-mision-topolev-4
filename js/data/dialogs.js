// Árboles de diálogo (motor en core/events.js)
// Diálogo: { title, speaker, color, nodes: { start: { text, opts: [ { label, cond?, show?, hint?, effects?, goto?, turn? } ] } } }
//  · cond  → la opción aparece desactivada si no se cumple (hint explica por qué)
//  · show  → la opción ni siquiera aparece si no se cumple
//  · goto  → nodo siguiente (sin goto ni efecto `dialog`, el diálogo termina)
//  · turn  → elegirla gasta el turno del agente activo (solo en expedición)
import { SURVIVOR_LINES } from './lore.js';
import { S } from '../core/state.js';

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
