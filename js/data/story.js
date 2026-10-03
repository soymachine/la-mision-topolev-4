// Narrativa profunda (fase 20): actos, escenas ASCII, finales, personal de la base, comedor, cartas y epitafios.
// Las escenas se reproducen a pantalla completa con texto mecanografiado (ui/scene.js).

export const ACTS = {
  1: { name: 'Acto I — «El Bloque»', short: 'EL BLOQUE', desc: 'Llegada al Puesto Pripyat-7. Las primeras zonas. El Dr. Topolev, entusiasta. Las notas hablan de experimentos anteriores a la explosión.' },
  2: { name: 'Acto II — «Los otros»', short: 'LOS OTROS', desc: 'Las expediciones extranjeras, el KGB presionando, los americanos buscando algo muy concreto. El Objeto 7 sale de las sombras.' },
  3: { name: 'Acto III — «El corazón»', short: 'EL CORAZÓN', desc: 'La Raíz-madre y el Útero de Corium. El doctor ya conocía la esencia. El «accidente» no fue del todo un accidente.' },
};

const ART_REACTOR = String.raw`
                 .   *        .        .   *
          *    .       ___________          .
     .        _______ |  ░░░░░░░  | _______      *
             |  ▓▓▓  ||  ░ ☢  ░░  ||  ▓▓▓  |  .
    .   *    |  ▓▓▓  ||___________||  ▓▓▓  |
        _____|_______|_____________|_______|_____
       /  ║║  ║║  ║║  ║║  ║║  ║║  ║║  ║║  ║║  ║║ \
  ____/___╨╨__╨╨__╨╨__╨╨__╨╨__╨╨__╨╨__╨╨__╨╨__╨╨__\____`;
const ART_FLAGS = String.raw`
      ____         ____          ____         ____
     |☭   |       |★★★ |        |▓▓▓▓|       |✚   |
     |____|       |____|        |____|       |____|
       ||  RDA      ||  EE.UU.    ||  ???      ||  CUBA
   ~~~~||~~~~~~~~~~~||~~~~~~~~~~~~||~~~~~~~~~~~||~~~~~~~~
       ||           ||            ||           ||
  ░░░░░░░░░░░░░░░░░░░░ ZONA DE EXCLUSIÓN ░░░░░░░░░░░░░░░░░░░`;
const ART_ROOTS = String.raw`
        ○       ◦   ●      ○    ◦       ●     ○
    ◦      \\    |   //      \  |  /     ◦
       ●    \\   |  //   ○    \ | /    ●
  ○          \\__|_//__________\|/__________   ◦
      ◦    ≈≈≈≈≈≈≈≈≈≈≈≈ ♥ ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
            //   |  \\        /|\       ○
     ●     //    |   \\      / | \    ◦      ●`;
const ART_DESK = String.raw`
        ________________________________
       |  ПРОТОКОЛ  № 7 · СЕКРЕТНО      |       _____
       |  ___________________________   |      ( ☕  )
       | |  A. S. Topolev, 1971      |  |       |___|
       | |  «Muestra n.º 7»          |  |   ____________
       | |___________________________|  |  |  ▓▓▓▓▓▓▓▓  |
       |________________________________|  |____________|`;
const ART_SEAL = String.raw`
      ███████████████████████████████████████████████
      ██                                           ██
      ██   ▓▓▓▓▓▓▓▓▓▓  S A R C Ó F A G O  ▓▓▓▓▓▓▓▓  ██
      ██                                           ██
      ███████████████████████████████████████████████
          ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀`;
const ART_KREMLIN = String.raw`
                    ★
                   /|\
          ★       / | \       ★
         /|\     |  |  |     /|\
        | | |____|  ☭  |____| | |
     ___|_|_|____|_____|____|_|_|___
    |  ▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓  |`;
const ART_BORDER = String.raw`
     ✈                                  ════════════════
         .  ·  ·  ·  ·  ·  ·  ·  ·  ·   ║  STOCKHOLM ║
    ☭ ═══════════════╗                   ════════════════
     URSS            ║   ~ ~ ~ ~  M A R  B Á L T I C O  ~ ~ ~
     ════════════════╝  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~`;
const ART_FUSION = String.raw`
                  ✦         ·        ✦
           ·          ✦ ✦ ✦ ✦ ✦           ·
        ✦         ✦               ✦          ✦
              ✦        ( @ )         ✦
        ·         ✦               ✦          ·
           ✦          ✦ ✦ ✦ ✦ ✦           ✦
                  ·         ✦        ·`;

// escenas: líneas (se mecanografían) y arte
export const SCENES = {
  act1: { title: 'ACTO I · EL BLOQUE', art: ART_REACTOR, color: '#ff8a1f', lines: [
    'Mayo de 1986. Diez kilómetros al norte de la central V. I. Lenin.',
    'El Puesto Pripyat-7 no figura en ningún mapa. Tampoco figurarán sus agentes.',
    'El Dr. Arkadi Topolev se frota las manos: «Ahí abajo hay algo vivo, camaradas. Algo que brilla. Vamos a ser los primeros en entenderlo».',
    'En la primera carpeta que os entregan hay una nota manuscrita con fecha de 1979. Siete años antes de la explosión.',
  ] },
  act2: { title: 'ACTO II · LOS OTROS', art: ART_FLAGS, color: '#e6dc6a', lines: [
    'Ya no estáis solos. Alemanes, suecos, cubanos, checos… y americanos que no deberían estar aquí.',
    'Moscú llama dos veces al día. El KGB quiere informes, el Comité quiere esencia, Topolev quiere muestras.',
    'Los operadores de «Nightingale» no buscan esencia cualquiera: buscan un expediente. Un nombre. Un número: siete.',
    'En el sótano de algún sitio que no sale en los planos, una puerta lleva cuarenta años cerrada. Objeto 7.',
  ] },
  act3: { title: 'ACTO III · EL CORAZÓN', art: ART_ROOTS, color: '#c06cff', lines: [
    'Las paredes respiran. La Raíz-madre late bajo la central como un segundo corazón.',
    'Los expedientes no mienten: el doctor trajo la Muestra n.º 7 al reactor cuatro. Él firmó el traslado.',
    'Topolev ya no sonríe. «Yo solo quería entender qué era», dice sin mirar a nadie. «Y ella quería salir».',
    'Más abajo, bajo la pata de elefante, está el Útero de Corium. Allí acaba todo. O empieza.',
  ] },
  past: { title: 'EL EXPEDIENTE TOPOLEV', art: ART_DESK, color: '#e05050', lines: [
    'Habéis leído el expediente del Objeto 7. El doctor lo sabe en cuanto entráis por la puerta.',
    '«No os lo conté porque no me habríais seguido. Tenía razón, ¿verdad?»',
    'Su confianza en vosotros, y la vuestra en él, ya no será la misma.',
  ] },
};

// finales (fase 20.1): se eligen en el diálogo «finale» al volver del Útero de Corium
export const ENDINGS = {
  partido: { name: 'Al servicio del Partido', art: ART_KREMLIN, color: '#e05050', lines: [
    'Cien bidones de plomo salen hacia Moscú en un tren sin número.',
    'El Comité condecora al Puesto Pripyat-7. Topolev recibe una dacha en Crimea y la orden de no hablar jamás.',
    'Diez años después, en un laboratorio de Sverdlovsk, alguien vuelve a abrir un frasco que brilla.',
  ] },
  sellar: { name: 'El sello', art: ART_SEAL, color: '#ff8a1f', lines: [
    'Cargas de demolición en cada galería. Hormigón y boro hasta el techo.',
    'El Útero de Corium queda sellado bajo diez metros de sarcófago. La esencia, enterrada con él.',
    'Nadie os dará una medalla por esto. Nadie sabrá nunca lo que evitasteis. Es suficiente.',
  ] },
  occidente: { name: 'Al otro lado', art: ART_BORDER, color: '#7fb8ff', lines: [
    'Una lancha sueca sin luces, una noche sin luna, un maletín de plomo con muestras.',
    'En Estocolmo os esperan periodistas, científicos y hombres de traje que no dan su nombre.',
    'El Pravda publica vuestras esquelas. En Occidente, la esencia ya tiene precio en bolsa.',
  ] },
  fusion: { name: 'Lo que Topolev buscaba', art: ART_FUSION, color: '#5ff7ff', lines: [
    'El doctor baja con vosotros hasta el final. Se quita el respirador.',
    '«No es un arma. No es energía. Es… memoria. Todo lo que ardió aquel 26 de abril sigue aquí».',
    'Cuando la luz azul os alcanza, dejáis de tener miedo. El Puesto Pripyat-7 nunca vuelve a emitir.',
  ] },
};

// personal de la base (fase 20.2): voz propia en sus pestañas, el comedor y los avisos
export const STAFF = {
  topolev: { name: 'Dr. Arkadi Topolev', role: 'Director científico', color: '#ff9a3c' },
  zhdanov: { name: 'Comisario Zhdánov', role: 'Comisario político', color: '#e05050', tab: 'cuartel',
    lines: ['«La cuota es la cuota, doctor. El Comité no entiende de mutantes.»', '«Un agente que duda es un agente que trabaja para el enemigo.»', '«He colgado un cartel nuevo en el comedor: «LA ESENCIA ES DEL PUEBLO». Que nadie lo descuelgue.»', '«Recuerde: yo informo de todo. De todo.»'] },
  orlova: { name: 'Dra. Lyudmila Orlova', role: 'Enfermería', color: '#ff8a8a', tab: 'barracones',
    lines: ['«Necesitan dormir, no medallas. Y que alguien le diga al doctor que esto no es un experimento.»', '«He visto dosímetros que ya no marcan. Y agentes que ya no sonríen. Lo segundo me preocupa más.»', '«Si vuelve alguien herido, que me lo traigan a mí antes que al Comisario.»', '«Topolev sabe más de lo que cuenta. Lo noto en cómo mira las muestras.»'] },
  kravets: { name: 'Sargento Kravets', role: 'Intendente', color: '#e6c86a', tab: 'intendencia',
    lines: ['«Oficialmente, esto es todo lo que hay. Extraoficialmente… pregunte por la trastienda.»', '«¿Vaqueros? ¿Cigarrillos americanos? Yo no he dicho nada, camarada.»', '«Lo que entra por esa puerta lo apunto. Lo que sale por la otra, no.»', '«El KGB no pregunta si yo no les doy motivos. Usted tampoco les dé.»'] },
  babai: { name: 'Mecánico «Babai»', role: 'Garaje', color: '#5fd0ff', tab: 'garaje',
    lines: ['«Laika no es un perro. Es mejor que un perro: no muerde a quien no debe.»', '«Tráigame piezas, chatarra, lo que sea. Con un destornillador y vodka hago milagros.»', '«Ese dron ha vuelto con un agujero de bala. Americano. Lo he guardado de recuerdo.»', '«Mi abuela decía que el Babai se llevaba a los niños malos. Ahora me llevo los chasis rotos.»'] },
};

// escenas del comedor (fase 20.2): plantillas por situación; {a} {b} son agentes, {d} un caído, {z} la zona
export const COMEDOR = {
  dead: ['{a} deja un vaso de vodka lleno en el sitio de {d}. Nadie se lo bebe.', '{a}: «{d} me debía tres rublos». Lo dice sonriendo, pero le tiembla la voz.', 'El Comisario Zhdánov lee una nota oficial sobre {d}. {a} se levanta y se va antes de que termine.', '{a} y {b} cantan en voz baja la canción favorita de {d}. Desafinan. Da igual.'],
  friends: ['{a} y {b} se pasan la noche jugando al ajedrez. Ninguno deja ganar al otro.', '{a} le cose la manga a {b}: «Si vuelves a romperla ahí abajo, te la coses tú».', '{a}: «Si no fuera por {b}, hoy no estaría cenando». {b} mira el plato y no dice nada.'],
  rivals: ['{a} y {b} discuten por quién abatió al último chebylita. La Dra. Orlova los separa.', '{a} se sienta en la otra punta de la mesa cuando llega {b}.', '{b} esconde el tabaco de {a}. {a} lo sabe. Habrá venganza.'],
  stressed: ['{a} no ha tocado la sopa. Mira la ventana como si algo fuera a asomarse.', '{a} se despierta gritando a las tres de la mañana. {b} se queda a su lado hasta el amanecer.', '{a} cuenta las balas de su cargador una y otra vez. Siempre le salen treinta.'],
  success: ['{a} cuenta por quinta vez cómo salieron de {z}. Cada vez hay más chebylitas.', 'Babai ha preparado pelmeni. {a} se come tres platos. «Para el miedo», dice.', 'Topolev entra con una botella de coñac armenio: «¡Por {z}, camaradas!». Hasta Zhdánov brinda.'],
  quiet: ['El comedor está en silencio. Alguien ha puesto la radio: Alla Pugachova.', '{a} escribe una carta que no piensa enviar.', 'Kravets reparte chocolate «de su reserva personal». Nadie pregunta de dónde sale.'],
};

// cartas de las familias (fase 20.2)
export const LETTERS_FROM = [
  { from: 'su madre', text: '«{Hijo}: en Kiev dicen que ya no hay peligro, pero yo no me lo creo. Come caliente. Abrígate. Vuelve.»' },
  { from: 'su hermana', text: '«Aquí todos preguntan por ti. Les digo que construyes algo importante. ¿Es verdad? Dime que es verdad.»' },
  { from: 'un viejo amigo de la fábrica', text: '«Los de la brigada te guardamos el sitio en el equipo de hockey. Que no te dé por quedarte allí.»' },
  { from: 'su abuelo', text: '«Yo estuve en Stalingrado. No te voy a decir que no tengas miedo: te diré que el miedo también se cansa.»' },
  { from: 'su hijo pequeño', text: 'Un dibujo hecho con lápices de colores: un sol, una casa y alguien con una máscara de gas. Debajo, en letras torcidas: «{PAPA}, VEN».' },
  { from: 'una vecina', text: '«Riego tus geranios. Han florecido rojos. Te esperan.»' },
];
// epitafios del memorial (fase 20.2)
export const EPITAPHS = [
  'Bajó cuando nadie quería bajar.', 'Su dosímetro marcaba cero. Su valor, también: no conocía el miedo.', 'Dejó atrás a nadie.', 'Volvió a por los demás. Esta vez no volvió.',
  'Que la tierra que le cubre sea más limpia que la que pisó.', 'Hizo su trabajo. Lo hizo bien. No le dieron las gracias.', 'Para {nick}, la última guardia.', 'Murió en {z}. Vivió en todos nosotros.',
];
// la última carta que escriben los agentes (se encuentra en su taquilla)
export const LAST_LETTERS = [
  '«Si lees esto, es que no he vuelto. No llores mucho. Bébete mi vodka y cuéntales que me reí hasta el final.»',
  '«Dile a mi madre que no fue culpa de nadie. Bueno, sí: de quien construyó el reactor. Pero no se lo digas así.»',
  '«He dejado mis botas a {friend}. Le van grandes. Que se ponga dos pares de calcetines.»',
  '«No sé qué hay ahí abajo, pero brilla. Si alguna vez lo entendéis, contádmelo.»',
];
