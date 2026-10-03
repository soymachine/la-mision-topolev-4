// Pantallas: título, intro, informe de expedición, instrucciones
import { el, panel, esc, confirmBox, modal, toast, tip, UI_SCALES, cycleUiScale } from '../util/dom.js';
import { ITEMS } from '../data/items.js';
import { itemHTML, itemTooltip } from '../core/items.js';
import { S, hasSave, settings, saveSettings, listSlots, slotInfo, lastSlot, exportSlot, importToSlot, wipe } from '../core/state.js';
import { RARITIES } from '../data/rarity.js';
import { ENEMIES, enemyColor } from '../data/enemies.js';
import { MAPS } from '../data/world.js';
import { sfx, music } from '../audio.js';
import { FONT } from '../render/ascii.js';
import { uiBurst } from './fx.js';
import { toggleFullscreen } from './expui.js';
import { a11yButtons } from './a11y.js';
import { t } from '../i18n/index.js';
import { achievementsModal } from './achievements.js';
import { settingsModal } from './settings.js';
import { MODES, NG_MODS, ngUnlocked, legacy, isoWeek, challengeTable } from '../core/modes.js';
import { controlsModal, keyName, helpKeysHTML, keyify } from './keys.js';

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
    if (has && last) menu.append(btn(t('menu.continue'), () => this.hooks.onContinue(last), 'primary'));
    menu.append(btn(t('menu.new'), () => this.slotsModal('new'), has ? '' : 'primary'));
    if (has) menu.append(btn(t('menu.saves'), () => this.slotsModal('load')));
    menu.append(btn(t('menu.help'), () => this.hooks.onHelp()));
    menu.append(btn(t('menu.achievements'), () => achievementsModal()));
    menu.append(btn(t('menu.settings'), () => settingsModal({ after: () => this.open() })));
    R.append(this.bg, el('div', { class: 'title-wrap' },
      this.logo,
      el('div', { class: 'title-sub', text: t('title.sub') }),
      menu,
    ), el('div', { class: 'title-foot', text: t('title.foot') }));
    this.startBg();
  }
  // gestor de ranuras: 'load' (cargar/borrar/exportar/importar) o 'new' (elegir ranura para empezar)
  slotsModal(mode) {
    const body = el('div', { style: { minWidth: 'min(70ch, 90vw)' } });
    let close;
    // fase 24.7: modo de juego de la partida nueva
    const opt = { mode: 'historia', ngMods: {}, carry: 'agent' };
    const modePick = () => {
      const box = el('div', { class: 'mode-pick' });
      const row = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } });
      for (const [id, M] of Object.entries(MODES)) {
        const locked = id === 'ng' && !ngUnlocked();
        row.append(el('button', { class: 'btn small' + (opt.mode === id ? ' primary' : '') + (locked ? ' dimt' : ''), 'data-mode': id, title: locked ? 'Se desbloquea al ver un final.' : M.desc, onclick: () => { if (locked) { toast('«1987» se desbloquea al ver un final de la campaña.', 'bad'); return; } sfx.click(); opt.mode = id; render(); } }, (locked ? '🔒 ' : '') + M.name));
      }
      box.append(el('div', { class: 'h', text: 'MODO' }), row, el('div', { class: 'eff', style: { margin: '4px 0' }, text: MODES[opt.mode].desc }));
      if (opt.mode === 'desafio') {
        const tb = challengeTable();
        box.append(el('div', { class: 'eff', html: `Semana <b>${isoWeek()}</b> · mejores marcas en este navegador: ${tb.length ? tb.slice(0, 5).map((x, i) => `${i + 1}.º <b>${x.score}</b>`).join(' · ') : '<span class="dimt">ninguna todavía</span>'}` }));
      }
      if (opt.mode === 'ng') {
        const L = legacy();
        const mods = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } });
        for (const [id, M] of Object.entries(NG_MODS)) mods.append(el('button', { class: 'btn small' + (opt.ngMods[id] ? ' primary' : ''), 'data-ngmod': id, title: M.desc, onclick: () => { opt.ngMods[id] = !opt.ngMods[id]; render(); } }, (opt.ngMods[id] ? '☑ ' : '☐ ') + M.name));
        const carry = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } });
        const ag = L && L.agent ? `${L.agent.first} ${L.agent.last} (Nv ${L.agent.lvl})` : null;
        const tr = L && L.trophy ? (ITEMS[L.trophy.b] ? ITEMS[L.trophy.b].name : L.trophy.b) : null;
        if (ag) carry.append(el('button', { class: 'btn small' + (opt.carry === 'agent' ? ' primary' : ''), onclick: () => { opt.carry = 'agent'; render(); } }, `VETERANO: ${ag}`));
        if (tr) carry.append(el('button', { class: 'btn small' + (opt.carry === 'trophy' ? ' primary' : ''), onclick: () => { opt.carry = 'trophy'; render(); } }, `TROFEO: ${tr}`));
        box.append(el('div', { class: 'eff', text: 'Modificadores:' }), mods, ag || tr ? el('div', { class: 'eff', text: 'Del año pasado:' }) : '', ag || tr ? carry : '');
      }
      return box;
    };
    const render = () => {
      body.innerHTML = '';
      if (mode === 'new') body.append(modePick());
      body.append(el('div', { class: 'dimt', style: { marginBottom: '1em' }, text: t(mode === 'new' ? 'slots.new' : 'slots.load') }));
      for (const { n, info } of listSlots()) {
        const row = el('div', { class: 'module', style: { gridTemplateColumns: '6ch 1fr auto' } });
        row.append(el('div', { class: 'mg', text: `[${n}]` }));
        row.append(el('div', { html: info
          ? `${info.mode && MODES[info.mode] && MODES[info.mode].short ? `<span class="warn">${MODES[info.mode].short}</span> · ` : ''}<b>Día ${info.day}</b> · ${info.agents} agentes · <span class="cyan">${info.ess} ✦</span> · ${info.rub} ₽ · ${info.unlocked} zonas${info.exp ? ' · <span class="warn">en expedición</span>' : ''}<div class="eff">Guardada el ${new Date(info.saved || Date.now()).toLocaleString('es-ES')} · ${info.kb || '?'} KB</div>`
          : `<span class="dimt">${t('slots.empty')}</span>` }));
        const acts = el('div', { class: 'row', style: { flexWrap: 'wrap', justifyContent: 'flex-end' } });
        const b = (label, fn, cls = '') => el('button', { class: 'btn small ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
        if (mode === 'new') {
          acts.append(b(t(info ? 'slots.overwrite' : 'slots.start'), async () => {
            if (info && !(await confirmBox('SOBRESCRIBIR', `Se borrará la partida de la ranura ${n} (día ${info.day}). ¿Continuar?`, 'BORRAR Y EMPEZAR', 'CANCELAR', true))) return;
            close(); this.hooks.onNew(n, { ...opt, ngMods: { ...opt.ngMods } });
          }, info ? 'danger' : 'primary'));
        } else {
          if (info) {
            acts.append(b(t('slots.load1'), () => { close(); this.hooks.onContinue(n); }, 'primary'));
            if (!info.iron) acts.append(b('EXPORTAR', () => { // en Hierro no hay copias de seguridad
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
    // un agente por columna, todos en la misma fila; los objetos extraídos con su tooltip al pasar el ratón
    const cols = el('div', { class: 'rep-agents', style: { gridTemplateColumns: `repeat(${Math.max(1, rep.agents.length)}, minmax(0, 1fr))` } });
    for (const ag of rep.agents) {
      const out = ag.status === 'extraído';
      const box = el('div', { class: 'rep-agent' + (out ? '' : ' dead') });
      box.append(el('div', { class: 'rep-name', html: `<span style="color:${ag.color};font-weight:700">@</span> <b>${esc(ag.name)}</b>` }),
        el('div', { html: `${out ? '<span class="cyan">⇑ EXTRAÍDO</span>' : '<span class="bad">✝ MUERTO EN COMBATE</span>'}` }),
        el('div', { class: 'dimt', html: `Nv ${ag.lvl}${ag.lvlUp > 0 ? ` <span class="warn">★ +${ag.lvlUp}</span>` : ''} · ${ag.kills} bajas · <span class="cyan">${ag.ess} ✦</span>` }));
      if (ag.news && ag.news.length) box.append(el('div', { class: 'rep-news', html: ag.news.map((n) => `<div class="${n.startsWith('✖') ? 'bad' : n.startsWith('🎖') ? 'warn' : 'o1'}">${esc(n)}</div>`).join('') }));
      if (out && ag.items.length) {
        const list = el('div', { class: 'rep-items' });
        for (const x of ag.items) {
          const row = el('div', { class: 'rep-item', html: x.it ? itemHTML(x.it) : `<span style="color:${RARITIES[x.r].color}">${esc(x.name)}${x.q > 1 ? ' ×' + x.q : ''}</span>` });
          if (x.it) tip(row, () => itemTooltip(x.it));
          list.append(row);
        }
        box.append(el('div', { class: 'h', style: { marginTop: '.4em' }, text: `OBJETOS (${ag.items.length})` }), list);
      } else if (!out) {
        box.append(el('div', { class: 'dimt', text: ag.recovered ? 'Su equipo y el botín recogido se han perdido, salvo el contenedor de seguridad.' : 'Todo su equipo y el botín recogido se han perdido.' }));
        if (ag.recovered) box.append(el('div', { html: `<span class="cyan">📡 Recuperado por la baliza:</span> ${ag.recovered.map((n) => esc(n)).join('<span class="o5"> · </span>')}${ag.essKept ? ` <span class="cyan">· ${ag.essKept} ✦</span>` : ''}` }));
      }
      cols.append(box);
    }
    B.append(cols);
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
<li><span class="cyan">⌂</span> extracciones: las <b>permanentes</b> están en los extremos del mapa, pero el radar tarda unos turnos (menos con el módulo Radar) en triangularlas; las <b>temporales</b> aparecen por radio en puntos aleatorios durante 84–126 turnos.</li>
<li><b>?</b> en el radar: un grupo de chebylitas sin identificar. Se identifica al verlo, con un radar de chebylitas o tras abatir 5 de su especie (para siempre). Los <b>alijos</b> y las <b>puertas blindadas</b> no aparecen hasta verlos o detectarlos con un radar de botín.</li>
</ul>

<h2>CONTROLES DE EXPEDICIÓN</h2>
<div class="keys">
${helpKeysHTML()}
</div>

<h2>TURNOS Y COMBATE</h2>
<ul>
<li>Cada acción (moverse, disparar, recargar, usar un objeto) consume un turno. Después actúan tus compañeros y luego los chebylitas (los rápidos actúan más de una vez).</li>
<li>Controlas a un agente; los demás le siguen y disparan solos según sus órdenes. Puedes cambiar de agente cuando quieras.</li>
<li>El % de impacto depende del arma, la puntería del agente, la distancia respecto al alcance del arma y la esquiva del objetivo. Las escopetas pierden daño a distancia; los fusiles de tirador odian la corta distancia.</li>
<li>Los disparos hacen <b>ruido</b> y despiertan a los nidos cercanos. Las armas cuerpo a cuerpo son silenciosas.</li>
<li>La armadura resta daño a cada golpe. La agilidad hace que te fallen más.</li>
<li><b>Cobertura</b>: detrás de sacos terreros o un coche (<b>total</b>, −45%) o de una consola o un murete (<b>media</b>, −25%) te aciertan menos; en el mapa lo indica ▄/█ sobre el agente. Si disparas desde un lado y la cobertura no queda en medio, lo <b>flanqueas</b>: sin cobertura, +15% de impacto y +10% de crítico. El tooltip de impacto lo muestra ([▄] [█] [⇄]). Los humanos también intentan flanquearte.</li>
<li><b>Sigilo</b>: los enemigos que aún no están en alerta te detectan desde más cerca si estás <b>agachado</b> (${keyName('crouch')}, −3; uno de cada dos pasos cuesta un turno más) o <b>quieto</b> (−2); la linterna te delata (+3). La tarjeta de cada agente dice si está <b>oculto</b>, <b>oído</b> o <b>visto</b>. Un golpe cuerpo a cuerpo a un enemigo que no sabe que estás ahí (dormido o errante) es un <b>ataque por la espalda</b>: crítico seguro. La orden <b>EMBOSCADA</b> (${keyName('orders')}) deja al compañero quieto hasta que algo entra a tiro: primer disparo con +20%. Ojo: los chebylitas sigilosos también emboscan (primer golpe ×1,5).</li>
<li><b>Abatidos</b>: a 0 de salud un agente no muere: cae <b>abatido</b> y se desangra 3 turnos (4 si alguien del grupo tiene «Rescate»). Pulsa <b>${keyName('interact')}</b> a su lado (o haz clic en él) para levantarlo: con un botiquín se levanta con esa curación; sin nada, con 1 de salud y te cuesta un turno más. El <b>desfibrilador</b> lo levanta a 2 casillas (una vez por expedición) y el talento <b>Rescate</b> lo deja con al menos un 25%. Los compañeros acuden solos a levantarlo. Si recibe otro golpe o se acaba el tiempo, muere; los enemigos que lo tienen al lado van a rematarlo. Un abatido no puede subir a la evacuación, y si todo el grupo cae abatido, se acabó.</li>
<li><b>Munición especial</b>: cada calibre tiene variantes <b>perforante</b> (ignora 3 de protección, −10% daño), <b>incendiaria</b> (prende fuego), <b>expansiva</b> (+30% contra objetivos sin protección, −50% contra blindados) y <b>de esencia</b> (+20% contra chebylitas). Se encuentran en el botín y se fabrican en el taller. Con <b>${keyName('ammo')}</b> eliges cuál cargar en la siguiente recarga (${keyName('reload')}); lo que llevaras cargado vuelve a la mochila.</li>
<li><b>Fuego de supresión</b> (<b>${keyName('suppress')}</b>, subfusiles, fusiles y ametralladoras): gasta muchas balas y hace poco daño, pero los enemigos a 1 casilla del objetivo quedan <b>suprimidos</b> 2 turnos (−30% de impacto y la mitad de las veces no actúan). Ojo: los humanos con armas automáticas también os suprimen.</li>
<li><b>Desgaste</b>: cada disparo gasta un poco el arma (más con munición incendiaria o expansiva, o bajo la lluvia y en el agua). Por debajo del 60% puede <b>encasquillarse</b>: no dispara hasta que pulses <b>${keyName('reload')}</b> para desencasquillarla. Las armas que sueltan los enemigos vienen gastadas. Se reparan con chatarra en el Taller de fabricación (pestaña INVESTIGACIÓN). El estado se ve en el tooltip del arma.</li>
<li><b>Granadas</b>: si la trayectoria choca con una pared, <b>rebotan</b> y caen antes (el modo de lanzamiento muestra dónde estallarán). Tienen mecha: las vuestras estallan al final del turno; las enemigas, al final del turno siguiente, así que hay tiempo de <b>apartarse</b> (la granada parpadea en el suelo). Con el talento <b>Devolución</b> (Zapador), <b>${keyName('interact')}</b> junto a una granada enemiga la devuelve de una patada.</li>
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
<li><b>§ Laika-M</b>, el perro robot: le sigue, pelea y lleva 4 objetos. Con <b>${keyName('companion')}</b> (o los botones del panel de escuadra) cambias su orden: seguir, quedarse, buscar (trae el botín cercano) o atacar. <b>F</b> a su lado para coger su carga; lo que lleve vuelve a la base contigo. Admite 3 módulos (ametralladora, bengalas, detector, sensor de radiación, botiquín, mandíbula, plomo). Si cae, deja un chasis: recógelo y el Garaje lo repara.</li>
<li><b>Drones</b> (tecla ${keyName('companion')}): el <b>Strizh</b> explora solo (clic en el radar para guiarlo; <b>${keyName('companion')}</b> para que vuelva); la <b>Mula</b> lleva lo más valioso de la mochila a la extracción y lo envía a la base; el <b>Kamikadze</b> se estrella contra un objetivo; el <b>Eco</b> hace ruido y luz donde le digas; el <b>Relé</b> mantiene el radar en la tormenta.</li>
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

<h2>ECOSISTEMA, ÉLITES Y JEFES</h2>
<ul>
<li>Cada bioma tiene sus chebylitas: medusas y sanguijuelas en el agua, topos que salen del suelo a tu lado, maniquíes que solo se mueven si nadie los mira, el <b>liquidador hueco</b> (invisible hasta tenerlo a 2 casillas), sirenas que despiertan a todo el sector… Pasa el ratón por encima para ver sus habilidades.</li>
<li>Los <b>élites</b> (<span style="color:#ffd23f">★</span>) tienen uno o dos afijos: Blindado, Veloz, Radiactivo, Vampírico, Engendrador, Explosivo, Invisible o Escudero. Más duros, pero dan el doble de esencia y siempre sueltan botín.</li>
<li><b>Cadena alimentaria</b>: los lobos cazan ratas, los osos a los jabalíes, los cuervos siguen a los lobos y las polillas acuden a la Raíz-madre. La <b>carne de cebo</b> atrae a los carnívoros desde el doble de lejos y los entretiene comiendo.</li>
<li>Cada zona nueva tiene su <b>jefe</b> en el piso más profundo. Cambia de fase al perder salud (llama a los suyos, se enfurece, se esconde…). Al caer deja un <b>trofeo</b> único (♛), si no lo tenéis ya, y tarda unos días en volver.</li>
<li>El mundo <b>recuerda</b>: una zona con los nidos despejados tarda días en repoblarse; una que olvidáis crece y sube de nivel. La <b>alerta del reactor</b> (cabecera de la base) sube con los días: más élites, nidos más grandes y el pulso antes.</li>
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

<h2>ACCESIBILIDAD</h2>
<p>En el menú principal (y en el menú de la base y de la expedición): <b>MODO DALTÓNICO</b> cambia los colores de las rarezas a una paleta distinguible (Okabe-Ito) y les pone un símbolo (· común, + no común, ◆ raro, ★ épico, ✦ legendario, ✪ mítico); en el mapa, las personas llevan además ! (hostil), ? (neutral) o + (aliado). <b>ALTO CONTRASTE</b> aclara los textos, marca los bordes, quita el efecto CRT y aviva los colores del mapa. Se recuerdan entre sesiones.</p>
<p><b>MÚSICA</b>: un drone generativo que cambia con la zona (superficie, subsuelo, laboratorios, corium) y se vuelve más tenso con el peligro (enemigos en alerta, el pulso del reactor, un jefe a la vista, un agente abatido); en la base suena un tema tranquilo. <b>VOL. MÚSICA</b> y <b>VOL. EFECTOS</b> se ajustan por separado.</p>
<p><b>IDIOMA</b>: español o inglés (English). En inglés ya están traducidos los menús, las pestañas de la base, el HUD de la expedición, los controles y los nombres de zonas, chebylitas y objetos básicos; lo que aún no tiene traducción sale en español.</p>
<p><b>CONTROLES TÁCTILES</b> (AUTO / SÍ / NO; en AUTO se activan solos en pantallas táctiles): durante la expedición aparece una cruceta de 8 direcciones (el punto del centro espera un turno; manteniéndola pulsada se repite) y botones para interactuar (F), apuntar (⌖; en el modo apuntar pasa al siguiente objetivo y F dispara), recargar, curarse, habilidad, granada, agacharse, cambiar de agente, inventario y ✕ (cancelar o menú). Tocar el mapa es como hacer clic (ir, atacar, abrir); <b>mantener pulsado</b> muestra la información de la casilla; <b>pellizcar</b> acerca o aleja; <b>arrastrar el radar</b> mueve la vista. En pantallas estrechas el panel del agente se abre con ☰.</p>

<h2>CONFIGURACIÓN</h2>
<p>Desde el menú principal, el menú de la base y la pausa: sonido, música, sonido ambiente y sus volúmenes (deslizadores: arrástralos o usa las flechas; Mayús, de 10 en 10), efecto CRT, pantalla completa, tamaño del texto, idioma, teclas, controles táctiles, modo daltónico, alto contraste y exportar una copia de la partida.</p>
<p><b>Sonido ambiente</b>: grabaciones reales (CC0) distintas en cada pantalla y zona: viento en el título, la ventilación del búnker en la base, la estufa en el informe, el rumor profundo del subsuelo, el bosque, la noche, la lluvia… <b>Mapa grande (M)</b>: rueda o pellizco para ampliar, arrastrar para moverse, botones − + ⟲ y @ (centrar en el agente). <b>Botín</b>: al abrir un contenedor, los objetos aparecen uno a uno; los épicos, legendarios y míticos, con partículas. <b>EQUIPO</b>: clic derecho en un objeto para comprar otro igual (si está hoy en la Intendencia) o dividir la pila.</p>

<h2>MODOS DE JUEGO</h2>
<p>Se eligen en NUEVA PARTIDA, encima de las ranuras. <b>HISTORIA</b>: la campaña de siempre. <b>LIBRE</b>: todas las zonas abiertas, 2000 ₽, sin cuota, ataques ni actos. <b>HIERRO</b>: guardado en cada turno, sin exportar copias; si os quedáis sin agentes y sin rublos para reclutar, la partida se borra. <b>DESAFÍO SEMANAL</b>: la misma semilla para todos durante la semana (agentes, botín inicial, reclutas y mapas de las 3 primeras zonas); al acabar el día 15 se apunta la puntuación (esencia + 2 por baja + 25 por extracción − 40 por caído) en la tabla de este navegador. <b>«1987»</b>: se desbloquea al ver un final; empezáis con el mejor agente o un trofeo de la partida anterior y podéis añadir modificadores (+1 nivel a los chebylitas, alerta +1, presupuesto recortado).</p>

<h2>ENCICLOPEDIA</h2>
<p>En el ARCHIVO y en el menú de pausa: chebylitas, objetos, zonas, facciones, notas y trofeos, pero <b>solo lo que habéis descubierto</b> en esta partida (lo demás sale como «???»). Tiene buscador y enlaces: de un chebylita a sus zonas, de una zona a sus chebylitas y a su jefe.</p>

<h2>LOGROS Y ESTADÍSTICAS</h2>
<p>En el menú principal y en el ARCHIVO: 36 logros (extracciones, jefes, trofeos, rachas sin bajas, rescates, finales secretos…) que se guardan aparte de las partidas, así que no se pierden al borrar una ranura; y las estadísticas de la partida: por zona, bajas por especie y por arma, abatidos levantados, granadas devueltas, ataques por la espalda, día récord de esencia.</p>

<h2>CONSEJOS</h2>
<ul>
<li>Lleva siempre munición de sobra, vendas y antirrad en la mochila.</li>
<li>Despierta los nidos de uno en uno: dispara desde lejos y retrocede por pasillos estrechos.</li>
<li>No hace falta limpiar el mapa. A veces lo más sabio es salir con lo que llevas.</li>
<li>Vende el botín en la intendencia y mejora el <b>Radar</b> para tener más extracciones temporales.</li>
</ul>
<p style="text-align:center;margin-top:2em"><button class="btn primary" id="help-back">VOLVER</button></p>`;
    p.body.innerHTML = keyify(p.body.innerHTML); // fase 24.2: teclas cambiadas por el jugador
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
