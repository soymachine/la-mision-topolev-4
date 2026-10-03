# LA MISIÓN TOPOLEV — Plan de desarrollo

> Extraction-looter por turnos, estética ASCII moderna, ambientado en la central de Chernóbil (era soviética).
> Web (GitHub Pages), sin build: HTML + CSS + JavaScript (módulos ES). Guardado en `localStorage`. Todo en español.
>
> **Convención**: `[x]` = tarea terminada, `[ ]` = pendiente, `[~]` = parcial. Cada sesión debe continuar
> por la primera tarea no marcada y actualizar este archivo al completar tareas (y hacer commit + push).

---

## 0. Decisiones de diseño (referencia rápida)

### Arquitectura de archivos
```
index.html            · esqueleto de pantallas, carga de fuente y main.js
css/style.css         · tema negro/naranja, CRT, marcos ASCII, rollovers
js/main.js            · arranque, router de pantallas
js/util/rng.js        · RNG con semilla (mulberry32) + utilidades
js/util/dom.js        · helpers DOM, marcos ASCII (ResizeObserver), tooltip, modales, toasts, drag&drop
js/data/*.js          · datos: rarezas, objetos, enemigos, mapas, módulos, nombres, textos
js/core/state.js      · estado global, nueva partida, guardar/cargar (localStorage, versión)
js/core/items.js      · generación de objetos, afijos, nombres, valor, tooltips
js/core/agents.js     · generación de agentes, estadísticas derivadas, XP
js/exp/mapgen.js      · generación procedural (sectores: salas BSP + cavernas autómata), POIs, extracciones
js/exp/fov.js         · shadowcasting
js/exp/path.js        · A* + mapas Dijkstra
js/exp/expedition.js  · simulación por turnos: movimiento, combate, IA, peligros, botín, extracción
js/render/ascii.js    · renderer canvas en rejilla (capa estática cacheada + capa dinámica)
js/render/particles.js· partículas ASCII (chispas, trazadoras, números de daño, esencia)
js/render/minimap.js  · minimapa / mapa completo con POIs
js/ui/*.js            · título, base (pestañas), HUD de expedición, informe, instrucciones
js/audio.js           · sintetizador WebAudio (Geiger, disparos, UI) con silencio opcional
```

### Estructura del mundo
- 1 **Mundo** → 5 **Mapas** (localizaciones) con nivel de dificultad distinto (Nv medio 1–2, 3–4, 5–6, 7–8, 9–10).
- Cada mapa se genera **proceduralmente en cada expedición** dividido en **sectores/zonas** con nombre.
- Cada mapa tiene **POIs**: nidos de chebylitas (con nivel visible), vetas de esencia, alijos de botín, peligros (radiación, gas, anomalías).
- **Puntos de extracción** permanentes en los extremos (siempre visibles) + **extracciones temporales** aleatorias que aparecen N turnos (visibles en el radar).
- El mapa siguiente se desbloquea al extraer con éxito del anterior.

### Recursos
- **Esencia** (de chebylitas y vetas) → mejoras de módulos del laboratorio.
- **Rublos** (venta de botín) → intendencia (compras), reclutamiento, tratamientos.

### Agentes
- Atributos: Salud, Puntería, Agilidad, Resistencia + rasgo. Nivel/XP.
- Equipo: Arma 1, Arma 2, Armadura, Casco, Gadget ×2, Mochila (capacidad).
- Muerte = pérdida permanente del agente + todo su equipo + botín recogido. Extracción = todo vuelve a la base.

### Rarezas
| Rareza | Color |
|---|---|
| Común | gris/blanco `#c8c8c8` |
| No común | verde `#3ddc6b` |
| Raro | azul `#3d8bff` |
| Épico | lila `#b05cff` |
| Legendario | oro/naranja `#ffb02e` |
| Mítico | rojo `#ff2b3a` |

### Colores
- Base negro + naranja (variaciones de naranja para el mapa).
- Cada tipo de chebylita tiene su propio tono; **más tenue a nivel bajo, más intenso a nivel alto**.

### Controles de expedición (resumen)
WASD/flechas/numpad + QEZC diagonales · clic para viajar · clic en enemigo para disparar · T apuntar (Tab ciclo, F/Enter dispara) ·
R recargar · X cambiar arma · F interactuar/extraer/minar/evacuar · G recoger · H curarse · B lanzar granada · Tab / 1-4 cambiar agente ·
O órdenes del escuadrón · I inventario · M mapa · Espacio esperar · ? ayuda · +/- zoom · Esc menú.

---

## FASE 1 — Planificación y esqueleto
- [x] 1.1 Plan detallado (`plan.md`)
- [x] 1.2 `index.html`, `.nojekyll`, estructura de carpetas
- [x] 1.3 CSS base: tema negro/naranja, fuente monoespaciada, pantalla completa, scanlines/viñeta CRT
- [x] 1.4 Router de pantallas (título, base, expedición, informe) en `main.js`

## FASE 2 — Núcleo
- [x] 2.1 RNG con semilla + utilidades (rangos, pesos, shuffle)
- [x] 2.2 Estado global + nueva partida
- [x] 2.3 Guardado/carga en `localStorage` (versión, autosave, guardado de expedición en curso)
- [x] 2.4 Helpers DOM: marcos ASCII con ResizeObserver, tooltip, modales, toasts
- [x] 2.5 Drag & drop genérico (pointer events) con fantasma ASCII

## FASE 3 — Datos del juego
- [x] 3.1 Rarezas (colores, multiplicadores, pesos por nivel)
- [x] 3.2 Objetos: armas, munición, armaduras, cascos, gadgets, consumibles, valiosos
- [x] 3.3 Afijos por categoría y nombres por rareza (míticos con nombre propio)
- [x] 3.4 Chebylitas: 10 tipos + 2 jefes (origen animal/roca/planta/hongo/mineral), habilidades, lore
- [x] 3.5 Mapas: 5 localizaciones con nivel, tamaño, tipos de sector, enemigos posibles
- [x] 3.6 Módulos de la base y costes de mejora
- [x] 3.7 Nombres de agentes, rasgos, nombres de sectores

## FASE 4 — Generación procedural
- [x] 4.1 División en sectores y asignación de tipo de zona
- [x] 4.2 Salas industriales (BSP) + pasillos
- [x] 4.3 Cavernas (autómata celular) + agua/escombros
- [x] 4.4 Conexión entre sectores y verificación de conectividad (flood fill)
- [x] 4.5 Punto de inserción y extracciones permanentes en extremos
- [x] 4.6 POIs: nidos con nivel, vetas de esencia, alijos, peligros
- [x] 4.7 Enemigos errantes y contenedores dispersos

## FASE 5 — Simulación de expedición
- [x] 5.1 FOV shadowcasting compartido por el escuadrón + niebla de guerra
- [x] 5.2 Movimiento, colisiones, puertas
- [x] 5.3 Sistema de turnos con velocidad (energía) para enemigos
- [x] 5.4 Combate a distancia y cuerpo a cuerpo (probabilidad, daño, armadura, críticos, cargador, recarga)
- [x] 5.5 IA enemiga: dormido / alerta / errante / fijo, mapa Dijkstra, ruido
- [x] 5.6 Habilidades especiales (veneno, explosión de esporas, carga, invocación, aura, a distancia)
- [x] 5.7 Compañeros con IA y órdenes (seguir / mantener / fuego libre)
- [x] 5.8 Peligros: radiación, gas, fuego, anomalías; radiación acumulada del agente
- [x] 5.9 Botín: drops, contenedores, recoger, vetas de esencia (minado ruidoso)
- [x] 5.10 Consumibles y granadas (lanzamiento con área)
- [x] 5.11 Extracción con cuenta atrás, extracciones temporales, baliza
- [x] 5.12 Muerte de agentes, fin de expedición, informe

## FASE 6 — Interfaz de expedición
- [x] 6.1 Renderer ASCII en canvas con cámara, zoom y capa estática cacheada
- [x] 6.2 Entidades con interpolación suave de movimiento
- [x] 6.3 HUD: barra superior, tarjetas de agentes, registro de mensajes
- [x] 6.4 Minimapa siempre visible + mapa completo (M) con POIs, niveles y extracciones
- [x] 6.5 Rollover de casillas con tooltip (enemigo: nivel, salud, % impacto)
- [x] 6.6 Modo apuntar + clic para disparar, viaje por clic con interrupción
- [x] 6.7 Inventario de expedición con drag & drop (equipar, usar, tirar)
- [x] 6.8 Ayuda de controles (?)

## FASE 7 — La base
- [x] 7.1 Cabecera con recursos + pestañas
- [x] 7.2 CUARTEL: resumen, mensajes del Dr. Topolev, último informe
- [x] 7.3 EQUIPO: lista de agentes, ficha, ranuras + mochila, almacén con drag & drop, tratamiento
- [x] 7.4 Reclutamiento de agentes
- [x] 7.5 LABORATORIO: mejoras de módulos
- [x] 7.6 INTENDENCIA: comprar / vender (stock rotativo por día)
- [x] 7.7 EXPEDICIÓN: selección de mapa y escuadrón, lanzamiento
- [x] 7.8 ARCHIVO: bestiario, caídos, estadísticas, instrucciones

## FASE 8 — Pulido visual y sonido
- [x] 8.1 Partículas: fogonazos, trazadoras, impactos, muerte (fragmentos), esencia volando
- [x] 8.2 Números de daño flotantes, sacudida de pantalla, parpadeos
- [x] 8.3 Animaciones de casillas: radiación, agua, extracción pulsante, anomalías
- [x] 8.4 Partículas de UI (compras, mejoras) y logo ASCII animado en el título
- [x] 8.5 Sonido sintetizado (Geiger, disparos, UI) con botón de silencio

## FASE 9 — Pantallas complementarias
- [x] 9.1 Pantalla de título (nueva, continuar, instrucciones, borrar)
- [x] 9.2 Intro narrativa (máquina de escribir) al empezar
- [x] 9.3 Sección de Instrucciones completa
- [x] 9.4 Informe de expedición (éxito / pérdidas)

## FASE 10 — Pruebas, balance y despliegue
- [x] 10.1 Prueba automatizada de humo (Playwright): carga, nueva partida, lanzar expedición, turnos
- [x] 10.2 Balance inicial de economía y dificultad
- [x] 10.3 Revisión de errores de consola y rendimiento
- [x] 10.4 Instrucciones de GitHub Pages en README.md

## Estado
- Juego completo y jugable (fases 1–12). Probado con Playwright (bot automático en las 5 zonas, guardado/carga a mitad de expedición, drag & drop, compras).
- Fase 13 (cimientos técnicos) completada: partes de la expedición, facciones y personas, motor de eventos/diálogos, guardado v2 con 3 ranuras y consola de depuración.
- Fase 14 completada: contenedores de seguridad (KGB, Kolyma, Matrioska) y ascenso de agentes (atributos + talentos).
- Fase 15 completada: atributos 1–10, trasfondos, 7 especializaciones con árboles de talentos y habilidades activas, rasgos adquiridos, condecoraciones, heridas y retiro como instructor.
- Fase 16 completada: casillas con mecánica (cobertura, destructibles, puertas blindadas, terminales…), 2–3 pisos por zona, luz y oscuridad, modificadores de zona diarios y (tras la fase 20) encargos especiales de un día ligados a cada modificador.
- Fase 17 completada: 12 zonas nuevas (6 de superficie con día/noche y clima, 6 de subsuelo), mapa ASCII de la región con progresión por requisitos, campamento social Wismut, equipo occidental y zonas de evento temporales.
- Fase 18 completada: 12 facciones con reputación (pestaña RADIO), IA humana (cobertura, granadas, radio, rendición), encuentros y prisioneros, bengala roja, campamentos abandonados con diarios extranjeros, 31 objetos extranjeros y el KGB vigilando.
- Fase 19 completada: ranura COMPAÑERO y Garaje, perro robot Laika-M con órdenes y módulos, 5 drones (tecla D) y 12 gadgets creativos (torreta, jaula, cámara, desfibrilador, gancho, soldadura, ruido blanco, centelleo, grabadora, sonda sísmica, camuflaje, paraguas).
- Fase 20 completada: arco en tres actos con escenas ASCII y 4 finales, confianza del Dr. Topolev y personal de la base con voz propia, comedor, cartas y epitafios, afinidad entre agentes, estrés con aflicciones y virtudes, 9 encargos, 80 notas en 8 colecciones, radio interceptada y crónica exportable.
- Fase 21 completada: plano de 16 parcelas con 17 edificios, investigación (16 proyectos) y celda de contención, materiales y taller de fabricación (16 recetas, desmontar), cuota del Comité, mercado negro y precios por demanda, calendario con estaciones e historia, defensa de la base y operaciones simultáneas.
- Fase 22 completada: 20 chebylitas nuevos con habilidades propias, élites con afijos, cadena alimentaria y cebo, 10 jefes de zona con fases y trofeos únicos, mundo persistente (nidos que vuelven, zonas que crecen) y alerta del reactor.
- Fase 23 completada: cobertura media/total y flanqueo, sigilo (agacharse, detección, ataques por la espalda, emboscadas), agentes abatidos que se pueden levantar, munición especial seleccionable y fuego de supresión, durabilidad y encasquillamientos, granadas que rebotan con mecha y patada.
- **Siguiente sesión:** fase 24, **desde la subtarea 24.3.1** (24.1 y 24.2 hechas). La fase está desglosada en subtareas en [`plan-ampliacion.md`](plan-ampliacion.md) (sección «FASE 24», con instrucciones para retomarla a medias). Al terminar cada subtarea, marcarla allí y actualizar esta línea; commit + push al cerrar cada subfase (24.1, 24.2…).

## FASE 12 — Ampliación del arsenal (petición del usuario)
- [x] 12.1 69 armas (×4) en `js/data/weapons.js`, cada una con dibujo ASCII visible en su tooltip; nuevos tipos lanzador (explosión) y 5 municiones nuevas
- [x] 12.2 Mods de armas (`js/data/mods.js`): 31 mods en 6 ranuras (óptica, boca, empuñadura, cargador, culata, bajo cañón) compatibles por tipo de arma, con excepciones por arma; montaje por drag & drop en EQUIPO
- [x] 12.3 49 consumibles (×4): potenciadores temporales, curas, granadas (impacto, antitanque, química, aturdidora, humo, termita, esencia), trampas, detector, planos, cajas de munición, cohetes de señales
- [x] 12.4 31 gadgets (×3, sin la mira PSO, que pasa a ser mod) con sinergias: juntos/separado/quieto/herido/último aliento, auras, equipo, conjuntos y disparadores (al matar, espinas, imán, autoinyector…)
- [x] 12.5 Catálogo admin.html actualizado (mods, dibujos, sinergias) e instrucciones del juego
- [x] 12.6 Migración de partidas antiguas (gadget PSO → mod)

## FASE 11 — Ideas futuras (opcional)
- [x] 11.1 Eventos narrativos aleatorios en expedición (radio, supervivientes)
- [x] 11.2 Crafteo con esencia (objetos míticos)
- [ ] 11.3 Más jefes y mapas
- [x] 11.4 Modo accesibilidad (fuente mayor, alto contraste)
