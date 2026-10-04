// Fase 28: la Conspiración. Piezas con las que cada partida monta su propio caso:
// alguien del Puesto filtra información (QUIÉN), por algún motivo (POR QUÉ), a alguien (PARA QUIÉN),
// y deja los paquetes en un buzón muerto de la Zona (DÓNDE). Las pistas se encuentran poco a poco
// y se clavan en el tablero de corcho del ARCHIVO.

// sospechosos: el personal de la base y uno de vuestros agentes (se elige al abrir el caso)
export const SUSPECTS = {
  zhdanov: { name: 'Comisario Zhdánov', short: 'Zhdánov', role: 'Comisario político', color: '#e05050', glyph: '☭' },
  orlova: { name: 'Dra. Lyudmila Orlova', short: 'Orlova', role: 'Enfermería', color: '#ff8a8a', glyph: '✚' },
  kravets: { name: 'Sargento Kravets', short: 'Kravets', role: 'Intendente', color: '#e6c86a', glyph: '▤' },
  babai: { name: 'Mecánico «Babai»', short: 'Babai', role: 'Garaje', color: '#5fd0ff', glyph: '⚙' },
  ninel: { name: 'Ninel Sokolova', short: 'Sokolova', role: 'Operadora de radio', color: '#c8a0ff', glyph: 'Ψ' },
  agent: { name: 'un agente', short: 'agente', role: 'Agente del Puesto', color: '#5fe08a', glyph: '@' },
};

// rasgos de cada sospechoso (su expediente del KGB); el culpable deja rastro de los suyos
export const TRAITS = {
  tabaco: { name: 'Tabaco', vals: ['Belomorkanal', 'Marlboro', 'no fuma'],
    clue: (v) => (v === 'no fuma' ? 'Junto al transmisor escondido no hay ni una colilla, y el cenicero de la sala de al lado rebosa: quien lo usa no fuma.' : `Colillas de ${v} aplastadas junto al transmisor escondido en el sótano.`) },
  mano: { name: 'Mano', vals: ['diestro', 'zurdo'],
    clue: (v) => (v === 'zurdo' ? 'La tinta de los mensajes cifrados está emborronada por el canto de la mano: los escribió un zurdo.' : 'El trazo de los mensajes cifrados es limpio y se inclina a la derecha: los escribió un diestro.') },
  turno: { name: 'Turno', vals: ['de día', 'de noche'],
    clue: (v) => (v === 'de noche' ? 'El transmisor solo emite entre las dos y las cuatro de la madrugada: alguien con guardia de noche.' : 'El transmisor solo emite a mediodía, a la hora del rancho, cuando nadie vigila: alguien con turno de día.') },
  idioma: { name: 'Idiomas', vals: ['inglés', 'alemán', 'solo ruso'],
    clue: (v) => (v === 'solo ruso' ? 'El borrador de un mensaje está en ruso, con faltas, y el contacto le contesta con un diccionario: no sabe otra lengua.' : `En el borrador de un mensaje hay palabras tachadas en ${v}.`) },
  llave: { name: 'Llaves', vals: ['sala de radio', 'almacén', 'garaje'],
    clue: (v) => `El transmisor estaba escondido detrás de un panel ${v === 'sala de radio' ? 'de la sala de radio' : v === 'almacén' ? 'del almacén' : 'del garaje'}: quien lo puso tiene esa llave.` },
};
export const TRAIT_SHORT = { 'Belomorkanal': 'fuma Belomor', 'Marlboro': 'fuma Marlboro', 'no fuma': 'no fuma', diestro: 'diestro', zurdo: 'zurdo', 'de día': 'turno de día', 'de noche': 'turno de noche', 'inglés': 'habla inglés', 'alemán': 'habla alemán', 'solo ruso': 'solo ruso', 'sala de radio': 'llave: radio', 'almacén': 'llave: almacén', garaje: 'llave: garaje' };

// motivos: una pista apunta al verdadero y las demás descartan los falsos
export const MOTIVES = {
  dinero: { name: 'Dinero', glyph: '$', yes: 'Un reloj suizo nuevo envuelto en un calcetín y un sobre con dólares: alguien le paga muy bien.', no: 'En su taquilla siguen intactos los rublos de tres pagas: no lo hace por dinero.' },
  chantaje: { name: 'Chantaje', glyph: '✉', yes: 'Una foto de su familia con una frase escrita a máquina al dorso: «Ellos también viven cerca de un reactor».', no: 'Sus cartas a casa son alegres y frecuentes; su familia está a salvo en Járkov y nadie la amenaza.' },
  ideologia: { name: 'Ideología', glyph: '☆', yes: 'Una copia mecanografiada de «Archipiélago Gulag» con frases subrayadas: «el mundo tiene que saber lo que pasó aquí».', no: 'Lleva el carné del Partido planchado en el bolsillo y discute de Lenin con el Comisario: no reniega del sistema.' },
  fe: { name: 'Fe', glyph: '⁂', yes: 'Un círculo de siete puntas grabado a navaja debajo de su litera: «el séptimo despierta».', no: 'Se ríe de las supersticiones de los liquidadores; ni un amuleto ni un símbolo del culto entre sus cosas.' },
  venganza: { name: 'Venganza', glyph: '✝', yes: 'Una esquela recortada del Pravda: un hermano, bombero, muerto la noche del 26 de abril. «Mintieron», escrito encima.', no: 'No perdió a nadie en abril: ni familia en Prípiat ni amigos en la central.' },
};

// para quién trabaja: las facciones reconocen (o no) su nombre en clave
export const BENEFICIARIES = {
  usa: { name: 'La CIA (EE. UU.)', short: 'CIA', fac: 'usa', yes: 'Los mensajes van a la frecuencia de «Nightingale», el operador americano de la estación Fénix.', no: 'Los americanos interceptados se quejan de que no tienen a nadie dentro del Puesto.', types: ['usa_operator', 'usa_elite', 'usa_sniper'] },
  uk: { name: 'El MI6 (Reino Unido)', short: 'MI6', fac: 'uk', yes: 'El cifrado usa el libro de claves de la estación británica de Helsinki.', no: 'Los británicos llevan semanas pidiendo a Londres «una fuente en el Puesto»: no la tienen.', types: ['uk_soldier', 'uk_sniper', 'uk_scout'] },
  culto: { name: 'El culto del Objeto 7', short: 'culto', fac: 'culto', yes: 'Todos los mensajes acaban igual: «El séptimo despierta. Dejadle salir».', no: 'Los sacerdotes del culto no saben nada de lo que pasa en el Puesto: rezan a ciegas.', types: ['cult_acolyte', 'cult_acolyte', 'cult_priest'] },
  contrabandistas: { name: 'Los contrabandistas', short: 'contrabandistas', fac: 'contrabandistas', yes: 'Las muestras de esencia robadas aparecen en el mercado negro de Prípiat al día siguiente.', no: 'Los contrabandistas venden de todo, pero ni una muestra del Puesto: no compran a nadie de dentro.', types: ['smuggler'] },
};

// dónde está el buzón muerto: rasgos de la zona
export const BIOME_TRACE = {
  bosque: 'agujas de pino rojo', ciudad: 'yeso de un bloque de viviendas', ferroviario: 'carbonilla de locomotora', industrial: 'virutas de metal y aceite de máquina',
  caverna: 'arcilla húmeda de cueva', inundado: 'lodo de agua estancada', ruinas: 'cascotes de hormigón', chatarreria: 'óxido de chatarra de vehículos', lago: 'escamas de pez',
  antena: 'hilo de cobre de antena', metro: 'balasto de vía de metro', base: 'pintura verde oliva americana', laboratorio: 'cristal de probeta', organico: 'savia de raíz', corium: 'escoria vítrea',
};
export const PLACE_CLUES = {
  estrato: (v) => (v === 'sup' ? 'Barro fresco y lluvia en las botas que dejaron el último paquete: el buzón está al aire libre.' : 'Polvo seco de hormigón en el último paquete: el buzón está bajo tierra.'),
  ew: (v) => `En el cuaderno de ruta del contacto, una flecha: el buzón queda al ${v} de la central.`,
  ns: (v) => `El mensaje interceptado habla de «subir» o «bajar» en el mapa: el buzón queda al ${v} de la central.`,
  bioma: (v) => `Restos de ${BIOME_TRACE[v] || v} en la cinta adhesiva del paquete.`,
};
export const CENTRAL = [35, 13]; // la central, en el mapa de la región

// de dónde salen las pistas
export const SOURCES = {
  mapa: 'Papel en la Zona', fuga: 'Filtración', interrogatorio: 'Interrogatorio', radio: 'Radio interceptada', inteligencia: 'Informe de inteligencia',
  kgb: 'Archivo del KGB', buzon: 'Buzón muerto', inicio: 'Carpeta del Comisario',
};
export const QUESTIONS = {
  quien: { name: 'QUIÉN', long: '¿Quién filtra?', need: 2 },
  porque: { name: 'POR QUÉ', long: '¿Por qué lo hace?', need: 2 },
  para: { name: 'PARA QUIÉN', long: '¿Para quién trabaja?', need: 2 },
  donde: { name: 'DÓNDE', long: '¿Dónde está el buzón?', need: 2 },
};
export const CODENAMES = ['GRULLA', 'ABEDUL', 'CENIZA', 'SAMOVAR', 'LIEBRE', 'SIRENA', 'TRINEO', 'MUÑECA', 'ARCO IRIS', 'CAMPANA', 'ESTORNINO', 'PERISCOPIO'];
export const KGB_CLUE_PRICE = 250;
