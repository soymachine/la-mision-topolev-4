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

## FASE 15 — Sistema RPG de agentes ✔

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

- [x] Migrar `acc`/`ev` actuales a este modelo.
  - *Hecho:* `a.attr` con 6 atributos de 1 a 10 (`a.av = 2`); las estadísticas se derivan en `agentStats` (Puntería→precisión, Agilidad→esquiva, Fortaleza→salud/cuerpo a cuerpo/huecos, Aguante→radiación/veneno/salud, Percepción→crítico/visión/rastreo, Técnica→esencia/curación/vetas). Las partidas antiguas convierten precisión/agilidad y los puntos de la fase 14.
- [x] Nivel máximo 20; curva de XP revisada; XP también por descubrir, curar, extraer y cumplir misiones (no solo matar).
  - *Hecho:* misma curva hasta el 10 y más empinada después. XP por sector nuevo (+4), alijo (+5), veta (+2), curación (+1), habilidad (+3), extracción y efectos de eventos (`xp`). Todo pasa por `exp.gainXp` (bonus de Veteranía).

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

- [x] **Habilidades activas** (1 por especialización, con recarga en turnos): *Fuego de supresión* (enemigos en un cono pierden su turno), *Primeros auxilios de campaña*, *Colocar carga*, *Marcar objetivo* (+25% de impacto para todo el grupo), *Desaparecer* (sigilo 3 turnos), *¡Por la Patria!* (el grupo gana un turno extra de movimiento).
- [x] Sinergias explícitas talento ↔ gadget ↔ mod (por ejemplo, «Paciencia» + bípode + prismáticos).
  - *Hecho:* `data/specs.js`: 7 especializaciones al nivel 5, 84 talentos en 3 ramas (avanzados con requisito de rama), ofertas de 1 entre 3 (una por rama) con re-tirada de pago, habilidad por especialización (tecla V; Liquidador: «Lavado de campo»), sinergias `syn` con gadgets y mods (◈ en la ficha), auras y condiciones nuevas (moved, irradiated, light, inWater, alliesNear). Lógica en `exp/abilities.js`.

### 15.3 Trasfondos y rasgos (M)
- [x] Trasfondo generado (minero del Donbás, bombero de Prípiat, veterano de Afganistán, profesora de física, ingeniera de turbinas, preso político conmutado, deportista olímpica…): da atributos iniciales, un rasgo y frases de diálogo propias.
- [x] **Rasgos adquiridos** por experiencias: «Superviviente» (sobrevivir con <5% de salud), «Traumatizado por lobos», «Amigo de la RDA», «Fobia al agua», «Cazador de jefes»…
- [x] **Heridas persistentes** (cicatriz: −1 en un atributo hasta tratarla en la Enfermería) y **condecoraciones** (Orden de la Estrella Roja, Medalla al Valor) con pequeños bonus.
- [x] **Retiro de veteranos:** un agente de nivel alto puede retirarse como **instructor** (los novatos ganan +X% de XP) — alternativa a perderlo.
  - *Hecho:* `data/backgrounds.js` (12 trasfondos con atributos, rasgos y frases que dicen en expedición), `data/honors.js` (9 rasgos adquiridos, 6 condecoraciones, 6 heridas que se operan en la ficha, retiro desde nivel 8 con hasta 3 instructores: +15% de XP cada uno para los agentes de nivel ≤ 6). Se conceden al volver (`awardHonors`) o durante la expedición (`markHurt`, `acquire`) y salen en el informe.

---

## FASE 16 — Mundo: casillas con sentido y nuevas reglas de mapa ✔

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

- [x] Sistema de **cobertura** (ver también fase 23) y de **objetos destructibles**.
- [x] Cada nueva casilla, con su animación (vapor, chispas, parpadeo de lámparas).
  - *Hecho:* 26 casillas nuevas en `data/tiles.js` con propiedades (`cover`, `shoot`, `use`, `noise`, `slip`, `quiet`, `fuel`, `light`, `anim`). Colocación en `mapgen.js` sin romper la conectividad (`placeBlock`), cámaras acorazadas tras puertas blindadas con terminal cercano, vagonetas en raíles, cristales `shard`. Mecánicas en `exp/terrain.js` (cobertura en ambos sentidos, disparar a casillas con T, reacciones en cadena, vapor, ventiladores, derrumbes por ruido, raíces que crecen, terminales con Técnica, interruptores, grafito). Objetos nuevos: tarjeta magnética, soplete, cuerda. El hielo sale con el modificador «Helada». Prueba: `tests/mapgen.mjs`.

### 16.2 Niveles verticales (L)
- [x] Una zona puede tener **2–3 pisos** conectados por montacargas, escaleras y simas. Bajar aumenta el nivel de los enemigos y la calidad del botín (mismo dilema de riesgo, en vertical).
- [x] Cada piso es un mapa generado; el minimapa muestra el piso actual y un selector.
- [x] Las extracciones permanentes solo están en el piso superior: cuanto más bajas, más lejos queda la salida.
  - *Hecho:* `floorsFor` (2, 2, 2, 3, 3), `buildFloor`/`mapState`/`applyMapState`/`changeFloor` en `exp/expedition.js`; los pisos visitados se guardan comprimidos en `floorStore`. Montacargas ↓/↑ y simas (con cuerda, sin daño); el escuadrón debe estar reunido. Selector de pisos en el mapa grande (M) con vista de solo lectura.

### 16.3 Luz y oscuridad (M)
- [x] Mapa de luz por casilla: zonas iluminadas y oscuras. En la oscuridad, la visión baja a la mitad salvo con linterna, visor nocturno o bengalas.
- [x] Las linternas encendidas **delatan** al agente (los enemigos lo ven desde más lejos). Se pueden apagar (tecla `L`): decisión entre sigilo y visión.
  - *Hecho:* sectores iluminados (según tipo y profundidad), lámparas (radio 5, se rompen), interruptores y terminales, fuego y bengalas. A oscuras la visión baja a la mitad (visor nocturno: −1); linterna (gadgets de luz, linterna táctica, queroseno de un compañero) da toda la visión. Enemigos: a oscuras te ven a un 65% de distancia; con linterna, +3.

### 16.4 Modificadores de zona por expedición (M)
Cada día, cada zona sale con 0–2 modificadores (visibles al elegir destino), que cambian riesgo y recompensa:
- [x] Modificadores (`data/modifiers.js`, deterministas por día y zona): Apagón, Inundación, Tormenta electromagnética (sin radar), Plaga de esporas, Nidos inquietos, Veta madre, Presencia extranjera (las otras expediciones aparecen por fin en los mapas), Lluvia radiactiva, Niebla, Pulso temprano y Helada. Se ven en EXPEDICIÓN y en el registro; la consola los fuerza con `mods`.
- «Apagón» (sin luz, +botín), «Inundación» (más agua), «Tormenta electromagnética» (sin radar), «Plaga de esporas», «Nidos inquietos» (los nidos empiezan despiertos), «Veta madre» (×1,5 esencia), «Presencia extranjera» (facciones garantizadas), «Lluvia radiactiva» (superficie), «Niebla», «Pulso temprano».
- [x] Contratos especiales con objetivo (ver fase 20) asociados a modificadores.
  - *Hecho:* `core/story.js · SPECIALS`: un encargo por modificador (11). CUARTEL ofrece uno al día en una zona abierta con ese modificador; solo vale ese día (caduca al pasar el día, sin penalización), no ocupa hueco de los 3 encargos normales y la recompensa sube un 10% por nivel de zona. Objetivos: rearmar o usar un objeto marcado (apagón, inundación, lluvia), coger un objeto y sacarlo de la zona (tormenta, sin radar; esporas, presencia extranjera, niebla, helada), abatir 12 chebylitas (nidos inquietos), recoger 120 ✦ (veta madre) o aguantar el pulso 15 turnos (pulso temprano). Se marca con ◎ en el mapa, en la lista de zonas y en las condiciones de hoy.

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

- [x] Estrato superficie/subsuelo y **mapa ASCII de la región** como selector de destinos; progresión por requisitos (`req`) en vez de en línea.
- [x] Las 6 zonas de superficie con sus casillas y mecánicas.
  - *Hecho:* `data/world.js` (campos `tier`, `stratum`, `floors`, `req`, `pos`, `special`; `zoneOpen`, `floorDef`), `ui/region.js` (mapa 64×22 con marcadores ◆ ▼ ☭ ? !). Generadores propios en `exp/mapgen.js` (ciudad, bosque, ferroviario, chatarrería, antena, lago); 16 casillas nuevas (tierra, hierba, asfalto, pinos que tapan media vista, tierra removida que se excava, coches, columpios, blindados, celosías, consola Ψ de la antena, barcas, alambrada…). Reloj (2 min/turno, noche de 21:00 a 6:00), luz natural de día al raso, clima por expedición (despejado, lluvia radiactiva, niebla, viento). Tren fantasma de Yanov, antena de Duga-3, sótano del hospital (2 pisos en Prípiat), siluros, robots de limpieza (sueltan piezas), lianas que atrapan. Botín nuevo: piezas de recambio y chaquetón de bombero.

### 17.2 Subsuelo nuevo (L)
| Zona | Nv | Concepto |
|---|---|---|
| **Metro-2: la línea secreta** | 6–8 | Túneles de metro militares bajo la región. Andenes, vagones de metro y puertas estancas. Lugar de encuentro de **facciones** |
| **Campamento «Wismut» (RDA)** | 5–7 | Zona social **aliada**: comercio, encargos, rumores, enfermería. Se puede visitar sin combate (pero de noche…) |
| **Estación avanzada «Fénix» (EE. UU.)** | 7–9 | Base hostil camuflada: cámaras, alarmas, torretas y soldados de élite. Botín occidental y documentos de inteligencia |
| **Objeto 7: el laboratorio del KGB** | 7–9 | Instalación secreta anterior a 1986 con celdas de contención. **Aquí se revela el pasado del Dr. Topolev** |
| **Las Raíces** | 8–10 | Red de cavernas orgánicas de la Raíz-madre: las paredes respiran y el mapa cambia durante la expedición |
| **El Útero de Corium** | 10+ | Zona final bajo el reactor; jefe final de varias fases (ver fase 22) |

- [x] Las 6 zonas de subsuelo.
  - *Hecho:* Metro-2 (patrullas de las 4 facciones, incluida la nueva de **contrabandistas**), Wismut (zona social: comerciante, enfermería y tablón con rumores y trabajos — diálogos `wismut_*`; residentes de la RDA; a veces una incursión por los pozos), Fénix (cámaras que dan la alarma, torretas, operadores de élite, botín occidental: M1911, M16, Remington 870, M21 y sus municiones, informes de inteligencia), Objeto 7 (celdas de contención que abre un terminal y archivo del KGB con el pasado del Dr. Topolev → flag `topolevPast`), Las Raíces (paredes que respiran y cambian el mapa) y el Útero de Corium (lagos de corium; el jefe final queda para la fase 22).

### 17.3 Zonas de evento temporales (M)
- [x] Aparecen unos días y desaparecen: «Helicóptero estrellado» (caja negra), «Convoy perdido», «Avión espía derribado» (equipo estadounidense raro), «Nido migratorio», «Mercado negro clandestino».
  - *Hecho:* `EVENT_ZONES`/`eventDef` en `data/world.js`; `tickEventZones` en `core/campaign.js` (desde el día 3, 40% diario, máximo 2, solo si su zona base está abierta). Se ven en la lista y en el mapa de la región (`!`), son de un solo uso y se generan sobre su zona base con contenido propio (restos del aparato `✈`, camiones con piezas, equipos americanos, cristales, el puesto del contrabandista con el diálogo `smuggler_trader`). Consola: `evzone`, `unlock`, `clock`. Pruebas: `tests/mapgen.mjs` (463 mapas) y la sección de la fase 17 de `tests/systems.cjs`.

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

- [x] Las 12 facciones (más chebylitas y el escuadrón), con 29 tipos de persona y patrullas propias.
  - *Hecho:* `data/factions.js` (reputación inicial `rep0`, bloque, negociables, `squadAttitude`, actitudes entre facciones: Pacto contra OTAN, el culto contra todos salvo los chebylitas…), `data/humans.js` (`SQUADS`, `SQUAD_MIN_TIER`) y un `fpool` por zona en `data/world.js`: cada mapa tiene 0–2 patrullas de las facciones de su región (Metro-2 y «Presencia extranjera», varias). Avistarlas por primera vez lo comenta Topolev por radio.

### 18.2 Mecánicas de facción (L)
- [x] **Reputación** −100…+100 por facción, visible en la base (sala de radio). Umbrales: hostil / desconfiada / neutral / amistosa / aliada.
- [x] Neutrales que **se vuelven hostiles** si les disparas, si robas en sus alijos o si apuntas mucho tiempo a uno de ellos (aviso «¡Baja el arma, camarada!»).
- [x] Aliados que **combaten a tu lado** contra chebylitas y estadounidenses; se pueden llamar con una bengala roja.
- [x] **Combates entre terceros:** estadounidenses contra chebylitas, culto contra todos… El jugador puede esperar y rematar (y cosechar la esencia).
- [x] **IA humana:** cobertura, retirada con poca salud, rendición (capturar prisioneros: dilema moral y reputación), uso de granadas, alertar al resto con radio.
- [x] **Diálogos al encontrarse** (motor de la fase 13): intercambiar, compartir mapa, pedir ayuda, sobornar, amenazar, ignorar.
- [x] **Restos de expediciones** en todas las zonas: campamentos abandonados (tiendas `Λ`, hogueras `*`, radios), cadáveres con equipo extranjero, cajas OTAN, diarios en inglés/alemán/sueco (traducidos al leerlos).
- [x] **Equipo extranjero** (≈25 armas/objetos nuevos) con su propio tipo de munición (5,56 OTAN, 7,62 OTAN, .45 ACP, 9 mm Parabellum): escasa, solo de botín → dilema: ¿vale la pena usar un M16 sin repuestos?
- [x] Repercusión política: si el KGB descubre que comercias con suecos o finlandeses, baja el presupuesto o envía a un **comisario** a la base.
  - *Hecho:* reputación absoluta con umbrales (hostil/desconfiada/neutral/amistosa/aliada) y migración de partidas antiguas; pestaña **RADIO** en la base con cada facción, su postura y lo que ofrece. Neutrales hostiles si les disparas, si abres sus suministros (`owner`) delante de ellos o si les apuntas tres veces («¡Baja el arma, camarada!»). Bengala roja: los aliados escoltan al escuadrón y, con reputación ≥ 25, llega una patrulla de la RDA/Cuba/Checoslovaquia. IA humana (`exp/ai.js`): cobertura, retirada, granadas, aviso por radio, rendición (⚑) y sacerdotes que azuzan chebylitas. Prisioneros (`exp/factions.js`): dejar ir, interrogar, requisar, entregar al KGB (150 ₽), reclutar (Comisario) o ejecutar. Encuentros (`encounter`): comerciar con existencias propias de cada facción, compartir mapas, pedir ayuda, tratamiento cubano, lecturas suecas, sobornar o amenazar a merodeadores y desertores. Campamentos abandonados con tiendas, hoguera, radio ☏ (localiza a las patrullas), cajas OTAN y 10 diarios en inglés, alemán, sueco, finés, checo y serbocroata traducidos al leerlos. 31 objetos extranjeros: 14 armas (MPi-KM, vz. 58, Škorpion, M70, Rk 62, m/45, ČZ 75, L9A1, Sterling, MP5, SA80, M16A2, M60, L42A1), munición de 9 mm Parabellum y 16 objetos (visor nocturno, PASGT, abrigo M/62, Semtex, Claymore, bengala roja, botiquín «Playa Girón», reliquias…). KGB: paga informes, documentos y diarios; cada trato con extranjeros le resta confianza; por debajo de −25 manda al comisario Orlov; por encima de 50, envía fondos. Pruebas: sección de la fase 18 de `tests/systems.cjs`.

---

## FASE 19 — Compañeros mecánicos y gadgets creativos

Se añade una ranura **COMPAÑERO** por agente (o por escuadrón) y un edificio **Garaje** en la base para mejorarlos y repararlos. Los compañeros son entidades aliadas (fase 13.2).

### 19.1 Perro robot «Laika-M» (L)
Homenaje a Laika: chasis de cuatro patas de la Academia de Ciencias.
- [x] Sigue a su dueño, tiene **salud, blindaje y 4 huecos de almacén** propios (botín extra que sobrevive si el perro vuelve).
- [x] **Órdenes:** seguir, quedarse (vigilar), buscar (va hacia el botín más cercano y lo trae), atacar.
- [x] **Módulos intercambiables** (3 ranuras): ametralladora ligera montada (gasta munición 5,45), lanzabengalas, detector de chebylitas a distancia (los marca en el radar a 15 casillas), sensor de radiación (muestra los focos), botiquín (cura a los adyacentes), mandíbula hidráulica (cuerpo a cuerpo potente), blindaje de plomo.
- [x] Si lo destruyen, deja un **chasis** recuperable; reparar en el Garaje cuesta rublos y piezas.
- [x] Sinergias: talento «Mecánico» (Zapador), gadget «Mando a distancia» (+alcance de órdenes).
  - *Hecho:* ranura **COMPAÑERO** por agente y módulo **Garaje** (niveles 1–5: tienda, módulos y reparaciones) con su pestaña en la base. `data/companions.js` (perro, 5 drones, 7 módulos y los actores) y `exp/companions.js` (IA del perro y de los drones, torreta, cambio de piso, vuelta a la base). Laika-M: salud y blindaje propios, 4 huecos de carga que llegan al almacén si su dueño extrae, órdenes con D o desde el panel de escuadra, lo que abate cuenta para su dueño; destruido → chasis recuperable (reparar: rublos + 2 piezas). «Mecánico»: +30% salud y daño, +50% batería, reparaciones −40%. «Mando a distancia»: el doble de alcance de órdenes y +50% de batería.

### 19.2 Drones (L)
| Dron | Rol | Detalles |
|---|---|---|
| **«Strizh» (golondrina)** | Reconocimiento | Vuela solo por el mapa, muy rápido (velocidad 250), sobre el agua; revela casillas y marca enemigos y POIs. Poca salud: los cuervos y los estadounidenses lo derriban. Batería de 40 turnos; vuelve solo si queda poca |
| **«Mula»** | Carga | Lleva hasta 3 objetos a la extracción más cercana y los **envía a la base** (una vez por expedición): otra forma de salvar botín |
| **«Kamikadze»** | Ataque | Se lanza contra un objetivo y explota (radio 2) |
| **«Eco»** | Señuelo | Emite ruido y luz: atrae chebylitas lejos del grupo |
| **«Relé»** | Radio | Mantiene el contacto con la base en zonas sin radar (anula la tormenta electromagnética) |

- [x] Control: tecla `D` para lanzar o recoger; órdenes con clic en el minimapa.
  - *Hecho:* Strizh (batería por turno, explora lo no visto y revela con su propia visión; clic en el radar lo guía; vuelve solo o con D), Mula (los 3 objetos más valiosos a la extracción → base, una vez por expedición), Kamikadze (radio 2, un solo uso), Eco (ruido, luz y señuelo durante 15 turnos; luego aterriza y se recoge) y Relé (pasivo: anula la tormenta electromagnética y adelanta las extracciones temporales).

### 19.3 Otros gadgets creativos (M)
- [x] **Torreta desplegable «Gnomo»**: se coloca en una casilla y dispara sola (munición limitada); se recoge al irse.
- [x] **Jaula de captura**: atrapa chebylitas pequeños **vivos** para la celda de contención de la base (investigación, fase 21).
- [x] **Cámara Zenit-E**: fotografiar chebylitas completa su ficha en el bestiario → +% de daño contra esa especie.
- [x] **Desfibrilador**: reanima a un agente **abatido** (fase 23) en 2 turnos.
- [x] **Gancho y cuerda**: cruzar simas y bajar de nivel sin daño.
- [x] **Equipo de soldadura**: abrir puertas blindadas y contenedores sellados (hace ruido).
- [x] **Generador de ruido blanco**: los disparos no despiertan nidos durante 10 turnos.
- [x] **Contador de centelleo**: muestra vetas y cristales a través de las paredes.
- [x] **Grabadora de bobina**: graba el sonido de un chebylita y lo reproduce para atraer a los de su especie (o asustarlos con el de un depredador).
- [x] **Sonda sísmica**: detecta minas, trampas y cavidades (simas ocultas).
- [x] **Camuflaje de ceniza termoóptico** (prototipo): invisibilidad breve con recarga.
- [x] **Paraguas antirradiación** (humor soviético): reduce la radiación de la lluvia en superficie.
  - *Hecho:* todos en `data/items.js`. Torreta Gnomo (60 balas, F para recogerla con lo que le quede), jaula (chebylitas pequeños por debajo del 50% → «jaula con un chebylita vivo», `S.captured`), Zenit-E (12 fotos, `S.photos` → +10% de daño y marca en el bestiario), desfibrilador (una vez por expedición, a 2 casillas: el sistema de abatidos llegará en la fase 23), gancho (salta simas de hasta 3 casillas y baja sin daño), soldadura (puertas blindadas y los nuevos contenedores sellados), ruido blanco (10 turnos), contador de centelleo (12 casillas), grabadora (graba y reproduce: atrae a su especie y espanta a los más débiles), sonda sísmica (las nuevas minas enemigas ocultas, simas y escombros), camuflaje (5 turnos invisible, recarga 25) y paraguas (−80% de radiación de la lluvia). Pruebas: sección de la fase 19 de `tests/systems.cjs`.

---

## FASE 20 — Narrativa profunda ✔

### 20.1 Arco principal en actos (L)
- **Acto I — «El Bloque»:** llegada, primeras zonas, el Dr. Topolev entusiasta. Gancho: las notas mencionan experimentos **anteriores** a la explosión.
- **Acto II — «Los otros»:** aparecen las expediciones extranjeras; el KGB presiona; los estadounidenses buscan algo concreto (¿la misma esencia?). Se descubre el Objeto 7.
- **Acto III — «El corazón»:** la Raíz-madre y el Útero de Corium. Revelación: el Dr. Topolev **ya conocía la esencia** y el «accidente» no fue del todo un accidente.
- **Final con decisiones** (3–4 finales según reputaciones, flags y relación con Topolev):
  - Entregar la esencia al Partido.
  - Destruir el Útero (sellar la central para siempre).
  - Huir a Occidente con las muestras.
  - Fusionarse con la esencia (final oculto del Dr. Topolev).
- [x] Hitos con **escenas ASCII animadas** cortas (pantalla completa, texto mecanografiado, dibujo ASCII).
  - *Hecho:* `data/story.js` (actos, escenas y finales con su dibujo) y `ui/scene.js` (texto mecanografiado a pantalla completa; clic, espacio o intro avanza, Esc salta). `core/story.js · checkActs()`: Acto II al conocer a una facción extranjera con 2 zonas superadas (o 8 zonas abiertas, o Metro-2); Acto III al leer el expediente del Objeto 7 o superar el Objeto 7 o las Raíces (escena «El expediente Topolev», −10 de confianza). Al volver del Útero de Corium, diálogo `finale` con los 4 finales (Partido: 500 ✦; sellar; Occidente: Suecia/Finlandia 40 o contrabandistas 30; fusión oculta: expediente leído y confianza ≥ 70) o «todavía no»; el epílogo queda en la crónica.

### 20.2 El Dr. Topolev y la base (L)
- [x] El Dr. Topolev con personalidad y medidor de **confianza** (sube al cumplir sus encargos y bajar muestras; baja si mueren agentes por sus órdenes o si se le desobedece).
- [x] **Personal de la base** con nombre y voz propia:
  - **Comisario Zhdánov:** cuotas, propaganda y amenazas; vigila la lealtad.
  - **Dra. Lyudmila Orlova:** la Enfermería; se preocupa por los agentes y cuestiona a Topolev.
  - **Sargento Kravets:** intendente con mercado negro propio.
  - **Mecánico «Babai»:** el Garaje, los drones y el perro.
- [x] **Escenas en el comedor** entre expediciones: conversaciones cortas generadas con plantillas según quién ha sobrevivido, quién ha muerto y las relaciones.
- [x] **Cartas** de las familias de los agentes (y que ellos escriben) y **epitafios** en el memorial.
  - *Hecho:* confianza 0–100 (empieza en 50, barra en CUARTEL): +3/+1 por extracción, +encargos suyos, −4 por muerte, −3 por cuota incumplida, −4 por abandonar su encargo; con 75 o más el laboratorio rinde +5%. Zhdánov (CUARTEL), Orlova (BARRACONES), Kravets (INTENDENCIA, con su trastienda) y Babai (GARAJE) hablan en su pestaña. Escena del comedor tras cada expedición según muertes, amistades, rivalidades, estrés o éxito. Cartas de casa cada pocos días (−12 de estrés; el texto se adapta al agente). Memorial con epitafio y última carta de cada caído.

### 20.3 Relaciones entre agentes (L)
- [x] **Afinidad** por pareja de agentes (−100…+100): sube al extraer juntos, curarse entre ellos, salvar a otro abatido o compartir trinchera; baja por fuego amigo, dejar atrás a un compañero o competir por el botín.
- [x] Estados: *camaradas*, *inseparables* (bonus al estar juntos: sinergia natural con los gadgets «juntos»), *rivales* (penalización si están juntos, bonus si compiten por bajas).
- [x] La **muerte de un amigo** genera duelo (estrés y posible rasgo «Venganza»: +daño contra esa especie).
  - *Hecho:* `S.affinity` por pareja: +5 al extraer juntos (+nivel del Comedor), +15 al curar o reanimar a otro, +1 al abatir juntos (trinchera compartida); −8 por fuego amigo, −3 por dejar atrás a alguien. Camaradas ≥ 30 (+1 puntería), inseparables ≥ 70 (+3 puntería, +2 esquiva y menos estrés si están cerca), rivales ≤ −30 (−2 puntería y +10% de daño). Relaciones en la ficha y el tooltip. Duelo: estrés para sus amigos y posible rasgo «Venganza» (×1,15 de daño contra la especie que lo mató).

### 20.4 Estrés y moral (M)
- [x] Barra de **estrés** 0–100: sube con la oscuridad, la radiación, ver morir a un compañero, los jefes o los ataques por sorpresa. Baja con descanso, la banya, el vodka (con riesgo de adicción), la música y los éxitos.
- [x] Con estrés alto aparecen **aflicciones temporales** (pánico: huye un turno; paranoia: dispara a neutrales; temblor: −puntería) y, a veces, **virtudes** (heroísmo).
  - *Hecho:* `exp/morale.js` (MoralePart). Suben: oscuridad, radiación, emboscadas, jefes, muertes. Bajan: descanso (+banya), la música de la radio VEF, los inseparables cerca, el vodka (consumible: −15; a la sexta, rasgo «Adicto»), las cartas y los éxitos. Investigación «Psicología de campo»: −25%. Por encima de 70: −puntería; al límite, pánico, paranoia, temblor o heroísmo.

### 20.5 Misiones y contratos (M)
- [x] Encargos de los personajes de la base y de las facciones: recuperar la caja negra de un helicóptero, escoltar a un científico sueco hasta una extracción, fotografiar al Pastor de Ceniza, capturar vivo un Lobo de grafito, sabotear la estación Fénix, encontrar a un agente desaparecido (¡vivo!).
- [x] Recompensas: rublos, reputación, objetos únicos con nombre propio, piezas del arco principal.
  - *Hecho:* 9 encargos en `core/story.js · CONTRACTS` (caja negra, escolta sueca, foto del Pastor, lobo vivo, sabotaje en Fénix, agente desaparecido, muestras para Wismut, medicinas cubanas, papeles para Kravets). CUARTEL ofrece 3 al día, hasta 3 activos; el científico, la carga y el desaparecido aparecen en su zona (`spawnContractStuff`). Recompensas: rublos, esencia, reputación, confianza y objetos con nombre propio. Los encargos especiales ligados a los modificadores de zona están en la fase 16.4.

### 20.6 Más contenido de texto (M)
- [x] 80+ notas organizadas en **colecciones** (Diario del operario de turno, Expedientes del Objeto 7, Cartas de Prípiat, Informes de la CIA traducidos…): completar una colección da una recompensa.
- [x] 60+ mensajes de radio, incluidos **mensajes interceptados** de otras facciones (pistas de dónde están sus alijos).
- [x] La **crónica del director**: diario automático de la partida, exportable como texto.
  - *Hecho:* 80 notas en 8 colecciones de 10 (`data/lore.js · COLLECTIONS`), con recompensa al completarlas y panel en ARCHIVO; las ya leídas salen menos. 40 mensajes de radio + 20 interceptados que marcan un alijo en el mapa. Crónica automática (actos, encargos, muertes, cuotas, ataques…) en ARCHIVO, exportable a .txt.

---

## FASE 21 — La base viva y la metaprogresión ✔

### 21.1 Base construible (L)
- [x] La base pasa a ser un **plano ASCII** donde se colocan edificios en parcelas: Laboratorio, Enfermería, Armería, Garaje, Sala de radio, Banya, Comedor, Invernadero, Celda de contención, Refugio antirradiación, Taller de fabricación.
- [x] Cada edificio con niveles (sustituye o amplía el sistema de módulos actual).
  - *Hecho:* `data/basedata.js` y `core/basecore.js`. Plano de 16 parcelas (4×4) en CUARTEL con el dibujo de cada edificio; 17 edificios (los módulos de siempre + banya, comedor, invernadero, celda de contención, refugio, taller de fabricación y sala de radio), así que no caben todos: hay que elegir, y derribar libera la parcela. Construir es el nivel 1 del módulo; los niveles siguen siendo los de los módulos.

### 21.2 Investigación (L)
- [x] **Árbol de investigación** que consume esencia, **muestras** (grafito, tejido chebylita, cristales) y **especímenes vivos** (jaula de captura): desbloquea objetos, mods, talentos y mejoras de compañeros.
- [x] **Celda de contención:** los chebylitas capturados producen esencia pasiva cada día… con riesgo de **fuga** (evento de defensa de la base).
  - *Hecho:* pestaña INVESTIGACIÓN (tecla 0): 16 proyectos con requisitos, coste en esencia, rublos, muestras y especímenes vivos, y duración en días (`researchMods` modifica a todos los agentes). Celda de contención: guarda las jaulas con chebylita vivo, produce esencia cada día y a veces se escapan (ataque «fuga»).

### 21.3 Fabricación (M)
- [x] Materiales: chatarra, componentes electrónicos, tela de plomo, tejido chebylita, piezas de vehículo.
- [x] Recetas (munición especial, medicinas, mods, mejoras de contenedor, piezas de drones). **Desmontar** objetos para obtener materiales.
  - *Hecho:* chatarra, electrónica, tela de plomo y tejido chebylita (contenedores, máquinas destruidas y chebylitas) + las piezas de recambio. 16 recetas en el Taller de fabricación (munición, botiquines, granadas, minas, mods, ampollas de esencia, traje de plomo, kit y batería de drones, placa de contenedor), algunas con investigación. Desmontar en el almacén devuelve materiales según el nivel del objeto.

### 21.4 Economía y política (M)
- [x] **Cuotas mensuales** del Comité (esencia a entregar): cumplir da presupuesto; fallar trae inspecciones y recortes.
- [x] **Mercado negro** del sargento Kravets: mejores precios, riesgo de que el KGB lo descubra.
- [x] Precios que fluctúan según la demanda (vender mucho de lo mismo baja el precio).
  - *Hecho:* cuota cada 30 días (crece un 35% cada vez; aviso 5 días antes): cumplir da 300 + 150 × n ₽ y reputación KGB; fallar, −20% del presupuesto, −12 KGB y −3 de confianza. Trastienda de Kravets en INTENDENCIA: 5 objetos occidentales al día (×1,6) y compra al 75%, con un 8% de que el KGB multe. Cada venta del mismo objeto baja su precio un 8% (mínimo 50%), y se recupera un 20% al día.

### 21.5 Calendario y tiempo (M)
- [x] Estaciones desde mayo de 1986: verano, **otoño de lluvia radiactiva**, **invierno** (frío, hielo, hipotermia; la superficie cambia).
- [x] Eventos históricos como contexto (la construcción del sarcófago termina en noviembre de 1986 → cambia la zona del Sarcófago; mensajes de televisión en la base).
  - *Hecho:* fecha y estación en la cabecera de la base. Otoño: más lluvia; invierno: modificador «helada» (agua de superficie congelada) e hipotermia sin abrigo (el abrigo M-62 protege). 10 noticias de televisión; el día 213 (finales de noviembre) el sarcófago queda terminado y la radiación de ambiente del Sarcófago baja un 40%.

### 21.6 Defensa de la base (M)
- [x] De vez en cuando, ataque a la base (chebylitas fugados, comandos estadounidenses, merodeadores): misión táctica corta en el plano de la base con los agentes que estén descansando.
  - *Hecho:* 4 ataques (fuga de la celda, comando «Nightingale», merodeadores, nido bajo la base): 5% al día desde el día 12, con 10 días de tregua tras cada uno (las fugas no esperan). Diálogo `base_attack`: defender (zona especial «defensa» con los agentes en la base; acabar con todos los atacantes da +200 ₽ y +5 de confianza) o ceder (−25% ₽, −20% ✦, hasta 3 objetos y estrés).

### 21.7 Operaciones simultáneas (M)
- [x] Enviar un **segundo escuadrón** de forma automática a zonas ya conocidas; el resultado se simula (botín, heridas, muertes) según su equipo y nivel.
  - *Hecho:* en EXPEDICIÓN, «Operación simultánea» con agentes fuera del escuadrón principal a una zona ya superada; están fuera hasta el día siguiente y el resultado (esencia, botín, heridas, muertes) se simula según nivel, salud y equipo frente a la zona.

---

## FASE 22 — Ecosistema y nuevos chebylitas ✔

- [x] **20+ chebylitas nuevos** por bioma: Liana de pino rojo, Siluro de Prípiat, Medusa de refrigeración, Velo de moho, Enjambre de cuarzo, Oso de grafito, Cigüeña de hierro, Perro de las fosas, **autómatas de chatarra** (robots de limpieza reactivados por la esencia: guiño a los robots reales usados en la limpieza) y Liquidador hueco (un traje vacío que camina).
  - *Hecho:* 20 nuevos en `data/enemies.js` repartidos por bioma (además de la liana, el siluro y el robot de la fase 17): medusa de refrigeración, velo de moho, enjambre de cuarzo, oso de grafito, cigüeña de hierro, perro de las fosas, autómata de chatarra, liquidador hueco, sanguijuela del canal, topo de hormigón, tejedora de cables, erizo de isótopos, sapo de cesio, murciélago de ceniza, hormiga de plomo, alce de la ciénaga, bobina viva, maniquí de la escuela n.º 3, eco de la sirena y gato de las cocinas. Habilidades nuevas en `exp/ecology.js`: descarga, ceguera, división al morir, rabia, aullido, autorreparación, sigilo, drenar, excavar (sale a tu lado), red, púas, arco eléctrico, maniquí (solo se mueve si nadie lo mira), alarma y salto. Los acuáticos aparecen solo en el agua.
- [x] **Élites con afijos** al estilo de Diablo: Blindado, Veloz, Radiactivo, Vampírico, Engendrador, Explosivo al morir, Invisible, Escudero (protege a otros). Mayor botín.
  - *Hecho:* `data/ecosystem.js · ELITES`. Probabilidad 3% + 0,8% por nivel de zona/piso + 1,2% por nivel de alerta; uno o dos afijos (dos desde el nivel 6). +50% de salud, el doble de esencia y XP, botín asegurado. ★ dorada en el mapa, en el registro y en el tooltip.
- [x] **Cadena alimentaria:** los lobos cazan ratas, los cuervos siguen a los lobos, la Raíz-madre atrae polillas. Se puede usar a favor (cebo).
  - *Hecho:* `diet` (lobos, osos, perros, cigüeñas, gatos, jabalíes) y `follows` (cuervos → lobos, murciélagos → osos, polillas → Raíz-madre). Sin nadie mejor a quien atacar, cazan o siguen a su depredador; la presa huye. Un depredador dormido con hambre se despierta si ve una presa. La carne de cebo atrae a los carnívoros desde el doble de lejos y durante más tiempo.
- [x] **Jefes con fases y patrones** (uno por zona nueva) y **trofeos** únicos.
  - *Hecho:* 10 jefes nuevos (Matriarca de las fosas, Pino Rojo, Locomotora de óxido, Rey de la chatarra, Siluro Abuelo, Pájaro Carpintero, Topo Rey, Prototipo XM-7, Muestra n.º 7, Corazón de la Raíz), uno por zona nueva, siempre en el piso más profundo (el Siluro, en el agua). Todos los jefes (también el Pastor y el Coloso) cambian de fase al 66% y al 33%: invocan a los suyos, ganan habilidades, se curan. 12 trofeos (gadgets únicos ♛) que solo caen si no los tenéis.
- [x] **Mundo persistente:** los nidos destruidos tardan días en volver; los no limpiados **crecen** y suben de nivel. «Nivel de alerta del reactor» global que sube con los días.
  - *Hecho:* `core/ecosys.js`. Despejar el 60% de los nidos deja la zona con menos nidos 5 días; una zona visitada y olvidada crece +1 nivel cada 12 días (máx. +2); un jefe abatido tarda 10 días en volver. Alerta del reactor 0–5 (un nivel cada 25 días, en la cabecera de la base): más élites, nidos más grandes, el pulso antes y, desde «Crítico», chebylitas un nivel más fuertes. En EXPEDICIÓN se ve el estado de cada zona y su jefe.

---

## FASE 23 — Combate táctico avanzado ✔

Resumen original: cobertura media/total con indicador `[▄]` y flanqueo; sigilo real (luz y movimiento, ataques por la espalda, emboscadas); estado **abatido** (3 turnos en el suelo, rescate con botiquín o desfibrilador); fuego de supresión y munición especial seleccionable; opcional: encasquillamientos y durabilidad; granadas que rebotan y se devuelven de una patada.

### Cómo trabajar esta fase (para retomarla a medias)
- Hacer las subfases **en orden** (23.1 → 23.7). Cada una es independiente y deja el juego jugable: al terminar una, **commit + push** con el mensaje `Fase 23.N: …`.
- Al terminar cada **subtarea**, marcarla aquí (`- [ ]` → `- [x]`) con una línea `*Hecho:*` breve (qué archivo/función). Si la sesión se corta a mitad de una subtarea, dejarla sin marcar y añadir debajo `*En curso:*` con lo que falta.
- Actualizar en `plan.md` → «Estado» la línea **Siguiente sesión** con la subtarea exacta por la que seguir (p. ej. «fase 23, desde 23.3.2»).
- Pruebas: cada subfase añade su bloque a la sección `· Fase 23` de `tests/systems.cjs` (contexto propio `ctx10`, arena iluminada como en la fase 22: copiar `window.__arena`/`__P` del bloque de la fase 22). Antes de cada commit: `node tests/mapgen.mjs` y la sección nueva; al cerrar la fase, `systems.cjs` completo (2 veces) y `smoke.cjs` en 3–4 zonas.
- Puntos de enganche ya existentes: `exp/combat.js` (`hitChance`, `canShoot`, `attack`, `damageAgent`, `agentDies`, `damageEnemy`, `killEnemy`), `exp/terrain.js` (`coverAgainst`, `isLit`, `agentLight`, `darkRadius`), `exp/ai.js` (`pickTarget`, `enemyAct`, `enemyMelee`, `enemyRanged`, IA humana `humanAct`), `exp/use.js` (`throwAt`, `explode`), `ui/expui.js` (tooltip de impacto y de enemigo, modo de lanzamiento), `exp/ecology.js` (`hidden`/`seen`, sigilo de chebylitas de la fase 22). Mezclas de la expedición: un nombre de método repetido entre partes **lanza un error** (comprobar con `grep -rn "^  nombre(" js/exp`).

### 23.1 Cobertura media/total y flanqueo (M) ✔
- [x] 23.1.1 **Dos niveles de cobertura** en `data/tiles.js`: `cover` ya da un %; añadir `coverLvl: 1|2` (media ≈ −25%, total ≈ −50%) a cada casilla con cobertura (barricadas, sacos, maquinaria, vagonetas, escombros…). `coverAgainst()` (terrain.js) devuelve `{ pct, lvl }` o se añade `coverLevel()`; mantener `coverAgainst` devolviendo el % para no romper a quien ya lo usa.
  - *Hecho:* `data/tiles.js` (`coverLvl`; sacos terreros y coches = total −45%, consola/murete = media −25%) y `terrain.js · coverInfo()/coverLvlOf()/coverCell()`; `coverAgainst()` se mantiene.
- [x] 23.1.2 **Flanqueo**: si el tirador está en un ángulo ≥ 90° respecto a la dirección en que la cobertura protege (es decir, la línea de tiro no cruza la casilla de cobertura adyacente al objetivo), la cobertura no cuenta y además **+15% de impacto** (+10% de crítico). Aplicar en `hitChance()` (agentes) y en `enemyRanged()`/IA humana (enemigos contra agentes).
  - *Hecho:* `hitChance()` y `rollDmg()` (+10% crítico) en combat.js; `enemyRanged()` y `humanShoot` en ai.js.
- [x] 23.1.3 **Indicador** en el tooltip de impacto (`ui/expui.js`): `[▄]` media, `[█]` total, `[⇄ flanco]`; y un pequeño marcador en el mapa sobre el agente/enemigo que está a cubierto (render `render/ascii.js`).
  - *Hecho:* tooltip de impacto (`[█] total`, `[▄] media`, `[⇄ flanco]`) y del agente («A cubierto» / «¡Te flanquean!»); marcador ▄/█ sobre el agente en `render/ascii.js`.
- [x] 23.1.4 **IA**: los humanos ya buscan cobertura (fase 18); que prefieran la total y que intenten flanquear si el agente está a cubierto (mover a una casilla que anule la cobertura). Los chebylitas a distancia (cristal, sapo, bobina) ignoran esto.
  - *Hecho:* IA humana (ai.js): si el agente está a cubierto, 45% de moverse a una casilla que lo flanquee; la búsqueda de cobertura ya prefiere la de más %.
- [x] 23.1.5 Pruebas: arena con una casilla de cobertura entre tirador y objetivo → % baja según nivel; desde un lado → sin cobertura y +15%. Ayuda (`ui/screens.js`) y Archivo (`admin.js` → «Casillas del mapa»: columna de nivel de cobertura).
  - *Hecho:* sección `· Fase 23` de `tests/systems.cjs` (arena `__arena`/`__P`/`__set`), ayuda (COMBATE) y Archivo (casillas: total/media).

### 23.2 Sigilo real y ataques por la espalda (L) ✔
- [x] 23.2.1 **Visibilidad del agente** (`pickTarget` en ai.js ya reduce la vista a oscuras y con linterna): añadir **movimiento** (si el agente no se movió el turno anterior, −2 a la distancia a la que lo detectan; si corrió/viaja, +2) y un estado **agachado** opcional (tecla `C`: −3 a la detección, movimiento a mitad de velocidad = cada paso cuesta 2 turnos de energía o se alterna). Guardar en `sq.crouch`; serializar.
  - *Hecho:* `exp/tactics.js` (`toggleCrouch`, `stealthBonus`): agachado −3, quieto −2, en `pickTarget` (ai.js) para enemigos dormidos o errantes; el paso agachado alterna un turno extra (`tryMove` en expedition.js); `sq.crouch` se guarda con el escuadrón.
- [x] 23.2.2 **Indicador de detección** en la barra/tarjeta del agente: «oculto / te han oído / te han visto» según el estado de los enemigos que lo tienen como objetivo (`e.state`, `e.mem`).
  - *Hecho:* `detectionOf(sq)` → chip OCULTO / OÍDO / VISTO en la tarjeta del agente (`ui/expui.js`), y chip AGACHADO.
- [x] 23.2.3 **Ataque por la espalda**: cuerpo a cuerpo contra un enemigo que no está en `alerta` (dormido/errante) o que no tiene al atacante en su línea de visión → **crítico garantizado** (×2, o ×2,5 con el talento de Explorador que ya da críticos). Mensaje «¡Ataque por la espalda!». En `attack()`/cálculo de daño de `combat.js`.
  - *Hecho:* `rollDmg()` (combat.js): cuerpo a cuerpo contra un enemigo `unaware` (dormido o errante sin memoria), no jefe → crítico seguro y mensaje.
- [x] 23.2.4 **Emboscadas** de los agentes: orden «emboscada» (en el menú de órdenes, `ORDERS` en `exp/shared.js`): el compañero no se mueve y dispara con +20% de impacto al primer enemigo que entre en su alcance (una vez, luego vuelve a «mantener»). Relacionado con «Vigilancia» si existe en talentos (revisar `data/specs.js`).
  - *Hecho:* orden `emboscada` en `ORDERS` (shared.js); `companionAct` no se mueve y `ambushFire` dispara con +20% (buff de 1 turno) y pasa a MANTENER. (No había un talento «Vigilancia».)
- [x] 23.2.5 Emboscadas **enemigas**: el liquidador hueco y el gato (fase 22, `stealth`) ya atacan por sorpresa; que sus primeros golpes cuenten como «ataque por la espalda» si el agente no los veía (`seen()`), y que `moraleOnAmbush` lo registre.
  - *Hecho:* `enemyMelee`: primer golpe de un chebylita con `stealth` ×1,5 («¡Emboscada!»); los ocultos ya no cuentan como «vistos» en `computeVisibility`.
- [x] 23.2.6 Pruebas (dormido + cuerpo a cuerpo = crítico; agachado = detectado más tarde; emboscada dispara con bonus) + ayuda + Archivo («Sistemas»: tabla de modificadores de detección).
  - *Hecho:* pruebas en la sección `· Fase 23`; ayuda (tecla C, sigilo) y Archivo («Detección y sigilo»).

### 23.3 Estado «abatido» y rescate (L) — *la más importante* ✔
- [x] 23.3.1 En `damageAgent()` (combat.js): cuando `hp <= 0` y no actúan Rescate/desfibrilador/autoinyector, en vez de `agentDies` → **abatido**: `sq.downed = 3` (turnos), `hp = 0`, no puede actuar ni ser controlado; si recibe otro golpe estando abatido (o se acaban los 3 turnos) → `agentDies`. Excepciones que matan directamente: daño ≥ 50% de la salud máxima en un golpe (opcional) y radiación letal.
  - *Hecho:* `damageAgent()` (combat.js) → `knockDown()` (exp/tactics.js): `sq.downed = 3`, hp 0, sin veneno ni quemaduras; otro golpe → `agentDies`. Sin la excepción de «golpe enorme» (opcional, no hecha); la radiación letal sí mata.
- [x] 23.3.2 **Rescatar** (F junto al abatido, o clic): con botiquín (`use: 'heal'`) → se levanta con la curación del botiquín; sin botiquín → se levanta con 1 de salud pero gasta 2 turnos. El **desfibrilador** (gadget de la fase 19, `flag defib`) pasa a servir para esto a 2 casillas (y ya no «revive» desde la muerte). El talento Rescate (Sanitario, `s_rescate`) da +1 turno de margen y levanta con 25% de salud.
  - *Hecho:* `rescue()`/`canRescue()`/`downedNear()` en tactics.js; F (use.js · `interact`) o clic sobre el abatido (expui.js). Rescate (Sanitario) = +1 turno y ≥25%; el desfibrilador levanta a 2 casillas y ya no revive solo.
- [x] 23.3.3 Cuenta atrás de cada turno en `environment()` o en el tick de agentes; mensajes («X se desangra: 2 turnos»), sonido y `interrupt`. Los enemigos **prefieren** rematar a un abatido si lo tienen al lado (IA en `enemyAct`/`humanAct`: objetivo prioritario). Los compañeros con orden «seguir» acuden a rescatar si tienen botiquín.
  - *Hecho:* `downedTick()` al principio de `environment()`; `pickTarget` (ai.js) prefiere al abatido adyacente; `companionAct` acude a levantarlo (salvo con NO DISPARAR).
- [x] 23.3.4 UI: el agente abatido se dibuja tumbado (glifo distinto, p. ej. `_` o el mismo en gris parpadeando) con el contador; tarjeta del escuadrón en rojo con «ABATIDO (n)»; no se puede seleccionar como agente activo (pasar al siguiente). Si todos están abatidos o fuera, la expedición termina como ahora.
  - *Hecho:* render (`_@` gris parpadeando + turnos), tarjeta «✚ ABATIDO (n)», no se puede seleccionar (`switchActive`, `act()`, `checkActive()` saltan a los abatidos); si todos están abatidos, mueren.
- [x] 23.3.5 Extracción: un abatido **no** puede extraerse por sí mismo; si un compañero lo rescata y llegan juntos, sí. Si la expedición termina con un abatido en el mapa, muere (el informe lo dice).
  - *Hecho:* la evacuación no sube a los abatidos (`environment.js`); si la expedición acaba con un abatido en el mapa, no vuelve (como un agente que no se extrae).
- [x] 23.3.6 Moral y relaciones (fase 20): rescatar a alguien = +15 de afinidad y −10 de estrés al rescatado; ver caer a un compañero abatido ya da estrés (`moraleOnDeath` solo al morir de verdad). Medalla/rasgo existente por salvar compañeros (`a.saves`) cuenta también los rescates.
  - *Hecho:* `rescue()`: +15 de afinidad, −10 de estrés al levantado, `a.saves++`; caer abatido da +5 de estrés al resto. `moraleOnDeath` solo al morir de verdad.
- [x] 23.3.7 Guardado: `downed` en el estado del escuadrón (serializar en `expedition.js` → `squad`). Migración: nada (campo opcional).
  - *Hecho:* `downed`/`downCause` viajan con el estado del escuadrón (se serializa entero); sin migración.
- [x] 23.3.8 Pruebas: daño letal → abatido 3 turnos → rescate con botiquín → de pie; otro caso: nadie lo rescata → muere al 3.er turno; desfibrilador a 2 casillas; enemigo remata al abatido. Ayuda + Archivo (sección «Sistemas»).
  - *Hecho:* pruebas en `· Fase 23` (abatido, cuenta atrás, levantar con y sin botiquín, rematar, desangrarse); adaptadas las de Rescate (fase 15) y desfibrilador (fase 19). Ayuda y Archivo («Abatidos y rescate»).

### 23.4 Munición especial seleccionable y fuego de supresión (L) ✔
- [x] 23.4.1 **Tipos de munición** por calibre: en `data/weapons.js` (`NEW_AMMO`) o en un archivo nuevo `data/ammo.js`, variantes con `base` (el calibre: `a_545`, `a_762`, `a_9x18`, `a_12`…) y `kind`: `ap` perforante (ignora 3 de protección, −10% daño), `inc` incendiaria (prende fuego: `burn`), `hp` expansiva (+30% daño contra sin armadura, −50% contra blindados), `ess` de esencia (+20% daño contra chebylitas, brilla). Precio y tier más altos; sueltos en botín de nivel alto y en recetas del taller de fabricación (`data/basedata.js · RECIPES`).
  - *Hecho:* `data/ammo.js` (`AMMO_KINDS`, `SPECIAL_AMMO`: 27 variantes de 9×18, 5,45, 7,62×54R, 7,62×39, cal. 12 —sin perforante—, 5,56 y 9×19), en `ITEMS`; salen en el botín por su tier; 4 recetas en `basedata.js · RECIPES`.
- [x] 23.4.2 El arma usa **cualquier munición de su calibre**: `ammoFor(sq)` y la recarga (`reload`) cuentan munición por `base`; el arma guarda qué tipo tiene cargado (`w.ammoKind`). Recargar cambia al tipo elegido.
  - *Hecho:* `reload()`/`ammoFor()` (use.js) por calibre; `w.ammoKind` (cargada) y `w.ammoSel` (elegida); al cambiar de tipo, lo cargado vuelve a la mochila.
- [x] 23.4.3 **Selector** en la expedición: tecla `X` (o botón junto al arma en el panel) para ciclar el tipo de munición del arma activa entre los que lleva el agente; la siguiente recarga usa ese tipo. Mostrar el tipo en el panel del arma y en el tooltip de impacto (daño previsto con el modificador).
  - *Hecho:* tecla **N** (la X ya cambia de arma): `cycleAmmo()` en tactics.js; el tipo cargado se ve en la tarjeta del agente (PERF/INC/EXP/ESS).
- [x] 23.4.4 Efectos en `attack()`/`damageEnemy` (combat.js): perforante (resta protección), incendiaria (`e.burn`), expansiva y de esencia según `est(e)`/mecánico/blindado (élites Blindados de la fase 22 cuentan como blindados).
  - *Hecho:* `rollDmg()` (perforante, expansiva, de esencia) y `resolveHit()` (incendiaria → `e.burn`) en combat.js; «blindado» = protección ≥ 3 (los élites Blindados también).
- [x] 23.4.5 **Fuego de supresión**: acción con tecla `Z` (armas automáticas: subfusil, fusil, ametralladora; `wtype` en weapons.js) sobre una casilla/enemigo: gasta 3× munición, hace poco daño (o ninguno) pero deja a los enemigos en un **cono/radio 1** «suprimidos» 2 turnos: −30% de impacto, no avanzan (humanos se quedan a cubierto, chebylitas pierden el turno con 50%). Marcador visual. La IA humana también puede suprimir (ametralladores `mar_gunner`, `usa_operator`).
  - *Hecho:* tecla **Z** → `suppress()` (tactics.js): 6–9 balas, un impacto a mitad de daño, `e.suppressed = 2` a 1 casilla del objetivo (−30% de impacto, 50% de perder el turno en `enemyAct`); marcador ∷. Humanos: `humanSuppress()` (15% por ráfaga) → `sq.suppressed` (−30% en `hitChance`, chip SUPRIMIDO).
- [x] 23.4.6 Pruebas (cada tipo de munición aplica su efecto; recargar cambia de tipo; supresión baja el impacto enemigo) + ayuda + Archivo («Munición especial»).
  - *Hecho:* pruebas en `· Fase 23`; ayuda (teclas N y Z) y Archivo («Munición especial»).

### 23.5 Encasquillamientos y durabilidad (M, opcional) ✔
- [x] 23.5.1 `it.dur` (0–100) en armas: baja 1 por cada N disparos (más rápido con munición incendiaria/expansiva y con lluvia/agua); `createItem` la inicializa a 100 (y las armas del suelo de humanos muertos, a 40–80). Migración en `state.js · migrate()`: armas sin `dur` → 100.
  - *Hecho:* `it.dur` (sin el campo = 100, sin migración): `wearWeapon()` en tactics.js, −0,5 por disparo (×1,6 incendiaria/expansiva, ×1,5 con lluvia o en el agua); las armas que sueltan los humanos salen al 40–80%.
- [x] 23.5.2 **Encasquillamiento**: probabilidad por disparo = `max(0, (60 − dur) / 400)` (0% por encima de 60); el arma encasquillada no dispara hasta **desencasquillar** (acción, 1 turno; con el talento/rasgo adecuado, gratis). Mensaje y sonido.
  - *Hecho:* probabilidad `(60 − dur) / 400` por disparo en `attack()` (combat.js); encasquillada no dispara; R → `unjam()` (gratis con `quickReload`); los compañeros la desencasquillan solos.
- [x] 23.5.3 **Reparación** en el Taller de fabricación (fase 21, pestaña INVESTIGACIÓN): coste en chatarra según el tier; o en el Garaje. Mostrar la durabilidad en el tooltip del arma (`core/items.js · itemTooltip`).
  - *Hecho:* `repairCost()`/`repairWeapon()` en basecore.js (chatarra según el tier) y bloque «REPARAR ARMAS» en el Taller (pestaña INVESTIGACIÓN, `ui/base21.js`); estado y munición cargada en el tooltip (`core/items.js`).
- [x] 23.5.4 Pruebas + ayuda + Archivo.
  - *Hecho:* pruebas en `· Fase 23`; ayuda y Archivo (en «Munición especial»).

### 23.6 Granadas que rebotan y patada (M) ✔
- [x] 23.6.1 Trayectoria de lanzamiento en `throwAt()` (use.js): si la línea al destino choca con un muro, la granada **rebota** una vez (refleja la dirección en el eje del choque) y cae 1–2 casillas después; previsualizar la trayectoria en el modo de lanzamiento (`ui/expui.js`, `enterThrow`). Las granadas tienen `fuse` (1 turno): caen al suelo y explotan al siguiente turno (en `this.pending`, que ya existe), en vez de al instante.
  - *Hecho:* `grenadePath()` en tactics.js (las paredes opacas la detienen; rebote único reflejando el eje que choca, 1–2 casillas más); `throwAt()` (use.js) arma la granada en `pending` (`kind: 'nade'`, se guarda) y `nadeTick()` la hace estallar al final del turno; previsualización del rebote en el modo de lanzamiento (expui.js) y granada parpadeando en el mapa (ascii.js).
- [x] 23.6.2 **Devolver de una patada**: talento nuevo (rama del Zapador o del Explorador en `data/specs.js`): si una granada enemiga cae a ≤1 casilla, el agente puede gastar su turno en patearla 3 casillas en la dirección contraria. Sin el talento: apartarse.
  - *Hecho:* talento `z_patada` «Devolución» (Zapador, rama Explosivos, nivel II, `kickNade`): F junto a una granada enemiga → `kickNade()` la manda 3 casillas en dirección contraria; sin el talento, aviso de apartarse.
- [x] 23.6.3 Granadas **enemigas** (IA humana ya lanza, fase 18): que también usen la mecha de 1 turno y avisen («¡Granada!») para dar tiempo a reaccionar.
  - *Hecho:* IA humana (ai.js): rebota, estalla al final del turno siguiente y avisa «¡apartaos!» (`interrupt`).
- [x] 23.6.4 Pruebas (rebote en un muro, mecha de 1 turno, patada con el talento) + ayuda + Archivo.
  - *Hecho:* pruebas en `· Fase 23` (rebote, mecha, patada) y ayuda (sección de combate).

### 23.7 Cierre de la fase ✔
- [x] 23.7.1 Revisar el equilibrio con `smoke.cjs` en varias zonas (que el bot no muera siempre por los abatidos ni la supresión).
  - *Hecho:* `smoke.cjs` en las zonas 0, 1, 5, 6, 12 y 16 sin errores: el bot termina sus expediciones con los abatidos, la supresión y las granadas con mecha.
- [x] 23.7.2 Ayuda completa (`ui/screens.js`: sección «COMBATE TÁCTICO») y teclas nuevas en la lista de controles (`C` agacharse, `X` munición, `Z` supresión).
  - *Hecho:* teclas C (agacharse), N (munición) y Z (supresión) en los controles; las reglas nuevas van en la sección de combate de la ayuda (`ui/screens.js`).
- [x] 23.7.3 Archivo (`admin.js`): «Munición especial», «Cobertura y flanqueo», «Detección y sigilo», «Abatidos».
  - *Hecho:* Archivo (`admin.js`): «Casillas del mapa» (cobertura total/media), «Detección y sigilo», «Abatidos y rescate» y «Munición especial» (con supresión y durabilidad).
- [x] 23.7.4 `systems.cjs` completo dos veces, `mapgen.mjs`, `smoke.cjs` en 3–4 zonas; marcar aquí la fase con ✔ y actualizar `plan.md` («Fase 23 completada…» y «Siguiente sesión: fase 24»).
  - *Hecho:* `systems.cjs` completo dos veces (162/162), `mapgen.mjs` (463 mapas) y `smoke.cjs` en 4 zonas.

---

## FASE 24 — Calidad, accesibilidad, modos y longevidad

Resumen original: accesibilidad (modo daltónico con símbolos en las rarezas, remapeo de teclas, fuente de mayor contraste, controles táctiles); localización (textos a `js/i18n/es.js` y preparar el inglés); música generativa y más sonidos; logros y estadísticas ampliadas; modos de juego (Historia, Libre, Hierro, Desafío semanal, Nueva partida+ «1987»); enciclopedia dentro del juego.

### Cómo trabajar esta fase (para retomarla a medias)
- Igual que en la fase 23: subfases **en orden** (24.1 → 24.9), cada una deja el juego jugable; al cerrar una, **commit + push** con `Fase 24.N: …`.
- Al terminar cada **subtarea**, marcarla aquí con una línea `*Hecho:*`; si se corta a medias, dejarla sin marcar con `*En curso:*` y lo que falta. Actualizar la línea **Siguiente sesión** de `plan.md` con la subtarea exacta.
- Pruebas: sección nueva `· Fase 24` en `tests/systems.cjs` (contexto propio `ctx11`). Los ajustes viven en `core/state.js · settings` (localStorage `topolev_settings_v1`): toda opción nueva necesita valor por defecto en `loadSettings()` y no debe romper partidas guardadas. Antes de cada commit: `node tests/mapgen.mjs` y la sección nueva; al cerrar la fase, `systems.cjs` completo dos veces y `smoke.cjs` en 3–4 zonas.
- Puntos de enganche: `ui/screens.js` (`TitleScreen` = menú principal y ajustes, `HelpScreen`), `ui/expui.js` (teclado `onKey`, tarjetas, tooltips, ratón), `ui/base.js` (pestañas de la base), `render/ascii.js` (colores del mapa), `core/items.js` (`itemHTML`, `itemTooltip`, `rarityColor`), `data/rarity.js`, `audio.js` (`sfx`, `setVolume`), `css/style.css` (variables de color en `:root`), `admin.js` (catálogo reutilizable para la enciclopedia).
- La 24.4 (localización) es la más grande: hacerla **por partes** (infraestructura y la interfaz primero; los datos del juego, por archivos) y no bloquear las demás subfases por ella.

### 24.1 Modo daltónico y alto contraste (M) ✔
- [x] 24.1.1 **Ajustes nuevos** en `settings` (`colorblind: false`, `contrast: false`) con sus botones en el menú principal (`TitleScreen`) y también accesibles durante la partida (menú de pausa / tecla de ajustes si existe; si no, desde la base). Se aplican al instante (clases `cb` y `hc` en `<body>`).
  - *Hecho:* `settings.colorblind`/`settings.contrast` (por defecto en `loadSettings()`); `ui/a11y.js` (`applyA11y`, `a11yButtons`) con botones en el menú principal, el de la base y el de la expedición; se aplica al arrancar en `main.js` (clases `cb`/`hc` en `<body>`).
- [x] 24.1.2 **Rarezas con símbolo**: cada rareza de `data/rarity.js` gana `sym` (· común, + no común, ◆ raro, ★ épico, ✦ legendario, ✪ mítico) y un color alternativo seguro para daltonismo (paleta Okabe-Ito). Con `colorblind`, `itemHTML`, el tooltip, la lista de botín del suelo, el almacén y las tiendas muestran el símbolo delante del nombre y usan los colores alternativos (`rarityColor` centraliza el cambio).
  - *Hecho:* `data/rarity.js`: `sym` y `cb` (Okabe-Ito) por rareza; `applyColorblind()` cambia el color en el propio `RARITIES` (y las variables `--r0…--r5`), así cambia en todo el juego; `rarSym()` antepone el símbolo en `itemHTML` y en el tooltip.
- [x] 24.1.3 **No solo color en el mapa**: actitud de las personas (hostil/neutral/aliado) con una marca distinta además del color del borde (p. ej. `!`, `?`, `+` en la esquina); élites ya llevan ★; barras de vida con el % en el tooltip; estados de los agentes (VISTO/OÍDO/OCULTO, ABATIDO, SUPRIMIDO) ya llevan texto.
  - *Hecho:* `render/ascii.js`: con el modo daltónico, las personas llevan ! / ? / + según su actitud (además del color del borde); élites (★) y estados de los agentes ya tenían texto.
- [x] 24.1.4 **Alto contraste**: variables de `:root` alternativas en `body.hc` (texto más claro, fondos más oscuros, bordes visibles), fuente en negrita, sin efecto CRT, y en el lienzo ASCII colores más luminosos (factor de luminosidad mínima en `render/ascii.js` cuando `settings.contrast`).
  - *Hecho:* `css/style.css · body.hc`: variables más claras, negrita, bordes marcados, sin CRT y filtro de contraste en el mapa y el minimapa (`.map-canvas`, `#minimap`).
- [x] 24.1.5 Pruebas (activar cada modo cambia las clases, los símbolos aparecen, `rarityColor` cambia) + ayuda + Archivo (rarezas con símbolo).
  - *Hecho:* sección `· Fase 24` de `tests/systems.cjs` (activar desde el menú, símbolos, se recuerda al recargar, expedición con ambos modos); ayuda («ACCESIBILIDAD») y Archivo (rarezas: columna «Modo daltónico»). De paso: `audio.js` no crea el `AudioContext` hasta el primer clic o tecla (evita el aviso del navegador).

### 24.2 Remapeo de teclas (M) ✔
- [x] 24.2.1 Tabla de **acciones** (`data/keys.js` o en `ui/expui.js`): mover (8 direcciones + numérico), esperar, interactuar F, recoger G, recargar R, cambiar arma X, apuntar T, curar H, habilidad V, linterna L, agacharse C, munición N, supresión Z, compañero D, granada B, inventario I, mapa M, órdenes O, siguiente agente Tab, ayuda ?, zoom +/−. Valores por defecto = los de ahora.
  - *Hecho:* `ui/keys.js · KEY_ACTIONS` (29 acciones con su tecla por defecto, incluido el movimiento WASD/QEZC). **Arreglo**: en `KEYDIR` las letras d/c/z movían y tapaban a compañero (D, fase 19), agacharse (C) y supresión (Z) de la fase 23, que nunca llegaban a ejecutarse; ahora por defecto son **J**, **K** y **P**.
- [x] 24.2.2 `settings.keys` guarda solo lo cambiado; `onKey()` en expui.js traduce la tecla pulsada a una acción a través de la tabla (en vez del `switch` con letras fijas).
  - *Hecho:* `settings.keys` (solo lo cambiado); `onKey()` (expui.js) usa `actionForKey()`/`dirOf()`; fijas: flechas, numérico, 1–4, Enter, Esc.
- [x] 24.2.3 Pantalla **CONTROLES** (menú principal): lista de acciones con su tecla, clic para reasignar («pulsa una tecla…»), aviso si choca con otra acción, botón «restaurar».
  - *Hecho:* `controlsModal()` (keys.js): botón CONTROLES en el menú principal, el de la base y el de la expedición; clic + tecla, aviso de choques y de teclas reservadas, RESTAURAR TECLAS.
- [x] 24.2.4 La ayuda y los tooltips que nombran teclas (p. ej. «pulsa **F**») leen la tecla actual (función `keyName('interactuar')`).
  - *Hecho:* la lista de controles de la ayuda se genera con `helpKeysHTML()`; las menciones (agacharse, munición, supresión, compañero, levantar…) usan `keyName()`; `keyify()` cambia «<b>R</b>», «<b>F</b>»… en el registro, los tooltips del mapa y la ayuda si el jugador ha remapeado.
- [x] 24.2.5 Pruebas (reasignar R → recarga con la nueva tecla; restaurar).
  - *Hecho:* pruebas en `· Fase 24` (K agacha y D mueve, choques y reservadas, la tecla nueva funciona, keyify y restaurar, pantalla CONTROLES).

### 24.3 Controles táctiles (L) ✔
- [x] 24.3.1 Detección de pantalla táctil (`matchMedia('(pointer: coarse)')`) y ajuste `touch: auto|on|off`. *Hecho:* `ui/touch.js` (`touchDetected`, `touchOn`, `applyTouch` → clase `touch` en `<body>`); `settings.touch` (por defecto `auto`); botón «CONTROLES TÁCTILES: AUTO/SÍ/NO» dentro de `a11yButtons` (menú principal, base y pausa); `applyA11y` lo aplica al arrancar.
- [x] 24.3.2 **Barra de acciones** en pantalla durante la expedición: cruceta de 8 direcciones (o tocar una casilla para ir), esperar, F, recargar, apuntar, curar, habilidad, granada, cambiar de agente. Botones grandes (≥ 44 px). *Hecho:* `buildTouchBar(ui)` sobre el mapa: cruceta 3×3 (centro = esperar; mantener pulsado repite) y 10 botones (F, apuntar, recargar, curar, habilidad, granada, agacharse, siguiente agente, inventario, ✕ cancelar/menú). El `switch` de teclas pasó a `ExpeditionUI.doAction(act)`, compartido con `touchAct`/`touchMove` (en el modo apuntar, F confirma y ⌖ cambia de objetivo). Tocar una casilla ya funcionaba como el clic.
- [x] 24.3.3 Gestos: toque = lo mismo que clic; **pulsación larga** = tooltip; pellizco = zoom; arrastrar el minimapa = desplazar la vista. *Hecho:* `mapGestures` (pulsación larga de 500 ms → `onHover` y anula el clic siguiente; dos dedos → `zoom(±1)`) y `minimapDrag` (arrastrar → `centerOn`; vuelve al agente en el siguiente turno). `touch-action: none` en el mapa y el radar.
- [x] 24.3.4 Base y menús usables en pantalla estrecha (rejillas de 3 columnas que pasen a 1–2; modales con scroll). Revisar `css/style.css`. *Hecho:* `@media (max-width: 760px)`: expedición en una columna (panel del agente debajo, o con táctil plegado y abierto con ☰ encima del mapa), base con `grid2/grid3` a 1 columna y scroll vertical, modales a 96vw con scroll, filas de tienda y mapa en 2 columnas; `@media (max-width: 460px)` encoge la barra. Ayuda: párrafo de CONTROLES TÁCTILES en ACCESIBILIDAD.
- [x] 24.3.5 Pruebas con Playwright emulando un móvil (`hasTouch`, viewport estrecho): la barra aparece y mover/esperar funcionan. *Hecho:* bloque `ctx12` (390×844, `hasTouch`, `isMobile`) en `tests/systems.cjs`: detección AUTO, sin scroll horizontal, rejilla de 1 columna, 20 botones ≥ 44 px, cruceta y esperar, agacharse, ☰, pulsación larga sin gastar turno, pellizco, y apagarlo desde la pausa. `window.__topolev.expUI` expuesto para las pruebas.

### 24.4 Localización (XL, por partes) — primera parte hecha; quedan 24.4.2/24.4.3 por completar sin bloquear el resto
- [x] 24.4.1 **Infraestructura**: `js/i18n/index.js` con `t(clave, vars)` (interpolación `{x}`, plural sencillo), idioma en `settings.lang` (`es` por defecto), carga de `js/i18n/es.js` y `js/i18n/en.js`; si falta una clave en inglés, cae al español (y en la consola de depuración se listan las que faltan). *Hecho:* `js/i18n/index.js` (`t`, `lang`, `setLang`, `cycleLang`, `applyLang`, `missingKeys`, `untranslated`, `loc`), `es.js`, `en.js`; `settings.lang` = `es`; `applyLang()` al arrancar (`main.js`); orden `i18n` en la consola de depuración.
- [ ] 24.4.2 Extraer los textos de la **interfaz** (menú principal, pestañas y botones de la base, panel de expedición, informe, ayuda) a `es.js`. *En curso:* extraídos el menú principal y el gestor de ranuras, los menús de la base y de pausa, la cabecera y las pestañas de la base, el HUD de la expedición (cabecera, títulos de los paneles, estado del agente), la pantalla CONTROLES, los nombres de las acciones, las filas de teclas de la ayuda y la barra táctil. **Falta:** el contenido de cada pestaña de la base (`base.js`, `base21.js`), el informe (`ReportScreen`), la ayuda (texto largo de `HelpScreen`), el inventario y el mapa grande. Patrón: `t('zona.clave')` en `es.js` con el texto exacto actual (las pruebas buscan los textos en español) y la traducción en `en.js`.
- [ ] 24.4.3 Extraer los **mensajes del registro** de la expedición más frecuentes (combate, extracción, objetos) — los de `exp/*.js` que se repiten. *En curso:* hechos los de `expui.js` (`log.*`: nada que recoger, sin medicinas, sin objetivos, sin camino, sin compañero, recarga de la habilidad…). **Falta:** los de `exp/combat.js`, `exp/extraction.js`, `exp/use.js` (importar `t` de `../i18n/index.js`).
- [x] 24.4.4 Datos del juego por archivos: nombres y descripciones de objetos, enemigos, zonas, talentos… con un sistema de «sobrescritura» por idioma (`i18n/en/items.js` con `{ id: { name, desc } }`) en lugar de duplicar los archivos de datos. *Hecho:* `i18n/en/data.js` (`zones`, `enemies`, `items` → `{ id: { name, desc } }`) y `applyDataLang()`, que sobrescribe `name`/`desc` en los propios `MAPS`/`ENEMIES`/`ITEMS` guardando el español en `_es` (no enumerable) para volver; como `ACTORS` comparte los objetos, también sale traducido. Traducidos: las 17 zonas, los 45 chebylitas y jefes y los objetos de nivel 0. Para más: añadir ids a `en/data.js` (o tipos nuevos en `SOURCES`).
- [x] 24.4.5 Traducción **inglesa** de la interfaz (24.4.2) como primer paso; selector de idioma en el menú; el resto se puede ir completando. *Hecho:* `en.js` cubre todas las claves de `es.js`; botón «IDIOMA: Español/English» (primero de `a11yButtons`, en el menú principal, la base y la pausa); `ExpeditionUI.relabel()` rehace títulos de paneles y la barra táctil al cambiarlo (y al empezar cada expedición).
- [x] 24.4.6 Pruebas: cambiar a inglés cambia el menú y las pestañas; claves que faltan caen al español sin romper nada. *Hecho:* bloque `ctx13` en `tests/systems.cjs` (menú, `<html lang>`, clave inexistente, interpolación, datos por id, pestañas, HUD y vuelta al español).

### 24.5 Música generativa y sonido (M) ✔
- [x] 24.5.1 Motor de **drones** en `audio.js` (WebAudio: 2–3 osciladores desafinados + filtro + LFO) con una «paleta» por estrato/zona (superficie, subsuelo, laboratorio, corium) y que sube de intensidad con el peligro (enemigos en alerta, pulso del reactor, jefe a la vista). *Hecho:* `music` en `audio.js` (`play`, `stop`, `setIntensity`, `sync`): 3 osciladores desafinados → filtro con LFO → trémolo → bus de música; voz disonante y trémolo que suben con la intensidad; paletas `superficie`, `subsuelo`, `laboratorio` (Objeto 7, Fénix, Wismut) y `corium` (Corium, Sarcófago) con `themeForZone(def)`; `ExpeditionUI.danger()` (enemigos a la vista y en alerta, jefe, pulso, abatidos) en cada turno.
- [x] 24.5.2 Música tranquila en la base (otro tema); fundidos al entrar/salir de la expedición. *Hecho:* tema `base` (tríada suave y campanas pentatónicas) en la base y el informe, silencio en el título; `show()` de `main.js` lo elige; fundido de ~2 s al cambiar de tema. Arranca tras el primer gesto (política de audio del navegador).
- [x] 24.5.3 **Volúmenes separados** (música / efectos) en los ajustes; `settings.music`. *Hecho:* buses `fxBus` y `musBus` bajo el maestro; `settings.music`, `musicVol` (0.4) y `sfxVol` (1); botones MÚSICA, VOL. MÚSICA y VOL. EFECTOS (pasos de 20%) en los tres menús (dentro de `a11yButtons`); SONIDO también apaga la música.
- [x] 24.5.4 Sonidos nuevos para lo añadido en las fases 19–23: granada con mecha (tic-tac), abatido (latido), levantar, supresión, encasquillar, agacharse, aullido/alarma de chebylitas, cambio de fase de jefe, élite a la vista. *Hecho:* `sfx.tick/heartbeat/revive/suppress/jam/crouch/howl/phase/elite`; el código de la expedición empuja `{ type: 'snd', s }` en `fx` (el renderizador lo ignora) y `playSounds` lo reproduce: mecha encendida (`nadeTick`), abatido y cada turno desangrándose, levantar, supresión, encasquillar, agacharse, aullido de jauría y sirena, fase de jefe y élite en el «¡Contacto!».
- [x] 24.5.5 Pruebas (sin errores con el sonido activado en Playwright; los volúmenes se guardan). *Hecho:* bloque `ctx14`: tema de la base, volúmenes guardados, MÚSICA NO/SÍ, drone de la zona, intensidad con lobos en alerta y los sonidos nuevos sin errores.

### 24.6 Logros y estadísticas ampliadas (M) ✔
- [x] 24.6.1 `data/achievements.js`: 30–40 logros con condición (primera extracción, 10 jefes, todos los trofeos, sin bajas en 10 expediciones, levantar a 20 abatidos, colección completa, cada final…). Se guardan **fuera de la partida** (localStorage propio, compartido entre ranuras). *Hecho:* 36 logros `{ id, name, desc, glyph, test(S, X), secret? }` (los 4 finales son secretos); `core/achievements.js` los guarda en `topolev_achievements_v1` (`{ id: { day, t } }`).
- [x] 24.6.2 Comprobación en los momentos clave (fin de expedición, muerte de jefe, `nextDay`, encargos, finales) y aviso con un toast y sonido. *Hecho:* `checkAchievements()` al final de `finalizeExpedition` (los nuevos van en `rep.achievements`), en `nextDay`, al abatir un jefe y en `endGame`; `setAchievementNotifier` (en `main.js`): toast «🏆 Logro: …» y `sfx.upgrade()`.
- [x] 24.6.3 **Estadísticas ampliadas** en `S.stats`: por zona (expediciones, extracciones, muertes), bajas por especie y por arma, rescates, granadas devueltas, críticos por la espalda, esencia por día, día récord… con migración para partidas viejas. *Hecho:* `statsDefaults` (en `upgrade()`): `zones` {exp, ext, deaths}, `killsBy`, `killsWeapon`, `essByDay`, `bestDay`, `rescues`, `nadesKicked`, `backstabs`, `bossKills`, `eliteKills`, `noLoss`/`bestNoLoss`; `statKill` (combat.js), `statBump` (rescates, patadas, espalda), `statExpedition` (campaign.js).
- [x] 24.6.4 Pantalla de **logros y estadísticas** (desde el menú principal y desde ARCHIVO). *Hecho:* `ui/achievements.js` (`achievementsModal`): rejilla de logros (los secretos como «???») y estadísticas de la partida cargada (generales, por zona, top de especies y armas).
- [x] 24.6.5 Pruebas (un logro se desbloquea y persiste tras borrar la ranura; estadísticas que suben). *Hecho:* bloque `ctx15`.

### 24.7 Modos de juego (L) ✔
- [x] 24.7.1 Selector de **modo** al crear partida (`S.mode`): Historia (lo de ahora, por defecto), Libre, Hierro, Desafío semanal, «1987». Se muestra en la ranura y en la cabecera de la base. *Hecho:* `core/modes.js` (`MODES`, `applyMode`, llamado al final de `newGame(n, opts)`); el selector va encima de las ranuras en NUEVA PARTIDA (sin paso extra, así las pruebas antiguas siguen igual) y pasa `{ mode, ngMods, carry }` a `hooks.onNew`; `info.mode`/`info.iron` en la ranura y `modeTag()` en la cabecera de la base.
- [x] 24.7.2 **Libre (sandbox)**: todas las zonas abiertas, sin cuota del Comité ni ataques a la base (o configurables), más rublos al empezar; sin actos ni finales. *Hecho:* `unlockAll`, 2000 ₽, `act = 0` y `flags.noStory` (`checkActs` no hace nada); `tickQuota` y `rollAttack` salen si `S.mode === 'libre'`.
- [x] 24.7.3 **Hierro**: guardado automático continuo en una sola ranura, sin «cargar partida» mientras dura (salir = guardar); al perder a todo el escuadrón y quedarse sin reclutas, la partida se borra (pantalla de «fin»). *Hecho:* `S.iron`: guardado en cada turno, sin EXPORTAR (menú de la base y ranuras), sin voluntario del Comité (`ensureVolunteer`); `ironOver()` en `rep.ironOver` y, al cerrar el informe, `main.js` borra la ranura y muestra «FIN · MODO HIERRO».
- [x] 24.7.4 **Desafío semanal**: semilla fija por semana ISO (`RNG` de la creación de agentes, del botín inicial y de los mapas de las 3 primeras zonas); objetivo de 15 días; **puntuación** (esencia + bajas + extracciones − muertes) y **tabla local** con las mejores marcas. *Hecho:* `isoWeek`, `weekSeed`; `newGame` usa `RNG(weekSeed)`; reclutas con la semilla (`ensureRecruits`); `mapSeed(mapIdx)` en `Expedition.create` para las zonas 0–2; `challengeDayTick()` en `nextDay` al pasar el día 15 → `topolev_challenge_v1` (`{ semana: [top 10] }`); la tabla se ve al elegir el modo.
- [x] 24.7.5 **Nueva partida+ «1987»**: se desbloquea al ver un final; empieza con un agente veterano o un trofeo de la partida anterior y modificadores acumulables (+1 nivel a los chebylitas, alerta del reactor +1, menos rublos…), elegibles al crearla. *Hecho:* `saveLegacy(ending)` en `endGame` (mejor agente + un trofeo → `topolev_legacy_v1`); `ngUnlocked()` (legado o logro de final); `NG_MODS`: `lvl` (+1 en `zoneWorld().grow`), `alert` (+1 en `reactorAlert`), `poor` (200 ₽); `carry: 'agent' | 'trophy'`.
- [x] 24.7.6 Pruebas (cada modo crea su estado; Hierro no permite cargar; desafío con la misma semilla genera lo mismo; 1987 aplica sus modificadores). *Hecho:* bloque `ctx16`.

### 24.8 Enciclopedia dentro del juego (M) ✔
- [x] 24.8.1 Pestaña o pantalla **ENCICLOPEDIA** (desde ARCHIVO y el menú de pausa) que reutiliza las secciones de `admin.js` (extraer las funciones de render a un módulo común, p. ej. `ui/codex.js`, para no duplicar). *Hecho:* `ui/codex.js` (`codexModal`, secciones chebylitas/objetos/zonas/facciones/notas/trofeos) desde ARCHIVO y el menú de pausa; lo compartido con `admin.js` (`ecoLines`, `ZONE_TYPE`, `zonesOf`, `escHTML`) pasó a `util/codexlines.js`, que solo depende de los datos.
- [x] 24.8.2 Solo muestra **lo descubierto**: chebylitas vistos (`S.bestiary`), objetos encontrados (registrar `S.seenItems` al recoger o comprar), zonas abiertas, facciones conocidas, notas leídas, trofeos conseguidos; lo demás aparece como «???». *Hecho:* `S.seenItems` con `seeItem()` (al recoger en `takeItem` y, en cada `save()`, todo lo del almacén y los agentes); facciones conocidas = `S.met` + chebylitas y KGB; contadores «vistos/total» en cada pestaña.
- [x] 24.8.3 Búsqueda y enlaces cruzados (de un enemigo a sus zonas, de una zona a sus enemigos y jefe). *Hecho:* buscador (solo entre lo descubierto; no deja pasar las teclas a la expedición) y enlaces `.cx-link` que cambian de sección y resaltan la entrada.
- [x] 24.8.4 Pruebas (lo no descubierto aparece oculto; tras ver un chebylita aparece). *Hecho:* bloque `ctx17` (y `admin.html` comprobado a mano tras mover las funciones).

### 24.9 Cierre de la fase
- [ ] 24.9.1 Revisión general de la ayuda y del Archivo con todo lo nuevo; teclas en la ayuda leídas de la tabla de controles.
- [ ] 24.9.2 `systems.cjs` completo dos veces, `mapgen.mjs`, `smoke.cjs` en 3–4 zonas (también con el modo daltónico y el contraste activados); marcar la fase con ✔ y actualizar `plan.md`.

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
