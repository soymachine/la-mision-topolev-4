# LA MISIÓN TOPOLEV — Plan de ampliación masiva

> Documento de diseño y hoja de ruta para hacer crecer el juego varias veces su tamaño actual.
> Se trabaja **fase a fase, en orden** (cada fase deja el juego jugable y probado).
> Convención de seguimiento: `[ ]` pendiente · `[~]` parcial · `[x]` hecho. Tamaño estimado: **S** (una sesión corta), **M** (una sesión), **L** (varias sesiones).
> Al terminar cada tarea: marcarla aquí, actualizar `admin.html` si hay contenido nuevo, actualizar las Instrucciones del juego, pasar `tests/smoke.cjs` y hacer commit.

---

## 0. Visión y principios

**Qué queremos:** que cada expedición cuente una historia distinta. Hoy el jugador baja, mata chebylitas y sube. Tras la ampliación debe poder **encontrarse con otras personas** (aliadas, neutrales u hostiles), **tomar decisiones morales**, **ver crecer a sus agentes como personajes** con nombre, carácter y relaciones, y **descubrir poco a poco el secreto del Dr. Topolev**.

**Pilares de diseño**
1. **Riesgo / recompensa:** todo lo nuevo debe crear decisiones del tipo «¿me arriesgo un poco más o salgo ya?».
2. **Narrativa emergente antes que guionizada:** sistemas (relaciones, reputación, estrés) que generen historias solas; el guion principal es la columna vertebral, no la carne.
3. **Sinergias:** cada sistema nuevo debe tocar al menos otros dos (por ejemplo, el perro robot interactúa con gadgets, talentos y facciones).
4. **Todo es dato:** el contenido nuevo vive en `js/data/` y aparece automáticamente en `admin.html`.
5. **ASCII ante todo:** cada zona, casilla, facción y compañero tiene glifo, color y animación propia.

**Restricciones técnicas a respetar**
- Sin proceso de compilación (módulos ES servidos tal cual en GitHub Pages).
- `localStorage` ≈ 5 MB: el guardado debe comprimirse antes de crecer el mundo persistente.
- Guardados antiguos deben migrarse (`SAVE_VERSION` + función `migrate`).
- Rendimiento: el render ya cachea el terreno; las nuevas capas (luz, niveles) deben seguir ese patrón.

---

## Resumen de fases

| Fase | Tema | Por qué en este orden | Tamaño |
|---|---|---|---|
| 13 | Cimientos técnicos | Todo lo demás depende de entidades genéricas, eventos, diálogos y guardado v2 | L |
| 14 | Victorias rápidas: maleta especial y talentos de agente | Mucho valor jugable con poco riesgo | M |
| 15 | Sistema RPG completo de agentes | Base para narrativa (personajes) y compañeros | L |
| 16 | Mundo: casillas con sentido, niveles verticales, luz y modificadores de zona | Hace que los mapas actuales y futuros sean más ricos | L |
| 17 | Nuevas zonas (superficie y subsuelo) | Usa todo lo de la fase 16 | L |
| 18 | Facciones humanas y otras expediciones | Requiere entidades genéricas, diálogos y zonas nuevas | L |
| 19 | Compañeros mecánicos y gadgets creativos | Perro robot, drones, torretas… sobre el sistema de entidades aliadas | L |
| 20 | Narrativa profunda | Arco principal, Topolev, relaciones, estrés, misiones | L |
| 21 | La base viva y la metaprogresión | Investigación, fabricación, cuotas, calendario, defensa de la base | L |
| 22 | Ecosistema y nuevos chebylitas | Élites, jefes con fases, mundo persistente | M |
| 23 | Combate táctico avanzado | Cobertura, sigilo, abatidos y rescate | M |
| 24 | Calidad, accesibilidad, modos de juego y longevidad | Pulido final y rejugabilidad | M |
| — | Banco de ideas | Ideas sueltas para el futuro | — |

---

## FASE 13 — Cimientos técnicos ✔

**Objetivo:** preparar el código para crecer sin romperse.

### 13.1 Reorganización del código de expedición (M)
- [x] Dividir `js/exp/expedition.js` (≈1500 líneas) en módulos: `combat.js` (disparo, daño, explosiones), `ai.js` (IA enemiga y de aliados), `use.js` (consumibles, lanzar, trampas), `environment.js` (gas, fuego, humo, radiación, pulso), `extraction.js`.
- [x] Mantener `Expedition` como fachada para no tocar la UI.

### 13.2 Entidades genéricas (L) — *pieza clave*
Hoy existen dos tipos de actor: agentes (`squad`) y chebylitas (`enemies`). Hace falta un tipo común:
```js
// entidad genérica en exp.actors
{ uid, kind: 'chebylita'|'human'|'drone'|'robot'|'turret'|'animal',
  faction: 'chebylitas'|'squad'|'rda'|'usa'|…, def: 'lobo'|'npc_nva_rifleman'|'laika_m'…,
  x, y, hp, hpMax, lvl, stats, equip?, bag?, ai: { mode, target, memory, orders }, status: { stun, poison, burn, buffs } }
```
- [x] Tabla de **actitudes entre facciones** (`data/factions.js`): `hostile | neutral | allied` dinámica (cambia con la reputación y con lo que pase en la partida).
- [x] Selección de objetivos generalizada: cualquier actor ataca a cualquier otro hostil (los chebylitas atacan también a los americanos; los aliados de la RDA disparan a los chebylitas).
- [x] Los humanos usan **armas reales del catálogo** (`ITEMS`) con su munición, y sueltan su equipo al morir.
- [x] Migrar `enemies` y los compañeros de escuadrón al nuevo sistema sin cambiar el comportamiento actual.
  - *Hecho:* registro común `ACTORS` (`data/actors.js` = chebylitas + humanos de `data/humans.js`), facción por actor, `relations` serializadas, `provoke()` al atacar a neutrales/aliados (−25 de reputación). Los humanos aún **no aparecen** en los mapas normales (llegan en la fase 18); se generan desde la consola de depuración (13.5).

### 13.3 Motor de eventos y diálogos (M)
- [x] `data/events.js`: eventos con **disparador** (entrar en zona, ver facción, turno N, objeto recogido, agente herido, día X en la base), **condiciones** (flags, reputación, relaciones) y **efectos** (dar objeto, cambiar reputación, abrir diálogo, generar actores, marcar flag).
- [x] `data/dialogs.js`: árboles de diálogo con opciones condicionadas (habilidad del agente, objeto en la mochila, reputación) → la UI ya tiene modales con botones (ver `openSurvivor`).
- [x] Estado narrativo global `S.flags` y por agente `a.flags`.
  - *Hecho:* motor en `core/events.js` (condiciones y efectos declarativos; cualquier valor puede ser una función), mezcla `exp/story.js` (`trigger`, cola de diálogos, se guardan con la expedición), ventana `ui/dialog.js` (teclas 1–9) usada también en la base (`S.pendingDialogs`). Disparadores: `expStart`, `enterSector`, `turn`, `seeFaction`, `pickup`, `agentHurt`, `kill`, `baseDay`. El superviviente ya es el diálogo `survivor` (con historia propia). Contenido inicial: radios de la RDA, EE. UU. y Suecia, visita del Comité, carta de la viuda y ~15 eventos ambientales.

### 13.4 Guardado v2 (M)
- [x] Compresión del guardado (LZ-string incrustado en `js/util/lz.js`, sin dependencias externas).
- [x] **3 ranuras de partida** + exportar/importar a archivo JSON (copia de seguridad).
- [x] `SAVE_VERSION = 2` con migración desde v1 (la partida v1 pasa a la ranura 1 y se guarda una copia `topolev_save_v1_backup`).

### 13.5 Herramientas de desarrollo (S)
- [x] Consola de depuración oculta (tecla `º` o `?debug` en la URL): teletransporte, generar actor, dar objeto, revelar mapa, saltar día.
- [x] Bot de pruebas ampliado: recorre cada zona nueva y prueba facciones, compañeros y eventos.
  - *Hecho:* `tests/systems.cjs` (18 comprobaciones: base, facciones, diálogos, superviviente, guardado, consola). Ampliarlo con cada zona y compañero nuevos.
- [x] Ampliar `admin.html` con secciones nuevas a medida que aparezcan (facciones, zonas, eventos, talentos).
  - *Hecho:* Facciones (con matriz de actitudes), Personas, Eventos y Diálogos. Seguir añadiendo secciones en cada fase.

---

## FASE 14 — Victorias rápidas ✔

### 14.1 Maleta especial «Contenedor de seguridad» (M)
**Idea:** una ranura de equipo nueva (`case`) con muy pocos huecos cuyos objetos **sobreviven aunque el agente muera**.

| Objeto | Huecos | Precio | Nivel | Particularidad |
|---|---|---|---|---|
| Maletín de plomo del KGB | 2 | 2 500 ₽ | 2 | — |
| Contenedor de titanio «Kolyma» | 3 | 6 000 ₽ | 3 | Admite pilas de munición/consumibles |
| Cápsula de esencia «Matrioska» | 4 | 12 000 ₽ + 400 ✦ | 5 | Además conserva el 25% de la esencia del agente si muere |

Reglas pensadas para evitar abusos:
- [x] Los objetos se **meten** en el contenedor durante la expedición (1 turno), pero **no se pueden sacar** hasta volver a la base («sellado»).
- [x] Si el agente muere, la radiobaliza del contenedor permite recuperarlo: los objetos vuelven al almacén y aparecen en el informe como «recuperado por la baliza».
- [x] Un contenedor solo por agente; los objetos legendarios/míticos de mayor tamaño (armas pesadas) no caben (`size` por categoría: armas 2 huecos, resto 1).
- [x] Mejora del módulo **Almacén** desbloquea los tipos superiores.
- [x] UI: ranura «CONTENEDOR» en EQUIPO y en el inventario de expedición, con candado ASCII `[▣]`.
  - *Hecho:* categoría `case` (`kgbcase`, `kolyma`, `matrioska`) con `it.vault`; reglas en `core/items.js` (`caseRefusal`: armas 2 huecos, sin armas pesadas, pilas solo en Kolyma/Matrioska). En expedición: arrastrar sobre la ranura → `stowItem` (1 turno), no se puede soltar ni cambiar. Al morir, `agentDies` devuelve contenedor + contenido al almacén (y el 25% de esencia con la Matrioska) y el informe lo muestra. En la base se llena y vacía libremente. Precio con esencia (`essCost`).

### 14.2 Puntos de talento al subir de nivel (M) — *adelanto de la fase 15*
- [x] Al subir de nivel, el agente gana **1 punto de atributo** y, cada 3 niveles, **elige 1 de 3 talentos** al azar (ver fase 15).
- [x] Pantalla «ASCENSO» en la base (los niveles subidos en expedición quedan pendientes de asignar).
  - *Hecho:* `data/talents.js` con 6 atributos (puntos extra sobre la base, máx. 10) y 20 talentos generales (estadísticas o los mismos efectos especiales que los gadgets; `flag()` toma el mejor). `a.attr`, `a.pts`, `a.talents`, `a.offers` (ofertas guardadas, no se re-tiran al recargar). Los reclutas veteranos llegan con todo repartido; las partidas antiguas reciben las ofertas de talento retroactivas. Marca ▲ en la lista de agentes. En la fase 15, los talentos generales se completan con los árboles de especialización y los atributos pasan al modelo 1–10.

---

## FASE 15 — Sistema RPG de agentes

### 15.1 Atributos (M)
Seis atributos de 1 a 10 (el rasgo y el trasfondo dan los valores iniciales):

| Atributo | Efecto |
|---|---|
| **Puntería** | +2% impacto por punto (ya existe) |
| **Agilidad** | esquiva (ya existe) y probabilidad de huir de cuerpo a cuerpo |
| **Fortaleza** | salud máxima, capacidad de carga (huecos), daño cuerpo a cuerpo |
| **Aguante** | resistencia a radiación, veneno y estrés |
| **Percepción** | visión, crítico, detectar trampas y enemigos dormidos antes |
| **Técnica** | uso de gadgets, compañeros mecánicos, desactivar minas, abrir cerraduras, minado |

- [ ] Migrar `acc`/`ev` actuales a este modelo.
- [ ] Nivel máximo 20; curva de XP revisada; XP también por descubrir, curar, extraer y cumplir misiones (no solo matar).

### 15.2 Especializaciones y talentos (L)
Al llegar a nivel 5 el agente elige una **especialización**. Cada una tiene un árbol de ~12 talentos pasivos en 3 ramas (se elige 1 de 3 opciones cada 3 niveles, estilo roguelite, con posibilidad de pagar para volver a tirar).

| Especialización | Fantasía | Ejemplos de talentos |
|---|---|---|
| **Tirador** | Mata desde lejos | «Paciencia» (+% al quedarse quieto, sinergia con bípode y prismáticos) · «Ojo de Zaitsev» (los críticos atraviesan) · «Tiro de gracia» |
| **Asalto** | Primera línea | «Fuego de cobertura» · «Ráfaga controlada» (+1 bala por ráfaga) · «Carga» |
| **Sanitario** | Mantiene vivo al grupo | «Manos firmes» (curar no gasta turno 1 vez/expedición) · «Triaje» (aura de regeneración) · «Rescate» (levanta abatidos) |
| **Zapador** | Explosivos, trampas, máquinas | «Bolsillos hondos» (+1 granada por pila) · «Minador» (trampas invisibles para enemigos inteligentes) · «Mecánico» (mejora al perro robot / dron) |
| **Liquidador** | Vive en la radiación | «Piel de plomo» · «Respiración contenida» (inmune al gas 3 turnos) · «Recolector» (+esencia en zonas radiactivas) |
| **Explorador** | Sigilo y información | «Paso de lince» (no despierta nidos) · «Cartógrafo» (revela sectores al entrar) · «Rastreador» |
| **Comisario** | Liderazgo | Auras de moral, reduce estrés del grupo, mejora relaciones, negociador con facciones |

- [ ] **Habilidades activas** (1 por especialización, con recarga en turnos): *Fuego de supresión* (enemigos en un cono pierden su turno), *Primeros auxilios de campaña*, *Colocar carga*, *Marcar objetivo* (+25% de impacto para todo el grupo), *Desaparecer* (sigilo 3 turnos), *¡Por la Patria!* (el grupo gana un turno extra de movimiento).
- [ ] Sinergias explícitas talento ↔ gadget ↔ mod (por ejemplo, «Paciencia» + bípode + prismáticos).

### 15.3 Trasfondos y rasgos (M)
- [ ] Trasfondo generado (minero del Donbás, bombero de Prípiat, veterano de Afganistán, profesora de física, ingeniera de turbinas, preso político conmutado, deportista olímpica…): da atributos iniciales, un rasgo y frases de diálogo propias.
- [ ] **Rasgos adquiridos** por experiencias: «Superviviente» (sobrevivir con <5% de salud), «Traumatizado por lobos», «Amigo de la RDA», «Fobia al agua», «Cazador de jefes»…
- [ ] **Heridas persistentes** (cicatriz: −1 en un atributo hasta tratarla en la Enfermería) y **condecoraciones** (Orden de la Estrella Roja, Medalla al Valor) con pequeños bonus.
- [ ] **Retiro de veteranos:** un agente de nivel alto puede retirarse como **instructor** (los novatos ganan +X% de XP) — alternativa a perderlo.

---

## FASE 16 — Mundo: casillas con sentido y nuevas reglas de mapa

### 16.1 Casillas nuevas con mecánica (L)
Cada casilla tiene propósito táctico, no solo decorativo:

| Casilla | Glifo | Mecánica |
|---|---|---|
| Sacos terreros | `▄` | **Cobertura media** (−25% a impactos desde el otro lado) |
| Muro bajo / consola | `▬` | Cobertura media, bloquea movimiento |
| Barril de combustible | `◘` | Se puede disparar: explota (radio 2) e incendia |
| Charco de aceite | `≋` | Inflamable; resbala (cuesta 2 turnos cruzarlo) |
| Pasarela metálica | `═` | Hace ruido al pisarla (despierta nidos) |
| Cristales rotos | `∴` | Ruido al pisar; los exploradores la cruzan en silencio |
| Arena / serrín | `░` | Silencia los pasos |
| Tubería de vapor | `║` | Quema a quien esté al lado si se rompe (disparo) |
| Puerta blindada | `▓` | Necesita tarjeta, Técnica alta o equipo de soldadura |
| Terminal | `▣` | Hackear (Técnica): abre puertas, enciende luces, desactiva torretas |
| Interruptor de energía | `¥` | Ilumina un sector entero (más visión, pero los enemigos te ven) |
| Ventilador industrial | `✣` | Dispersa el gas cercano |
| Montacargas | `↕` | Conecta con el nivel inferior/superior (ver 16.2) |
| Sima | ` ` (vacío) | Caída al nivel inferior con daño; con cuerda se baja en seguridad |
| Escombros inestables | `▒` | Se derrumban con ruido alto → bloquean el paso y dañan |
| Grafito expuesto | `▪` | Radiación extrema; se recogen **muestras** (material de investigación) |
| Cristal de esencia incrustado | `✧` | Minable como una veta pequeña |
| Raíces de la Raíz-madre | `ψ` | Crecen cada pocos turnos y cierran pasillos |
| Hielo (invierno) | `·` blanco | Resbala; los agentes pueden caer |
| Vagoneta en raíles | `Ш` | Se empuja: transporta botín pesado o aplasta enemigos |
| Lámpara de emergencia | `☼` | Fuente de luz que se puede romper de un disparo |

- [ ] Sistema de **cobertura** (ver también fase 23) y de **objetos destructibles**.
- [ ] Cada nueva casilla, con su animación (vapor, chispas, parpadeo de lámparas).

### 16.2 Niveles verticales (L)
- [ ] Una zona puede tener **2–3 pisos** conectados por montacargas, escaleras y simas. Bajar aumenta el nivel de los enemigos y la calidad del botín (mismo dilema de riesgo, en vertical).
- [ ] Cada piso es un mapa generado; el minimapa muestra el piso actual y un selector.
- [ ] Las extracciones permanentes solo están en el piso superior: cuanto más bajas, más lejos queda la salida.

### 16.3 Luz y oscuridad (M)
- [ ] Mapa de luz por casilla: zonas iluminadas y oscuras. En la oscuridad, la visión baja a la mitad salvo con linterna, visor nocturno o bengalas.
- [ ] Las linternas encendidas **delatan** al agente (los enemigos lo ven desde más lejos). Se pueden apagar (tecla `L`): decisión entre sigilo y visión.

### 16.4 Modificadores de zona por expedición (M)
Cada día, cada zona sale con 0–2 modificadores (visibles al elegir destino), que cambian riesgo y recompensa:
- «Apagón» (sin luz, +botín), «Inundación» (más agua), «Tormenta electromagnética» (sin radar), «Plaga de esporas», «Nidos inquietos» (los nidos empiezan despiertos), «Veta madre» (×1,5 esencia), «Presencia extranjera» (facciones garantizadas), «Lluvia radiactiva» (superficie), «Niebla», «Pulso temprano».
- [ ] Contratos especiales con objetivo (ver fase 20) asociados a modificadores.

---

## FASE 17 — Nuevas zonas

Se añade el concepto de **estrato**: *Superficie* (cielo abierto, día/noche, clima) y *Subsuelo* (el actual). El selector de destinos pasa a ser un **mapa ASCII de la región de Chernóbil** con las zonas como puntos.

### 17.1 Superficie (L)
| Zona | Nv | Concepto | Casillas y mecánicas propias |
|---|---|---|---|
| **Prípiat, la ciudad dormida** | 2–3 | Bloques de viviendas, la noria, la piscina Azure, el supermercado, el hospital n.º 126 | Edificios con interior (entrar a pisos), coches oxidados como cobertura, columpios que chirrían (ruido), sótano del hospital con ropa de bombero muy radiactiva (botín valioso y peligroso) |
| **El Bosque Rojo** | 3–5 | Pinos muertos de color óxido y fosas de enterramiento de residuos | Pinos que tapan la visión a medias, tierra removida (radiación alta + objetos enterrados que se excavan), lianas chebylitas |
| **Estación de Yanov y depósito ferroviario** | 4–5 | Vagones, raíles y locomotoras | Vagones como contenedores grandes, pasillos largos entre trenes, vagonetas empujables, evento «tren fantasma» |
| **Cementerio de vehículos de Rassokha** | 5–6 | Helicópteros Mi-8, camiones y blindados usados por los liquidadores | Muy radiactivo pero lleno de **piezas** (material de fabricación); los blindados son refugios; robots de limpieza abandonados que se reactivan |
| **Radar Duga-3 «El Pájaro Carpintero»** | 6–7 | La gigantesca antena sobre el horizonte | Celosías metálicas, cables con anomalías eléctricas. **Mecánica:** activar la antena revela todo el mapa durante 30 turnos… y atrae a todo lo que hay |
| **Estanque de refrigeración** | 5–7 | Lago artificial junto a la central | Barcas para cruzar, plataformas, siluros chebylitas gigantes, islotes con alijos |

### 17.2 Subsuelo nuevo (L)
| Zona | Nv | Concepto |
|---|---|---|
| **Metro-2: la línea secreta** | 6–8 | Túneles de metro militares bajo la región. Andenes, vagones de metro y puertas estancas. Lugar de encuentro de **facciones** |
| **Campamento «Wismut» (RDA)** | 5–7 | Zona social **aliada**: comercio, encargos, rumores, enfermería. Se puede visitar sin combate (pero de noche…) |
| **Estación avanzada «Fénix» (EE. UU.)** | 7–9 | Base hostil camuflada: cámaras, alarmas, torretas y soldados de élite. Botín occidental y documentos de inteligencia |
| **Objeto 7: el laboratorio del KGB** | 7–9 | Instalación secreta anterior a 1986 con celdas de contención. **Aquí se revela el pasado del Dr. Topolev** |
| **Las Raíces** | 8–10 | Red de cavernas orgánicas de la Raíz-madre: las paredes respiran y el mapa cambia durante la expedición |
| **El Útero de Corium** | 10+ | Zona final bajo el reactor; jefe final de varias fases (ver fase 22) |

### 17.3 Zonas de evento temporales (M)
- [ ] Aparecen unos días y desaparecen: «Helicóptero estrellado» (caja negra), «Convoy perdido», «Avión espía derribado» (equipo estadounidense raro), «Nido migratorio», «Mercado negro clandestino».

---

## FASE 18 — Facciones humanas y otras expediciones

### 18.1 Facciones (L)

| Facción | País | Postura inicial | Comportamiento | Qué ofrece |
|---|---|---|---|---|
| **Expedición «Wismut»** | RDA | Aliada | Patrullas de 2–4 soldados de la NVA y un científico. Luchan contra los chebylitas a tu lado | Comercio (MPi-KM, munición, medicinas), encargos, información de mapa |
| **Brigada «Playa Girón»** | Cuba | Aliada | Médicos e ingenieros | Tratamientos baratos, recetas de medicinas |
| **Grupo «Tatra»** | Checoslovaquia | Aliada / neutral | Ingenieros de minas | Mods (vz.58, Škorpion), explosivos |
| **Equipo «Forsmark»** | Suecia | Neutral | Científicos que detectaron la nube; huyen si los atacas | Datos de radiación, compra de muestras a buen precio |
| **Misión «Sisu»** | Finlandia | Neutral | Exploradores muy sigilosos | Mapas, mochilas y ropa de abrigo |
| **Observadores no alineados** | Yugoslavia | Neutral | Comerciantes ambulantes | Mercado de todo un poco (precios variables) |
| **Operación «Nightingale»** | EE. UU. (CIA + Delta) | **Hostil a la vista** | Escuadras de élite con tácticas: cobertura, flanqueo, granadas, retirada. Roban esencia | M16A2, M60, Remington 870, M1911, visores nocturnos, documentos de inteligencia |
| **Destacamento «Saxon»** | Reino Unido | Hostil | Francotiradores y emboscadas | L42A1, SA80, trampas |
| **Merodeadores** | Locales | Hostil | Saqueadores mal armados que atacan en grupo y huyen | Botín robado, a veces rehenes |
| **Desertores del Ejército Rojo** | URSS | Hostil / negociable | Se puede negociar (Comisario) o reclutar a alguno | Armamento soviético, agentes reclutables |
| **La Congregación de la Ceniza** | — | Hostil | Culto que adora a los chebylitas; sus sacerdotes **controlan** chebylitas cercanos | Reliquias de esencia, lore |
| **KGB, Directorio 9** | URSS | «Aliado» vigilante | No aparece en combate: exige informes, castiga la colaboración con extranjeros | Presupuesto, acceso a zonas, misiones secretas |

### 18.2 Mecánicas de facción (L)
- [ ] **Reputación** −100…+100 por facción, visible en la base (sala de radio). Umbrales: hostil / desconfiada / neutral / amistosa / aliada.
- [ ] Neutrales que **se vuelven hostiles** si les disparas, si robas en sus alijos o si apuntas mucho tiempo a uno de ellos (aviso «¡Baja el arma, camarada!»).
- [ ] Aliados que **combaten a tu lado** contra chebylitas y estadounidenses; se pueden llamar con una bengala roja.
- [ ] **Combates entre terceros:** estadounidenses contra chebylitas, culto contra todos… El jugador puede esperar y rematar (y cosechar la esencia).
- [ ] **IA humana:** cobertura, retirada con poca salud, rendición (capturar prisioneros: dilema moral y reputación), uso de granadas, alertar al resto con radio.
- [ ] **Diálogos al encontrarse** (motor de la fase 13): intercambiar, compartir mapa, pedir ayuda, sobornar, amenazar, ignorar.
- [ ] **Restos de expediciones** en todas las zonas: campamentos abandonados (tiendas `Λ`, hogueras `*`, radios), cadáveres con equipo extranjero, cajas OTAN, diarios en inglés/alemán/sueco (traducidos al leerlos).
- [ ] **Equipo extranjero** (≈25 armas/objetos nuevos) con su propio tipo de munición (5,56 OTAN, 7,62 OTAN, .45 ACP, 9 mm Parabellum): escasa, solo de botín → dilema: ¿vale la pena usar un M16 sin repuestos?
- [ ] Repercusión política: si el KGB descubre que comercias con suecos o finlandeses, baja el presupuesto o envía a un **comisario** a la base.

---

## FASE 19 — Compañeros mecánicos y gadgets creativos

Se añade una ranura **COMPAÑERO** por agente (o por escuadrón) y un edificio **Garaje** en la base para mejorarlos y repararlos. Los compañeros son entidades aliadas (fase 13.2).

### 19.1 Perro robot «Laika-M» (L)
Homenaje a Laika: chasis de cuatro patas de la Academia de Ciencias.
- [ ] Sigue a su dueño, tiene **salud, blindaje y 4 huecos de almacén** propios (botín extra que sobrevive si el perro vuelve).
- [ ] **Órdenes:** seguir, quedarse (vigilar), buscar (va hacia el botín más cercano y lo trae), atacar.
- [ ] **Módulos intercambiables** (3 ranuras): ametralladora ligera montada (gasta munición 5,45), lanzabengalas, detector de chebylitas a distancia (los marca en el radar a 15 casillas), sensor de radiación (muestra los focos), botiquín (cura a los adyacentes), mandíbula hidráulica (cuerpo a cuerpo potente), blindaje de plomo.
- [ ] Si lo destruyen, deja un **chasis** recuperable; reparar en el Garaje cuesta rublos y piezas.
- [ ] Sinergias: talento «Mecánico» (Zapador), gadget «Mando a distancia» (+alcance de órdenes).

### 19.2 Drones (L)
| Dron | Rol | Detalles |
|---|---|---|
| **«Strizh» (golondrina)** | Reconocimiento | Vuela solo por el mapa, muy rápido (velocidad 250), sobre el agua; revela casillas y marca enemigos y POIs. Poca salud: los cuervos y los estadounidenses lo derriban. Batería de 40 turnos; vuelve solo si queda poca |
| **«Mula»** | Carga | Lleva hasta 3 objetos a la extracción más cercana y los **envía a la base** (una vez por expedición): otra forma de salvar botín |
| **«Kamikadze»** | Ataque | Se lanza contra un objetivo y explota (radio 2) |
| **«Eco»** | Señuelo | Emite ruido y luz: atrae chebylitas lejos del grupo |
| **«Relé»** | Radio | Mantiene el contacto con la base en zonas sin radar (anula la tormenta electromagnética) |

- [ ] Control: tecla `D` para lanzar o recoger; órdenes con clic en el minimapa.

### 19.3 Otros gadgets creativos (M)
- [ ] **Torreta desplegable «Gnomo»**: se coloca en una casilla y dispara sola (munición limitada); se recoge al irse.
- [ ] **Jaula de captura**: atrapa chebylitas pequeños **vivos** para la celda de contención de la base (investigación, fase 21).
- [ ] **Cámara Zenit-E**: fotografiar chebylitas completa su ficha en el bestiario → +% de daño contra esa especie.
- [ ] **Desfibrilador**: reanima a un agente **abatido** (fase 23) en 2 turnos.
- [ ] **Gancho y cuerda**: cruzar simas y bajar de nivel sin daño.
- [ ] **Equipo de soldadura**: abrir puertas blindadas y contenedores sellados (hace ruido).
- [ ] **Generador de ruido blanco**: los disparos no despiertan nidos durante 10 turnos.
- [ ] **Contador de centelleo**: muestra vetas y cristales a través de las paredes.
- [ ] **Grabadora de bobina**: graba el sonido de un chebylita y lo reproduce para atraer a los de su especie (o asustarlos con el de un depredador).
- [ ] **Sonda sísmica**: detecta minas, trampas y cavidades (simas ocultas).
- [ ] **Camuflaje de ceniza termoóptico** (prototipo): invisibilidad breve con recarga.
- [ ] **Paraguas antirradiación** (humor soviético): reduce la radiación de la lluvia en superficie.

---

## FASE 20 — Narrativa profunda

### 20.1 Arco principal en actos (L)
- **Acto I — «El Bloque»:** llegada, primeras zonas, el Dr. Topolev entusiasta. Gancho: las notas mencionan experimentos **anteriores** a la explosión.
- **Acto II — «Los otros»:** aparecen las expediciones extranjeras; el KGB presiona; los estadounidenses buscan algo concreto (¿la misma esencia?). Se descubre el Objeto 7.
- **Acto III — «El corazón»:** la Raíz-madre y el Útero de Corium. Revelación: el Dr. Topolev **ya conocía la esencia** y el «accidente» no fue del todo un accidente.
- **Final con decisiones** (3–4 finales según reputaciones, flags y relación con Topolev):
  - Entregar la esencia al Partido.
  - Destruir el Útero (sellar la central para siempre).
  - Huir a Occidente con las muestras.
  - Fusionarse con la esencia (final oculto del Dr. Topolev).
- [ ] Hitos con **escenas ASCII animadas** cortas (pantalla completa, texto mecanografiado, dibujo ASCII).

### 20.2 El Dr. Topolev y la base (L)
- [ ] El Dr. Topolev con personalidad y medidor de **confianza** (sube al cumplir sus encargos y bajar muestras; baja si mueren agentes por sus órdenes o si se le desobedece).
- [ ] **Personal de la base** con nombre y voz propia:
  - **Comisario Zhdánov:** cuotas, propaganda y amenazas; vigila la lealtad.
  - **Dra. Lyudmila Orlova:** la Enfermería; se preocupa por los agentes y cuestiona a Topolev.
  - **Sargento Kravets:** intendente con mercado negro propio.
  - **Mecánico «Babai»:** el Garaje, los drones y el perro.
- [ ] **Escenas en el comedor** entre expediciones: conversaciones cortas generadas con plantillas según quién ha sobrevivido, quién ha muerto y las relaciones.
- [ ] **Cartas** de las familias de los agentes (y que ellos escriben) y **epitafios** en el memorial.

### 20.3 Relaciones entre agentes (L)
- [ ] **Afinidad** por pareja de agentes (−100…+100): sube al extraer juntos, curarse entre ellos, salvar a otro abatido o compartir trinchera; baja por fuego amigo, dejar atrás a un compañero o competir por el botín.
- [ ] Estados: *camaradas*, *inseparables* (bonus al estar juntos: sinergia natural con los gadgets «juntos»), *rivales* (penalización si están juntos, bonus si compiten por bajas).
- [ ] La **muerte de un amigo** genera duelo (estrés y posible rasgo «Venganza»: +daño contra esa especie).

### 20.4 Estrés y moral (M)
- [ ] Barra de **estrés** 0–100: sube con la oscuridad, la radiación, ver morir a un compañero, los jefes o los ataques por sorpresa. Baja con descanso, la banya, el vodka (con riesgo de adicción), la música y los éxitos.
- [ ] Con estrés alto aparecen **aflicciones temporales** (pánico: huye un turno; paranoia: dispara a neutrales; temblor: −puntería) y, a veces, **virtudes** (heroísmo).

### 20.5 Misiones y contratos (M)
- [ ] Encargos de los personajes de la base y de las facciones: recuperar la caja negra de un helicóptero, escoltar a un científico sueco hasta una extracción, fotografiar al Pastor de Ceniza, capturar vivo un Lobo de grafito, sabotear la estación Fénix, encontrar a un agente desaparecido (¡vivo!).
- [ ] Recompensas: rublos, reputación, objetos únicos con nombre propio, piezas del arco principal.

### 20.6 Más contenido de texto (M)
- [ ] 80+ notas organizadas en **colecciones** (Diario del operario de turno, Expedientes del Objeto 7, Cartas de Prípiat, Informes de la CIA traducidos…): completar una colección da una recompensa.
- [ ] 60+ mensajes de radio, incluidos **mensajes interceptados** de otras facciones (pistas de dónde están sus alijos).
- [ ] La **crónica del director**: diario automático de la partida, exportable como texto.

---

## FASE 21 — La base viva y la metaprogresión

### 21.1 Base construible (L)
- [ ] La base pasa a ser un **plano ASCII** donde se colocan edificios en parcelas: Laboratorio, Enfermería, Armería, Garaje, Sala de radio, Banya, Comedor, Invernadero, Celda de contención, Refugio antirradiación, Taller de fabricación.
- [ ] Cada edificio con niveles (sustituye o amplía el sistema de módulos actual).

### 21.2 Investigación (L)
- [ ] **Árbol de investigación** que consume esencia, **muestras** (grafito, tejido chebylita, cristales) y **especímenes vivos** (jaula de captura): desbloquea objetos, mods, talentos y mejoras de compañeros.
- [ ] **Celda de contención:** los chebylitas capturados producen esencia pasiva cada día… con riesgo de **fuga** (evento de defensa de la base).

### 21.3 Fabricación (M)
- [ ] Materiales: chatarra, componentes electrónicos, tela de plomo, tejido chebylita, piezas de vehículo.
- [ ] Recetas (munición especial, medicinas, mods, mejoras de contenedor, piezas de drones). **Desmontar** objetos para obtener materiales.

### 21.4 Economía y política (M)
- [ ] **Cuotas mensuales** del Comité (esencia a entregar): cumplir da presupuesto; fallar trae inspecciones y recortes.
- [ ] **Mercado negro** del sargento Kravets: mejores precios, riesgo de que el KGB lo descubra.
- [ ] Precios que fluctúan según la demanda (vender mucho de lo mismo baja el precio).

### 21.5 Calendario y tiempo (M)
- [ ] Estaciones desde mayo de 1986: verano, **otoño de lluvia radiactiva**, **invierno** (frío, hielo, hipotermia; la superficie cambia).
- [ ] Eventos históricos como contexto (la construcción del sarcófago termina en noviembre de 1986 → cambia la zona del Sarcófago; mensajes de televisión en la base).

### 21.6 Defensa de la base (M)
- [ ] De vez en cuando, ataque a la base (chebylitas fugados, comandos estadounidenses, merodeadores): misión táctica corta en el plano de la base con los agentes que estén descansando.

### 21.7 Operaciones simultáneas (M)
- [ ] Enviar un **segundo escuadrón** de forma automática a zonas ya conocidas; el resultado se simula (botín, heridas, muertes) según su equipo y nivel.

---

## FASE 22 — Ecosistema y nuevos chebylitas

- [ ] **20+ chebylitas nuevos** por bioma: Liana de pino rojo, Siluro de Prípiat, Medusa de refrigeración, Velo de moho, Enjambre de cuarzo, Oso de grafito, Cigüeña de hierro, Perro de las fosas, **autómatas de chatarra** (robots de limpieza reactivados por la esencia: guiño a los robots reales usados en la limpieza) y Liquidador hueco (un traje vacío que camina).
- [ ] **Élites con afijos** al estilo de Diablo: Blindado, Veloz, Radiactivo, Vampírico, Engendrador, Explosivo al morir, Invisible, Escudero (protege a otros). Mayor botín.
- [ ] **Cadena alimentaria:** los lobos cazan ratas, los cuervos siguen a los lobos, la Raíz-madre atrae polillas. Se puede usar a favor (cebo).
- [ ] **Jefes con fases y patrones** (uno por zona nueva) y **trofeos** únicos.
- [ ] **Mundo persistente:** los nidos destruidos tardan días en volver; los no limpiados **crecen** y suben de nivel. «Nivel de alerta del reactor» global que sube con los días.

---

## FASE 23 — Combate táctico avanzado

- [ ] **Cobertura** media/total con indicador en el tooltip de impacto (`[▄]`) y **flanqueo** (+% si disparas por un lateral sin cobertura).
- [ ] **Sigilo real:** visibilidad según luz y movimiento, ataques por la espalda (crítico garantizado en cuerpo a cuerpo a enemigos que no te han visto), emboscadas.
- [ ] Estado **abatido**: al llegar a 0 de salud el agente queda en el suelo 3 turnos; un compañero puede **rescatarlo** (botiquín o desfibrilador). Hace las muertes menos súbitas y más dramáticas.
- [ ] **Fuego de supresión** y **munición especial** (perforante, incendiaria, expansiva, de esencia) como tipos de munición seleccionables.
- [ ] Opcional: **encasquillamientos** según el estado del arma y **durabilidad** (reparación en el taller).
- [ ] Granadas que **rebotan** en las paredes y se pueden devolver de una patada (talento).

---

## FASE 24 — Calidad, accesibilidad, modos y longevidad

- [ ] **Accesibilidad:** modo daltónico (las rarezas también con símbolo), remapeo de teclas, fuente con mayor contraste, controles táctiles (móvil y tableta).
- [ ] **Localización:** extraer todos los textos a `js/i18n/es.js` y preparar el inglés.
- [ ] **Música generativa** (drones de WebAudio que cambian con la zona y el peligro) y más efectos de sonido.
- [ ] **Logros** y **estadísticas** ampliadas.
- [ ] **Modos de juego:**
  - Historia, con el arco principal.
  - Libre (sandbox).
  - **Hierro**: una sola ranura de guardado, sin recargar.
  - **Desafío semanal** con semilla fija y tabla de puntuación local.
  - **Nueva partida+ «1987»**: modificadores acumulables y enemigos más duros.
- [ ] Enciclopedia dentro del juego (versión jugable de `admin.html` con lo ya descubierto).

---

## Banco de ideas (sin fase asignada)

- **Vehículos en superficie:** un UAZ-469 o un BRDM para viajar rápido entre puntos de la superficie (combustible limitado y ruido).
- **Animales normales** (caballos de Przewalski, alces) que no son hostiles: matarlos baja la moral del grupo.
- **Fotografía artística:** el bestiario y la crónica guardan «fotos» ASCII de momentos clave.
- **Clima subterráneo:** filtraciones de agua que inundan sectores durante la expedición.
- **Cartas de tarot soviéticas** (superstición de los agentes): bonus o penalización aleatorios al día.
- **Radio de la base con música** (canciones de la época en forma de melodías generadas).
- **Infiltrado:** uno de tus agentes puede ser espía de la CIA (rasgo oculto que se revela en un evento).
- **Rescate de agentes desaparecidos:** un agente dado por muerto puede reaparecer vivo en una expedición posterior, capturado por una facción.
- **Huella de las decisiones:** pintadas en las paredes de las zonas que recuerdan a agentes caídos en esa zona.
- **Mascota en la base** (un gato «Sputnik») con pequeños eventos.
- **Modo foto / repetición** de la última expedición en ASCII.

---

## Orden recomendado para la próxima sesión

1. **13.1 → 13.2** (reorganización y entidades genéricas): sin esto, facciones y compañeros serían frágiles.
2. **14.1** (maleta especial): rápida y muy visible.
3. **15.1–15.2** (atributos, especializaciones y talentos).
4. **16.1 + 16.4** (casillas con sentido + modificadores de zona) y después **17.1** (Prípiat y el Bosque Rojo como primeras zonas de superficie).
5. **18** (facciones) con la RDA como aliada y los EE. UU. como hostiles en las zonas nuevas.
6. **19.1–19.2** (perro robot y dron Strizh).
7. Resto de fases en orden.
