// Pantallas: título, intro, informe de expedición, instrucciones
import { el, panel, esc, confirmBox, modal, toast, UI_SCALES, cycleUiScale } from '../util/dom.js';
import { S, hasSave, settings, saveSettings, listSlots, slotInfo, lastSlot, exportSlot, importToSlot, wipe } from '../core/state.js';
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
    const last = slotInfo(lastSlot()) ? lastSlot() : (listSlots().find((x) => x.info) || {}).n;
    if (has && last) menu.append(btn('CONTINUAR', () => this.hooks.onContinue(last), 'primary'));
    menu.append(btn('NUEVA PARTIDA', () => this.slotsModal('new'), has ? '' : 'primary'));
    if (has) menu.append(btn('PARTIDAS GUARDADAS', () => this.slotsModal('load')));
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
  // gestor de ranuras: 'load' (cargar/borrar/exportar/importar) o 'new' (elegir ranura para empezar)
  slotsModal(mode) {
    const body = el('div', { style: { minWidth: 'min(70ch, 90vw)' } });
    let close;
    const render = () => {
      body.innerHTML = '';
      body.append(el('div', { class: 'dimt', style: { marginBottom: '1em' }, text: mode === 'new' ? 'Elige una ranura para la nueva partida.' : 'Partidas guardadas en este navegador. Exporta una copia de seguridad para no perderla nunca.' }));
      for (const { n, info } of listSlots()) {
        const row = el('div', { class: 'module', style: { gridTemplateColumns: '6ch 1fr auto' } });
        row.append(el('div', { class: 'mg', text: `[${n}]` }));
        row.append(el('div', { html: info
          ? `<b>Día ${info.day}</b> · ${info.agents} agentes · <span class="cyan">${info.ess} ✦</span> · ${info.rub} ₽ · ${info.unlocked} zonas${info.exp ? ' · <span class="warn">en expedición</span>' : ''}<div class="eff">Guardada el ${new Date(info.saved || Date.now()).toLocaleString('es-ES')} · ${info.kb || '?'} KB</div>`
          : '<span class="dimt">— vacía —</span>' }));
        const acts = el('div', { class: 'row', style: { flexWrap: 'wrap', justifyContent: 'flex-end' } });
        const b = (label, fn, cls = '') => el('button', { class: 'btn small ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
        if (mode === 'new') {
          acts.append(b(info ? 'SOBRESCRIBIR' : 'EMPEZAR AQUÍ', async () => {
            if (info && !(await confirmBox('SOBRESCRIBIR', `Se borrará la partida de la ranura ${n} (día ${info.day}). ¿Continuar?`, 'BORRAR Y EMPEZAR', 'CANCELAR', true))) return;
            close(); this.hooks.onNew(n);
          }, info ? 'danger' : 'primary'));
        } else {
          if (info) {
            acts.append(b('CARGAR', () => { close(); this.hooks.onContinue(n); }, 'primary'));
            acts.append(b('EXPORTAR', () => {
              const txt = exportSlot(n);
              if (!txt) return;
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
              a.download = `topolev-ranura${n}-dia${info.day}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            }));
            acts.append(b('BORRAR', async () => { if (await confirmBox('BORRAR', `¿Borrar la partida de la ranura ${n}? No se puede deshacer.`, 'BORRAR', 'CANCELAR', true)) { wipe(n); render(); } }, 'danger'));
          }
          acts.append(b('IMPORTAR', () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.json,application/json';
            inp.onchange = async () => {
              const f = inp.files[0];
              if (!f) return;
              try {
                if (info && !(await confirmBox('IMPORTAR', `Se sustituirá la partida de la ranura ${n}. ¿Continuar?`, 'IMPORTAR', 'CANCELAR', true))) return;
                importToSlot(n, await f.text());
                toast('Partida importada.', 'good');
                render();
              } catch (e) { toast(esc(e.message || 'Archivo no válido.'), 'bad', 4000); }
            };
            inp.click();
          }));
        }
        row.append(acts);
        body.append(row);
      }
    };
    render();
    close = modal({ title: mode === 'new' ? 'NUEVA PARTIDA' : 'PARTIDAS GUARDADAS', body, actions: [{ label: 'CERRAR' }], onClose: () => this.open() });
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
      if (ag.news && ag.news.length) box.append(el('div', { style: { paddingLeft: '3ch' }, html: ag.news.map((n) => `<span class="${n.startsWith('✖') ? 'bad' : n.startsWith('🎖') ? 'warn' : 'o1'}">${esc(n)}</span>`).join('<span class="o5"> · </span>') }));
      if (ag.status === 'extraído' && ag.items.length) {
        box.append(el('div', { style: { paddingLeft: '3ch' }, html: ag.items.map((it) => `<span style="color:${RARITIES[it.r].color}">${esc(it.name)}${it.q > 1 ? ' ×' + it.q : ''}</span>`).join('<span class="o5"> · </span>') }));
      } else if (ag.status !== 'extraído') {
        box.append(el('div', { class: 'dimt', style: { paddingLeft: '3ch' }, text: ag.recovered ? 'Su equipo y el botín recogido se han perdido, salvo el contenedor de seguridad.' : 'Todo su equipo y el botín recogido se han perdido.' }));
        if (ag.recovered) box.append(el('div', { style: { paddingLeft: '3ch' }, html: `<span class="cyan">📡 Recuperado por la baliza:</span> ${ag.recovered.map((n) => esc(n)).join('<span class="o5"> · </span>')}${ag.essKept ? ` <span class="cyan">· ${ag.essKept} ✦</span>` : ''}` }));
      }
      B.append(box);
    }
    if (rep.compItems && rep.compItems.length) B.append(el('div', { class: 'cyan', style: { textAlign: 'center' }, text: `§ Traído por los compañeros: ${rep.compItems.join(', ')}` }));
    if (rep.prisoners) B.append(el('div', { class: 'warn', style: { textAlign: 'center' }, text: `⚑ ${rep.prisoners} prisionero(s) entregados al KGB: +${rep.prisoners * 150} ₽` }));
    if (rep.recruits && rep.recruits.length) B.append(el('div', { class: 'good', style: { textAlign: 'center' }, text: `✚ Se unen al puesto: ${rep.recruits.join(', ')}` }));
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

<h2>AGENTES: ATRIBUTOS, ESPECIALIZACIÓN Y HONORES</h2>
<p>Cada agente tiene un <b>trasfondo</b> (minero del Donbás, veterana de Afganistán, operador de la central…) que marca sus <b>atributos</b> de 1 a 10: <b>Puntería</b> (precisión), <b>Agilidad</b> (esquiva), <b>Fortaleza</b> (salud, cuerpo a cuerpo, carga), <b>Aguante</b> (radiación, veneno), <b>Percepción</b> (crítico, visión, rastreo) y <b>Técnica</b> (esencia, curación, vetas). Pasa el ratón por encima para ver qué da cada uno.</p>
<ul>
<li>Al subir de nivel (hasta el 20) gana salud y <b>1 punto de atributo</b>. Cada <b>3 niveles</b> elige <b>1 talento entre 3</b> (puedes pagar para volver a tirar).</li>
<li>Al <b>nivel 5</b> elige una <b>especialización</b>: Tirador, Asalto, Sanitario, Zapador, Liquidador, Explorador o Comisario. Cada una tiene su árbol de talentos (3 ramas; los avanzados exigen uno de su rama) y una <b>habilidad activa</b> (tecla <b>V</b>) con recarga.</li>
<li>Algunos talentos tienen <b>sinergias</b> <span class="cyan">◈</span> con gadgets o mods concretos.</li>
<li>Lo que viven los marca: <b>rasgos adquiridos</b> (Superviviente, Traumatizado por lobos…), <b>condecoraciones</b> (Medalla al Valor, Orden de la Estrella Roja…) y <b>heridas persistentes</b> (−1 a un atributo hasta operarlas en la ficha).</li>
<li>La experiencia también llega por explorar sectores, abrir alijos, extraer esencia de vetas y curar, no solo por matar.</li>
<li>Los veteranos de nivel 8 o más pueden <b>retirarse como instructores</b> (BARRACONES): los novatos aprenderán más rápido.</li>
</ul>
<p>Un <span class="warn">▲</span> junto al agente indica un ascenso pendiente: abre su ficha en EQUIPO y pulsa <b>ASCENSO</b>.</p>

<h2>CONTENEDOR DE SEGURIDAD</h2>
<p>Los contenedores (<b>▣</b>, en la Intendencia a partir de Almacén 2) van en la ranura <b>CONTENEDOR</b>. Durante la expedición, arrastra un objeto sobre él para guardarlo (<b>1 turno</b>): queda <b>sellado</b> hasta volver a la base. Si el agente muere, su radiobaliza devuelve el contenedor y su contenido al almacén. Las armas ocupan 2 huecos; las pesadas no caben. En la base puedes llenarlo y vaciarlo libremente.</p>

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
<span>V</span><span>Habilidad de la especialización (con objetivo: apunta y confirma)</span>
<span>D</span><span>Compañero mecánico: órdenes del perro, lanzar o recoger drones (Eco y Kamikadze: elige destino)</span>
<span>L</span><span>Encender / apagar la linterna</span>
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

<h2>EL TERRENO</h2>
<ul>
<li><b>Cobertura</b>: sacos terreros <b>▄</b> y consolas <b>▬</b> restan un 25% de impacto a quien se cubre detrás (a ti y a ellos).</li>
<li><b>Se pueden disparar</b> (apunta con <b>T</b>): barriles <b>◘</b> (explotan e incendian), tuberías <b>║</b> (vapor ardiente) y lámparas <b>☼</b> (oscuridad).</li>
<li><b>Ruido</b>: pasarelas metálicas <b>═</b> y cristales rotos <b>∴</b> despiertan nidos; la arena <b>░</b> amortigua los pasos. Un ruido fuerte derrumba los escombros inestables <b>▒</b>.</li>
<li><b>Resbala</b>: el aceite <b>≋</b> (inflamable) cuesta un turno más; en el hielo puedes caer.</li>
<li><b>Se usan con F</b>: puertas blindadas <b>▓</b> (tarjeta, Técnica 7, soplete o un terminal), terminales <b>▣</b> (piratear con Técnica), interruptores <b>¥</b> (iluminan el sector), grafito <b>▪</b> (muestras, muy radiactivo).</li>
<li>Las raíces <b>ψ</b> crecen y cierran pasillos: córtalas cuerpo a cuerpo o quémalas. Las vagonetas <b>Ш</b> se empujan por los raíles y arrollan lo que encuentran. Los cristales <b>✧</b> se minan como vetas pequeñas.</li>
</ul>

<h2>PISOS, LUZ Y CONDICIONES</h2>
<ul>
<li>Las zonas tienen <b>2–3 pisos</b>. El montacargas <b>↓</b> o una sima <b>◌</b> llevan abajo: más nivel y mejor botín, pero las extracciones permanentes solo están arriba (sube por el montacargas <b>↑</b>). Reúne al escuadrón antes de usarlos. Bajar por una sima sin <b>cuerda</b> hace daño. En el mapa (M) puedes consultar los pisos ya visitados.</li>
<li><b>Luz</b>: en las zonas oscuras ves la mitad de lejos; los sectores iluminados, lámparas, fuego y bengalas se ven desde lejos. Una <b>linterna</b> (gadget o linterna táctica) te deja ver todo tu alcance, pero te delata; <b>L</b> la apaga. A oscuras, a los enemigos también les cuesta verte.</li>
<li>Cada día, cada zona puede tener <b>modificadores</b> (Apagón, Niebla, Nidos inquietos, Presencia extranjera…) con su riesgo y su recompensa. Se ven en EXPEDICIÓN antes de lanzar.</li>
</ul>

<h2>LA REGIÓN: SUPERFICIE Y SUBSUELO</h2>
<ul>
<li>En EXPEDICIÓN, el <b>mapa de la región</b> muestra los destinos: <b>◆</b> superficie, <b>▼</b> subsuelo, <b>☭</b> campamento, <b>?</b> cerrado. Cada zona se abre al <b>extraer con éxito</b> de alguna de las que la preceden (pasa el ratón por encima para verlo). Haz clic en un punto para elegirlo.</li>
<li>En la <b>superficie</b> hay cielo abierto: <b>reloj</b> (☀ de día / ☾ de noche, arriba), luz natural de día y <b>clima</b>: la lluvia irradia al raso, la niebla acorta la vista, el viento se lleva el gas. Los pinos <b>♣</b> tapan media vista; la tierra removida se <b>excava</b> con F; los coches y los blindados dan cobertura; los columpios chirrían.</li>
<li>Cada zona tiene lo suyo: el <b>tren fantasma</b> de Yanov (¡apártate de la vía cuando se oiga!), los siluros del Estanque, la antena <b>Ψ</b> de Duga-3 (revela el mapa 30 turnos y atrae a todo), las celdas y el archivo del Objeto 7, las paredes que respiran de Las Raíces…</li>
<li>El <b>Campamento Wismut</b> es territorio aliado: comerciante <b>₽</b>, enfermería <b>✚</b> y tablón de rumores y trabajos <b>▦</b> (F estando al lado). Es tranquilo… de día.</li>
<li>Las <b>zonas de evento</b> (<b>!</b> en rosa) aparecen unos días y desaparecen: helicópteros estrellados, convoyes, un avión espía, nidos migratorios o el mercado negro de los contrabandistas. Son de un solo uso.</li>
</ul>

<h2>PERSONAS Y CONVERSACIONES</h2>
<p>No estáis solos ahí abajo. Las personas (<b>@</b>) llevan un recuadro según su postura: <span class="good">verde</span> aliados, <span class="warn">amarillo</span> neutrales y <span class="bad">rojo</span> hostiles. Los aliados se apartan si chocas con ellos y combaten a vuestro lado; los neutrales no os molestarán... salvo que abráis fuego contra ellos: entonces toda su facción se vuelve hostil.</p>
<p>Algunos encuentros abren una <b>conversación</b>: elige respuesta con el ratón o con las teclas <b>1–9</b>. Las opciones en gris necesitan algo que no tienes. Lo que decidas se recuerda.</p>

<h2>FACCIONES Y REPUTACIÓN</h2>
<ul>
<li>Hay una docena de expediciones en la Zona: aliados del Pacto (RDA, Cuba, Checoslovaquia), neutrales (Suecia, Finlandia, Yugoslavia, contrabandistas), hostiles (EE. UU., Reino Unido, la Congregación de la Ceniza) y negociables (merodeadores, desertores). La pestaña <b>RADIO</b> de la base muestra la <b>reputación</b> con cada una (−100…+100) y lo que ofrecen.</li>
<li><b>F</b> junto a alguien no hostil abre un <b>encuentro</b>: comerciar, compartir mapas, pedir ayuda, amenazar… A los merodeadores y desertores se les puede sobornar; un Comisario puede reclutar desertores.</li>
<li>Los neutrales se vuelven hostiles si les disparas, si abres sus suministros delante de ellos o si les <b>apuntas</b> (T) con insistencia: «¡Baja el arma, camarada!».</li>
<li>Las personas buscan cobertura, lanzan granadas, avisan por radio y, malheridas, <b>se rinden</b> (⚑): F para dejarlas ir, interrogarlas, requisar su equipo, entregarlas al KGB o algo peor.</li>
<li>La <b>bengala roja</b> llama a los aliados de la zona; si la RDA o Cuba os aprecian, mandan una patrulla. Los sacerdotes de la Ceniza azuzan a los chebylitas: dispárales primero.</li>
<li>En los mapas hay <b>campamentos abandonados</b> (tiendas Λ, hogueras *, radios ☏) con cajas OTAN y diarios en otros idiomas. El <b>KGB</b> paga por informes, documentos y diarios (pestaña RADIO), pero no le gusta que comerciéis con extranjeros: si desconfía, manda a un comisario.</li>
</ul>

<h2>COMPAÑEROS MECÁNICOS Y GADGETS</h2>
<ul>
<li>Cada agente tiene una ranura <b>COMPAÑERO</b>. Se compran y reparan en el <b>GARAJE</b> (constrúyelo en LABORATORIO).</li>
<li><b>§ Laika-M</b>, el perro robot: le sigue, pelea y lleva 4 objetos. Con <b>D</b> (o los botones del panel de escuadra) cambias su orden: seguir, quedarse, buscar (trae el botín cercano) o atacar. <b>F</b> a su lado para coger su carga; lo que lleve vuelve a la base contigo. Admite 3 módulos (ametralladora, bengalas, detector, sensor de radiación, botiquín, mandíbula, plomo). Si cae, deja un chasis: recógelo y el Garaje lo repara.</li>
<li><b>Drones</b> (tecla D): el <b>Strizh</b> explora solo (clic en el radar para guiarlo; D para que vuelva); la <b>Mula</b> lleva lo más valioso de la mochila a la extracción y lo envía a la base; el <b>Kamikadze</b> se estrella contra un objetivo; el <b>Eco</b> hace ruido y luz donde le digas; el <b>Relé</b> mantiene el radar en la tormenta.</li>
<li>Gadgets: torreta <b>Gnomo</b> (F para recogerla), <b>jaula</b> (chebylitas pequeños y heridos, vivos), <b>cámara Zenit-E</b> (+10% de daño contra lo fotografiado), <b>desfibrilador</b>, <b>gancho</b> (salta simas), <b>soldadura</b> (puertas blindadas y contenedores sellados), <b>ruido blanco</b>, <b>contador de centelleo</b>, <b>grabadora</b>, <b>sonda sísmica</b> (minas ocultas ¤), <b>camuflaje</b> y <b>paraguas antirradiación</b>.</li>
</ul>

<h2>LA CAMPAÑA: ACTOS, TOPOLEV Y EL PERSONAL</h2>
<ul>
<li>La historia avanza en <b>tres actos</b>; cada uno empieza con una escena a pantalla completa (clic, espacio o intro para avanzar, Esc para saltarla). En el Útero de Corium se decide el <b>final</b> (hay cuatro, uno de ellos oculto).</li>
<li>La <b>confianza del Dr. Topolev</b> (CUARTEL) sube con sus encargos y las extracciones y baja con las muertes y las cuotas incumplidas. El Comisario Zhdánov, la Dra. Orlova, el sargento Kravets y el mecánico «Babai» hablan en sus pestañas.</li>
<li>Tras cada expedición hay una escena del <b>comedor</b>; de vez en cuando llegan <b>cartas</b> de las familias. En ARCHIVO, el memorial guarda el epitafio y la última carta de cada caído, y la <b>crónica</b> de la campaña se puede exportar a .txt.</li>
</ul>

<h2>ESTRÉS Y AFINIDAD</h2>
<ul>
<li>La oscuridad, la radiación, las emboscadas, los jefes y ver morir a un compañero suben el <b>estrés</b>. Por encima de 70 resta puntería; al límite puede aparecer una aflicción (<b>pánico</b>: huye; <b>paranoia</b>: dispara a cualquiera que se mueva; <b>temblor</b>: −8 de puntería) o, a veces, una virtud (<b>heroísmo</b>).</li>
<li>Baja descansando en la base (la <b>banya</b> ayuda), con la música de la radio VEF, con vodka (cuidado: crea adicción) y con las cartas de casa.</li>
<li>Los agentes que pelean juntos se hacen <b>camaradas</b> (+1) o <b>inseparables</b> (+3 puntería, +2 esquiva, menos estrés si están cerca); el fuego amigo y abandonar a alguien los hacen <b>rivales</b> (−2 puntería). Si muere un amigo, a veces queda el rasgo <b>Venganza</b>.</li>
</ul>

<h2>ENCARGOS, COLECCIONES Y RADIO</h2>
<ul>
<li>En CUARTEL hay <b>encargos</b> del personal y de las facciones (hasta 3 a la vez): entregar objetos, fotografiar, capturar, escoltar, sabotear o rescatar. Se cobran al volver.</li>
<li>Cada día puede haber un <b>encargo especial</b> ligado a las condiciones de una zona (apagón, niebla, pulso temprano…): solo vale ese día, se marca con <span style="color:#ffd23f">◎</span> en el mapa y en la lista de zonas, y paga más cuanto más peligrosa es la zona.</li>
<li>Las notas forman <b>8 colecciones</b>; completar una da una recompensa (ARCHIVO). La radio intercepta a veces transmisiones extranjeras que marcan un <b>alijo</b> en el mapa.</li>
</ul>

<h2>LA BASE VIVA</h2>
<ul>
<li>El Puesto tiene <b>16 parcelas</b> (CUARTEL): no caben todos los edificios, así que elige; se puede derribar uno para hacer sitio.</li>
<li><b>INVESTIGACIÓN</b> (tecla <b>0</b>): proyectos que tardan días y piden esencia, muestras o especímenes vivos (de la <b>celda de contención</b>, que además produce esencia… y a veces sufre fugas). Allí también está el <b>taller de fabricación</b>: munición, botiquines, mods y mejoras con chatarra, electrónica, plomo y tejido; y desmontar objetos.</li>
<li>Los precios <b>bajan</b> si vendes mucho de lo mismo (se recuperan con los días). Cada 30 días, la <b>cuota del Comité</b>: entrega la esencia pedida o recorta el presupuesto. En la intendencia, la <b>trastienda de Kravets</b> vende equipo occidental… y el KGB a veces se entera.</li>
<li>El calendario avanza desde mayo de 1986: en <b>invierno</b> el agua se hiela y hace falta abrigo; en otoño llueve más. La televisión cuenta lo que pasa fuera.</li>
<li>A veces <b>atacan la base</b>: defiéndela con quien esté allí o cede parte del almacén. Los agentes que no van en el escuadrón principal pueden salir en una <b>operación simultánea</b> (EXPEDICIÓN) a una zona ya conocida: el resultado se sabe al pasar el día.</li>
</ul>

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
