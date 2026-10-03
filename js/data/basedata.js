// La base viva y la metaprogresión (fase 21): parcelas, investigación, materiales, recetas, calendario y defensa.

// ---------------------------------------------------------------- plano de la base (16 parcelas, 4×4)
export const PLOTS = 16;
export const PLOT_COLS = 4;
// dibujo de cada edificio en su parcela (3 líneas de 9 caracteres)
export const BUILD_ART = {
  armeria: ['╔═══════╗', '║ ╦ ╦ ╦ ║', '╚═══════╝'], polvorin: ['┌──≡≡≡──┐', '│ ▒▒▒▒▒ │', '└───────┘'], blindaje: ['╔═▓▓▓▓═╗', '║ [ ] ^ ║', '╚═══════╝'],
  enfermeria: ['┌───✚───┐', '│ ▬ ▬ ▬ │', '└───────┘'], taller: ['┌──¤¤¤──┐', '│ ⚙ ¤ ⚙ │', '└───────┘'], radar: ['   ◎◎◎   ', ' ┌─┴─┴─┐ ', ' └─────┘ '],
  barracones: ['┌⌂─⌂─⌂─┐', '│▬▬ ▬▬ │', '└───────┘'], almacen: ['┌▤▤▤▤▤▤┐', '│▤▤▤▤▤▤│', '└──────┘ '], laboratorio: ['┌──✦✦✦──┐', '│ ⊔ ✦ ⊔ │', '└───────┘'],
  garaje: ['┌──Ш────┐', '│ § ˇ ˇ │', '└──═════┘'], banya: ['  ≈ ≈ ≈  ', '┌───♨───┐', '└───────┘'], comedor: ['┌───☕───┐', '│ ╤ ╤ ╤ │', '└───────┘'],
  invernadero: ['╱‾‾‾‾‾‾‾╲', '│ ♣ ♣ ♣ │', '└───────┘'], contencion: ['┌─╫─╫─╫─┐', '│ # # # │', '└───────┘'], refugio: ['▄▄▄▄▄▄▄▄▄', '█ ☢ ▒ ☢ █', '▀▀▀▀▀▀▀▀▀'],
  taller_fab: ['┌──⚒────┐', '│ ⚙ ⚒ ⚙ │', '└───────┘'], sala_radio: ['    ╪    ', '┌───┼───┐', '└───────┘'],
};

// ---------------------------------------------------------------- materiales (fase 21.3)
export const MATERIALS = {
  chatarra: { cat: 'material', name: 'Chatarra', glyph: '%', tier: 0, stack: 50, value: 4, desc: 'Tornillos, chapa y tubos. Material de fabricación.' },
  electronica: { cat: 'material', name: 'Componentes electrónicos', glyph: '%', tier: 1, stack: 30, value: 12, desc: 'Válvulas, resistencias y relés de fabricación soviética.' },
  plomo: { cat: 'material', name: 'Tela de plomo', glyph: '%', tier: 1, stack: 20, value: 15, desc: 'Lona impregnada de plomo. Para trajes y blindajes.' },
  tejido: { cat: 'material', name: 'Tejido chebylita', glyph: '%', tier: 1, stack: 30, value: 10, desc: 'Fibras, escamas y glándulas. Para medicinas e investigación.' },
  // objetos fabricables nuevos
  dronekit: { cat: 'consumable', name: 'Kit de reparación de drones', glyph: '!', tier: 2, stack: 3, use: 'dronekit', value: 120, desc: 'Repara 50% de la salud del perro robot adyacente o de un dron recién recogido.' },
  dronebat: { cat: 'material', name: 'Batería de litio para drones', glyph: '%', tier: 2, stack: 5, value: 90, desc: 'En la base: +20 turnos de batería a un dron (se instala en el Taller de fabricación).' },
  caseplate: { cat: 'material', name: 'Placa de ampliación de contenedor', glyph: '%', tier: 3, stack: 3, value: 200, desc: 'En la base: +1 hueco para un contenedor de seguridad (se instala en el Taller de fabricación).' },
};

// ---------------------------------------------------------------- investigación (fase 21.2)
// cost: esencia, rublos, muestras (objetos del almacén) y especímenes vivos (jaulas por especie); days: duración
export const RESEARCH = {
  r_muestras: { name: 'Análisis de muestras', glyph: '⊔', days: 1, cost: { ess: 20, items: { graphsample: 1 } }, req: [], desc: '+5% de esencia recogida en las expediciones.' },
  r_dosimetria: { name: 'Dosimetría avanzada', glyph: '☢', days: 2, cost: { ess: 40, items: { graphsample: 2 } }, req: ['r_muestras'], desc: '+10% de resistencia a la radiación para todos los agentes.' },
  r_tejidos: { name: 'Bioquímica chebylita', glyph: '%', days: 2, cost: { ess: 40, items: { tejido: 4 } }, req: ['r_muestras'], desc: 'Recetas: ampolla de esencia y pomada de grafito.' },
  r_vacuna: { name: 'Antídoto de esporas', glyph: '✚', days: 3, cost: { ess: 60, items: { tejido: 6 } }, req: ['r_tejidos'], desc: 'El veneno dura la mitad.' },
  r_balistica: { name: 'Balística contra caparazones', glyph: '/', days: 3, cost: { ess: 60, items: { tejido: 3, chatarra: 6 } }, req: ['r_muestras'], desc: '+6% de daño contra chebylitas.' },
  r_cristal: { name: 'Resonancia de cristales', glyph: '✦', days: 3, cost: { ess: 80, items: { crystal: 1 } }, req: ['r_dosimetria'], desc: 'Las vetas y cristales dan un 20% más de esencia.' },
  r_essammo: { name: 'Munición de esencia', glyph: '¥', days: 4, cost: { ess: 120, items: { electronica: 4 } }, req: ['r_cristal'], desc: 'Receta: celdas de esencia (sin necesitar el Laboratorio a nivel 3).' },
  r_drones: { name: 'Baterías de litio', glyph: 'ˇ', days: 2, cost: { ess: 50, items: { electronica: 4 } }, req: ['r_muestras'], desc: '+25% de batería en los drones. Receta: batería de litio.' },
  r_laika: { name: 'Laika-M mk2', glyph: '§', days: 3, cost: { ess: 80, items: { parts: 4, electronica: 3 } }, req: ['r_drones'], desc: 'El perro robot: +20% de salud y daño.' },
  r_contencion: { name: 'Celdas reforzadas', glyph: '#', days: 2, cost: { ess: 50, specimen: 1 }, req: ['r_tejidos'], desc: 'La celda de contención: mitad de fugas y +1 ✦ al día por espécimen.' },
  r_genetica: { name: 'Genética de la Raíz', glyph: '♥', days: 5, cost: { ess: 200, specimen: 2 }, req: ['r_contencion', 'r_vacuna'], desc: '+8 de salud máxima para todos los agentes.' },
  r_blindaje: { name: 'Tela de plomo', glyph: '[', days: 2, cost: { ess: 40, items: { plomo: 4 } }, req: ['r_dosimetria'], desc: 'Receta: traje de tela de plomo. +5% de resistencia a la radiación.' },
  r_comunicaciones: { name: 'Descifrado de transmisiones', glyph: '╪', days: 3, cost: { ess: 60, items: { electronica: 3, intel: 1 } }, req: ['r_muestras'], desc: 'Más mensajes interceptados y el KGB paga un 20% más.' },
  r_invernadero: { name: 'Cultivos hidropónicos', glyph: '♣', days: 2, cost: { ess: 30, items: { tejido: 2 } }, req: ['r_muestras'], desc: 'El invernadero produce el doble.' },
  r_psico: { name: 'Psicología de campo', glyph: '☺', days: 3, cost: { ess: 50, rub: 300 }, req: ['r_muestras'], desc: 'El estrés sube un 25% más despacio.' },
  r_ceniza: { name: 'Teología de la Ceniza', glyph: '✝', days: 4, cost: { ess: 100, items: { relic: 1 } }, req: ['r_tejidos'], desc: 'Los sacerdotes de la Ceniza no pueden azuzar chebylitas contra el escuadrón.' },
};

// ---------------------------------------------------------------- recetas (fase 21.3): Taller de fabricación
// lvl: nivel mínimo del taller · research: investigación necesaria · out: [objeto, cantidad] · special: mejora sobre un objeto
export const RECIPES = [
  { id: 'f_9x18', name: 'Munición 9×18 mm ×48', lvl: 1, cost: { chatarra: 2 }, out: ['a_9x18', 48] },
  { id: 'f_545', name: 'Munición 5,45×39 mm ×60', lvl: 1, cost: { chatarra: 4 }, out: ['a_545', 60] },
  { id: 'f_12', name: 'Cartuchos del calibre 12 ×24', lvl: 1, cost: { chatarra: 3 }, out: ['a_12', 24] },
  { id: 'f_ai2', name: 'Botiquín AI-2', lvl: 1, cost: { tejido: 1, chatarra: 1 }, out: ['ai2', 1] },
  { id: 'f_antirad', name: 'Antirrad ×2', lvl: 1, cost: { tejido: 2 }, out: ['antirad', 2] },
  { id: 'f_rgd5', name: 'Granada RGD-5 ×2', lvl: 2, cost: { chatarra: 3, electronica: 1 }, out: ['rgd5', 2] },
  { id: 'f_pmn', name: 'Mina PMN ×2', lvl: 2, cost: { chatarra: 3, electronica: 2 }, out: ['pmn', 2] },
  { id: 'f_pso', name: 'Mira óptica PSO-1', lvl: 2, cost: { electronica: 3, chatarra: 2 }, out: ['pso', 1] },
  { id: 'f_pbs1', name: 'Silenciador PBS-1', lvl: 2, cost: { chatarra: 5, electronica: 1 }, out: ['pbs1', 1] },
  { id: 'f_dronekit', name: 'Kit de reparación de drones', lvl: 2, cost: { electronica: 2, parts: 2 }, out: ['dronekit', 1] },
  { id: 'f_essamp', name: 'Ampolla de esencia', lvl: 2, research: 'r_tejidos', cost: { tejido: 3 }, ess: 20, out: ['essamp', 1] },
  { id: 'f_salve', name: 'Pomada de grafito', lvl: 1, research: 'r_tejidos', cost: { tejido: 1, graphsample: 1 }, out: ['salve', 2] },
  { id: 'f_cell', name: 'Celdas de esencia ×10', lvl: 3, research: 'r_essammo', cost: { electronica: 2 }, ess: 15, out: ['a_cell', 10] },
  { id: 'f_leadsuit', name: 'Traje de tela de plomo (L-1)', lvl: 2, research: 'r_blindaje', cost: { plomo: 5, chatarra: 2 }, out: ['l1', 1] },
  { id: 'f_dronebat', name: 'Batería de litio para drones', lvl: 2, research: 'r_drones', cost: { electronica: 3, chatarra: 1 }, out: ['dronebat', 1] },
  { id: 'f_caseplate', name: 'Placa de ampliación de contenedor', lvl: 3, cost: { plomo: 3, electronica: 2, parts: 2 }, out: ['caseplate', 1] },
];

// ---------------------------------------------------------------- calendario (fase 21.5)
// día 1 = 2 de mayo de 1986
export const dateOf = (day) => new Date(1986, 4, 1 + day);
export function seasonOf(day) {
  const m = dateOf(day).getMonth(); // 0 = enero
  if (m >= 5 && m <= 7) return 'verano';
  if (m >= 8 && m <= 10) return 'otono';
  if (m === 11 || m <= 1) return 'invierno';
  return 'primavera';
}
export const SEASONS = {
  primavera: { name: 'Primavera', glyph: '❀', desc: 'Mayo de 1986: los primeros días después de la explosión.' },
  verano: { name: 'Verano', glyph: '☀', desc: 'Calor, polvo radiactivo y tormentas secas.' },
  otono: { name: 'Otoño', glyph: '☂', desc: 'Lluvia radiactiva frecuente en superficie.' },
  invierno: { name: 'Invierno', glyph: '❄', desc: 'Frío y hielo: en superficie el agua se congela y la intemperie hiela (hipotermia sin abrigo).' },
};
// eventos históricos (mensajes de televisión en la base) · day: días desde el 1 de mayo de 1986
export const HISTORY = [
  { day: 5, text: 'TV: El Pravda publica por fin una nota de cuatro líneas sobre «un accidente en la central de Chernóbil».' },
  { day: 13, text: 'TV: Gorbachov habla por primera vez del accidente en la televisión soviética. Dice que la situación está bajo control.' },
  { day: 30, text: 'TV: La evacuación de la zona de 30 km se ha completado. 116.000 personas han dejado sus casas.' },
  { day: 50, text: 'TV: Empiezan los trabajos del «Objeto Refugio»: el sarcófago que cubrirá el bloque 4.' },
  { day: 116, text: 'TV: En Viena, el informe soviético ante el OIEA sorprende por su franqueza. Legásov habla durante cinco horas.' },
  { day: 152, text: 'TV: El bloque 1 de la central vuelve a funcionar. «El átomo soviético no se rinde».' },
  { day: 213, text: 'TV: El sarcófago del bloque 4 está terminado. 400.000 m³ de hormigón y 7.300 toneladas de acero.', flag: 'sarcophagusDone' },
  { day: 244, text: 'TV: El discurso de Año Nuevo no menciona Chernóbil. En el Puesto, alguien apaga la televisión.' },
  { day: 330, text: 'TV: El juicio a los responsables de la central se celebra en la propia Chernóbil. Se cierra al público.' },
  { day: 360, text: 'TV: Primer aniversario. Las flores rojas de los geranios han vuelto a crecer en los balcones de Prípiat.' },
];

// ---------------------------------------------------------------- defensa de la base (fase 21.6)
export const ATTACKS = {
  fuga: { name: 'Fuga de la celda de contención', desc: 'Los especímenes han roto las rejas y los chebylitas de alrededor han olido la sangre.', enemies: null, faction: 'chebylitas' },
  usa: { name: 'Comando de «Nightingale»', desc: 'Un equipo americano quiere las muestras del laboratorio. Han cortado la luz.', enemies: ['usa_operator', 'usa_operator', 'usa_elite', 'usa_sniper'], faction: 'usa' },
  merodeadores: { name: 'Asalto de merodeadores', desc: 'Una banda de saqueadores se ha enterado de lo que guardáis en el almacén.', enemies: ['mar_thug', 'mar_thug', 'mar_gunner', 'mar_gunner', 'mar_thug'], faction: 'merodeadores' },
  nido: { name: 'Nido bajo la base', desc: 'Algo ha excavado hasta los sótanos del Puesto. Viene de abajo.', enemies: ['lobo', 'lobo', 'rata', 'rata', 'rata', 'golem'], faction: 'chebylitas' },
};
