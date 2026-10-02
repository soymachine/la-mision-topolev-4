# ☢ La Misión Topolev

Extraction-looter por turnos en ASCII ambientado en la central nuclear de Chernóbil (1986).
Juego web sin dependencias ni proceso de compilación: HTML + CSS + JavaScript (módulos ES).
La partida se guarda automáticamente en el `localStorage` del navegador.

## Jugar en GitHub Pages

1. En GitHub, abre el repositorio y ve a **Settings → Pages**.
2. En **Build and deployment → Source** elige **Deploy from a branch**.
3. En **Branch** elige la rama con el juego (`main` si se ha fusionado, o `claude/zen-shannon-rlqxbz`) y la carpeta **`/ (root)`**. Pulsa **Save**.
4. Espera 1–2 minutos. El juego estará en:
   `https://<tu-usuario>.github.io/la-mision-topolev-4/`
   (para este repositorio: <https://soymachine.github.io/la-mision-topolev-4/>)

El archivo `.nojekyll` evita que GitHub procese el sitio con Jekyll.

## Catálogo del contenido (`admin.html`)

`admin.html` es una web de consulta con todo lo que contiene el juego: armas, munición, protecciones, gadgets, mochilas, consumibles, botín, rarezas, propiedades, chebylitas, zonas, casillas, módulos, rasgos y textos narrativos. Lee directamente los archivos de `js/data/`, así que se actualiza sola cuando se añade contenido.
En GitHub Pages: `https://soymachine.github.io/la-mision-topolev-4/admin.html`

## Jugar en local

Los módulos ES no funcionan abriendo `index.html` con doble clic (`file://`). Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```

## Estructura

```
index.html          pantallas y carga
css/style.css       tema negro/naranja, marcos ASCII, CRT
js/main.js          arranque y navegación
js/admin.js         catálogo de contenido (admin.html)
js/util/            RNG con semilla, helpers DOM (marcos, tooltips, modales, drag & drop)
js/data/            objetos, rarezas, chebylitas, mapas, módulos, casillas
js/core/            estado y guardado, objetos, agentes, lógica de campaña
js/exp/             generación procedural, FOV, caminos, simulación por turnos
js/render/          renderer ASCII en canvas, partículas, minimapa
js/ui/              base, expedición, título, intro, informe, instrucciones, partículas de UI
js/audio.js         sonido sintetizado con WebAudio
plan.md             plan de desarrollo por fases (hecho)
plan-ampliacion.md  hoja de ruta de la ampliación masiva (fases 13–24)
```

Dentro del juego, la sección **Instrucciones** explica las reglas y los controles.

## Prueba de humo

```bash
python3 -m http.server 8000 &
npm i -D playwright   # una sola vez
node tests/smoke.cjs 0   # 0..4 = zona
node tests/systems.cjs   # facciones, eventos, diálogos, consola y guardado
```

## Consola de depuración

Pulsa **º** (o la tecla `` ` ``) en partida, o abre el juego con `?debug` en la URL. Escribe `help` para ver las órdenes:
`give`, `spawn`, `kill`, `tp`, `reveal`, `heal`, `god`, `wait`, `extract`, `day`, `ess`, `rub`, `rel`, `rep`, `flag`, `events`, `event`, `dialog`.
Tab completa órdenes e identificadores.
