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

// ---------------------------------------------------------------- fase 20.6: colecciones de notas
// Cada nota de NOTES pertenece a una colección (campo col). Completar una colección da una recompensa.
export const COLLECTIONS = {
  operario: { name: 'Diario del operario de turno', reward: { rub: 300 }, desc: 'Las últimas horas del turno de noche del 25 al 26 de abril.' },
  objeto7: { name: 'Expedientes del Objeto 7', reward: { ess: 80, trust: -5 }, desc: 'Lo que el KGB quería olvidar.' },
  cartas: { name: 'Cartas de Prípiat', reward: { stress: -20 }, desc: 'Lo que la gente escribió antes de irse para siempre.' },
  cia: { name: 'Informes de la CIA traducidos', reward: { rub: 500, rep: ['kgb', 12] }, desc: 'Operación «Nightingale», de puño y letra de Langley.' },
  liquidadores: { name: 'Partes de los liquidadores', reward: { item: 'ozk', nm: 'Traje OZK «del cabo Shevchuk»' }, desc: 'Órdenes, dichos y consejos de los que bajaron primero.' },
  fauna: { name: 'Cuaderno de campo de la fauna', reward: { ess: 60 }, desc: 'Observaciones de lo que ya no son animales.' },
  ceniza: { name: 'El evangelio de la Ceniza', reward: { item: 'ashrosary', nm: 'Rosario del primer sacerdote' }, desc: 'Las escrituras de la Congregación.' },
  corazon: { name: 'El corazón del reactor', reward: { ess: 120, trust: 5 }, desc: 'Mediciones, sueños y latidos bajo el bloque 4.' },
};
// colección de las 18 notas originales (por índice)
const ORIG_COL = ['operario', 'liquidadores', 'fauna', 'fauna', 'cartas', 'ceniza', 'objeto7', 'fauna', 'operario', 'ceniza', 'liquidadores', 'cartas', 'operario', 'corazon', 'liquidadores', 'corazon', 'fauna', 'liquidadores'];
ORIG_COL.forEach((c, i) => { if (NOTES[i]) NOTES[i].col = c; });
const N = (col, a, t) => NOTES.push({ col, a, t });
// Diario del operario de turno
N('operario', 'Diario de un operario', '«25-IV, 23:10. Nos han retrasado la prueba de la turbina diez horas. Djatlov grita. Nadie se atreve a contradecirle.»');
N('operario', 'Diario de un operario', '«00:28. La potencia ha caído a treinta megavatios. Toptunov dice que no puede subirla. Le obligan a sacar las barras.»');
N('operario', 'Diario de un operario', '«01:23:04. Empieza la prueba. Me tiemblan las manos y no sé por qué.»');
N('operario', 'Diario de un operario', '«01:23:40. Akímov pulsa el AZ-5. El botón rojo. Lo vi. Lo vi pulsarlo. Después todo tembló.»');
N('operario', 'Diario de un operario', '«02:15. Hay grafito en el tejado. Grafito. Del núcleo. Me dicen que es imposible. Lo tengo en la bota.»');
N('operario', 'Diario de un operario', '«04:00. Me sangran las encías. Valera no ha vuelto de la sala de bombas. Nadie va a buscarlo.»');
N('operario', 'Diario de un operario', '«26-IV, mañana. Nos llevan al hospital n.º 126. En el autobús, alguien dice que el reactor ha brillado azul. Como un ojo.»');
// Expedientes del Objeto 7
N('objeto7', 'Expediente KGB · Objeto 7', '«1957. Accidente de Kyshtym. Entre los restos del tanque 14 se recupera un tejido que no se descompone. Clasificado: Muestra n.º 7.»');
N('objeto7', 'Expediente KGB · Objeto 7', '«1964. La Muestra n.º 7 duplica su masa expuesta a cobalto-60. Se recomienda trasladarla a una instalación con mayor flujo neutrónico.»');
N('objeto7', 'Expediente KGB · Objeto 7', '«1969. Reclutamiento del físico A. S. Topolev para el programa «Ceniza». Perfil: brillante, idealista, controlable.»');
N('objeto7', 'Expediente KGB · Objeto 7', '«1973. Primer sujeto de ensayo con exposición a la Muestra. El sujeto deja de necesitar dormir. Al tercer mes, deja de necesitar comer.»');
N('objeto7', 'Expediente KGB · Objeto 7', '«1979. Solicitud de suspensión del programa, firmada por A. S. Topolev. Denegada. Anotación al margen: «vigilar».»');
N('objeto7', 'Expediente KGB · Objeto 7', '«1982. Traslado de la Muestra n.º 7 a la central V. I. Lenin, bloque 4, nivel −4. Motivo: flujo neutrónico óptimo.»');
N('objeto7', 'Expediente KGB · Objeto 7', '«Abril de 1986. La Muestra solicita (sic) una prueba de potencia. El informe no explica cómo «solicita» algo un tejido.»');
N('objeto7', 'Expediente KGB · Objeto 7', '«27-IV-1986. Se sella el Objeto 7. El personal científico se considera prescindible. No se informará a Moscú.»');
N('objeto7', 'Nota a mano', '«La llave del archivo del director está en la caja fuerte de la sala de muestras. La combinación es la fecha de Kyshtym.»');
// Cartas de Prípiat
N('cartas', 'Carta sin enviar', '«Querida Ania: mañana nos vamos «tres días», dicen. Te dejo las llaves con la vecina del cuarto. Riega el ficus.»');
N('cartas', 'Carta sin enviar', '«Mamá, papá: no os preocupéis. Han puesto autobuses para todos. Me llevo el acordeón y la foto de la boda.»');
N('cartas', 'Postal de Prípiat', '«Saludos desde la ciudad más joven de la URSS. El 1 de mayo abren la noria. ¡Ven a verla!» (La noria nunca se abrió.)');
N('cartas', 'Carta de un niño', '«Querido Abuelo Frío: este año quiero una bici roja. Mi gato se llama Barsik. Si no volvemos, ¿le cuidas tú?»');
N('cartas', 'Carta de amor', '«Te esperé en el parque hasta que los soldados me echaron. Si lees esto, sigo esperándote. En Kiev, en casa de mi tía.»');
N('cartas', 'Nota en una puerta', '«Bloque 17, piso 6. No toquen el piano. Es de mi madre. Volveremos.»');
N('cartas', 'Carta sin enviar', '«Me han dicho que el polvo amarillo de los balcones es polen. Mienten. El polen no hace que se te caiga el pelo.»');
N('cartas', 'Diario de una maestra', '«Escuela n.º 3. Hoy no ha venido nadie a clase. Les he dejado deberes en la pizarra, por si vuelven.»');
// Informes de la CIA traducidos
N('cia', 'Informe CIA (traducido)', '«Asunto: CHERNOBYL-7. Fuente ZARYA confirma la existencia de un agente biológico de origen desconocido bajo la unidad 4.»');
N('cia', 'Informe CIA (traducido)', '«Operación NIGHTINGALE autorizada. Objetivo: muestras del agente y documentación del programa ASH (CENIZA).»');
N('cia', 'Informe CIA (traducido)', '«El sujeto TOPOLEV, A. S., es la llave. Prioridad: captura. Alternativa aceptable: eliminación.»');
N('cia', 'Informe CIA (traducido)', '«Las fuerzas soviéticas en la zona son mínimas. Los mutantes, no. Bajas estimadas: inaceptables. Proceder.»');
N('cia', 'Informe CIA (traducido)', '«Equipo Delta-3 informa: el material responde a la presencia humana. Se acerca. Recomendamos no tocarlo con las manos.»');
N('cia', 'Informe CIA (traducido)', '«Langley pregunta si el agente puede usarse como arma. Respuesta del jefe de equipo: «Ya lo están usando contra nosotros».»');
N('cia', 'Informe CIA (traducido)', '«Contacto con los británicos (SAXON). Compartimos inteligencia, no muestras. Las muestras son nuestras.»');
N('cia', 'Informe CIA (traducido)', '«Delta-3 no responde desde hace 48 horas. Último mensaje: «Las paredes se mueven».»');
N('cia', 'Informe CIA (traducido)', '«Plan de exfiltración: helicóptero sin marcas desde Duga-3. Ventana: 4 minutos. Quien no llegue, se queda.»');
N('cia', 'Informe CIA (traducido)', '«Nota personal del agente WALLACE: «Si alguien encuentra esto, decid a mi hija que papá vio la aurora boreal. Más o menos».»');
// Partes de los liquidadores
N('liquidadores', 'Parte de los liquidadores', '«Tejado del bloque 3. Turnos de 90 segundos. Una palada de grafito y fuera. El que se queda más, no baja por su pie.»');
N('liquidadores', 'Parte de los liquidadores', '«Los robots alemanes se han vuelto locos con la radiación. Ahora los robots somos nosotros. «Biorrobots», nos llaman.»');
N('liquidadores', 'Dicho de los liquidadores', '«El dosímetro que no pita está roto. El que pita mucho, también. Fíate de tus encías.»');
N('liquidadores', 'Dicho de los liquidadores', '«Antes de bajar: un trago, un rezo y una broma. Si te falta uno de los tres, no bajes.»');
N('liquidadores', 'Parte de los liquidadores', '«Los mineros de Tula excavan bajo el reactor desnudos por el calor. Ni una queja. Ni una.»');
N('liquidadores', 'Nota de un liquidador', '«He visto a los perros de Prípiat. Los que dejamos atrás. Los soldados tienen orden de matarlos. Yo no he podido.»');
// Cuaderno de campo de la fauna
N('fauna', 'Cuaderno de un zoólogo', '«Las ratas espinosas viven en grupos de cinco. Siempre cinco. Si matas a una, otra aparece en menos de una hora.»');
N('fauna', 'Cuaderno de un zoólogo', '«Los lobos de grafito no comen carne. Comen radiación. La carne es solo… el envoltorio.»');
N('fauna', 'Cuaderno de un zoólogo', '«Las polillas de ceniza siguen la luz, pero no la de las lámparas: la de la esencia. Una linterna no las engaña.»');
N('fauna', 'Cuaderno de un zoólogo', '«El musgo errante se mueve hacia el calor de los cuerpos. Despacio. Con paciencia. Como si supiera que acabaremos durmiendo.»');
N('fauna', 'Cuaderno de un zoólogo', '«Los cuervos de plomo no vuelan alto: pesan demasiado. Pero se lanzan desde los tejados como piedras con pico.»');
N('fauna', 'Cuaderno de un zoólogo', '«Hipótesis: todos los chebylitas son una sola cosa. Una sola. Con muchos cuerpos. Y la Raíz-madre es la cabeza.»');
// El evangelio de la Ceniza
N('ceniza', 'Evangelio de la Ceniza, I', '«Al principio fue la Luz Azul, y la Luz Azul vio que la carne era débil, y la Luz Azul dijo: cambiad.»');
N('ceniza', 'Evangelio de la Ceniza, II', '«Bienaventurados los que se cubren de ceniza, porque los hijos de la Luz no los morderán.»');
N('ceniza', 'Evangelio de la Ceniza, III', '«El Pastor guía a los lobos. Nosotros guiamos al Pastor. Y la Raíz nos guía a todos.»');
N('ceniza', 'Evangelio de la Ceniza, IV', '«No temáis al dosímetro. El dosímetro mide la gracia.»');
N('ceniza', 'Evangelio de la Ceniza, V', '«Cuando el Útero se abra, la ceniza caerá hacia arriba y los muertos de abril volverán a respirar.»');
N('ceniza', 'Himno de la Ceniza', '«Arde, arde, corazón de grafito; canta, canta, raíz de cristal; abre, abre, vientre de fuego…» (La letra sigue durante tres páginas.)');
N('ceniza', 'Diario de un acólito', '«Hoy me han dejado tocar al lobo. No me ha mordido. El hermano Ilyá dice que es porque ya no huelo a hombre.»');
N('ceniza', 'Diario de un acólito', '«El sacerdote canta y los chebylitas escuchan. Yo también escucho. Ya no recuerdo el nombre de mi madre.»');
// El corazón del reactor
N('corazon', 'Informe del Sarcófago', '«Temperatura de la masa de corium: 1.200 °C y subiendo, aunque no hay fisión. Algo la calienta desde dentro.»');
N('corazon', 'Informe del Sarcófago', '«La pata de elefante ha crecido 11 cm este mes. Los físicos dicen que es imposible. La cinta métrica no está de acuerdo.»');
N('corazon', 'Cuaderno de un sismólogo', '«Latido registrado cada 40 minutos, 3,1 Hz. Coincide con el ritmo cardiaco de un mamífero grande en reposo.»');
N('corazon', 'Cuaderno de un sismólogo', '«El latido se acelera cuando hay gente cerca. Se acelera más cuando hay gente con miedo.»');
N('corazon', 'Sueño apuntado por un soldado', '«He soñado con una mujer azul que me pedía que la sacara. Hoy lo han soñado otros cuatro de la compañía.»');
N('corazon', 'Nota del Dr. Topolev', '«No es un reactor lo que explotó. Fue una cáscara lo que se rompió. Y lo que había dentro lleva cuarenta años esperando.»');
N('corazon', 'Nota del Dr. Topolev', '«Si alguien baja al Útero, que lleve plomo, boro y una decisión tomada. Allí abajo no se piensa bien.»');
N('corazon', 'Informe del Sarcófago', '«Noviembre de 1986: el sarcófago está terminado. Hormigón, acero y plomo. Dentro, el latido sigue.»');

// ---------------------------------------------------------------- fase 20.6: más radio e interceptaciones
RADIO.push(
  '«Pripyat-7, aquí Moscú. Esperamos el informe semanal. No se retrasen.»',
  '«…los niños de Kiev han sido enviados a campamentos de pioneros. Repito: es una medida de precaución…»',
  '«Atención: helicóptero Mi-8 sobre el sector 4. No disparen a las luces, son nuestros.»',
  '«Dosimetría: lluvia prevista esta tarde sobre el Bosque Rojo. Eviten las zonas abiertas.»',
  '«…ssshh… ¿alguien más oye el latido? Cada cuarenta minutos… ssshh…»',
  '«El Comité recuerda: el pánico es el arma del enemigo.»',
  '«…Radio Kiev: los mineros de Tula siguen excavando bajo el reactor. Su heroísmo no será olvidado…»',
  '«Kravets a todas las unidades: si alguien encuentra cigarrillos americanos, que me los traiga. Para el expediente.»',
  '«Babai informa: el generador vuelve a funcionar. No toquen el cable rojo. Ni el azul.»',
  '«La Dra. Orlova pide que los agentes beban agua. Agua. No vodka. Agua.»',
  '«…crrk… unidad tres, ¿me copia? Unidad tres… crrk… unidad tres…»',
  '«Vyshgorod informa: columna de evacuación detenida por un control. Paciencia, camaradas.»',
  '«…música: «Million alyh roz»… los soldados la cantan en los camiones…»',
  '«Se recuerda que las setas del bosque no son comestibles. Ninguna. Nunca más.»',
  '«…el Pravda de mañana: «la situación está bajo control»…»',
  '«Aviso: un oso pardo ha sido visto cerca de Yanov. Es un oso normal. Probablemente.»',
  '«…crrk… aquí la granja de Kopachi… nadie ha venido a por las vacas… crrk…»',
  '«Topolev a los agentes: el que me traiga un cristal entero tendrá doble ración de chocolate.»',
  '«…interferencias en la banda de 10 MHz: la antena Duga vuelve a emitir. Nadie la ha encendido.»',
  '«El Comisario Zhdánov recuerda que escuchar emisoras extranjeras es delito.»',
  '«…el Estanque de refrigeración está a 30 grados. En mayo. Los peces flotan. Los grandes, no.»',
  '«Vuelos de reconocimiento: nubes de polvo sobre Narodichi. Distribuyan yoduro.»',
  '«…crrk… si alguien escucha esto, el andén del Metro-2 está inundado… crrk…»',
  '«Los bomberos de la primera noche están en Moscú, en el hospital n.º 6. Recemos por ellos, aunque esté prohibido.»',
  '«…se busca voluntario para el turno de noche en el tejado del bloque 3. Se paga triple.»',
  '«Pripyat-7: les llega un envío de botas de goma. Talla única: 46.»',
  '«…las chebylitas parecen evitar la luz roja. Es una observación, no una orden…»',
  '«El ingeniero jefe pide que nadie use los ascensores del bloque administrativo. Sobre todo, de noche.»',
  '«…crrk… repito: no son lobos… crrk… no son lobos…»',
  '«Moscú informa: la nube ha llegado a Suecia. Los suecos lo han detectado. Moscú lo niega.»',
);
// mensajes interceptados (fase 20.6): pistas sobre los alijos de otras facciones
export const INTERCEPTS = [
  { f: 'usa', t: '«Nightingale-2 a base: alijo de munición escondido en el sector {s}. Señal: dos piedras cruzadas.»' },
  { f: 'usa', t: '«Delta-3: dejamos el equipo pesado en {s}. Volveremos a por él al anochecer.»' },
  { f: 'uk', t: '«Saxon: cache at grid {s}. Claymores on approach.» (Alijo en el sector {s}; cuidado con las minas.)' },
  { f: 'rda', t: '«Wismut-3 an Zentrale: Vorräte in Sektor {s} versteckt.» (Suministros escondidos en el sector {s}.)' },
  { f: 'suecia', t: '«Forsmark: vi lämnade proverna i sektor {s}.» (Dejamos las muestras en el sector {s}.)' },
  { f: 'finlandia', t: '«Sisu: varasto sektorissa {s}.» (Almacén en el sector {s}.)' },
  { f: 'merodeadores', t: '«…el botín está en {s}, debajo de la chapa oxidada… que no se entere el Tuerto…»' },
  { f: 'desertores', t: '«Sargento a los suyos: las cajas del cuartel están en {s}. Nadie toca nada hasta que yo lo diga.»' },
  { f: 'contrabandistas', t: '«Vasyl, el material está en {s}. Ven solo. Trae los rublos.»' },
  { f: 'checos', t: '«Tatra: nálože uloženy v sektoru {s}.» (Cargas guardadas en el sector {s}.)' },
  { f: 'cuba', t: '«Brigada: las medicinas están en el sector {s}, compañeros. Tomad lo que necesitéis.»' },
  { f: 'culto', t: '«…las reliquias reposan en {s}, donde la Raíz canta… quien las toque, arderá…»' },
  { f: 'yugo', t: '«Prijatelji, la mercancía está en {s}. Cincuenta por ciento para el que la encuentre.»' },
  { f: 'usa', t: '«Wallace: el maletín de muestras está en {s}. Si no vuelvo, que lo recoja quien pueda.»' },
  { f: 'rda', t: '«Stasi, canal cifrado: documento comprometido oculto en {s}. Destruir si es necesario.»' },
  { f: 'uk', t: '«Saxon-2: sniper hide in {s}. Supplies left behind.» (Nido de tirador en {s}; quedan suministros.)' },
  { f: 'suecia', t: '«Forsmark: dosimetrar och mat i {s}.» (Dosímetros y comida en {s}.)' },
  { f: 'desertores', t: '«…quien encuentre la caja de {s} que la reparta. Hoy por ti, mañana por mí…»' },
  { f: 'merodeadores', t: '«…enterramos las botellas en {s}. Las buenas. Las de antes de la guerra…»' },
  { f: 'usa', t: '«Nightingale: intel package dead-dropped at {s}.» (Paquete de inteligencia dejado en {s}.)' },
];
