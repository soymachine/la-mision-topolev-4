// Chebylitas: mutantes nacidos de la radiación a partir de elementos naturales.
// hue: tono propio. A nivel bajo, color tenue; a nivel alto, intenso.
export const ENEMIES = {
  rata: {
    name: 'Rata espinosa', glyph: 'r', hue: 350, origin: 'Animal', hp: 6, dmg: [1, 3], acc: 70, armor: 0, ev: 10, speed: 120,
    range: 1, xp: 4, ess: [2, 4], minL: 1, maxL: 5, group: [2, 5], abil: [],
    lore: 'Ratas de los sótanos cuyas púas se han calcificado con estroncio. Atacan en manada.',
  },
  polilla: {
    name: 'Polilla de ceniza', glyph: 'ж', hue: 72, origin: 'Insecto', hp: 5, dmg: [1, 2], acc: 74, armor: 0, ev: 20, speed: 150,
    range: 1, xp: 4, ess: [2, 3], minL: 1, maxL: 6, group: [3, 7], abil: ['erratic', 'radbite'], follows: 'raiz',
    lore: 'Su polvo de alas es radiactivo. Revolotean sin rumbo hasta que huelen sangre.',
  },
  musgo: {
    name: 'Musgo errante', glyph: 'щ', hue: 118, origin: 'Planta', hp: 16, dmg: [2, 4], acc: 76, armor: 0, ev: 0, speed: 55,
    range: 1, xp: 5, ess: [3, 5], minL: 1, maxL: 8, group: [2, 4], abil: ['poison'],
    lore: 'Colonias de musgo que aprendieron a arrastrarse. Sus filamentos inyectan toxinas.',
  },
  esporangio: {
    name: 'Esporangio', glyph: 'ё', hue: 290, origin: 'Hongo', hp: 9, dmg: [0, 0], acc: 100, armor: 0, ev: 0, speed: 70,
    range: 1, xp: 5, ess: [3, 6], minL: 2, maxL: 8, group: [2, 4], abil: ['explode'],
    lore: 'Hongo hinchado de esporas. Revienta junto a sus víctimas liberando una nube tóxica.',
  },
  lobo: {
    name: 'Lobo de grafito', glyph: 'Л', hue: 196, origin: 'Animal', hp: 14, dmg: [3, 6], acc: 76, armor: 1, ev: 14, speed: 130,
    range: 1, xp: 7, ess: [4, 7], minL: 3, maxL: 9, group: [2, 5], abil: [], diet: ['rata', 'perro', 'gato'],
    lore: 'Lobos del Bosque Rojo con escamas de grafito incrustadas. Cazan en jauría.',
  },
  cuervo: {
    name: 'Cuervo de plomo', glyph: 'в', hue: 262, origin: 'Ave', hp: 8, dmg: [2, 4], acc: 80, armor: 0, ev: 30, speed: 150,
    range: 1, xp: 6, ess: [3, 6], minL: 3, maxL: 9, group: [2, 5], abil: ['flying', 'radbite', 'erratic'], follows: 'lobo',
    lore: 'Plumas pesadas como plomo. Vuela sobre el agua contaminada y picotea los ojos.',
  },
  cristal: {
    name: 'Cristal aullante', glyph: 'Ж', hue: 176, origin: 'Mineral', hp: 20, dmg: [4, 7], acc: 72, armor: 2, ev: 0, speed: 100,
    range: 7, xp: 9, ess: [6, 10], minL: 3, maxL: 10, group: [1, 3], abil: ['stationary', 'ranged', 'radbite'],
    lore: 'Formaciones de cuarzo que vibran con la radiación y disparan rayos ionizantes.',
  },
  golem: {
    name: 'Gólem de grafito', glyph: 'Ф', hue: 222, origin: 'Roca', hp: 45, dmg: [6, 11], acc: 70, armor: 3, ev: 0, speed: 70,
    range: 1, xp: 14, ess: [9, 14], minL: 4, maxL: 10, group: [1, 2], abil: [],
    lore: 'Bloques del moderador del reactor fundidos en una forma vagamente humana. Lento e imparable.',
  },
  jabali: {
    name: 'Jabalí de óxido', glyph: 'Б', hue: 322, origin: 'Animal', hp: 30, dmg: [5, 9], acc: 76, armor: 1, ev: 6, speed: 110,
    range: 1, xp: 12, ess: [7, 12], minL: 4, maxL: 10, group: [1, 3], abil: ['charge'], diet: ['rata', 'hormiga'],
    lore: 'Su piel se ha convertido en chapa oxidada. Embiste en línea recta a gran velocidad.',
  },
  raiz: {
    name: 'Raíz-madre', glyph: 'Ѱ', hue: 140, origin: 'Planta', hp: 55, dmg: [3, 6], acc: 80, armor: 2, ev: 0, speed: 100,
    range: 2, xp: 18, ess: [14, 22], minL: 5, maxL: 10, group: [1, 1], abil: ['stationary', 'spawn'],
    lore: 'Un nudo de raíces que palpita en el hormigón. Da a luz Musgo errante sin cesar.',
  },
  // ---- fase 17: superficie y zonas nuevas ----
  liana: {
    name: 'Liana chebylita', glyph: 'ʃ', hue: 96, origin: 'Planta', hp: 22, dmg: [2, 4], acc: 82, armor: 1, ev: 0, speed: 100,
    range: 2, xp: 8, ess: [5, 8], minL: 3, maxL: 10, group: [2, 4], abil: ['stationary', 'grab'],
    lore: 'Enredaderas del Bosque Rojo que se enroscan en los tobillos. Quien queda atrapado no puede moverse.',
  },
  siluro: {
    name: 'Siluro gigante', glyph: 'ʂ', hue: 184, origin: 'Animal', hp: 48, dmg: [7, 12], acc: 74, armor: 2, ev: 6, speed: 110,
    range: 1, xp: 16, ess: [10, 16], minL: 5, maxL: 10, group: [1, 2], abil: ['aquatic'],
    lore: 'Los siluros del estanque de refrigeración ya medían dos metros antes de 1986. Ahora no caben en ninguna leyenda.',
  },
  robot: {
    name: 'Robot de limpieza STR-1', glyph: 'Ѧ', hue: 40, origin: 'Máquina', hp: 38, dmg: [5, 9], acc: 72, armor: 4, ev: 0, speed: 80,
    range: 4, xp: 14, ess: [0, 0], minL: 4, maxL: 10, group: [1, 2], abil: ['ranged', 'mech'], drops: ['parts', 'parts'],
    lore: 'Robots de limpieza de los liquidadores, abandonados cuando la radiación les frió la electrónica. Algo los ha vuelto a encender.',
  },
  // ---- fase 22: ecosistema (por bioma) ----
  // diet: carnívoros que cazan presas (prey) cuando no tienen a nadie mejor · follows: carroñeros que siguen a un depredador
  medusa: {
    name: 'Medusa de refrigeración', glyph: 'ю', hue: 192, origin: 'Animal', hp: 14, dmg: [2, 5], acc: 78, armor: 0, ev: 8, speed: 70,
    range: 1, xp: 8, ess: [4, 7], minL: 3, maxL: 10, group: [2, 4], abil: ['aquatic', 'shock'],
    lore: 'Medusas de agua dulce que llegaron con el agua del estanque. Sus filamentos dan descargas que paralizan las piernas.',
  },
  velo: {
    name: 'Velo de moho', glyph: 'ш', hue: 88, origin: 'Hongo', hp: 12, dmg: [1, 3], acc: 80, armor: 0, ev: 12, speed: 60,
    range: 1, xp: 6, ess: [3, 6], minL: 1, maxL: 8, group: [1, 3], abil: ['blind', 'poison', 'erratic'],
    lore: 'Una cortina de moho que flota a la altura de la cara. Se pega a los ojos y a la máscara: durante un rato, no se ve nada.',
  },
  enjambre: {
    name: 'Enjambre de cuarzo', glyph: 'ч', hue: 168, origin: 'Mineral', hp: 16, dmg: [2, 4], acc: 82, armor: 1, ev: 28, speed: 140,
    range: 1, xp: 9, ess: [5, 8], minL: 5, maxL: 10, group: [1, 3], abil: ['flying', 'erratic', 'radbite', 'split'],
    lore: 'Miles de esquirlas de cuarzo que vibran juntas. Si lo rompes, los pedazos siguen volando por su cuenta.',
  },
  oso: {
    name: 'Oso de grafito', glyph: 'Д', hue: 210, origin: 'Animal', hp: 60, dmg: [8, 13], acc: 74, armor: 3, ev: 4, speed: 95,
    range: 1, xp: 20, ess: [12, 18], minL: 5, maxL: 10, group: [1, 1], abil: ['rage'], diet: ['jabali', 'lobo', 'perro', 'alce'],
    lore: 'Pesa como un camión y tiene placas de grafito en el lomo. Herido, se vuelve loco de rabia.',
  },
  ciguena: {
    name: 'Cigüeña de hierro', glyph: 'Г', hue: 30, origin: 'Ave', hp: 18, dmg: [4, 8], acc: 82, armor: 2, ev: 18, speed: 120,
    range: 1, xp: 10, ess: [5, 9], minL: 4, maxL: 10, group: [1, 2], abil: ['flying', 'charge'], diet: ['rata', 'sapo', 'medusa'],
    lore: 'Las cigüeñas volvieron a los tejados de Prípiat con el pico de hierro. Se lanzan en picado desde lo alto.',
  },
  perro: {
    name: 'Perro de las fosas', glyph: 'п', hue: 14, origin: 'Animal', hp: 12, dmg: [3, 5], acc: 78, armor: 0, ev: 16, speed: 140,
    range: 1, xp: 6, ess: [3, 6], minL: 2, maxL: 9, group: [3, 6], abil: ['howl'], diet: ['rata', 'gato'],
    lore: 'Los perros de los evacuados que nadie se llevó. Viven en las fosas de enterramiento de los vehículos y cazan en jauría. Su aullido despierta a todo el sector.',
  },
  automata: {
    name: 'Autómata de chatarra', glyph: 'Ѳ', hue: 48, origin: 'Máquina', hp: 26, dmg: [3, 6], acc: 72, armor: 3, ev: 0, speed: 85,
    range: 1, xp: 10, ess: [0, 0], minL: 3, maxL: 10, group: [2, 4], abil: ['mech', 'repair'], drops: ['parts'],
    lore: 'Robots de limpieza a escala, montados con piezas de los STR-1 que la esencia volvió a encender. Se reparan solos con lo que encuentran.',
  },
  hueco: {
    name: 'Liquidador hueco', glyph: 'Я', hue: 0, origin: 'Desconocido', hp: 32, dmg: [6, 10], acc: 80, armor: 2, ev: 10, speed: 100,
    range: 1, xp: 18, ess: [10, 16], minL: 6, maxL: 10, group: [1, 2], abil: ['stealth', 'radbite', 'pounce'],
    lore: 'Un traje de protección vacío que camina. Nadie lo ve llegar: solo se oye el roce del caucho cuando ya lo tienes al lado.',
  },
  sanguijuela: {
    name: 'Sanguijuela del canal', glyph: 'з', hue: 340, origin: 'Animal', hp: 10, dmg: [2, 4], acc: 80, armor: 0, ev: 10, speed: 110,
    range: 1, xp: 6, ess: [3, 5], minL: 3, maxL: 9, group: [2, 4], abil: ['aquatic', 'drain'],
    lore: 'Sanguijuelas del tamaño de un antebrazo. Lo que chupan las cura.',
  },
  topo: {
    name: 'Topo de hormigón', glyph: 'т', hue: 26, origin: 'Animal', hp: 20, dmg: [4, 7], acc: 76, armor: 2, ev: 6, speed: 90,
    range: 1, xp: 9, ess: [5, 8], minL: 3, maxL: 10, group: [1, 3], abil: ['burrow'],
    lore: 'Excava el hormigón como si fuera tierra. Desaparece bajo el suelo y sale justo a tu lado.',
  },
  tejedora: {
    name: 'Tejedora de cables', glyph: 'Ш', hue: 280, origin: 'Insecto', hp: 18, dmg: [2, 4], acc: 80, armor: 1, ev: 14, speed: 90,
    range: 5, xp: 10, ess: [5, 9], minL: 4, maxL: 10, group: [1, 3], abil: ['ranged', 'web'],
    lore: 'Arañas que tejen con hilo de cobre arrancado de los cuadros eléctricos. Su red te pega al suelo.',
  },
  erizo: {
    name: 'Erizo de isótopos', glyph: 'э', hue: 64, origin: 'Animal', hp: 22, dmg: [3, 5], acc: 74, armor: 3, ev: 4, speed: 80,
    range: 1, xp: 9, ess: [5, 8], minL: 3, maxL: 10, group: [1, 3], abil: ['thorns', 'radbite'],
    lore: 'Las púas brillan de noche. Quien lo golpea cuerpo a cuerpo se las clava.',
  },
  sapo: {
    name: 'Sapo de cesio', glyph: 'ц', hue: 100, origin: 'Animal', hp: 14, dmg: [2, 5], acc: 76, armor: 0, ev: 8, speed: 90,
    range: 4, xp: 7, ess: [4, 6], minL: 2, maxL: 9, group: [2, 4], abil: ['ranged', 'radbite'],
    lore: 'Escupe una baba verde que quema la piel y deja el dosímetro chillando.',
  },
  murcielago: {
    name: 'Murciélago de ceniza', glyph: 'у', hue: 300, origin: 'Animal', hp: 8, dmg: [1, 3], acc: 82, armor: 0, ev: 32, speed: 160,
    range: 1, xp: 5, ess: [2, 4], minL: 2, maxL: 9, group: [3, 6], abil: ['flying', 'erratic', 'drain'], follows: 'oso',
    lore: 'Colonias enteras en los túneles. Muerden, beben y se van. Siguen a los osos para comerse las sobras.',
  },
  hormiga: {
    name: 'Hormiga de plomo', glyph: 'ф', hue: 230, origin: 'Insecto', hp: 7, dmg: [1, 3], acc: 80, armor: 2, ev: 8, speed: 110,
    range: 1, xp: 4, ess: [2, 3], minL: 1, maxL: 6, group: [4, 8], abil: ['poison'],
    lore: 'Hormigas con caparazón de plomo. Una sola no es nada; el hormiguero entero es otra cosa.',
  },
  alce: {
    name: 'Alce de la ciénaga', glyph: 'Ψ', hue: 36, origin: 'Animal', hp: 42, dmg: [6, 11], acc: 74, armor: 2, ev: 6, speed: 115,
    range: 1, xp: 14, ess: [8, 13], minL: 4, maxL: 10, group: [1, 2], abil: ['charge'],
    lore: 'Cornamentas de dos metros cubiertas de liquen fosforescente. Embiste a todo lo que se mueve.',
  },
  bobina: {
    name: 'Bobina viva', glyph: 'Ξ', hue: 54, origin: 'Máquina', hp: 30, dmg: [4, 8], acc: 78, armor: 3, ev: 0, speed: 100,
    range: 6, xp: 13, ess: [0, 0], minL: 4, maxL: 10, group: [1, 2], abil: ['stationary', 'ranged', 'chain', 'mech'], drops: ['electronica'],
    lore: 'Un transformador que la esencia volvió a cargar. El arco eléctrico salta de un agente al de al lado.',
  },
  maniqui: {
    name: 'Maniquí de la escuela n.º 3', glyph: 'Ч', hue: 20, origin: 'Desconocido', hp: 24, dmg: [6, 10], acc: 82, armor: 1, ev: 6, speed: 130,
    range: 1, xp: 14, ess: [8, 12], minL: 3, maxL: 10, group: [1, 3], abil: ['angel', 'pounce'],
    lore: 'Los maniquíes del aula de defensa civil. No se mueven mientras alguien los mira. Cuando nadie mira…',
  },
  sirena: {
    name: 'Eco de la sirena', glyph: 'Э', hue: 6, origin: 'Desconocido', hp: 20, dmg: [0, 0], acc: 100, armor: 2, ev: 0, speed: 100,
    range: 1, xp: 8, ess: [6, 10], minL: 2, maxL: 10, group: [1, 1], abil: ['stationary', 'scream'],
    lore: 'Una sirena de alarma civil que aún gira y aúlla sola. No hace daño: despierta a todo lo que hay alrededor.',
  },
  gato: {
    name: 'Gato de las cocinas', glyph: 'к', hue: 46, origin: 'Animal', hp: 10, dmg: [3, 6], acc: 84, armor: 0, ev: 26, speed: 150,
    range: 1, xp: 6, ess: [3, 5], minL: 1, maxL: 8, group: [1, 2], abil: ['stealth', 'pounce'], diet: ['rata', 'hormiga'],
    lore: 'Los gatos de las cantinas de la central. Se mueven sin ruido y saltan a la cara.',
  },
  // ---- JEFES ----
  pastor: {
    name: 'El Pastor de Ceniza', glyph: 'Ω', hue: 2, origin: 'Desconocido', hp: 130, dmg: [8, 14], acc: 76, armor: 3, ev: 8, speed: 100,
    range: 6, xp: 60, ess: [60, 90], minL: 6, maxL: 10, group: [1, 1], abil: ['ranged', 'summon'], boss: 1,
    trophy: 'tr_pastor', phases: [
      { at: 0.66, say: 'El Pastor alza el cayado: la ceniza se arremolina y la manada responde.', summon: ['lobo', 3] },
      { at: 0.33, say: 'El Pastor se desvanece en la ceniza… y reaparece a vuestro lado.', add: ['burrow', 'stealth'] },
    ],
    lore: 'Una figura alta envuelta en ceniza. Los lobos acuden a su llamada. Algunos dicen que fue un operario.',
  },
  coloso: {
    name: 'Coloso de corium', glyph: 'Ѫ', hue: 88, origin: 'Mineral', hp: 210, dmg: [12, 20], acc: 72, armor: 6, ev: 0, speed: 60,
    range: 1, xp: 90, ess: [90, 140], minL: 8, maxL: 10, group: [1, 1], abil: ['aura'], boss: 1,
    trophy: 'tr_coloso', phases: [
      { at: 0.66, say: 'El Coloso se resquebraja: de las grietas brotan cristales aullantes.', summon: ['cristal', 2] },
      { at: 0.33, say: 'El corium hierve. El Coloso se lanza contra vosotros, más rápido de lo que debería.', add: ['rage', 'charge'] },
    ],
    lore: 'Masa viva de combustible fundido. Su mera presencia abrasa con radiación.',
  },
  // ---- fase 22: un jefe por zona nueva, con fases (umbral de salud) y trofeo único ----
  matriarca: {
    name: 'La Matriarca de las fosas', glyph: 'П', hue: 8, origin: 'Animal', hp: 95, dmg: [7, 12], acc: 80, armor: 2, ev: 14, speed: 130,
    range: 1, xp: 45, ess: [40, 60], minL: 2, maxL: 10, group: [1, 1], abil: ['howl'], boss: 1, home: 'pripyat', trophy: 'tr_matriarca',
    phases: [
      { at: 0.66, say: 'La Matriarca aúlla: de las fosas salen sus cachorros.', summon: ['perro', 3] },
      { at: 0.33, say: 'La Matriarca, acorralada, enloquece.', add: ['rage', 'pounce'] },
    ],
    lore: 'La perra más vieja de Prípiat, del tamaño de un poni. Toda jauría de la ciudad es hija suya.',
  },
  pinorojo: {
    name: 'El Pino Rojo', glyph: 'Ϯ', hue: 4, origin: 'Planta', hp: 140, dmg: [5, 9], acc: 82, armor: 4, ev: 0, speed: 100,
    range: 6, xp: 55, ess: [50, 75], minL: 3, maxL: 10, group: [1, 1], abil: ['stationary', 'ranged', 'web'], boss: 1, home: 'bosque', trophy: 'tr_pino',
    phases: [
      { at: 0.66, say: 'Las raíces del Pino Rojo revientan el suelo: brotan lianas a su alrededor.', summon: ['liana', 3] },
      { at: 0.33, say: 'El Pino Rojo suelta una lluvia de agujas radiactivas.', add: ['chain', 'radbite'], heal: 0.1 },
    ],
    lore: 'El árbol que más radiación absorbió en 1986. Sus agujas no se cayeron: se volvieron rojas y afiladas.',
  },
  locomotora: {
    name: 'La Locomotora de óxido', glyph: 'Ѭ', hue: 24, origin: 'Máquina', hp: 170, dmg: [10, 16], acc: 74, armor: 6, ev: 0, speed: 80,
    range: 1, xp: 60, ess: [0, 0], minL: 4, maxL: 10, group: [1, 1], abil: ['mech', 'charge'], boss: 1, home: 'yanov', trophy: 'tr_locomotora', drops: ['parts', 'parts', 'parts'],
    phases: [
      { at: 0.66, say: 'Las calderas de la Locomotora escupen autómatas de chatarra.', summon: ['automata', 3] },
      { at: 0.33, say: 'La Locomotora se recalienta: chispas por todas partes.', add: ['rage', 'chain', 'ranged'] },
    ],
    lore: 'Una locomotora de maniobras que la esencia puso en marcha sin vía. Embiste lo que tiene delante.',
  },
  reychatarra: {
    name: 'El Rey de la chatarra', glyph: 'Ѩ', hue: 44, origin: 'Máquina', hp: 160, dmg: [8, 13], acc: 78, armor: 5, ev: 2, speed: 90,
    range: 5, xp: 60, ess: [0, 0], minL: 5, maxL: 10, group: [1, 1], abil: ['mech', 'ranged', 'repair'], boss: 1, home: 'rassokha', trophy: 'tr_rey', drops: ['parts', 'parts', 'electronica'],
    phases: [
      { at: 0.66, say: 'El Rey de la chatarra llama a su corte de autómatas.', summon: ['automata', 4] },
      { at: 0.33, say: 'El Rey arranca un rotor de helicóptero y lo usa de escudo.', add: ['chain'], heal: 0.15 },
    ],
    lore: 'Un amasijo de tanques, helicópteros y camiones de bomberos de Rassokha, soldados entre sí por la esencia.',
  },
  siluroabuelo: {
    name: 'El Siluro Abuelo', glyph: 'Θ', hue: 186, origin: 'Animal', hp: 180, dmg: [9, 15], acc: 76, armor: 3, ev: 4, speed: 100,
    range: 6, xp: 65, ess: [60, 90], minL: 5, maxL: 10, group: [1, 1], abil: ['aquatic', 'ranged', 'drain'], boss: 1, home: 'estanque', trophy: 'tr_siluro',
    phases: [
      { at: 0.66, say: 'El Siluro Abuelo remueve el fondo: el agua se llena de medusas.', summon: ['medusa', 3] },
      { at: 0.33, say: 'El Siluro Abuelo salta fuera del agua y cae con todo su peso.', add: ['rage', 'shock'] },
    ],
    lore: 'Los pescadores de Chernóbil ya hablaban de él en los setenta. Ahora tiene bigotes de tres metros.',
  },
  carpintero: {
    name: 'El Pájaro Carpintero', glyph: 'Δ', hue: 210, origin: 'Ave', hp: 130, dmg: [8, 13], acc: 84, armor: 2, ev: 22, speed: 140,
    range: 1, xp: 60, ess: [50, 80], minL: 5, maxL: 10, group: [1, 1], abil: ['flying', 'charge'], boss: 1, home: 'duga', trophy: 'tr_pajaro',
    phases: [
      { at: 0.66, say: 'El Pájaro Carpintero golpea la antena: tac-tac-tac. Acuden los cuervos.', summon: ['cuervo', 4] },
      { at: 0.33, say: 'La señal de la Duga-3 vuelve a sonar en todas las radios: todo el bosque despierta.', add: ['scream', 'rage'] },
    ],
    lore: 'Le pusieron el nombre de la señal del radar. Anida en lo alto de la antena y picotea el acero.',
  },
  toporey: {
    name: 'El Topo Rey', glyph: 'Ҭ', hue: 30, origin: 'Animal', hp: 150, dmg: [9, 14], acc: 78, armor: 4, ev: 8, speed: 100,
    range: 1, xp: 60, ess: [50, 80], minL: 5, maxL: 10, group: [1, 1], abil: ['burrow'], boss: 1, home: 'metro2', trophy: 'tr_toporey',
    phases: [
      { at: 0.66, say: 'El Topo Rey se hunde en el balasto y los túneles se llenan de topos.', summon: ['topo', 3] },
      { at: 0.33, say: 'El Topo Rey derrumba el techo del túnel a su paso.', add: ['rage', 'pounce'] },
    ],
    lore: 'Excavó la mitad de los túneles del Metro-2 que no salen en los planos. La otra mitad, también.',
  },
  xm7: {
    name: 'Prototipo XM-7', glyph: 'Σ', hue: 214, origin: 'Máquina', hp: 160, dmg: [8, 13], acc: 84, armor: 5, ev: 6, speed: 100,
    range: 7, xp: 70, ess: [0, 0], minL: 6, maxL: 10, group: [1, 1], abil: ['mech', 'ranged'], boss: 1, home: 'fenix', trophy: 'tr_xm7', drops: ['electronica', 'electronica', 'intel'],
    phases: [
      { at: 0.66, say: 'El XM-7 activa su camuflaje óptico. La pantalla de la estación dice «STEALTH MODE ENGAGED».', add: ['stealth'] },
      { at: 0.33, say: 'El XM-7 pide refuerzos por un canal que nadie contesta… salvo los robots de limpieza.', summon: ['robot', 2], add: ['chain'] },
    ],
    lore: 'Un robot de combate americano que alguien trajo a la zona para probarlo con esencia. La prueba salió demasiado bien.',
  },
  muestra7: {
    name: 'La Muestra n.º 7', glyph: 'λ', hue: 170, origin: 'Desconocido', hp: 150, dmg: [8, 14], acc: 82, armor: 3, ev: 12, speed: 110,
    range: 1, xp: 75, ess: [70, 100], minL: 6, maxL: 10, group: [1, 1], abil: ['drain', 'angel'], boss: 1, home: 'objeto7', trophy: 'tr_muestra',
    phases: [
      { at: 0.66, say: 'Las luces del laboratorio parpadean. En cada parpadeo hay un maniquí más.', summon: ['maniqui', 3] },
      { at: 0.33, say: 'La Muestra n.º 7 se parte en dos. Las dos mitades siguen viniendo.', add: ['split', 'burrow'], heal: 0.1 },
    ],
    lore: 'Lo que Topolev trajo en 1982. Nadie sabe qué aspecto tiene: cambia cada vez que lo miras.',
  },
  corazon: {
    name: 'El Corazón de la Raíz', glyph: '♥', hue: 128, origin: 'Planta', hp: 200, dmg: [6, 10], acc: 80, armor: 4, ev: 0, speed: 100,
    range: 3, xp: 80, ess: [80, 120], minL: 7, maxL: 10, group: [1, 1], abil: ['stationary', 'spawn', 'drain'], boss: 1, home: 'raices', trophy: 'tr_corazon',
    phases: [
      { at: 0.66, say: 'El Corazón late más deprisa: las paredes se llenan de lianas.', summon: ['liana', 3], heal: 0.1 },
      { at: 0.33, say: 'El Corazón suelta una nube de esporas y velos de moho.', summon: ['velo', 3], add: ['web', 'ranged'] },
    ],
    lore: 'Lo que late bajo la central. Cuando se para, todas las raíces de la zona tiemblan.',
  },
};

export const ABIL_TEXT = {
  erratic: 'Movimiento errático', radbite: 'Mordisco radiactivo', poison: 'Veneno', explode: 'Revienta en gas tóxico',
  flying: 'Vuela', stationary: 'Inmóvil', ranged: 'Ataque a distancia', charge: 'Embestida', spawn: 'Engendra musgo',
  summon: 'Invoca lobos', aura: 'Aura de radiación',
  grab: 'Atrapa (inmoviliza)', aquatic: 'Solo en el agua', mech: 'Máquina (inmune a gas y veneno; suelta piezas)',
  shock: 'Descarga (no te deja moverte 1 turno)', blind: 'Ciega (−3 visión 3 turnos)', split: 'Se divide al morir', rage: 'Rabia (herido: +50% daño y más rápido)',
  howl: 'Aúlla (despierta al sector)', repair: 'Se repara solo', stealth: 'Invisible hasta que lo tienes al lado', drain: 'Drena (se cura al morder)',
  burrow: 'Excava (sale a tu lado)', web: 'Red (inmoviliza a distancia)', thorns: 'Púas (devuelve daño cuerpo a cuerpo)', chain: 'Arco eléctrico (salta al de al lado)',
  angel: 'Solo se mueve si nadie lo mira', scream: 'Alarma (despierta a todo)', pounce: 'Salto (el primer golpe hace el doble)',
};

// Color según tono y nivel (1..10): tenue a bajo nivel, intenso a alto
export function enemyColor(hue, level) {
  const L = Math.max(1, Math.min(10, level));
  const s = 22 + L * 7.8;
  const l = 34 + L * 3.6;
  return `hsl(${hue},${s}%,${l}%)`;
}

// Estadísticas escaladas por nivel
export function scaleEnemy(def, level) {
  const k = level - 1;
  return {
    hp: Math.round(def.hp * (1 + 0.32 * k)),
    dmg: [Math.round(def.dmg[0] * (1 + 0.2 * k)), Math.round(def.dmg[1] * (1 + 0.22 * k))],
    acc: def.acc + 2 * k,
    armor: def.armor + Math.floor(k / 3),
    ev: def.ev + k,
    ess: [Math.round(def.ess[0] * (1 + 0.45 * k)), Math.round(def.ess[1] * (1 + 0.45 * k))],
    xp: Math.round(def.xp * (1 + 0.4 * k)),
  };
}
