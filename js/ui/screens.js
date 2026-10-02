// Pantallas: título, intro, informe de expedición, instrucciones
import { el, panel, esc, confirmBox, UI_SCALES, cycleUiScale } from '../util/dom.js';
import { S, hasSave, settings, saveSettings } from '../core/state.js';
import { RARITIES } from '../data/rarity.js';
import { ENEMIES, enemyColor } from '../data/enemies.js';
import { MAPS } from '../data/world.js';
import { sfx } from '../audio.js';
import { FONT } from '../render/ascii.js';
import { uiBurst } from './fx.js';
import { toggleFullscreen } from './expui.js';

// ------------------------------------------------------------ logo ASCII
function asciiLogo(lines, cols) {
  const c = document.createElement('canvas');
  const cw = 6, ch = 10;
  const rows = lines.length * 9;
  c.width = cols * cw; c.height = rows * ch;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    let size = 120;
    x.font = `800 ${size}px ${FONT}`;
    while (x.measureText(ln).width > c.width * 0.96 && size > 10) { size -= 4; x.font = `800 ${size}px ${FONT}`; }
    x.fillText(ln, c.width / 2, (i + 0.5) * (c.height / lines.length));
  });
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const ramp = ' ·:░▒▓█';
  let out = '';
  for (let r = 0; r < rows; r++) {
    let row = '';
    for (let col = 0; col < cols; col++) {
      let s = 0, n = 0;
      for (let yy = 0; yy < ch; yy += 2) for (let xx = 0; xx < cw; xx += 2) { s += d[((r * ch + yy) * c.width + col * cw + xx) * 4]; n++; }
      const v = s / n / 255;
      row += ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))];
    }
    out += row.replace(/\s+$/, '') + '\n';
  }
  return out.replace(/^\s*\n/gm, '');
}

export class TitleScreen {
  constructor(root, hooks) { this.root = root; this.hooks = hooks; }
  open() {
    const R = this.root;
    R.innerHTML = '';
    this.bg = el('canvas', { id: 'title-bg' });
    const cols = Math.max(50, Math.min(110, Math.floor(innerWidth / 6.2) - 4));
    const logoTxt = asciiLogo(['LA MISIÓN', 'TOPOLEV'], cols);
    this.logo = el('pre', { id: 'title-logo', text: logoTxt });
    this.logoTxt = logoTxt;
    const menu = el('div', { class: 'title-menu' });
    const btn = (label, fn, cls = '') => {
      const b = el('button', { class: 'btn ' + cls, onclick: (ev) => { sfx.click(); uiBurst(ev.clientX, ev.clientY, { n: 10 }); fn(); } }, label);
      b.addEventListener('pointerenter', () => sfx.hover());
      return b;
    };
    const has = hasSave();
    if (has) menu.append(btn('CONTINUAR', () => this.hooks.onContinue(), 'primary'));
    menu.append(btn('NUEVA PARTIDA', async () => {
      if (has && !(await confirmBox('NUEVA PARTIDA', 'Se borrará la partida guardada. ¿Continuar?', 'BORRAR Y EMPEZAR', 'CANCELAR', true))) return;
      this.hooks.onNew();
    }, has ? '' : 'primary'));
    menu.append(btn('INSTRUCCIONES', () => this.hooks.onHelp()));
    menu.append(btn('PANTALLA COMPLETA', () => toggleFullscreen()));
    menu.append(btn(`SONIDO: ${settings.sound ? 'SÍ' : 'NO'}`, () => { settings.sound = !settings.sound; saveSettings(); this.open(); }));
    menu.append(btn(`EFECTO CRT: ${settings.crt ? 'SÍ' : 'NO'}`, () => { settings.crt = !settings.crt; document.body.classList.toggle('no-crt', !settings.crt); saveSettings(); this.open(); }));
    menu.append(btn(`TEXTO: ${UI_SCALES[settings.uiScale || 0].name}`, () => { cycleUiScale(); this.open(); }));
    R.append(this.bg, el('div', { class: 'title-wrap' },
      this.logo,
      el('div', { class: 'title-sub', text: 'CHERNÓBIL · RSS DE UCRANIA · 1986' }),
      menu,
    ), el('div', { class: 'title-foot', text: 'Un extraction-looter por turnos · ☢ · guardado automático en este navegador' }));
    this.startBg();
  }
  close() { this.running = false; }
  startBg() {
    this.running = true;
    const c = this.bg, ctx = c.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; };
    resize();
    const fs = 14, cw = 9, chh = 16;
    let last = 0;
    const ramp = ' .·:-=+*%#';
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      if (now - last < 66) return;
      last = now;
      if (c.width !== innerWidth * dpr) resize();
      const t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.font = `${fs}px ${FONT}`;
      ctx.textBaseline = 'top';
      const cols = Math.ceil(innerWidth / cw), rows = Math.ceil(innerHeight / chh);
      const cx = cols / 2, cy = rows / 2;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const dx = (x - cx) / cols, dy = (y - cy) / rows * 0.6;
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = Math.sin(d * 28 - t * 1.6) * 0.5 + Math.sin(x * 0.11 + t * 0.7) * 0.25 + Math.sin(y * 0.17 - t * 0.5) * 0.25;
        const f = v * (1 - d * 1.4);
        if (f < 0.25) continue;
        const idx = Math.min(ramp.length - 1, Math.floor(f * ramp.length));
        ctx.fillStyle = `rgba(255,138,31,${Math.min(0.22, f * 0.2)})`;
        ctx.fillText(ramp[idx], x * cw, y * chh);
      }
      // glitch del logo
      if (Math.random() < 0.08) {
        const chars = this.logoTxt.split('');
        for (let i = 0; i < 12; i++) { const k = Math.floor(Math.random() * chars.length); if (chars[k] !== '\n' && chars[k] !== ' ') chars[k] = '▒░▓#%'[Math.floor(Math.random() * 5)]; }
        this.logo.textContent = chars.join('');
        this.logo.style.transform = `translateX(${(Math.random() - 0.5) * 6}px)`;
        setTimeout(() => { this.logo.textContent = this.logoTxt; this.logo.style.transform = ''; }, 90);
      }
    };
    requestAnimationFrame(loop);
  }
}

// ------------------------------------------------------------ intro
const INTRO = `PRÍPIAT · RSS DE UCRANIA · MAYO DE 1986
TELEGRAMA CIFRADO — PRIORIDAD MÁXIMA

Camarada director:

Hace pocas semanas que el reactor número 4 de la Central
V. I. Lenin explotó. Los comunicados oficiales hablan de un
accidente bajo control. No lo está.

Bajo el hormigón, la radiación ha despertado algo. Ratas,
lobos, musgo... incluso la roca y el grafito del reactor se
mueven, cazan y anidan. Los llamamos CHEBYLITAS.

Cuando mueren dejan tras de sí una sustancia luminosa: la
ESENCIA. Con ella podemos construir lo que nadie imaginó.

Usted dirigirá el Puesto Pripyat-7. Equipe a sus agentes,
envíelos a las profundidades y tráigalos de vuelta con
esencia y todo lo que encuentren.

Si caen allí abajo, lo perderán todo.
Si regresan, la ciencia soviética avanzará.

Bienvenido a la Misión Topolev.

    — Dr. Arkadi Topolev, Instituto Kurchátov`;

export class IntroScreen {
  constructor(root, hooks) { this.root = root; this.hooks = hooks; }
  open() {
    const R = this.root;
    R.innerHTML = '';
    const txt = el('div', { class: 'intro-text' });
    const box = panel({ title: 'TELEGRAMA', cls: 'intro-box', frame: 'double' }, txt, el('div', { class: 'actions', style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1em' } }, el('button', { class: 'btn primary', onclick: () => this.finish() }, 'COMENZAR')));
    R.append(box);
    let i = 0;
    this.done = false;
    const tick = () => {
      if (this.done) return;
      i += 2;
      txt.innerHTML = esc(INTRO.slice(0, i)) + '<span class="cur">█</span>';
      if (i % 6 === 0) sfx.type();
      if (i < INTRO.length) this.timer = setTimeout(tick, INTRO[i] === '\n' ? 90 : 18);
      else txt.innerHTML = esc(INTRO) + '<span class="cur">█</span>';
    };
    tick();
    this.skip = (ev) => {
      if (!R.classList.contains('active')) return;
      if (i < INTRO.length) { i = INTRO.length - 1; clearTimeout(this.timer); tick(); }
      else if (ev.type === 'keydown' && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape')) this.finish();
    };
    window.addEventListener('keydown', this.skip);
    R.addEventListener('click', this.skip);
  }
  finish() {
    this.done = true;
    clearTimeout(this.timer);
    window.removeEventListener('keydown', this.skip);
    this.hooks.onDone();
  }
}

// ------------------------------------------------------------ informe
export class ReportScreen {
  constructor(root, hooks) { this.root = root; this.hooks = hooks; }
  open(rep) {
    const R = this.root;
    R.innerHTML = '';
    const res = { success: ['EXTRACCIÓN COMPLETADA', 'good'], partial: ['EXTRACCIÓN CON BAJAS', 'warn'], fail: ['ESCUADRÓN PERDIDO', 'bad'] }[rep.result];
    const p = panel({ title: 'INFORME DE EXPEDICIÓN', cls: 'report-box', frame: 'double', bodyCls: 'scroll' });
    const B = p.body;
    B.append(
      el('div', { class: res[1], style: { fontSize: '22px', fontWeight: 800, letterSpacing: '.2em', textAlign: 'center', margin: '.5em 0', textShadow: '0 0 12px currentColor' }, text: `══ ${res[0]} ══` }),
      el('div', { class: 'dimt', style: { textAlign: 'center' }, text: `${rep.map} · día ${rep.day} · ${rep.turns} turnos · ${rep.kills} chebylitas abatidos` }),
      el('div', { class: 'sep', text: '─'.repeat(200) }),
    );
    const essEl = el('span', { class: 'cyan', style: { fontSize: '20px', fontWeight: 800 }, text: '0' });
    B.append(el('div', { style: { textAlign: 'center', margin: '.5em 0' } }, el('span', { class: 'h', text: 'ESENCIA RECUPERADA  ' }), essEl, el('span', { class: 'cyan', text: ' ✦' }), rep.essRaw && rep.ess !== rep.essRaw ? el('span', { class: 'dimt', text: `  (${rep.essRaw} + bonificación del laboratorio)` }) : ''));
    for (const ag of rep.agents) {
      const box = el('div', { style: { margin: '6px 0' } });
      box.append(el('div', { html: `<span style="color:${ag.color};font-weight:700">@</span> <b>${esc(ag.name)}</b> <span class="dimt">Nv ${ag.lvl}</span> — ${ag.status === 'extraído' ? '<span class="cyan">⇑ EXTRAÍDO</span>' : '<span class="bad">✝ MUERTO EN COMBATE</span>'}${ag.lvlUp > 0 ? ` <span class="warn">★ +${ag.lvlUp} nivel</span>` : ''} <span class="dimt">· ${ag.kills} bajas · ${ag.ess} ✦</span>` }));
      if (ag.status === 'extraído' && ag.items.length) {
        box.append(el('div', { style: { paddingLeft: '3ch' }, html: ag.items.map((it) => `<span style="color:${RARITIES[it.r].color}">${esc(it.name)}${it.q > 1 ? ' ×' + it.q : ''}</span>`).join('<span class="o5"> · </span>') }));
      } else if (ag.status !== 'extraído') box.append(el('div', { class: 'dimt', style: { paddingLeft: '3ch' }, text: 'Todo su equipo y el botín recogido se han perdido.' }));
      B.append(box);
    }
    if (rep.unlocked) B.append(el('div', { class: 'sep', text: '─'.repeat(200) }), el('div', { class: 'good', style: { textAlign: 'center', fontWeight: 700 }, text: `☢ NUEVA ZONA ACCESIBLE: ${rep.unlocked.toUpperCase()}` }));
    B.append(el('div', { class: 'sep', text: '─'.repeat(200) }), el('div', { class: 'dimt', text: 'Los objetos extraídos siguen en las mochilas de los agentes. Usa «DESCARGAR MOCHILA» en EQUIPO para pasarlos al almacén y vende el botín en la INTENDENCIA.' }));
    B.append(el('div', { style: { textAlign: 'center', marginTop: '1em' } }, el('button', { class: 'btn primary', onclick: () => { sfx.click(); this.hooks.onDone(); } }, 'VOLVER A LA BASE')));
    R.append(p);
    // cuenta ascendente
    let v = 0;
    const step = Math.max(1, Math.ceil(rep.ess / 40));
    const iv = setInterval(() => {
      v = Math.min(rep.ess, v + step);
      essEl.textContent = v;
      if (v % 3 === 0) sfx.type();
      if (v >= rep.ess) {
        clearInterval(iv);
        if (rep.ess > 0) { const r = essEl.getBoundingClientRect(); uiBurst(r.left + r.width / 2, r.top + r.height / 2, { n: 30, chars: ['✦', '*', '·'], colors: ['#5ff7ff', '#fff'] }); sfx.essence(); }
      }
    }, 30);
    if (rep.result === 'fail') sfx.death(); else sfx.evac();
  }
}

// ------------------------------------------------------------ instrucciones
export class HelpScreen {
  constructor(root, hooks) { this.root = root; this.hooks = hooks; }
  open() {
    const R = this.root;
    R.innerHTML = '';
    const p = panel({ title: 'INSTRUCCIONES', cls: 'help-box', frame: 'double', bodyCls: 'scroll', right: 'Esc para volver' });
    const rar = RARITIES.map((r) => `<span style="color:${r.color}">■ ${r.name}</span>`).join(' &nbsp; ');
    const lvlDemo = [1, 3, 5, 7, 10].map((l) => `<span style="color:${enemyColor(196, l)};font-weight:700">Л</span><span class="dimt">${l}</span>`).join(' ');
    const maps = MAPS.map((m) => `<li><b>${m.name}</b> — nivel ${m.lvl[0]}–${m.lvl[1]}</li>`).join('');
    p.body.innerHTML = `
<h2>OBJETIVO</h2>
<p>Diriges el <b>Puesto Pripyat-7</b>. Envía escuadrones de agentes a las profundidades de la central de Chernóbil, abate <b>chebylitas</b>, recoge su <span class="cyan">✦ esencia</span> y todo el botín que puedas, y vuelve por un <span class="cyan">⌂ punto de extracción</span>.</p>
<ul>
<li>Si un agente <b class="bad">muere</b>, pierde para siempre todo lo que llevaba encima: su equipo y el botín recogido.</li>
<li>Si <b class="cyan">escapa</b>, todo lo que lleve (equipo + botín) y su esencia vuelven a la base.</li>
<li>Con la esencia y los rublos mejoras los módulos de la base para conseguir mejor material y llegar más hondo.</li>
</ul>

<h2>LA BASE</h2>
<ul>
<li><b>CUARTEL</b>: resumen, mensajes del Dr. Topolev y último informe.</li>
<li><b>EQUIPO</b>: <b>arrastra y suelta</b> objetos entre el almacén, las ranuras del agente y su mochila. Doble clic para moverlos rápido. Puedes tratar heridas y radiación pagando rublos.</li>
<li><b>BARRACONES</b>: recluta nuevos agentes (llegan candidatos cada día) o despide a los que sobren.</li>
<li><b>LABORATORIO</b>: mejora los módulos (Armería, Polvorín, Blindaje, Enfermería, Taller, Radar, Barracones, Almacén y Laboratorio de esencia) con esencia y rublos. En la <b>Forja de esencia</b> puedes arrastrar una pieza de equipo para subir su rareza; los cristales de esencia se convierten aquí.</li>
<li><b>INTENDENCIA</b>: compra material (el catálogo cambia cada día) y vende el botín. El botín <span style="color:#ffb02e">$</span> se vende a precio completo.</li>
<li><b>EXPEDICIÓN</b>: elige destino según su <b>nivel medio</b> y forma el escuadrón.</li>
<li><b>ARCHIVO</b>: bestiario, memorial de caídos y estadísticas.</li>
</ul>
<p class="dimt">Cada expedición cuenta como un día: los agentes se recuperan un poco, llegan nuevos candidatos y cambia el catálogo.</p>

<h2>EL MUNDO SUBTERRÁNEO</h2>
<p>Cada zona tiene un nivel de dificultad y se <b>genera de nuevo en cada expedición</b>, dividida en sectores con nombre. Se desbloquea la siguiente al extraer con éxito de la anterior.</p>
<ul>${maps}</ul>
<p>El <b>radar</b> (minimapa, tecla <b>M</b> para ampliarlo) muestra desde el principio los puntos de interés:</p>
<ul>
<li><b>▲n</b> nidos de chebylitas con su <b>nivel</b> · <b class="bad">☠</b> nido alfa con un jefe.</li>
<li><span class="cyan">✦</span> vetas de esencia (ponte al lado y pulsa <b>F</b>; hace ruido).</li>
<li><span style="color:#ffb02e">■</span> alijos de suministros con buen botín (a menudo vigilados).</li>
<li><span style="color:#b8f53d">☢</span> focos de radiación · <span style="color:#c06cff">≋</span> fugas de esporas · <span style="color:#7fb8ff">ϟ</span> anomalías eléctricas.</li>
<li><span class="cyan">⌂</span> extracciones: las <b>permanentes</b> están en los extremos del mapa; las <b>temporales</b> aparecen por radio en puntos aleatorios durante unos turnos.</li>
</ul>

<h2>CONTROLES DE EXPEDICIÓN</h2>
<div class="keys">
<span>WASD / flechas</span><span>Moverse (y atacar cuerpo a cuerpo al chocar)</span>
<span>Q E Z C · numpad</span><span>Movimiento en diagonal</span>
<span>Clic en el suelo</span><span>Viajar hasta ahí (se detiene al ver enemigos)</span>
<span>Clic en enemigo</span><span>Disparar (el % de impacto aparece al pasar el ratón)</span>
<span>T</span><span>Modo apuntar · Tab cambia de objetivo · F/Enter dispara</span>
<span>F</span><span>Interactuar: abrir, registrar, extraer esencia, <b>solicitar evacuación</b></span>
<span>G</span><span>Recoger del suelo</span>
<span>R</span><span>Recargar</span>
<span>X</span><span>Cambiar de arma</span>
<span>H</span><span>Curarse con el mejor botiquín</span>
<span>B</span><span>Lanzar granada / objeto arrojadizo (o colocar trampas desde el inventario)</span>
<span>I</span><span>Inventario (arrastrar y soltar para equipar, soltar o dar a compañeros)</span>
<span>Tab · 1-4</span><span>Cambiar de agente controlado</span>
<span>O</span><span>Órdenes del escuadrón: seguir / mantener / no disparar</span>
<span>Espacio · .</span><span>Esperar un turno</span>
<span>M</span><span>Mapa del radar</span>
<span>+ / − · rueda</span><span>Zoom</span>
<span>Esc</span><span>Cancelar / menú</span>
</div>

<h2>TURNOS Y COMBATE</h2>
<ul>
<li>Cada acción (moverse, disparar, recargar, usar un objeto) consume un turno. Después actúan tus compañeros y luego los chebylitas (los rápidos actúan más de una vez).</li>
<li>Controlas a un agente; los demás le siguen y disparan solos según sus órdenes. Puedes cambiar de agente cuando quieras.</li>
<li>El % de impacto depende del arma, la puntería del agente, la distancia respecto al alcance del arma y la esquiva del objetivo. Las escopetas pierden daño a distancia; los fusiles de tirador odian la corta distancia.</li>
<li>Los disparos hacen <b>ruido</b> y despiertan a los nidos cercanos. Las armas cuerpo a cuerpo son silenciosas.</li>
<li>La armadura resta daño a cada golpe. La agilidad hace que te fallen más.</li>
</ul>

<h2>MODS DE ARMAS</h2>
<p>Las armas de fuego tienen <b>ranuras</b> según su tipo: ⌖ óptica, » boca, ╤ empuñadura, ▮ cargador, ◣ culata y ┬ bajo cañón. En <b>EQUIPO</b>, bajo cada arma del agente aparecen sus ranuras: arrastra un mod compatible encima para montarlo, y arrástralo al almacén para desmontarlo. Cada mod solo encaja en ciertos tipos de arma (una mira no cabe en una escopeta).</p>
<ul>
<li>Las <b>miras de tirador</b> (PU, PSO…) convierten un fusil o carabina en arma de tirador: más alcance y crítico, pero −20% a quemarropa.</li>
<li>Los <b>silenciadores</b> reducen el ruido (menos nidos despiertos). El <b>bípode</b> da mucha precisión si no te moviste el turno anterior. La <b>bayoneta</b> añade una puñalada al disparar a un enemigo adyacente.</li>
</ul>

<h2>GADGETS Y SINERGIAS</h2>
<ul>
<li><b>Juntos / separado</b>: algunos gadgets solo funcionan con un aliado cerca (≤3 casillas) o lejos de todos (≥7).</li>
<li><b>Quieto, herido, último aliento</b>: otros se activan si no te mueves, o si tu salud baja del 50% / 30%.</li>
<li><b>Auras</b>: benefician a los aliados cercanos. <b>Equipo</b>: mejoran si varios agentes llevan el mismo. <b>Conjuntos</b>: dos piezas concretas en el mismo agente dan un bonus extra.</li>
<li><b>Especiales</b>: curarte al matar, frenesí, espinas, imán de esencia, recarga instantánea, sigilo, autoinyector…</li>
</ul>

<h2>CONSUMIBLES ESPECIALES</h2>
<ul>
<li><b>Potenciadores</b> (té, cafeína, adrenalina…): efectos temporales que aparecen en la tarjeta del agente.</li>
<li><b>Granadas</b> de fragmentación, impacto, antitanque, incendiarias, químicas, aturdidoras y de <b>humo</b> (bloquea la visión de todos: ideal para huir).</li>
<li><b>Trampas</b> (cepos y minas): pulsa B o haz clic en ellas y elige una casilla adyacente; saltan cuando un chebylita las pisa.</li>
<li><b>Utilidad</b>: planos, detectores de movimiento, cajas de munición, cohetes de señales y balizas de extracción.</li>
</ul>

<h2>CHEBYLITAS Y NIVELES</h2>
<p>Cada especie tiene su propio color. Cuanto <b>más intenso</b> es, <b>más nivel</b> tiene: ${lvlDemo}</p>
<p>Los nidos duermen hasta que te acercas o haces ruido. Algunos chebylitas envenenan, otros revientan en esporas, embisten, disparan rayos o engendran más criaturas. Consulta el bestiario en el ARCHIVO.</p>

<h2>RADIACIÓN Y PELIGROS</h2>
<ul>
<li>La radiación se acumula en el agente (barra <span style="color:#b8f53d">RAD</span>) y <b>reduce su salud máxima</b>. A partir de 100 causa daño cada turno. Los trajes y el antirrad la reducen; la enfermería la trata en la base.</li>
<li>El agua está contaminada. Las esporas envenenan (las máscaras de gas protegen). El fuego quema. Las anomalías eléctricas dan descargas.</li>
<li>Tras un tiempo, el reactor emite un <b class="bad">PULSO</b> y la radiación ambiente sube sin parar: ¡no te entretengas demasiado!</li>
</ul>

<h2>EXTRACCIÓN</h2>
<p>Entra en la zona de un <span class="cyan">⌂</span> (3×3 casillas) y pulsa <b>F</b>. La evacuación tarda <b>3 turnos</b>: todos los agentes que estén en la zona al terminar serán extraídos. Los que queden fuera seguirán en el mapa. Una <b>baliza de extracción</b> abre una salida de emergencia donde la uses.</p>

<h2>BOTÍN Y RAREZAS</h2>
<p>${rar}</p>
<p>Cuanto más rara es una pieza, mejores estadísticas y más propiedades extra (◆) tiene. Las zonas profundas dan mejor botín. Al pasar el ratón sobre un objeto verás sus estadísticas y la comparación (▲▼) con lo que llevas equipado.</p>

<h2>CONSEJOS</h2>
<ul>
<li>Lleva siempre munición de sobra, vendas y antirrad en la mochila.</li>
<li>Despierta los nidos de uno en uno: dispara desde lejos y retrocede por pasillos estrechos.</li>
<li>No hace falta limpiar el mapa. A veces lo más sabio es salir con lo que llevas.</li>
<li>Vende el botín en la intendencia y mejora el <b>Radar</b> para tener más extracciones temporales.</li>
</ul>
<p style="text-align:center;margin-top:2em"><button class="btn primary" id="help-back">VOLVER</button></p>`;
    R.append(p);
    p.querySelector('#help-back').addEventListener('click', () => { sfx.click(); this.close(); });
    this.esc = (ev) => { if (ev.key === 'Escape' && R.classList.contains('active')) { ev.stopImmediatePropagation(); this.close(); } };
    window.addEventListener('keydown', this.esc, true);
  }
  close() {
    window.removeEventListener('keydown', this.esc, true);
    this.hooks.onBack();
  }
}
