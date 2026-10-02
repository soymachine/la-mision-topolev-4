// Trasfondos (fase 15.3): de dónde viene cada agente. Dan atributos iniciales, un rasgo
// (uno de `traits` de data/world.js) y frases propias que dicen durante las expediciones.
// lines: start (al bajar) · kill (tras abatir) · hurt (malherido) · extract (al salir) · rad (muy irradiado)
export const BACKGROUNDS = {
  minero: {
    name: 'Minero del Donbás', nameF: 'Minera del Donbás', attrs: { fue: 2, agu: 2, tec: 1 }, traits: ['minero', 'robusto'],
    lines: {
      start: ['«Bajar es lo de menos. Lo difícil siempre fue volver a subir.»', '«Huele igual que la mina de Gorlovka. Polvo y algo que no quieres saber.»'],
      kill: ['«Otra veta que se agota.»', '«En la mina también había bichos. Más pequeños.»'],
      hurt: ['«He salido de derrumbes peores… creo.»'],
      extract: ['«Arriba. Aire. Aunque sea este aire.»'],
      rad: ['«El dosímetro canta como un canario. Mal asunto.»'],
    },
  },
  bombero: {
    name: 'Bombero de Prípiat', nameF: 'Bombera de Prípiat', attrs: { agu: 3, fue: 1, agi: 1 }, traits: ['liquidador', 'robusto'],
    lines: {
      start: ['«La primera noche subimos sin máscaras. Hoy por lo menos llevo una.»', '«Mis compañeros de la sexta brigada están enterrados en Mitino. Esto va por ellos.»'],
      kill: ['«Apagado.»'],
      hurt: ['«He sentido peor calor que este.»'],
      extract: ['«Ninguna noche dura para siempre.»'],
      rad: ['«Este sabor a metal en la boca… lo conozco.»'],
    },
  },
  afgano: {
    name: 'Veterano de Afganistán', nameF: 'Veterana de Afganistán', attrs: { pun: 3, agi: 1, per: 1 }, traits: ['tirador', 'nervioso'],
    lines: {
      start: ['«Panjshir era peor. Allí por lo menos sabías quién te disparaba.»', '«Comprobad los cargadores. Dos veces.»'],
      kill: ['«Uno.»', '«Siguiente.»', '«Como en Kandahar.»'],
      hurt: ['«No es la primera bala que me llevo.»'],
      extract: ['«Todos fuera. Así se hace.»'],
      rad: ['«Esto no venía en el manual del afganets.»'],
    },
  },
  profesora: {
    name: 'Profesor de física', nameF: 'Profesora de física', attrs: { tec: 3, per: 2 }, traits: ['supersticioso', 'ojoagudo'],
    lines: {
      start: ['«Fisión, desintegración, vida mutante… mis alumnos no me creerían.»', '«Recordad: la dosis depende del tiempo, la distancia y el blindaje.»'],
      kill: ['«Interesante… muy interesante.»'],
      hurt: ['«Esto no estaba en el libro de texto.»'],
      extract: ['«Tengo material para diez cursos.»'],
      rad: ['«Estoy recibiendo una dosis que pondría en mis exámenes.»'],
    },
  },
  ingeniera: {
    name: 'Ingeniero de turbinas', nameF: 'Ingeniera de turbinas', attrs: { tec: 3, fue: 1, agu: 1 }, traits: ['carronero', 'minero'],
    lines: {
      start: ['«Yo estaba en la prueba de la turbina. Sé exactamente qué salió mal.»', '«Esta sala la diseñó mi equipo. No la reconozco.»'],
      kill: ['«Avería reparada.»'],
      hurt: ['«Necesito… recalibrarme.»'],
      extract: ['«La turbina gira otra vez. Por así decirlo.»'],
      rad: ['«Los valores están fuera de escala.»'],
    },
  },
  preso: {
    name: 'Preso político conmutado', nameF: 'Presa política conmutada', attrs: { agi: 2, agu: 2, per: 1 }, traits: ['nervioso', 'bruto', 'fumador'],
    lines: {
      start: ['«Diez años en Perm o esto. Elegí esto. Todavía no sé si bien.»', '«Aquí abajo nadie lee los expedientes.»'],
      kill: ['«Un camarada menos.» Sonríe torcido.'],
      hurt: ['«En el campo pegaban más fuerte.»'],
      extract: ['«Un día menos de condena.»'],
      rad: ['«En el gulag por lo menos el frío era limpio.»'],
    },
  },
  deportista: {
    name: 'Deportista olímpico', nameF: 'Deportista olímpica', attrs: { agi: 3, fue: 2 }, traits: ['agil'],
    lines: {
      start: ['«Moscú 80. Bronce en pentatlón. Esto es otra prueba más.»', '«Calentad. Lo digo en serio.»'],
      kill: ['«Récord personal.»'],
      hurt: ['«Solo es un tirón…»'],
      extract: ['«Meta.»'],
      rad: ['«Esto no lo detecta el control antidopaje.»'],
    },
  },
  cazador: {
    name: 'Cazador siberiano', nameF: 'Cazadora siberiana', attrs: { pun: 2, per: 3 }, traits: ['ojoagudo', 'tirador'],
    lines: {
      start: ['«En la taiga los lobos avisan antes de atacar. Estos no.»', '«Pisad donde piso yo.»'],
      kill: ['«Buena pieza.»', '«Limpio.»'],
      hurt: ['«Un oso me hizo algo parecido en Tunguska.»'],
      extract: ['«La caza ha terminado por hoy.»'],
      rad: ['«El bosque de aquí arriba también está enfermo.»'],
    },
  },
  enfermera: {
    name: 'Enfermero de Kiev', nameF: 'Enfermera de Kiev', attrs: { tec: 2, agu: 2, per: 1 }, traits: ['sanitario'],
    lines: {
      start: ['«En el Hospital n.º 6 de Moscú vi lo que hace la radiación. No voy a dejar que os pase.»', '«Si alguien sangra, que avise. Aunque sea poco.»'],
      kill: ['«Lo siento. De verdad.»'],
      hurt: ['«Médico, cúrate a ti mismo…»'],
      extract: ['«Todos vivos. Eso es lo que importa.»'],
      rad: ['«Necesito yodo. Ahora.»'],
    },
  },
  tanquista: {
    name: 'Conductor de tanque', nameF: 'Conductora de tanque', attrs: { fue: 2, agu: 2, tec: 1 }, traits: ['robusto', 'fumador'],
    lines: {
      start: ['«Echo de menos mi T-62. Tenía blindaje.»', '«Avanzamos. Nadie se queda atrás.»'],
      kill: ['«Aplastado.»'],
      hurt: ['«Brecha en el blindaje.»'],
      extract: ['«Retirada ordenada.»'],
      rad: ['«En el tanque por lo menos había filtros.»'],
    },
  },
  operador: {
    name: 'Operador de la central', nameF: 'Operadora de la central', attrs: { tec: 2, agu: 3 }, traits: ['liquidador', 'supersticioso'],
    lines: {
      start: ['«Yo estaba en el turno de noche del 25. Nos dijeron que pulsáramos AZ-5.»', '«Conozco cada pasillo. O los conocía.»'],
      kill: ['«Barras de control insertadas.»'],
      hurt: ['«Igual que aquella noche…»'],
      extract: ['«Fin del turno.»'],
      rad: ['«Tres mil seiscientos roentgen. No, no es posible.»'],
    },
  },
  koljosiano: {
    name: 'Koljosiano de Polesia', nameF: 'Koljosiana de Polesia', attrs: { fue: 2, agu: 1, per: 2 }, traits: ['supersticioso', 'carronero'],
    lines: {
      start: ['«Mi abuela decía que en estos bosques vivían espíritus. Tenía razón.»', '«Evacuaron mi aldea en tres horas. Dejé las vacas atrás.»'],
      kill: ['«Que el diablo se lo lleve.»'],
      hurt: ['«Babushka, reza por mí.»'],
      extract: ['«A casa. Bueno, a lo que queda.»'],
      rad: ['«Las setas de aquí también brillan.»'],
    },
  },
};
export const bgName = (a) => { const b = BACKGROUNDS[a.bg]; return b ? (a.female ? b.nameF : b.name) : ''; };
