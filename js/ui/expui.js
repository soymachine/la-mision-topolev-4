// Interfaz de la expedición: HUD, entrada, inventario, botín, mapa completo
import { el, $, panel, esc, UI_SCALES, cycleUiScale, showTooltip, hideTooltip, modal, modalOpen, closeTopModal, toast, draggable, dropzone, hpBar, bar, tip, confirmBox } from '../util/dom.js';
import { MapRenderer, OBJ_NAME } from '../render/ascii.js';
import { Minimap } from '../render/minimap.js';
import { TILES, T } from '../data/tiles.js';
import { ENEMIES, enemyColor, ABIL_TEXT } from '../data/enemies.js';
import { ACTORS, actorColor, actorFaction, isHuman } from '../data/actors.js';
import { FACTIONS, ATTITUDE_TEXT, ATTITUDE_CLASS } from '../data/factions.js';
import { ITEMS, AMMO_NAMES } from '../data/items.js';
import { itemName, itemStats, itemTooltip, itemHTML, rarityColor, mergeInto, sortItems } from '../core/items.js';
import { agentStats, agentName, EQUIP_SLOTS, canEquip, bagCapacity, traitOf } from '../core/agents.js';
import { S, save, settings, saveSettings } from '../core/state.js';
import { ORDERS, ESSENCE_COLOR } from '../exp/shared.js';
import { astar } from '../exp/path.js';
import { cheb, rng } from '../util/rng.js';
import { sfx } from '../audio.js';
import { uiFly } from './fx.js';
import { NOTES } from '../data/lore.js';
import { showDialog } from './dialog.js';

export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch {}
}

const KEYDIR = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};
const STATE_TXT = { dormido: 'dormido', alerta: '¡alerta!', errante: 'merodeando', aturdido: 'aturdido' };

export class ExpeditionUI {
  constructor(root, hooks) {
    this.root = root;
    this.hooks = hooks;
    this.build();
    this.active = false;
    this.mode = null;
    this.travel = null;
    this.lastAct = 0;
    window.addEventListener('keydown', (ev) => this.onKey(ev));
    window.addEventListener('resize', () => { if (this.active) { this.r.resize(); this.sizeMinimap(); if (this.exp && this.exp.cur) this.r.centerOn(this.exp.cur.x, this.exp.cur.y); } });
  }

  // ------------------------------------------------------------ construcción
  build() {
    const R = this.root;
    R.innerHTML = '';
    this.top = el('div', { class: 'exp-top' });
    this.mapHost = el('div', { class: 'exp-map' });
    this.side = el('div', { class: 'exp-side' });
    this.logEl = el('div', { class: 'exp-log' });
    R.append(this.top, this.mapHost, this.side, this.logEl);
    this.r = new MapRenderer(this.mapHost);
    this.banner = el('div', { class: 'target-banner hidden' });
    this.mapHost.append(this.banner);
    // panel lateral
    this.mmCanvas = el('canvas', { id: 'minimap' });
    this.mmPanel = panel({ title: 'RADAR', right: '<span class="link">M</span>' }, this.mmCanvas);
    this.mmPanel.style.flex = 'none';
    this.mm = new Minimap(this.mmCanvas);
    this.squadPanel = panel({ title: 'ESCUADRA', right: 'Tab' });
    this.squadPanel.style.flex = 'none';
    this.agentPanel = panel({ title: 'AGENTE', bodyCls: 'scroll' });
    this.agentPanel.classList.add('grow');
    this.side.append(this.mmPanel, this.squadPanel, this.agentPanel);

    this.mmCanvas.addEventListener('click', () => { hideTooltip(); this.toggleBigMap(); });
    this.mmCanvas.addEventListener('pointermove', (ev) => {
      const rc = this.mmCanvas.getBoundingClientRect();
      const k = this.mmCanvas.width / rc.width;
      const m = this.mm.markerAt((ev.clientX - rc.left) * k, (ev.clientY - rc.top) * k);
      const html = m ? this.markerTooltip(m) : '<div class="tt-title">Radar</div><div class="dimt">Pasa el ratón por los iconos para ver detalles. Clic o <b>M</b> para el mapa completo.</div>';
      showTooltip(html, ev.clientX, ev.clientY);
    });
    this.mmCanvas.addEventListener('pointerleave', () => hideTooltip());

    // ratón sobre el mapa
    const c = this.r.canvas;
    c.addEventListener('pointermove', (ev) => this.onHover(ev));
    c.addEventListener('pointerleave', () => { this.r.hover = null; this.clearOverlay(); hideTooltip(); });
    c.addEventListener('click', (ev) => this.onClick(ev));
    c.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.cancelMode(); this.travel = null; });
    c.addEventListener('wheel', (ev) => { if (ev.ctrlKey || ev.altKey) return; ev.preventDefault(); this.zoom(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
  }

  sizeMinimap() {
    const e = this.exp;
    if (!e) return;
    const w = this.mmPanel.body.getBoundingClientRect().width;
    const h = Math.round(Math.min(w * (e.h / e.w), innerHeight * 0.28));
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.mmCanvas.width = Math.round(w * dpr); this.mmCanvas.height = Math.round(h * dpr);
    this.mmCanvas.style.width = w + 'px'; this.mmCanvas.style.height = h + 'px';
  }

  // ------------------------------------------------------------ ciclo de vida
  start(exp) {
    this.exp = exp;
    this.active = true;
    this.mode = null; this.travel = null; this.big = null;
    this.r.resize();
    if (!settings.zoom) settings.zoom = Math.round(Math.max(13, Math.min(18, innerWidth / 105)));
    this.r.setZoom(settings.zoom);
    this.r.radar = S.modules.radar;
    this.r.attach(exp);
    this.r.onEssence = () => {};
    this.mm.attach(exp);
    requestAnimationFrame(() => { this.sizeMinimap(); this.r.resize(); this.r.centerOn(exp.cur.x, exp.cur.y, true); });
    exp.on('log', () => this.renderLog());
    exp.on('turn', () => this.onTurn());
    exp.on('update', () => this.refresh());
    exp.on('switch', () => { this.r.centerOn(exp.cur.x, exp.cur.y); this.refresh(); });
    exp.on('loot', (d) => this.openLoot(d));
    exp.on('death', (sq) => { toast(`✝ ${esc(sq.a.first)} «${esc(sq.a.nick)}» ha caído.`, 'bad', 4000); });
    exp.on('tempexit', () => { sfx.radio(); toast('📻 Nueva extracción temporal disponible. Consulta el radar.', '', 3500); });
    exp.on('end', () => this.onEnd());
    exp.on('note', (o) => this.openNote(o));
    exp.on('dialog', () => this.openDialog());
    this.renderLog();
    this.refresh();
    this.dlgClose = null;
    if (exp.dlg) setTimeout(() => { if (this.exp === exp && exp.dlg && !this.dlgClose) this.openDialog(); }, 350);
    this.last = performance.now();
    const token = (this.loopToken = (this.loopToken || 0) + 1);
    const loop = (now) => {
      if (!this.active || token !== this.loopToken) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.root.classList.contains('active')) { requestAnimationFrame(loop); return; }
      this.playSounds();
      this.r.frame(now, dt);
      if (!this.mmT || now - this.mmT > 90) {
        this.mmT = now;
        const cols = this.r.vw / this.r.cw, rows = this.r.vh / this.r.ch;
        this.mm.draw(now, { radar: S.modules.radar, view: { x: this.r.cam.x, y: this.r.cam.y, w: cols, h: rows } });
        if (this.big) this.big.mm.draw(now, { big: true, radar: S.modules.radar });
      }
      this.stepTravel(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.active = false;
    hideTooltip();
  }

  onEnd() {
    this.travel = null;
    this.mode = null;
    this.cancelMode();
    // el resultado se aplica ya (por si se cierra la página); la pantalla cambia tras la animación
    const rep = this.hooks.onEnd(this.exp);
    setTimeout(() => { this.stop(); this.hooks.onReport(rep); }, 1600);
  }

  // ------------------------------------------------------------ sonidos según efectos
  playSounds() {
    const e = this.exp;
    if (!e.fx.length) return;
    const seen = new Set();
    for (const f of e.fx) {
      const k = f.type + (f.wtype || '');
      if (seen.has(k)) continue;
      seen.add(k);
      switch (f.type) {
        case 'shot': sfx.shot(f.wtype); break;
        case 'slash': sfx.shot('melee'); break;
        case 'beam': case 'arc': sfx.shot('energy'); break;
        case 'flame': if (!seen.has('fl')) { seen.add('fl'); sfx.shot('flame'); } break;
        case 'kill': setTimeout(() => sfx.kill(), f.delay || 0); break;
        case 'hurt': setTimeout(() => sfx.hurt(), f.delay || 0); break;
        case 'explosion': setTimeout(() => sfx.explosion(), f.delay || 0); break;
        case 'essence': case 'mine': sfx.essence(); this.flyEssence(); break;
        case 'pickup': sfx.pickup(); break;
        case 'levelup': sfx.levelup(); break;
        case 'death': sfx.death(); break;
        case 'door': sfx.door(); break;
        case 'reload': sfx.reload(); break;
        case 'evac': case 'newexit': sfx.evac(); break;
        case 'extract': sfx.evac(); break;
        case 'zap': sfx.zap(); break;
        case 'surge': sfx.surge(); break;
        case 'alert': sfx.alert(); break;
        case 'ebolt': sfx.zap(); break;
      }
    }
  }
  flyEssence() {
    const target = this.top.querySelector('.ess-count');
    if (target) setTimeout(() => uiFly(this.mapHost, target, 6), 50);
  }

  onTurn() {
    const e = this.exp;
    const c = e.cur;
    if (c && e.inMap(c)) {
      this.r.centerOn(c.x, c.y);
      const r = e.rad[e.key(c.x, c.y)] + e.ambient;
      if (r > 0.4) sfx.geiger(Math.min(8, Math.round(r * 1.5)));
    }
    this.refresh();
    if (e.turn % 3 === 0) save();
  }

  // ------------------------------------------------------------ HUD
  refresh() {
    const e = this.exp;
    if (!e) return;
    this.renderTop();
    this.renderSquad();
    this.renderAgent();
  }

  renderTop() {
    const e = this.exp;
    const c = e.cur;
    const sec = c ? e.sectorAt(c.x, c.y) : null;
    const essTotal = e.squad.reduce((s, q) => s + (q.alive ? q.ess : 0), 0);
    const pulseIn = e.surgeAt - e.turn;
    const surge = e.turn >= e.surgeAt ? 1 + Math.floor((e.turn - e.surgeAt) / 40) : 0;
    const amb = e.ambient + surge * 0.45;
    this.top.innerHTML = '';
    this.top.append(
      el('span', { class: 'loc', text: e.def.name.toUpperCase() }),
      el('span', { class: 'dimt', html: `Nv ${e.def.lvl[0]}–${e.def.lvl[1]}` }),
      el('span', { html: sec ? `<span class="dimt">SECTOR</span> ${sec.code} · ${esc(sec.name)}` : '' }),
      el('span', { html: `<span class="dimt">TURNO</span> <b>${e.turn}</b>` }),
      el('span', { html: surge ? `<span class="bad pulse-red">☢ PULSO ×${surge}</span>` : pulseIn <= 60 ? `<span class="warn">☢ pulso en ${pulseIn}</span>` : `<span class="dimt">☢ amb.</span> ${amb.toFixed(2)}` }),
      e.evac ? el('span', { class: 'cyan', html: `⇑ EVACUACIÓN ${e.evac.left}` }) : '',
      el('span', { class: 'ess-count', html: `<span class="cyan">✦ ${essTotal}</span>` }),
      el('div', { class: 'right' },
        el('button', { class: 'btn small', onclick: () => this.toggleBigMap() }, 'MAPA M'),
        el('button', { class: 'btn small', onclick: () => this.openInventory() }, 'INVENTARIO I'),
        el('button', { class: 'btn small', onclick: () => this.hooks.onHelp() }, 'AYUDA ?'),
        el('button', { class: 'btn small', onclick: () => this.openMenu() }, 'MENÚ Esc'),
      ),
    );
  }

  renderSquad() {
    const e = this.exp;
    const b = this.squadPanel.body;
    b.innerHTML = '';
    e.squad.forEach((sq, i) => {
      const a = sq.a;
      if (!a) return;
      const st = e.inMap(sq) ? e.ast(sq) : agentStats(a);
      const w = a.equip[sq.cur];
      const ws = w ? itemStats(w) : null;
      const status = !sq.alive ? '<span class="bad">✝ CAÍDO</span>' : sq.out ? '<span class="cyan">⇑ EXTRAÍDO</span>' : '';
      const chips = [];
      if (sq.poison) chips.push(`<span class="status-chip good">VEN ${sq.poison}</span>`);
      if (sq.burn) chips.push('<span class="status-chip bad">FUEGO</span>');
      for (const b of sq.buffs || []) chips.push(`<span class="status-chip warn" title="${esc(b.name)}">${esc(b.name.toUpperCase().slice(0, 12))} ${b.turns}</span>`);
      if (sq.autoUsed === false && e.flag && e.inMap(sq) && e.flag(sq, 'autoInject')) chips.push('<span class="status-chip cyan">💉</span>');
      if (a.rad >= 100) chips.push('<span class="status-chip bad pulse-red">RAD!</span>');
      const card = el('div', { class: `agent-card ${sq === e.cur ? 'active' : ''} ${!sq.alive ? 'dead' : sq.out ? 'gone' : ''}` });
      card.innerHTML = `
        <div class="ln2"><span><span style="color:${a.color}">@</span> <span class="nm">${esc(a.nick)}</span> <span class="dimt">${esc(a.last)} · Nv ${a.lvl}</span></span><span class="dimt">${sq !== e.cur && e.inMap(sq) ? ORDERS[sq.order] + ' ' : ''}[${i + 1}]</span></div>
        ${status ? `<div>${status}</div>` : `
        <div class="ln2"><span>SAL ${hpBar(a.hp, st.hpMaxEff, 14)}</span><span>${Math.max(0, a.hp)}/${st.hpMaxEff}</span></div>
        <div class="ln2"><span>RAD ${bar(Math.min(100, a.rad), 100, 14, 'rad')}</span><span>${Math.round(a.rad)}</span></div>
        <div class="ln2"><span style="color:${w ? rarityColor(w.r) : 'inherit'};overflow:hidden;text-overflow:ellipsis">${w ? esc(ITEMS[w.b].name) : 'Puños'}</span><span>${ws && ws.mag ? `${w.ld}/${ws.mag} <span class="dimt">+${e.ammoFor(sq)}</span>` : ''} <span class="cyan">✦${sq.ess}</span></span></div>
        ${chips.length ? `<div>${chips.join('')}</div>` : ''}`}`;
      if (e.inMap(sq)) card.addEventListener('click', () => { e.switchActive(i); sfx.click(); });
      // soltar objetos sobre un compañero adyacente para dárselos
      dropzone(card, {
        accepts: (d) => d && d.kind === 'inv' && e.inMap(sq) && sq !== e.cur && cheb(sq.x, sq.y, e.cur.x, e.cur.y) <= 1,
        onDrop: (d) => this.giveTo(sq, d.it),
      });
      tip(card, () => `<div class="tt-title" style="color:${a.color}">${esc(agentName(a))}</div><div class="dimt">Nivel ${a.lvl} · ${esc(traitOf(a).name)}</div><div class="tt-sep">${'─'.repeat(40)}</div><div class="tt-row"><span class="dimt">Puntería</span><span>${st.acc}</span></div><div class="tt-row"><span class="dimt">Agilidad</span><span>${st.ev}</span></div><div class="tt-row"><span class="dimt">Protección</span><span>${st.prot}</span></div><div class="tt-row"><span class="dimt">Resist. rad.</span><span>${st.rad}%</span></div><div class="tt-row"><span class="dimt">Visión</span><span>${st.vision}</span></div><div class="tt-row"><span class="dimt">Bajas</span><span>${sq.kills}</span></div>${e.inMap(sq) && sq !== e.cur ? '<div class="dimt">Clic para controlar. Arrastra objetos aquí para dárselos (adyacente).</div>' : ''}`);
      b.append(card);
    });
    if (e.team.length > 1) {
      const ord = el('div', { class: 'row', style: { marginTop: '4px', flexWrap: 'wrap' } }, el('span', { class: 'dimt', text: 'Órdenes (O):' }));
      for (const [k, v] of Object.entries(ORDERS)) {
        const cur = e.squad.find((s) => s !== e.cur && e.inMap(s));
        ord.append(el('button', { class: 'btn small ' + (cur && cur.order === k ? 'primary' : ''), onclick: () => { e.setOrder(k); sfx.click(); } }, v));
      }
      b.append(ord);
    }
  }

  renderAgent() {
    const e = this.exp;
    const sq = e.cur;
    const b = this.agentPanel.body;
    b.innerHTML = '';
    if (!sq || !sq.a) return;
    const a = sq.a;
    const st = e.ast(sq);
    const wrow = (slot) => {
      const w = a.equip[slot];
      const ws = w ? itemStats(w) : null;
      const cur = sq.cur === slot;
      const r = el('div', { class: 'item' + (cur ? ' sel' : ''), html: `<span class="ig">${cur ? '►' : ' '}</span>${w ? itemHTML(w) : '<span class="in dimt">— vacío —</span>'}${ws && ws.mag ? `<span class="iq">${w.ld}/${ws.mag}</span>` : ''}` });
      if (w) tip(r, () => itemTooltip(w));
      r.addEventListener('click', () => { if (sq.cur !== slot) { e.swapWeapon(); sfx.click(); } });
      return r;
    };
    b.append(el('div', { class: 'h', text: 'ARMAS  (X cambia · R recarga)' }), wrow('w1'), wrow('w2'));
    const prot = el('div', { class: 'dimt', html: `PROT <b>${st.prot}</b> · RES.RAD <b>${st.rad}%</b> · AGI <b>${st.ev}</b> · VIS <b>${st.vision}</b>` });
    b.append(prot);
    b.append(el('div', { class: 'sep', text: '─'.repeat(80) }));
    b.append(el('div', { class: 'spread' }, el('span', { class: 'h', text: `MOCHILA ${a.bag.length}/${bagCapacity(a)}` }), el('span', { class: 'dimt', text: 'clic usar · dcho soltar' })));
    const list = el('div', { class: 'inv-grid' });
    for (const it of sortItems([...a.bag])) {
      const d = ITEMS[it.b];
      const row = el('div', { class: 'item', html: itemHTML(it) });
      tip(row, () => itemTooltip(it, d.cat === 'weapon' ? a.equip[sq.cur] : ['armor', 'helmet', 'backpack'].includes(d.cat) ? a.equip[d.cat === 'backpack' ? 'pack' : d.cat] : null, `<div class="tt-sep">${'─'.repeat(40)}</div><div class="dimt">${this.defaultActionText(it)}</div>`));
      row.addEventListener('click', () => this.defaultAction(it));
      row.addEventListener('contextmenu', (ev) => { ev.preventDefault(); e.dropItem(sq, it); sfx.click(); });
      draggable(row, { data: () => ({ kind: 'inv', it }), ghost: () => itemHTML(it) });
      list.append(row);
    }
    if (!a.bag.length) list.append(el('div', { class: 'dimt', text: '  (vacía)' }));
    b.append(list);
    // suelo
    const fl = e.floorAt(sq.x, sq.y);
    if (fl.length) {
      b.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'EN EL SUELO  (G recoge)' }));
      for (const it of fl) {
        const row = el('div', { class: 'item', html: itemHTML(it) });
        tip(row, () => itemTooltip(it));
        row.addEventListener('click', () => e.takeItem(sq, fl, it));
        b.append(row);
      }
    }
  }

  defaultActionText(it) {
    const d = ITEMS[it.b];
    if (d.cat === 'consumable') return d.use === 'throw' ? 'Clic: lanzar (elige destino)' : d.use === 'trap' ? 'Clic: colocar en una casilla adyacente' : 'Clic: usar (1 turno)';
    if (d.cat === 'mod') return 'Mod de arma: se instala en la base (EQUIPO).';
    if (['weapon', 'armor', 'helmet', 'gadget', 'backpack'].includes(d.cat)) return 'Clic: equipar (1 turno)';
    return 'Botín: llévalo a la base para venderlo.';
  }
  defaultAction(it) {
    const e = this.exp;
    const d = ITEMS[it.b];
    if (d.cat === 'consumable') {
      if (d.use === 'throw' || d.use === 'trap') { this.enterThrow(it); return; }
      e.act((sq) => e.useItem(sq, it));
      return;
    }
    const slot = this.slotFor(it);
    if (slot) { e.act((sq) => e.equipItem(sq, it, slot)); sfx.click(); }
  }
  slotFor(it) {
    const d = ITEMS[it.b];
    const a = this.exp.cur.a;
    if (d.cat === 'weapon') return this.exp.cur.cur;
    if (d.cat === 'armor') return 'armor';
    if (d.cat === 'helmet') return 'helmet';
    if (d.cat === 'backpack') return 'pack';
    if (d.cat === 'gadget') return !a.equip.g1 ? 'g1' : !a.equip.g2 ? 'g2' : 'g1';
    return null;
  }
  giveTo(sq, it) {
    const e = this.exp;
    const from = e.cur.a;
    const i = from.bag.indexOf(it);
    if (i < 0) return;
    const rest = mergeInto(sq.a.bag, it, bagCapacity(sq.a));
    if (rest) { toast('Su mochila está llena.', 'bad'); return; }
    from.bag.splice(i, 1);
    e.say(`${e.nm(e.cur)} da ${esc(itemName(it))} a ${e.nm(sq)}.`, 'dimt');
    sfx.pickup();
    this.refresh();
    if (this.invRefresh) this.invRefresh();
  }

  renderLog() {
    const e = this.exp;
    const lines = e.log.slice(-7);
    this.logEl.innerHTML = '';
    lines.forEach((l, i) => {
      this.logEl.append(el('div', { class: `ln ${l.c || ''} ${i < lines.length - 3 ? 'old' : ''}`, html: `<span class="dimt">${String(l.t).padStart(4, ' ')}│</span> ${l.s}` }));
    });
  }

  // ------------------------------------------------------------ entrada
  canAct(now = performance.now()) {
    if (!this.active || this.exp.ended || modalOpen()) return false;
    if (now - this.lastAct < 55) return false;
    this.lastAct = now;
    return true;
  }

  onKey(ev) {
    if (!this.active || !this.root.classList.contains('active')) return;
    const e = this.exp;
    const k = ev.key;
    if (modalOpen()) {
      if (k === 'Escape') { closeTopModal(); ev.preventDefault(); }
      else if ((k === 'i' || k === 'I') && this.invClose) { this.invClose(); ev.preventDefault(); }
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (this.big && (k === 'm' || k === 'M' || k === 'Escape')) { this.toggleBigMap(); ev.preventDefault(); return; }
    if (k === 'Escape') { if (this.mode) this.cancelMode(); else if (this.travel) this.travel = null; else this.openMenu(); ev.preventDefault(); return; }
    if (e.ended) return;
    const lower = k.length === 1 ? k.toLowerCase() : k;
    // modo apuntar
    if (this.mode) {
      if (k === 'Tab' || lower === 't') { this.cycleTarget(ev.shiftKey ? -1 : 1); ev.preventDefault(); return; }
      if (k === 'Enter' || lower === 'f') { this.confirmTarget(); ev.preventDefault(); return; }
    }
    const dir = KEYDIR[ev.code] || KEYDIR[lower] || KEYDIR[k];
    if (dir && !(ev.code && ev.code.startsWith('Numpad') && !KEYDIR[ev.code])) {
      ev.preventDefault();
      if (this.mode) { this.moveCursor(dir); return; }
      if (!this.canAct()) return;
      this.travel = null;
      e.moveDir(dir[0], dir[1]);
      return;
    }
    switch (lower) {
      case ' ': case '.': case 'Numpad5': ev.preventDefault(); if (this.canAct()) { this.travel = null; e.wait(); } break;
      case 'f': ev.preventDefault(); if (this.canAct()) e.interact(); break;
      case 'g': ev.preventDefault(); this.pickupHere(); break;
      case 'r': ev.preventDefault(); if (this.canAct()) e.act((sq) => e.reload(sq)); break;
      case 'x': ev.preventDefault(); e.swapWeapon(); sfx.click(); break;
      case 't': ev.preventDefault(); this.enterFire(); break;
      case 'h': ev.preventDefault(); this.quickHeal(); break;
      case 'b': ev.preventDefault(); this.quickGrenade(); break;
      case 'i': ev.preventDefault(); this.openInventory(); break;
      case 'm': ev.preventDefault(); this.toggleBigMap(); break;
      case 'o': ev.preventDefault(); this.cycleOrder(); break;
      case 'Tab': ev.preventDefault(); e.switchActive(); sfx.click(); break;
      case '?': case 'F1': ev.preventDefault(); this.hooks.onHelp(); break;
      case '+': ev.preventDefault(); this.zoom(1); break;
      case 'F11': break;
      case '-': ev.preventDefault(); this.zoom(-1); break;
      case '1': case '2': case '3': case '4': {
        const i = +lower - 1;
        if (e.squad[i] && e.inMap(e.squad[i])) { e.switchActive(i); sfx.click(); }
        break;
      }
    }
    if (ev.code === 'Numpad5') { ev.preventDefault(); if (this.canAct()) e.wait(); }
  }

  zoom(d) {
    settings.zoom = Math.max(9, Math.min(28, (settings.zoom || 15) + d));
    saveSettings();
    this.r.setZoom(settings.zoom);
    const c = this.exp.cur;
    if (c) this.r.centerOn(c.x, c.y, true);
  }

  cycleOrder() {
    const e = this.exp;
    const keys = Object.keys(ORDERS);
    const other = e.squad.find((s) => s !== e.cur && e.inMap(s));
    if (!other) return;
    e.setOrder(keys[(keys.indexOf(other.order) + 1) % keys.length]);
    sfx.click();
  }

  pickupHere() {
    const e = this.exp;
    const sq = e.cur;
    const fl = e.floorAt(sq.x, sq.y);
    if (!fl.length) { e.say('No hay nada que recoger aquí.', 'dimt'); return; }
    if (fl.length === 1) e.takeItem(sq, fl, fl[0]);
    else this.openLoot({ floor: true, x: sq.x, y: sq.y });
  }

  quickHeal() {
    const e = this.exp;
    const sq = e.cur;
    const st = agentStats(sq.a);
    const heals = sq.a.bag.filter((it) => ITEMS[it.b].use === 'heal');
    if (!heals.length) { e.say('No llevas medicinas.', 'bad'); return; }
    const missing = st.hpMaxEff - sq.a.hp;
    if (missing <= 0 && !sq.poison) { e.say('Estás en plena forma.', 'dimt'); return; }
    heals.sort((x, y) => Math.abs(ITEMS[x.b].heal - missing) - Math.abs(ITEMS[y.b].heal - missing));
    if (this.canAct()) e.act((s) => e.useItem(s, heals[0]));
  }
  quickGrenade() {
    const e = this.exp;
    const g = e.cur.a.bag.find((it) => ITEMS[it.b].use === 'throw' && ITEMS[it.b].dmg) || e.cur.a.bag.find((it) => ITEMS[it.b].use === 'throw');
    if (!g) { e.say('No llevas granadas ni objetos arrojadizos.', 'bad'); return; }
    this.enterThrow(g);
  }

  // ---------- modos de objetivo ----------
  visibleEnemies() {
    const e = this.exp;
    const c = e.cur;
    return e.enemies.filter((en) => e.isVisible(en.x, en.y) && e.hostile(c, en)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
  }
  enterFire() {
    const list = this.visibleEnemies();
    if (!list.length) { this.exp.say('No hay objetivos a la vista.', 'dimt'); return; }
    this.mode = { type: 'fire', list, i: 0, cx: list[0].x, cy: list[0].y };
    this.showBanner();
    this.updateTargetOverlay();
  }
  enterThrow(it) {
    const c = this.exp.cur;
    const list = ITEMS[it.b].use === 'trap' ? [] : this.visibleEnemies();
    this.mode = { type: 'throw', it, list, i: 0, cx: list[0] ? list[0].x : c.x + 1, cy: list[0] ? list[0].y : c.y };
    if (this.invClose) this.invClose();
    this.showBanner();
    this.updateTargetOverlay();
  }
  showBanner() {
    const m = this.mode;
    this.banner.classList.remove('hidden');
    this.banner.innerHTML = m.type === 'fire'
      ? 'APUNTANDO — clic / F / Enter: disparar · Tab: siguiente objetivo · Esc: cancelar'
      : ITEMS[m.it.b].use === 'trap' ? `COLOCAR ${esc(ITEMS[m.it.b].name.toUpperCase())} — clic en una casilla adyacente · Esc: cancelar`
      : `LANZAR ${esc(ITEMS[m.it.b].name.toUpperCase())} — clic / F: lanzar · flechas: mover · Esc: cancelar`;
  }
  cancelMode() { this.mode = null; this.banner.classList.add('hidden'); this.clearOverlay(); }
  cycleTarget(d) {
    const m = this.mode;
    if (!m.list.length) return;
    m.i = (m.i + d + m.list.length) % m.list.length;
    m.cx = m.list[m.i].x; m.cy = m.list[m.i].y;
    this.updateTargetOverlay();
  }
  moveCursor([dx, dy]) { this.mode.cx += dx; this.mode.cy += dy; this.updateTargetOverlay(); }
  confirmTarget() {
    const m = this.mode;
    if (!m) return;
    this.fireAt(m.cx, m.cy);
  }
  fireAt(x, y) {
    const e = this.exp;
    const m = this.mode;
    if (m && m.type === 'throw') {
      const it = m.it;
      const ok = e.act((sq) => e.throwAt(sq, it, x, y));
      if (ok) this.cancelMode();
      return;
    }
    const en = e.enemyAt(x, y);
    if (!en || !e.isVisible(x, y)) { e.say('No hay objetivo ahí.', 'dimt'); return; }
    if (!e.hostile(e.cur, en)) { this.confirmAttack(en); return; }
    e.act((sq) => e.attack(sq, en));
    if (this.mode) {
      const list = this.visibleEnemies();
      if (!list.length) this.cancelMode();
      else { this.mode.list = list; if (!list.includes(en)) { this.mode.i = 0; this.mode.cx = list[0].x; this.mode.cy = list[0].y; } this.updateTargetOverlay(); }
    }
  }
  async confirmAttack(en) {
    const e = this.exp;
    const fac = FACTIONS[actorFaction(en)];
    const att = e.attitudeToSquad(en);
    const ok = await confirmBox('¿ABRIR FUEGO?', `<b style="color:${fac.color}">${esc(ACTORS[en.type].name)}</b> pertenece a <b>${esc(fac.name)}</b> (${esc(fac.country)}), que es <span class="${ATTITUDE_CLASS[att]}">${ATTITUDE_TEXT[att]}</span>.<br><br>Si le atacas, toda su facción se volverá <b class="bad">hostil</b> durante esta expedición y tu reputación con ella bajará.`, 'ABRIR FUEGO', 'NO', true);
    if (ok && !e.ended) { if (e.canShoot(e.cur, en) === 'ok') e.act((sq) => e.attack(sq, en)); else e.attack(e.cur, en); }
  }
  updateTargetOverlay() {
    const m = this.mode;
    const e = this.exp;
    const c = e.cur;
    if (!m) return;
    this.r.hover = [m.cx, m.cy];
    const ov = { targetMode: true };
    if (m.type === 'fire') {
      const en = e.enemyAt(m.cx, m.cy);
      const ok = en && e.isVisible(m.cx, m.cy) && e.canShoot(c, en) === 'ok';
      ov.line = [c.x, c.y, m.cx, m.cy, ok];
      if (en && e.isVisible(m.cx, m.cy)) ov.hit = e.hitChance(c, en);
    } else {
      const d = ITEMS[m.it.b];
      const inRange = Math.hypot(m.cx - c.x, m.cy - c.y) <= d.range + 0.5;
      ov.line = [c.x, c.y, m.cx, m.cy, inRange];
      const br = d.blast || d.smoke || d.gas || (d.trap && d.trap.blast) || 0;
      if (br) ov.blast = { x: m.cx, y: m.cy, r: br };
    }
    this.r.overlay = ov;
  }
  clearOverlay() { this.r.overlay = null; }

  // ---------- ratón ----------
  cellFromEvent(ev) {
    const rc = this.r.canvas.getBoundingClientRect();
    return this.r.screenToCell(ev.clientX - rc.left, ev.clientY - rc.top);
  }
  onHover(ev) {
    const e = this.exp;
    if (!e) return;
    const [x, y] = this.cellFromEvent(ev);
    if (!e.inb(x, y)) { this.r.hover = null; hideTooltip(); return; }
    if (this.mode) { this.mode.cx = x; this.mode.cy = y; this.updateTargetOverlay(); }
    else {
      this.r.hover = [x, y];
      const c = e.cur;
      const en = e.enemyAt(x, y);
      if (en && e.isVisible(x, y) && c) {
        this.r.overlay = { line: [c.x, c.y, x, y, e.canShoot(c, en) === 'ok'], hit: e.hitChance(c, en) };
      } else if (!this.travel && c && e.explored[e.key(x, y)] && (x !== c.x || y !== c.y) && cheb(x, y, c.x, c.y) < 60) {
        const path = this.findPath(x, y);
        this.r.overlay = path ? { path } : null;
      } else if (!this.travel) this.r.overlay = null;
    }
    const html = this.cellTooltip(x, y);
    if (html) showTooltip(html, ev.clientX, ev.clientY); else hideTooltip();
  }
  findPath(x, y) {
    const e = this.exp;
    const c = e.cur;
    const target = e.blockedObj(x, y);
    return astar(e.w, e.h, c.x, c.y, x, y, (px, py) => {
      const k = e.key(px, py);
      if (!e.explored[k]) return Infinity;
      if (!e.passable(px, py)) return Infinity;
      const ent = e.entityAt(px, py);
      if (ent && ent.type && e.isVisible(px, py)) return Infinity;
      return e.hazardCost(px, py) + (ent && ent.id ? 2 : 0);
    }, 8000) || (target ? null : null);
  }
  onClick(ev) {
    const e = this.exp;
    if (!e || e.ended) return;
    const [x, y] = this.cellFromEvent(ev);
    if (!e.inb(x, y)) return;
    if (this.mode) { this.fireAt(x, y); return; }
    const c = e.cur;
    const en = e.enemyAt(x, y);
    if (en && e.isVisible(x, y) && !e.hostile(c, en)) {
      if (e.attitudeToSquad(en) === 'allied') this.startTravel(x, y, true);
      else this.confirmAttack(en);
      return;
    }
    if (en && e.isVisible(x, y)) {
      const r = e.canShoot(c, en);
      if (r === 'ok') { if (this.canAct()) e.act((sq) => e.attack(sq, en)); return; }
      if (r === 'melee') { this.startTravel(x, y, true); return; }
      e.attack(c, en); // mostrará el motivo
      return;
    }
    if (x === c.x && y === c.y) {
      if (e.exitAt(x, y) || e.floorAt(x, y).length || (e.objAt(x, y) && ['corpse', 'note'].includes(e.objAt(x, y).kind))) { if (this.canAct()) e.interact(); }
      else if (this.canAct()) e.wait();
      return;
    }
    const obj = e.objAt(x, y);
    if (obj && cheb(x, y, c.x, c.y) <= 1) { if (this.canAct()) e.act((sq) => e.interactObj(sq, obj)); return; }
    const ag = e.agentAt(x, y);
    if (ag && cheb(x, y, c.x, c.y) > 1) { e.switchActive(e.squad.indexOf(ag)); return; }
    this.startTravel(x, y);
  }
  startTravel(x, y, toEnemy = false) {
    const e = this.exp;
    let path = this.findPath(x, y);
    if (!path && toEnemy) {
      path = astar(e.w, e.h, e.cur.x, e.cur.y, x, y, (px, py) => (e.passable(px, py) && !(e.enemyAt(px, py)) ? 1 : Infinity), 4000);
    }
    if (!path || !path.length) { e.say('No conozco un camino hasta ahí.', 'dimt'); sfx.error(); return; }
    const obj = e.blockedObj(x, y);
    if (obj || toEnemy) path = path.slice(0, -1);
    e.interrupt = false;
    this.travel = { path, i: 0, t: 0, obj };
  }
  stepTravel(now) {
    const tr = this.travel;
    if (!tr) return;
    const e = this.exp;
    if (e.ended || modalOpen()) { this.travel = null; return; }
    if (now - tr.t < 75) return;
    tr.t = now;
    if (e.interrupt) { this.travel = null; e.interrupt = false; return; }
    if (tr.i >= tr.path.length) {
      this.travel = null;
      if (tr.obj && cheb(tr.obj.x, tr.obj.y, e.cur.x, e.cur.y) <= 1) e.act((sq) => e.interactObj(sq, tr.obj));
      return;
    }
    const [nx, ny] = tr.path[tr.i++];
    const c = e.cur;
    if (cheb(nx, ny, c.x, c.y) !== 1) { this.travel = null; return; }
    const ent = e.entityAt(nx, ny);
    if (ent && ent.type) { this.travel = null; return; }
    const ok = e.moveDir(nx - c.x, ny - c.y);
    if (!ok) this.travel = null;
    this.lastAct = now;
  }

  cellTooltip(x, y) {
    const e = this.exp;
    const k = e.key(x, y);
    const ex = e.exits.find((q) => cheb(q.x, q.y, x, y) <= 1);
    if (!e.explored[k] && !ex) return null;
    const vis = e.visible[k] > 0;
    const parts = [];
    const en = vis ? e.enemyAt(x, y) : null;
    if (en) {
      const def = ACTORS[en.type];
      const col = actorColor(en);
      const es = e.est(en);
      const att = e.attitudeToSquad(en);
      const human = isHuman(en);
      const fac = FACTIONS[actorFaction(en)];
      parts.push(`<div class="tt-title" style="color:${col}">${def.glyph} ${def.name}${def.boss ? ' ☠' : ''}</div>`);
      parts.push(`<div class="tt-sub">Nivel <b style="color:${col}">${en.lvl}</b> · ${human ? `<span style="color:${fac.color}">${esc(fac.short)}</span>` : def.origin} · <span class="${ATTITUDE_CLASS[att]}">${ATTITUDE_TEXT[att]}</span> · <span class="${en.state === 'alerta' ? 'bad' : 'dimt'}">${en.stun > 0 ? `aturdido (${en.stun})` : STATE_TXT[en.state]}</span></div>`);
      parts.push(`<div class="tt-row"><span>Salud</span><span>${hpBar(en.hp, en.hpMax, 12)} ${en.hp}/${en.hpMax}</span></div>`);
      if (human) parts.push(`<div class="tt-row"><span class="dimt">Arma</span><span style="color:${en.w ? rarityColor(en.w.r) : ''}">${en.w ? esc(itemName(en.w)) : 'ninguna'}</span></div><div class="tt-row"><span class="dimt">Protección</span><span>${es.armor}</span></div><div class="tt-row"><span class="dimt">Esquiva</span><span>${es.ev}</span></div><div class="tt-lore">${esc(def.lore || '')}</div>`);
      else parts.push(`<div class="tt-row"><span class="dimt">Daño</span><span>${es.dmg[0]}–${es.dmg[1]}</span></div><div class="tt-row"><span class="dimt">Blindaje</span><span>${es.armor}</span></div><div class="tt-row"><span class="dimt">Esquiva</span><span>${es.ev}</span></div>`);
      if (def.abil.length) parts.push(`<div class="tt-aff">◆ ${def.abil.map((a) => ABIL_TEXT[a]).join(' · ')}</div>`);
      if (att !== 'hostile') parts.push(`<div class="dimt">${att === 'allied' ? 'Aliado: choca con él para intercambiar posiciones.' : 'Neutral: no te atacará si no le atacas.'} Atacarle lo volverá hostil.</div>`);
      const c = e.cur;
      if (c) {
        const r = e.canShoot(c, en);
        const why = { ok: '', melee: ' (acércate)', empty: ' (recarga)', range: ' (fuera de alcance)', los: ' (sin línea de tiro)' }[r];
        const hc = e.hitChance(c, en);
        parts.push(`<div class="tt-row"><span>Impacto</span><span class="${hc >= 60 ? 'good' : hc >= 35 ? 'warn' : 'bad'}">${hc}%${why}</span></div>`);
      }
    }
    const ag = vis ? e.agentAt(x, y) : null;
    if (ag) { const st = agentStats(ag.a); parts.push(`<div class="tt-title" style="color:${ag.a.color}">@ ${esc(agentName(ag.a))}</div><div>Salud ${ag.a.hp}/${st.hpMaxEff} · Rad ${Math.round(ag.a.rad)}</div>`); }
    if (ex) parts.push(`<div class="tt-title cyan">⌂ ${esc(ex.name)}</div><div class="dimt">${ex.perm ? 'Extracción permanente.' : `Extracción temporal: ${ex.expires - e.turn} turnos.`} Entra en la zona y pulsa <b>F</b>.</div>`);
    const obj = e.objAt(x, y);
    if (obj) {
      if (obj.kind === 'vein') parts.push(`<div class="tt-title cyan">✦ Veta de esencia</div><div class="dimt">${obj.amount > 0 ? `Quedan ~${obj.amount} ✦. Ponte al lado y pulsa <b>F</b> para extraer (hace ruido).` : 'Agotada.'}</div>`);
      else if (obj.kind === 'note') parts.push(`<div class="tt-title" style="color:#f0e1aa">? Nota</div><div class="dimt">${obj.opened ? 'Ya leída.' : 'Papel arrugado.'} Ponte encima y pulsa <b>F</b>.</div>`);
      else if (obj.kind === 'survivor') parts.push('<div class="tt-title" style="color:#a0e8a0">☺ Superviviente</div><div class="dimt">Alguien sigue vivo aquí abajo. Ponte al lado y pulsa <b>F</b>.</div>');
      else parts.push(`<div class="tt-title o1">${OBJ_NAME[obj.kind]}</div><div class="dimt">${!obj.opened ? 'Sin registrar. Adyacente + <b>F</b> o clic.' : obj.items.length ? `${obj.items.length} objeto(s) dentro.` : 'Vacío.'}</div>`);
    }
    if (vis && e.essence.get(k)) parts.push(`<div class="cyan">✦ ${e.essence.get(k)} de esencia</div>`);
    const fl = e.floorItems.get(k);
    if (fl && fl.length && (vis || e.explored[k])) parts.push(fl.map((it) => `<div style="color:${rarityColor(it.r)}">${esc(itemName(it))}${it.q > 1 ? ' ×' + it.q : ''}</div>`).join(''));
    const trap = e.trapAt(x, y);
    if (trap) parts.push(`<div class="bad">× ${esc(ITEMS[trap.b].name)} (tuya)</div>`);
    const td = TILES[e.t[k]];
    const sec = e.sectorAt(x, y);
    parts.push(`<div class="tt-sep">${'─'.repeat(40)}</div><div class="dimt">${td.name}${sec ? ` · ${sec.code} ${esc(sec.name)}` : ''}${vis ? '' : ' (recordado)'}</div>`);
    if (vis) {
      const r = e.rad[k] + e.ambient;
      const hz = [];
      if (r > 0.3) hz.push(`<span style="color:#b8f53d">☢ radiación ${r > 3 ? 'letal' : r > 1.5 ? 'alta' : r > 0.7 ? 'media' : 'baja'}</span>`);
      if (e.gas[k]) hz.push('<span style="color:#c06cff">gas tóxico</span>');
      if (e.fire[k]) hz.push('<span class="bad">fuego</span>');
      if (e.anomaly[k]) hz.push('<span style="color:#7fb8ff">anomalía eléctrica</span>');
      if (e.smoke[k]) hz.push('<span class="dimt">humo</span>');
      if (hz.length) parts.push(`<div>${hz.join(' · ')}</div>`);
    }
    return parts.join('');
  }

  markerTooltip(m) {
    const e = this.exp;
    if (m.exit) return `<div class="tt-title cyan">⌂ ${esc(m.exit.name)}</div><div class="dimt">${m.exit.perm ? 'Extracción permanente' : `Temporal: ${m.exit.expires - e.turn} turnos`}</div>`;
    const p = m.poi;
    const sec = e.sectors[p.sector];
    let h = `<div class="tt-title">${esc(p.name)}</div>`;
    if (p.type === 'nest') { const d = ENEMIES[p.boss || p.enemy]; h += `<div>Nivel <b style="color:${enemyColor(d.hue, p.lvl)}">${p.lvl}</b>${p.cleared ? ' · <span class="good">despejado</span>' : ''}${p.boss ? ' · <span class="bad">☠ jefe</span>' : ''}</div><div class="tt-lore">${S.bestiary[p.boss || p.enemy] ? esc(d.lore) : 'Especie no catalogada.'}</div>`; }
    if (p.type === 'vein') h += `<div class="cyan">${p.cleared ? 'Agotada' : 'Esencia extraíble'} · Nv ${p.lvl}</div>`;
    if (p.type === 'cache') h += `<div>${p.cleared ? 'Saqueado' : 'Suministros sin abrir'}${S.modules.radar >= 2 && !p.cleared ? ` · mejor objeto: <span style="color:${rarityColor(p.best)}">${['común', 'no común', 'raro', 'épico', 'legendario', 'mítico'][p.best]}</span>` : ''}</div>`;
    if (p.type === 'hazard') h += `<div class="dimt">Peligro de nivel ${p.lvl}</div>`;
    if (sec) h += `<div class="dimt">Sector ${sec.code} · ${esc(sec.name)}</div>`;
    const c = e.cur;
    if (c) h += `<div class="dimt">Distancia: ${Math.round(Math.hypot(p.x - c.x, p.y - c.y))} casillas</div>`;
    return h;
  }

  // ------------------------------------------------------------ mapa completo
  toggleBigMap() {
    if (this.big) { this.big.wrap.remove(); this.big = null; return; }
    const e = this.exp;
    const cv = el('canvas');
    const wrap = el('div', { class: 'bigmap-wrap' },
      el('div', { class: 'h', text: `══[ ${e.def.name.toUpperCase()} · MAPA DEL RADAR ]══` }),
      cv,
      el('div', { class: 'legend', html: '<span><span style="color:#ff6a6a">▲</span><b>n</b> nido (nivel)</span><span style="color:#ff3b30">☠ nido alfa</span><span class="cyan">✦ veta</span><span style="color:#ffb02e">■ alijo</span><span style="color:#b8f53d">☢ radiación</span><span style="color:#c06cff">≋ esporas</span><span style="color:#7fb8ff">ϟ anomalía</span><span class="cyan">⌂ extracción</span><span class="dimt">clic: viajar · M/Esc: cerrar</span>' }),
    );
    this.mapHost.append(wrap);
    const r = this.mapHost.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const s = Math.min((r.width * 0.96) / e.w, (r.height * 0.8) / e.h);
    cv.width = Math.round(e.w * s * dpr); cv.height = Math.round(e.h * s * dpr);
    cv.style.width = e.w * s + 'px'; cv.style.height = e.h * s + 'px';
    const mm = new Minimap(cv);
    mm.attach(e);
    mm.draw(performance.now(), { big: true, radar: S.modules.radar, force: true });
    this.big = { wrap, mm };
    cv.addEventListener('pointermove', (ev) => {
      const rc = cv.getBoundingClientRect();
      const px = (ev.clientX - rc.left) * dpr, py = (ev.clientY - rc.top) * dpr;
      const m = mm.markerAt(px, py);
      if (m) showTooltip(this.markerTooltip(m), ev.clientX, ev.clientY);
      else hideTooltip();
    });
    cv.addEventListener('pointerleave', () => hideTooltip());
    cv.addEventListener('click', (ev) => {
      const rc = cv.getBoundingClientRect();
      const cell = mm.cellAt((ev.clientX - rc.left) * dpr, (ev.clientY - rc.top) * dpr);
      hideTooltip();
      this.toggleBigMap();
      if (cell && e.explored[e.key(cell[0], cell[1])]) this.startTravel(cell[0], cell[1]);
    });
  }

  // ------------------------------------------------------------ inventario
  openInventory() {
    const e = this.exp;
    if (!e || e.ended) return;
    if (this.invClose) { this.invClose(); return; }
    const body = el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,.8fr)', gap: '2ch' } });
    const render = () => {
      const sq = e.cur;
      const a = sq.a;
      body.innerHTML = '';
      // equipo
      const eq = el('div');
      eq.append(el('div', { class: 'h', text: `EQUIPO · ${a.nick}` }));
      for (const s of EQUIP_SLOTS) {
        const it = a.equip[s.id];
        const slot = el('div', { class: 'slot' }, el('span', { class: 'sl', text: s.label }), el('div', { class: 'sv' }, it ? (() => {
          const r = el('div', { class: 'item', html: itemHTML(it) + (it.ld != null && itemStats(it).mag ? `<span class="iq">${it.ld}/${itemStats(it).mag}</span>` : '') });
          tip(r, () => itemTooltip(it, null, '<div class="dimt">Arrastra a la mochila para quitar. Clic derecho: soltar.</div>'));
          draggable(r, { data: () => ({ kind: 'inv', it, from: s.id }), ghost: () => itemHTML(it) });
          r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); e.dropItem(sq, it); render(); });
          return r;
        })() : el('div', { class: 'empty', text: '— vacío —' })));
        dropzone(slot, {
          accepts: (d) => d && d.kind === 'inv' && canEquip(d.it, s.id) && d.from !== s.id,
          onDrop: (d) => {
            if (d.from && d.from.startsWith('w') && s.id.startsWith('w')) { [a.equip[d.from], a.equip[s.id]] = [a.equip[s.id], a.equip[d.from]]; render(); this.refresh(); return; }
            e.act((q) => e.equipItem(q, d.it, s.id)); render();
          },
        });
        eq.append(slot);
      }
      const st = e.ast(sq);
      eq.append(el('div', { class: 'sep', text: '─'.repeat(60) }), el('div', { class: 'kv', html: `<span>Salud</span><span>${a.hp}/${st.hpMaxEff}</span><span>Radiación</span><span>${Math.round(a.rad)}</span><span>Protección</span><span>${st.prot}</span><span>Resist. rad.</span><span>${st.rad}%</span><span>Agilidad</span><span>${st.ev}</span><span>Puntería</span><span>${st.acc}</span><span>Visión</span><span>${st.vision}</span><span>Esencia</span><span class="cyan">${sq.ess} ✦</span>` }));
      // mochila
      const bag = el('div', { style: { minHeight: '20em' } });
      bag.append(el('div', { class: 'h', text: `MOCHILA ${a.bag.length}/${bagCapacity(a)}` }));
      for (const it of sortItems([...a.bag])) {
        const d = ITEMS[it.b];
        const r = el('div', { class: 'item', html: itemHTML(it) });
        const cmpSlot = d.cat === 'weapon' ? sq.cur : d.cat === 'backpack' ? 'pack' : ['armor', 'helmet'].includes(d.cat) ? d.cat : d.cat === 'gadget' ? 'g1' : null;
        tip(r, () => itemTooltip(it, cmpSlot ? a.equip[cmpSlot] : null, `<div class="tt-sep">${'─'.repeat(40)}</div><div class="dimt">${this.defaultActionText(it)} · Clic derecho: soltar · Arrastra a una ranura o a un compañero</div>`));
        r.addEventListener('click', () => { this.defaultAction(it); if (this.invClose) render(); });
        r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); e.dropItem(sq, it); render(); });
        draggable(r, { data: () => ({ kind: 'inv', it }), ghost: () => itemHTML(it) });
        bag.append(r);
      }
      dropzone(bag, {
        accepts: (d) => d && ((d.kind === 'inv' && d.from) || d.kind === 'floor'),
        onDrop: (d) => {
          if (d.kind === 'floor') { e.takeItem(sq, d.list, d.it); render(); return; }
          if (a.bag.length >= bagCapacity(a)) { toast('Mochila llena.', 'bad'); return; }
          a.equip[d.from] = null; a.bag.push(d.it); render(); this.refresh();
        },
      });
      // suelo y compañeros
      const side = el('div');
      side.append(el('div', { class: 'h', text: 'SUELO' }));
      const fl = e.floorAt(sq.x, sq.y);
      const flBox = el('div', { style: { minHeight: '6em' } });
      for (const it of fl) {
        const r = el('div', { class: 'item', html: itemHTML(it) });
        tip(r, () => itemTooltip(it));
        r.addEventListener('click', () => { e.takeItem(sq, fl, it); render(); });
        draggable(r, { data: () => ({ kind: 'floor', it, list: fl }), ghost: () => itemHTML(it) });
        flBox.append(r);
      }
      if (!fl.length) flBox.append(el('div', { class: 'dimt', text: 'Arrastra aquí para soltar.' }));
      dropzone(flBox, { accepts: (d) => d && d.kind === 'inv', onDrop: (d) => { e.dropItem(sq, d.it); render(); } });
      side.append(flBox, el('div', { class: 'sep', text: '─'.repeat(40) }), el('div', { class: 'h', text: 'DAR A UN COMPAÑERO' }));
      for (const o of e.squad) {
        if (o === sq || !e.inMap(o)) continue;
        const near = cheb(o.x, o.y, sq.x, sq.y) <= 1;
        const r = el('div', { class: 'agent-row', html: `<span class="ag" style="color:${o.a.color}">@</span><span class="an">${esc(o.a.nick)} <span class="dimt">${o.a.bag.length}/${bagCapacity(o.a)}</span></span><span class="${near ? 'good' : 'dimt'}">${near ? 'adyacente' : 'lejos'}</span>` });
        dropzone(r, { accepts: (d) => d && d.kind === 'inv' && !d.from && near, onDrop: (d) => { this.giveTo(o, d.it); render(); } });
        side.append(r);
      }
      body.append(eq, bag, side);
    };
    render();
    this.invRefresh = render;
    const close = modal({ title: 'INVENTARIO', body, width: 'min(124ch, 94vw)', actions: [{ label: 'CERRAR (I)' }], onClose: () => { this.invClose = null; this.invRefresh = null; this.refresh(); } });
    this.invClose = close;
  }

  // ------------------------------------------------------------ botín
  openLoot(d) {
    const e = this.exp;
    const sq = e.cur;
    const list = d.obj ? d.obj.items : e.floorAt(d.x, d.y);
    const title = d.obj ? OBJ_NAME[d.obj.kind].toUpperCase() : 'SUELO';
    const body = el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '3ch' } });
    const render = () => {
      body.innerHTML = '';
      const left = el('div', { style: { minHeight: '12em' } }, el('div', { class: 'h', text: `CONTENIDO (${list.length})` }));
      for (const it of list) {
        const r = el('div', { class: 'item', html: itemHTML(it) });
        tip(r, () => itemTooltip(it, null, '<div class="dimt">Clic o arrastra a la mochila para coger.</div>'));
        r.addEventListener('click', () => { e.takeItem(sq, list, it); render(); });
        draggable(r, { data: () => ({ kind: 'loot', it }), ghost: () => itemHTML(it) });
        left.append(r);
      }
      if (!list.length) left.append(el('div', { class: 'dimt', text: 'Vacío.' }));
      dropzone(left, { accepts: (dd) => dd && dd.kind === 'inv' && !dd.from, onDrop: (dd) => { const i = sq.a.bag.indexOf(dd.it); if (i >= 0) { sq.a.bag.splice(i, 1); list.push(dd.it); render(); this.refresh(); } } });
      const right = el('div', { style: { minHeight: '12em' } }, el('div', { class: 'h', text: `MOCHILA ${sq.a.bag.length}/${bagCapacity(sq.a)}` }));
      for (const it of sortItems([...sq.a.bag])) {
        const r = el('div', { class: 'item', html: itemHTML(it) });
        tip(r, () => itemTooltip(it, null, '<div class="dimt">Arrastra al contenedor para dejarlo.</div>'));
        draggable(r, { data: () => ({ kind: 'inv', it }), ghost: () => itemHTML(it) });
        right.append(r);
      }
      dropzone(right, { accepts: (dd) => dd && dd.kind === 'loot', onDrop: (dd) => { e.takeItem(sq, list, dd.it); render(); } });
      body.append(left, right);
      if (!list.length && d.obj && this.lootClose) setTimeout(() => { if (this.lootClose) this.lootClose(); }, 250);
    };
    render();
    const close = modal({
      title, body, width: 'min(90ch, 94vw)',
      actions: [
        { label: 'COGER TODO', cls: 'primary', fn: () => { for (const it of [...list]) if (!e.takeItem(sq, list, it)) break; render(); return list.length === 0 ? undefined : false; } },
        { label: 'CERRAR' },
      ],
      onClose: () => { this.lootClose = null; this.refresh(); },
    });
    this.lootClose = close;
  }

  // ------------------------------------------------------------ eventos narrativos
  openNote(o) {
    const n = NOTES[o.note % NOTES.length];
    sfx.type();
    modal({ title: 'NOTA ENCONTRADA', width: 'min(70ch, 92vw)', body: `<div class="msg-topolev" style="font-size:15px;line-height:1.6;padding:1em 1ch">${esc(n.t)}</div><div class="dimt" style="text-align:right">— ${esc(n.a)}</div>`, actions: [{ label: 'GUARDAR EN LA MEMORIA' }] });
  }
  // diálogo abierto por el motor de eventos (data/dialogs.js)
  openDialog() {
    const e = this.exp;
    if (this.dlgClose) { const c = this.dlgClose; this.dlgClose = null; c('replaced'); }
    const view = e.dialogView();
    if (!view) { e.closeDialog(); return; }
    const tok = e.dlg.tok;
    this.dlgClose = showDialog(view,
      (i) => { this.dlgClose = null; if (!e.dlg || e.dlg.tok !== tok) return; e.act(() => e.dialogChoose(i)); if (e.dlg && e.dlg.tok === tok) this.refresh(); },
      () => { this.dlgClose = null; if (e.dlg && e.dlg.tok === tok) e.closeDialog(); });
  }

  // ------------------------------------------------------------ menú de pausa
  openMenu() {
    const body = el('div', { class: 'title-menu', style: { marginTop: 0 } });
    let close;
    const btn = (label, fn, cls = '') => el('button', { class: 'btn ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
    body.append(
      btn('CONTINUAR', () => close()),
      btn('INSTRUCCIONES', () => { close(); this.hooks.onHelp(); }),
      btn(`SONIDO: ${settings.sound ? 'SÍ' : 'NO'}`, () => { settings.sound = !settings.sound; saveSettings(); close(); this.openMenu(); }),
      btn(`EFECTO CRT: ${settings.crt ? 'SÍ' : 'NO'}`, () => { settings.crt = !settings.crt; document.body.classList.toggle('no-crt', !settings.crt); saveSettings(); close(); this.openMenu(); }),
      btn('ZOOM +', () => this.zoom(1)), btn('ZOOM −', () => this.zoom(-1)),
      btn('PANTALLA COMPLETA', () => { toggleFullscreen(); close(); }),
      btn(`TEXTO: ${UI_SCALES[settings.uiScale || 0].name}`, () => { cycleUiScale(); close(); this.refresh(); this.renderLog(); setTimeout(() => { this.sizeMinimap(); this.r.resize(); }, 50); this.openMenu(); }),
      btn('GUARDAR Y SALIR AL TÍTULO', () => { save(); close(); this.stop(); this.hooks.onQuit(); }, 'danger'),
    );
    body.append(el('div', { class: 'dimt', style: { marginTop: '1em', textAlign: 'center' }, text: 'La expedición se guarda automáticamente. No se puede abandonar: solo se sale por una extracción.' }));
    close = modal({ title: 'PAUSA', body, width: '50ch' });
  }
}
