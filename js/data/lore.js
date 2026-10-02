// Textos narrativos: notas encontradas, radio y supervivientes
export const NOTES = [
  { t: '«26-IV-1986, 01:30. El techo de la sala de turbinas ha desaparecido. Hay trozos de grafito en el suelo y brillan. Akímov dice que el reactor está intacto. Miente.»', a: 'Diario de un operario' },
  { t: '«Orden n.º 147: queda terminantemente prohibido mencionar a los "animales anómalos" en cualquier informe escrito.»', a: 'Comité Estatal' },
  { t: '«Las ratas ya no huyen de la luz. Ayer una se quedó mirándome. Juro que me miró.»', a: 'Nota garabateada' },
  { t: '«Muestra 12: el musgo crece 4 cm por hora en presencia de la fuente. Se desplaza hacia el calor corporal.»', a: 'Laboratorio dosimétrico' },
  { t: '«Mamá, aquí abajo hace frío y los dosímetros se han roto. Dicen que mañana subimos. Dile a Lena que le llevaré una piedra que brilla.»', a: 'Carta sin enviar' },
  { t: '«Si encuentras esto: no dispares cerca de los esporangios. No respires. Corre.»', a: 'Escrito en la pared' },
  { t: '«El camarada Topolev cree que la esencia es una forma de vida. El Instituto cree que es energía. Yo creo que nos está mirando.»', a: 'Informe interno' },
  { t: '«Turno de noche. Los lobos aúllan bajo el suelo. Ningún lobo de Polesia tenía escamas.»', a: 'Guardia del perímetro' },
  { t: '«Nivel de radiación: fuera de escala. El aparato marca 3,6 roentgen porque no puede marcar más.»', a: 'Cuaderno de dosimetría' },
  { t: '«Hemos visto a un hombre alto envuelto en ceniza. Los lobos le seguían como perros. Llevaba una placa de operario.»', a: 'Testimonio de un bombero' },
  { t: '«Para quien venga después: los cristales cantan antes de disparar. Escucha.»', a: 'Nota de un liquidador' },
  { t: '«Sopa de remolacha, pan negro y 100 gramos de vodka por persona. Contra la radiación, dicen.»', a: 'Menú del comedor' },
  { t: '«Estado del bloque 4: inaccesible. Estado de la tripulación del turno: [TACHADO].»', a: 'Parte oficial' },
  { t: '«La piedra se movió. No fue un derrumbe. La piedra se levantó y caminó.»', a: 'Diario de un minero' },
  { t: '«Todo lo que te lleves al subir es tuyo. Todo lo que pierdas abajo se lo queda la Zona.»', a: 'Dicho de los liquidadores' },
  { t: '«El corium ya no se enfría. Late. Cada cuarenta minutos, como un corazón.»', a: 'Informe del Sarcófago' },
  { t: '«Los pájaros caen del cielo como piedras. Luego se levantan. Y vuelven a volar.»', a: 'Cuaderno de un ornitólogo' },
  { t: '«He enterrado la llave de mi taquilla junto al montacargas oeste. Si no vuelvo, lo que hay dentro es para quien la encuentre.»', a: 'Nota doblada' },
];

export const RADIO = [
  '«...crrk... Pripyat-7, aquí Vyshgorod, ¿me reciben?... crrk...»',
  '«Dosimetría informa: el viento ha rolado al noroeste. Nubes sobre Gómel.»',
  '«...repito: no tocar los cristales con las manos desnudas...»',
  '«Los helicópteros siguen echando arena y plomo sobre el reactor. Mil ochocientas toneladas.»',
  '«...ssshhh... se oye cantar a alguien en los canales... ssshhh...»',
  '«Moscú pregunta por los resultados. El Dr. Topolev pide paciencia.»',
  '«Aviso del Comité: toda la esencia recuperada es propiedad del Estado.»',
  '«...la evacuación de Prípiat se ha completado. Solo quedamos nosotros...»',
  '«Detectados movimientos sísmicos menores bajo el bloque 4. Probablemente nada.»',
  '«...crrk... ¿Quién anda ahí? ¡Identifíquese!... crrk...»',
];

export const SURVIVOR_LINES = [
  'Un liquidador herido, atrapado aquí abajo desde hace días. Tiene los labios agrietados y un dosímetro roto colgado del cuello.',
  'Un bombero de la primera noche. Sus quemaduras no se han curado. Os mira como si fuerais un espejismo.',
  'Una técnica del laboratorio dosimétrico, escondida tras unas taquillas. Aprieta contra el pecho una carpeta de documentos.',
  'Un soldado de la defensa civil, sin munición y con la mirada perdida. Repite en voz baja los nombres de su pelotón.',
];

// Diarios de otras expediciones (fase 18): idioma original y traducción al leerlos
export const FOREIGN_NOTES = [
  { lang: 'inglés', o: 'Day 4. Sgt. Miller says the glowing stuff is worth more than gold. Langley wants samples, not questions.', t: 'Día 4. El sargento Miller dice que esa cosa brillante vale más que el oro. Langley quiere muestras, no preguntas.', a: 'Diario de un operador, Operación «Nightingale»' },
  { lang: 'inglés', o: 'They don\'t die when you shoot them. They just get… angrier. Request extraction. Request extraction.', t: 'No mueren cuando les disparas. Solo se… enfadan más. Solicito extracción. Solicito extracción.', a: 'Radiograma sin enviar, destacamento «Saxon»' },
  { lang: 'alemán', o: 'Die Dosimeter zeigen Werte, die es nicht geben dürfte. Genosse Major sagt, wir sollen sie nicht aufschreiben.', t: 'Los dosímetros marcan valores que no deberían existir. El camarada mayor dice que no los apuntemos.', a: 'Cuaderno de campo, Expedición «Wismut»' },
  { lang: 'alemán', o: 'Heute Nacht hat Klaus im Schlaf gesungen. Ein Lied, das keiner von uns kennt. Die Wände haben mitgesummt.', t: 'Esta noche Klaus ha cantado dormido. Una canción que ninguno conoce. Las paredes tarareaban con él.', a: 'Diario de una científica de Wismut' },
  { lang: 'sueco', o: 'Vi mätte molnet i Forsmark innan Moskva erkände något. Nu står vi vid källan, och källan andas.', t: 'Medimos la nube en Forsmark antes de que Moscú admitiera nada. Ahora estamos en el origen, y el origen respira.', a: 'Equipo «Forsmark», cuaderno de mediciones' },
  { lang: 'finés', o: 'Lumi olisi parempi. Täällä tuhka sataa ylöspäin.', t: 'La nieve sería mejor. Aquí la ceniza cae hacia arriba.', a: 'Nota a lápiz, misión «Sisu»' },
  { lang: 'checo', o: 'Odstřelili jsme štolu číslo tři. Za ní byla další štola, kterou nikdo nekopal.', t: 'Volamos la galería número tres. Detrás había otra galería que nadie había excavado.', a: 'Parte de voladura, grupo «Tatra»' },
  { lang: 'serbocroata', o: 'Prodao sam Amerikancu kartu za tri boce viskija. Karta je bila lažna. Viski nije.', t: 'Le vendí al americano un mapa por tres botellas de whisky. El mapa era falso. El whisky no.', a: 'Libreta de cuentas de un comerciante yugoslavo' },
  { lang: 'español', o: 'Mamá: aquí no hay sol ni mar, pero los niños de Kiev nos sonríen. Mañana bajamos otra vez. No te preocupes.', t: 'Mamá: aquí no hay sol ni mar, pero los niños de Kiev nos sonríen. Mañana bajamos otra vez. No te preocupes.', a: 'Carta sin enviar, Brigada «Playa Girón»' },
  { lang: 'inglés', o: 'Asset ZARYA confirmed. Topolev project codename ASH. Recover all documents. Leave no witnesses.', t: 'Fuente ZARYA confirmada. Proyecto Topolev, nombre en clave CENIZA. Recuperar todos los documentos. No dejar testigos.', a: 'Orden cifrada de la CIA (descifrada)' },
];
