// La base: cuartel general cerca de la central
import { el, $, panel, framify, esc, UI_SCALES, cycleUiScale, toast, tip, draggable, dropzone, hpBar, bar, levelPips, confirmBox, modal, modalOpen, closeTopModal } from '../util/dom.js';
import { S, save, settings, saveSettings, slot, exportSlot } from '../core/state.js';
import { ITEMS, CAT_INFO } from '../data/items.js';
import { MAPS, MODULES, MODULE_MAX, moduleCost, TRAITS } from '../data/world.js';
import { ENEMIES, enemyColor, ABIL_TEXT } from '../data/enemies.js';
import { RARITIES, rarityWeights } from '../data/rarity.js';
import { itemHTML, itemTooltip, itemName, itemStats, sortItems, mergeInto, rarityColor, itemValue, forgeCost, infuse, FORGE_CATS, slotsOf, modFits, installMod, removeMod, WTYPE_NAMES } from '../core/items.js';
import { MOD_SLOTS } from '../data/mods.js';
import { agentStats, agentName, EQUIP_SLOTS, canEquip, bagCapacity, traitOf, xpForLevel } from '../core/agents.js';
import * as C from '../core/campaign.js';
import { sfx } from '../audio.js';
import { uiBurst, uiSparkEl, uiFly, uiText } from './fx.js';
import { fmt } from '../util/rng.js';
import { toggleFullscreen } from './expui.js';
import { showDialog } from './dialog.js';

const TABS = [
  { id: 'cuartel', label: 'CUARTEL' },
  { id: 'equipo', label: 'EQUIPO' },
  { id: 'barracones', label: 'BARRACONES' },
  { id: 'laboratorio', label: 'LABORATORIO' },
  { id: 'intendencia', label: 'INTENDENCIA' },
  { id: 'expedicion', label: 'EXPEDICIÓN' },
  { id: 'archivo', label: 'ARCHIVO' },
];

const BASE_ART = String.raw`
            .   *        .        ☢          .
     *          ___________________          *
        .      |  PUESTO  PRIPYAT-7 |   .
   ____________|____________________|_______________
  |  ┌──────┐  ┌─────┐  ║ ▓▓ ║  ┌─────────┐ ┌────┐ |
  |  │LAB ✦ │  │ ╦╦╦ │  ║ ▓▓ ║  │ ⌂ ⌂ ⌂ ⌂ │ │ ◎  │ |
  |  └──────┘  └─────┘  ║ ▓▓ ║  └─────────┘ └────┘ |
  |____[ ]________[ ]___╚════╝______[ ]_______[ ]___|
 ///////////////////////////////////////////////////////
       ║        ║         ║          ║         ║
   ~~~~~~~~ hacia la central  ═════════════►  ~~~~~~~~`;

export class BaseUI {
  constructor(root, hooks) {
    this.root = root;
    this.hooks = hooks;
    this.tab = 'cuartel';
    this.selAgent = null;
    this.stashFilter = 'all';
    this.selMap = 0;
    this.squad = new Set();
    window.addEventListener('keydown', (ev) => {
      if (!this.active || !this.root.classList.contains('active') || modalOpen() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const n = parseInt(ev.key, 10);
      if (n >= 1 && n <= TABS.length) { this.show(TABS[n - 1].id); sfx.click(); }
      if (ev.key === '?') this.hooks.onHelp();
      if (ev.key === 'Escape') this.openMenu();
    });
  }

  open(tab) {
    this.active = true;
    if (tab) this.tab = tab;
    if (!this.selAgent || !S.agents.includes(this.selAgent)) this.selAgent = S.agents[0] || null;
    this.selMap = Math.min(this.selMap, S.unlocked - 1);
    for (const id of [...this.squad]) if (!S.agents.find((a) => a.id === id)) this.squad.delete(id);
    C.ensureShop(); C.ensureRecruits();
    this.render();
    setTimeout(() => this.runDialogs(), 400);
  }

  // diálogos pendientes del motor de eventos (visitas, cartas…)
  runDialogs() {
    if (!this.active || this.dlgOpen) return;
    const d = C.baseDialog();
    if (!d) return;
    const step = () => {
      const view = d.view();
      if (!view) { d.dismiss(); this.dlgOpen = false; return; }
      this.dlgOpen = true;
      showDialog(view, (i) => {
        this.dlgOpen = false;
        const more = d.choose(i);
        this.render();
        if (more) step(); else setTimeout(() => this.runDialogs(), 250);
      }, () => { this.dlgOpen = false; d.dismiss(); this.render(); setTimeout(() => this.runDialogs(), 250); });
    };
    step();
  }
  close() { this.active = false; }

  show(tab) { this.tab = tab; this.render(); }

  render() {
    const R = this.root;
    R.innerHTML = '';
    // cabecera
    const top = el('div', { class: 'base-top' },
      el('span', { class: 'logo', html: '☢ LA MISIÓN TOPOLEV' }),
      el('span', { class: 'dimt', html: `PUESTO PRIPYAT-7 · DÍA <b>${S.day}</b> · ${new Date(1986, 4, 1 + S.day).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} de 1986` }),
      el('div', { class: 'res' },
        this.resEl('ess', '✦', 'Esencia', S.ess, 'cyan'),
        this.resEl('rub', '₽', 'Rublos', S.rub, 'o0'),
        this.resEl('ag', '@', 'Agentes', `${S.agents.length}/${C.rosterCap()}`, ''),
        el('button', { class: 'btn small', onclick: () => this.hooks.onHelp() }, '? INSTRUCCIONES'),
        el('button', { class: 'btn small', onclick: () => this.openMenu() }, '≡ MENÚ'),
      ),
    );
    const tabs = el('div', { class: 'tabs' });
    TABS.forEach((t, i) => {
      const tb = el('div', { class: 'tab' + (t.id === this.tab ? ' active' : ''), html: `<span class="k">${i + 1}</span>${t.label}` });
      tb.addEventListener('click', () => { sfx.click(); this.show(t.id); });
      tb.addEventListener('pointerenter', () => sfx.hover());
      tabs.append(tb);
    });
    const body = el('div', { class: 'base-body' });
    R.append(top, tabs, body);
    const view = this['tab_' + this.tab]();
    body.append(view);
    // sonidos de rollover en botones
    for (const b of R.querySelectorAll('.btn, .agent-row, .mapcard, .item')) b.addEventListener('pointerenter', () => sfx.hover());
  }

  resEl(id, g, label, v, cls) {
    const e = el('span', { class: 'res-item', id: 'res-' + id, html: `<span class="${cls}">${g}</span> <span class="v">${typeof v === 'number' ? fmt(v) : v}</span>` });
    tip(e, () => `<div class="tt-title">${label}</div><div class="dimt">${{ ess: 'Esencia de chebylita. Se usa para mejorar los módulos del laboratorio.', rub: 'Rublos. Para comprar en la intendencia, reclutar y tratar a los agentes.', ag: 'Agentes en plantilla / capacidad de los barracones.' }[id]}</div>`);
    return e;
  }
  pulseRes(id) { const v = $('#res-' + id + ' .v'); if (v) { v.classList.remove('pulse'); void v.offsetWidth; v.classList.add('pulse'); } }

  // =========================================================== CUARTEL
  tab_cuartel() {
    const g = el('div', { class: 'grid3' });
    const a = panel({ title: 'PUESTO PRIPYAT-7', bodyCls: 'scroll' });
    const stash = S.stash.length;
    a.body.append(
      el('pre', { class: 'ascii-art', text: BASE_ART }),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'kv', html: `
        <span>Día</span><span>${S.day}</span>
        <span>Agentes</span><span>${S.agents.length} / ${C.rosterCap()} · escuadrón de ${C.squadCap()}</span>
        <span>Almacén</span><span>${stash} / ${C.stashCap()}</span>
        <span>Esencia</span><span class="cyan">${fmt(S.ess)} ✦</span>
        <span>Rublos</span><span>${fmt(S.rub)} ₽</span>
        <span>Zonas</span><span>${S.unlocked} / ${MAPS.length} accesibles</span>
        <span>Expediciones</span><span>${S.stats.expeditions} (${S.stats.extractions} con éxito)</span>
        <span>Caídos</span><span class="bad">${S.fallen.length}</span>` }),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'row', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn primary', onclick: () => this.show('expedicion') }, 'PREPARAR EXPEDICIÓN'),
        el('button', { class: 'btn', onclick: () => this.show('equipo') }, 'EQUIPAR AGENTES'),
      ),
    );
    const m = panel({ title: 'MENSAJES · DR. A. TOPOLEV', bodyCls: 'scroll' });
    for (const msg of S.messages) m.body.append(el('div', { class: 'msg-topolev', html: `<span class="dimt">[día ${msg.day}]</span> ${esc(msg.text)}` }), el('div', { class: 'sep', text: '·'.repeat(80) }));
    const r = panel({ title: 'ÚLTIMO INFORME', bodyCls: 'scroll' });
    const rep = S.lastReport;
    if (!rep) r.body.append(el('div', { class: 'dimt', text: 'Todavía no se ha realizado ninguna expedición.' }), el('div', { class: 'sep', text: ' ' }), el('div', { class: 'msg-topolev', text: 'Consejo: equipa a tus agentes en EQUIPO (arrastra objetos del almacén a sus ranuras) y luego elige destino y escuadrón en EXPEDICIÓN.' }));
    else {
      const res = { success: '<span class="good">ÉXITO</span>', partial: '<span class="warn">ÉXITO PARCIAL</span>', fail: '<span class="bad">FRACASO</span>' }[rep.result];
      r.body.append(el('div', { html: `<b>${esc(rep.map)}</b> · día ${rep.day} · ${res}` }), el('div', { class: 'kv', html: `<span>Turnos</span><span>${rep.turns}</span><span>Bajas enemigas</span><span>${rep.kills}</span><span>Esencia</span><span class="cyan">${rep.ess} ✦</span>` }));
      for (const ag of rep.agents) r.body.append(el('div', { html: `<span style="color:${ag.color}">@</span> ${esc(ag.name)} — ${ag.status === 'extraído' ? '<span class="cyan">extraído</span>' : '<span class="bad">muerto</span>'}${ag.lvlUp > 0 ? ` <span class="warn">★ Nv ${ag.lvl}</span>` : ''}` }));
      if (rep.unlocked) r.body.append(el('div', { class: 'good', text: `Nueva zona: ${rep.unlocked}` }));
    }
    g.append(a, m, r);
    return g;
  }

  // =========================================================== EQUIPO
  tab_equipo() {
    const g = el('div', { class: 'grid3' });
    // lista de agentes
    const L = panel({ title: 'AGENTES', bodyCls: 'scroll' });
    for (const a of S.agents) L.body.append(this.agentRow(a));
    if (!S.agents.length) L.body.append(el('div', { class: 'dimt', text: 'No hay agentes. Recluta en BARRACONES.' }));
    L.body.append(el('div', { class: 'sep', text: '─'.repeat(60) }), el('button', { class: 'btn', onclick: () => this.show('barracones') }, 'RECLUTAR'));
    // ficha
    const M = panel({ title: 'FICHA', bodyCls: 'scroll' });
    if (this.selAgent) this.agentSheet(M.body, this.selAgent);
    // almacén
    const R = panel({ title: `ALMACÉN ${S.stash.length}/${C.stashCap()}`, bodyCls: 'scroll' });
    this.stashView(R.body, 'equip');
    g.append(L, M, R);
    return g;
  }

  agentRow(a, extra = '', onClick = null) {
    const st = agentStats(a);
    const row = el('div', { class: 'agent-row' + (a === this.selAgent ? ' sel' : ''), html: `<span class="ag" style="color:${a.color}">@</span><span class="an">${esc(a.first)} «${esc(a.nick)}» ${esc(a.last)}</span><span class="dimt">Nv${a.lvl}</span> ${hpBar(a.hp, st.hpMaxEff, 6)}${extra}` });
    row.addEventListener('click', onClick || (() => { this.selAgent = a; sfx.click(); this.render(); }));
    tip(row, () => this.agentTip(a));
    return row;
  }
  agentTip(a) {
    const st = agentStats(a);
    const t = traitOf(a);
    return `<div class="tt-title" style="color:${a.color}">${esc(agentName(a))}</div><div class="tt-sub">Nivel ${a.lvl} · ${esc(t.name)} (${esc(t.desc)})</div><div class="tt-sep">${'─'.repeat(40)}</div>
      <div class="tt-row"><span class="dimt">Salud</span><span>${a.hp}/${st.hpMaxEff}${st.hpMaxEff < st.hpMax ? ` <span class="bad">(máx ${st.hpMax})</span>` : ''}</span></div>
      <div class="tt-row"><span class="dimt">Radiación</span><span>${Math.round(a.rad)}</span></div>
      <div class="tt-row"><span class="dimt">Puntería</span><span>${st.acc}</span></div><div class="tt-row"><span class="dimt">Agilidad</span><span>${st.ev}</span></div>
      <div class="tt-row"><span class="dimt">Misiones</span><span>${a.missions || 0} (${a.extractions || 0} extracciones)</span></div><div class="tt-row"><span class="dimt">Bajas</span><span>${a.kills || 0}</span></div>`;
  }

  agentSheet(B, a) {
    const st = agentStats(a);
    const t = traitOf(a);
    const xpPrev = a.lvl > 1 ? xpForLevel(a.lvl - 1) : 0;
    B.append(
      el('div', { class: 'spread' }, el('span', { class: 'h', html: `<span style="color:${a.color}">@</span> ${esc(agentName(a))}` }), el('span', { class: 'dimt', text: `Nv ${a.lvl}` })),
      el('div', { class: 'dimt', html: `${esc(t.name)} — ${esc(t.desc)}` }),
      el('div', { html: `XP ${bar(a.xp - xpPrev, xpForLevel(a.lvl) - xpPrev, 16)} <span class="dimt">${a.xp}/${xpForLevel(a.lvl)}</span>` }),
      el('div', { html: `SAL ${hpBar(a.hp, st.hpMaxEff, 16)} ${a.hp}/${st.hpMaxEff}${st.hpMaxEff < st.hpMax ? ` <span class="bad">(rad: máx ${st.hpMax})</span>` : ''}` }),
      el('div', { html: `RAD ${bar(Math.min(100, a.rad), 100, 16, 'rad')} ${Math.round(a.rad)}` }),
      el('div', { class: 'kv', style: { marginTop: '4px' }, html: `<span>Puntería</span><span>${st.acc}</span><span>Agilidad</span><span>${st.ev}</span><span>Protección</span><span>${st.prot}</span><span>Resist. rad.</span><span>${st.rad}%</span><span>Visión</span><span>${st.vision}</span><span>Mochila</span><span>${a.bag.length}/${bagCapacity(a)}</span>` }),
    );
    const cost = C.treatCost(a);
    const acts = el('div', { class: 'row', style: { flexWrap: 'wrap', margin: '4px 0' } });
    if (cost > 0) acts.append(el('button', { class: 'btn good', onclick: (ev) => { const r = C.treat(a); if (r.ok) { sfx.upgrade(); uiSparkEl(ev.target, { colors: ['#3ddc6b', '#fff'], chars: ['+'] }); toast(`Tratamiento completado (−${r.cost} ₽).`, 'good'); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, `TRATAR (${cost} ₽)`));
    acts.append(el('button', { class: 'btn', onclick: () => this.unloadBag(a) }, 'DESCARGAR MOCHILA'));
    B.append(acts);
    B.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'EQUIPO' }));
    for (const s of EQUIP_SLOTS) {
      const it = a.equip[s.id];
      const val = el('div', { class: 'sv' });
      if (it) {
        const ws = itemStats(it);
        const r = el('div', { class: 'item', html: itemHTML(it, { extra: ws.mag ? `<span class="iq">${it.ld}/${ws.mag}</span>` : '' }) });
        tip(r, () => itemTooltip(it, null, '<div class="dimt">Arrastra al almacén o a la mochila. Doble clic: a la mochila.</div>'));
        draggable(r, { data: () => ({ src: 'equip', a, slot: s.id, it }), ghost: () => itemHTML(it) });
        r.addEventListener('dblclick', () => { this.moveItem({ src: 'equip', a, slot: s.id, it }, { dst: 'bag', a }); });
        val.append(r);
      } else val.append(el('div', { class: 'empty', text: `— ${s.cats.map((c) => CAT_INFO[c].name.toLowerCase()).join('/')} —` }));
      const row = el('div', { class: 'slot' }, el('span', { class: 'sl', text: s.label }), val);
      dropzone(row, { accepts: (d) => d && d.it && canEquip(d.it, s.id) && !(d.src === 'equip' && d.slot === s.id && d.a === a), onDrop: (d) => this.moveItem(d, { dst: 'equip', a, slot: s.id }) });
      B.append(row);
      // ranuras de mods del arma
      if (it && ITEMS[it.b].cat === 'weapon') {
        const slots = slotsOf(it);
        const line = el('div', { class: 'modline' });
        if (!slots.length) line.append(el('span', { class: 'dimt', text: ITEMS[it.b].wtype === 'melee' ? '' : 'sin ranuras de mod' }));
        for (const sl of slots) {
          const mo = it.mods && it.mods[sl];
          const chip = el('span', { class: 'modslot' + (mo ? ' full' : ''), html: `${MOD_SLOTS[sl].glyph} ${mo ? `<span style="color:${rarityColor(mo.r)}">${esc(itemName(mo))}</span>` : `<span class="dimt">${MOD_SLOTS[sl].name}</span>`}` });
          if (mo) {
            tip(chip, () => itemTooltip(mo, null, '<div class="dimt">Arrastra al almacén o a la mochila para desmontarlo.</div>'));
            draggable(chip, { data: () => ({ src: 'mod', a, wslot: s.id, slot: sl, it: mo }), ghost: () => itemHTML(mo) });
            chip.addEventListener('dblclick', () => this.moveItem({ src: 'mod', a, wslot: s.id, slot: sl, it: mo }, { dst: 'stash' }));
          } else tip(chip, () => `<div class="tt-title">${MOD_SLOTS[sl].glyph} ${MOD_SLOTS[sl].name}</div><div class="dimt">Ranura libre. Arrastra aquí un mod compatible con ${esc(WTYPE_NAMES[ITEMS[it.b].wtype])}.</div>`);
          dropzone(chip, { accepts: (d) => d && d.it && modFits(d.it, it, sl) && d.it !== mo, onDrop: (d) => this.moveItem(d, { dst: 'mod', a, wslot: s.id, slot: sl }) });
          line.append(chip);
        }
        B.append(line);
      }
    }
    B.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: `MOCHILA ${a.bag.length}/${bagCapacity(a)}` }));
    const bag = el('div', { style: { minHeight: '6em' } });
    for (const it of sortItems([...a.bag])) {
      const r = el('div', { class: 'item', html: itemHTML(it) });
      tip(r, () => itemTooltip(it, this.compareFor(a, it), '<div class="dimt">Arrastra a una ranura o al almacén. Doble clic: al almacén.</div>'));
      draggable(r, { data: () => ({ src: 'bag', a, it }), ghost: () => itemHTML(it) });
      r.addEventListener('dblclick', () => this.moveItem({ src: 'bag', a, it }, { dst: 'stash' }));
      bag.append(r);
    }
    if (!a.bag.length) bag.append(el('div', { class: 'dimt', text: 'Vacía. Arrastra aquí munición, medicinas y granadas.' }));
    dropzone(bag, { accepts: (d) => d && d.it && !(d.src === 'bag' && d.a === a), onDrop: (d) => this.moveItem(d, { dst: 'bag', a }) });
    B.append(bag);
  }

  compareFor(a, it) {
    const d = ITEMS[it.b];
    if (d.cat === 'weapon') return a.equip.w1;
    if (d.cat === 'armor') return a.equip.armor;
    if (d.cat === 'helmet') return a.equip.helmet;
    if (d.cat === 'backpack') return a.equip.pack;
    if (d.cat === 'gadget') return a.equip.g1;
    return null;
  }

  stashView(B, mode) {
    const cats = [['all', 'TODO'], ['weapon', 'ARMAS'], ['mod', 'MODS'], ['armor', 'PROT.'], ['gadget', 'GADGETS'], ['consumable', 'CONSUM.'], ['ammo', 'MUNIC.'], ['valuable', 'BOTÍN']];
    const f = el('div', { class: 'filters' });
    for (const [id, lb] of cats) {
      const b = el('span', { class: 'filter' + (this.stashFilter === id ? ' active' : ''), text: lb });
      b.addEventListener('click', () => { this.stashFilter = id; this.render(); });
      f.append(b);
    }
    B.append(f);
    const list = el('div', { style: { minHeight: '60%' } });
    const filt = (it) => {
      const c = ITEMS[it.b].cat;
      if (this.stashFilter === 'all') return true;
      if (this.stashFilter === 'armor') return c === 'armor' || c === 'helmet';
      if (this.stashFilter === 'gadget') return c === 'gadget' || c === 'backpack';
      return c === this.stashFilter;
    };
    const items = sortItems([...S.stash]).filter(filt);
    for (const it of items) {
      const extra = mode === 'sell' ? `<span class="iq o0">${C.sellPrice(it)} ₽</span>` : '';
      const r = el('div', { class: 'item', html: itemHTML(it, { extra }) });
      const a = this.selAgent;
      tip(r, () => itemTooltip(it, a ? this.compareFor(a, it) : null, mode === 'sell' ? `<div class="tt-sep">${'─'.repeat(40)}</div><div class="o0">Venta: ${C.sellPrice(it)} ₽</div><div class="dimt">Doble clic o arrastra a VENDER.</div>${ITEMS[it.b].essenceValue ? '<div class="cyan">Clic derecho: convertir en esencia.</div>' : ''}` : '<div class="dimt">Arrastra a un agente. Doble clic: equipar o meter en la mochila del agente seleccionado.</div>'));
      draggable(r, { data: () => ({ src: 'stash', it }), ghost: () => itemHTML(it) });
      if (mode === 'sell') {
        r.addEventListener('dblclick', (ev) => this.doSell(it, ev));
        r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (ITEMS[it.b].essenceValue) this.doConvert(it, ev); });
      } else {
        r.addEventListener('dblclick', () => {
          if (!a) return;
          if (ITEMS[it.b].cat === 'mod') {
            const ws = ['w1', 'w2'].find((k) => a.equip[k] && modFits(it, a.equip[k]));
            if (ws) this.moveItem({ src: 'stash', it }, { dst: 'mod', a, wslot: ws, slot: ITEMS[it.b].slot });
            else { sfx.error(); toast('Ninguna arma del agente admite este mod.', 'bad'); }
            return;
          }
          const slot = this.autoSlot(a, it); this.moveItem({ src: 'stash', it }, slot ? { dst: 'equip', a, slot } : { dst: 'bag', a }); });
      }
      list.append(r);
    }
    if (!items.length) list.append(el('div', { class: 'dimt', text: 'Nada por aquí.' }));
    dropzone(list, { accepts: (d) => d && d.it && d.src !== 'stash' && d.src !== 'shop', onDrop: (d) => this.moveItem(d, { dst: 'stash' }) });
    B.append(list);
  }

  autoSlot(a, it) {
    const c = ITEMS[it.b].cat;
    if (c === 'weapon') return !a.equip.w1 ? 'w1' : !a.equip.w2 ? 'w2' : 'w1';
    if (c === 'armor') return 'armor';
    if (c === 'helmet') return 'helmet';
    if (c === 'backpack') return 'pack';
    if (c === 'gadget') return !a.equip.g1 ? 'g1' : !a.equip.g2 ? 'g2' : 'g1';
    return null;
  }

  // mueve objetos entre almacén, mochilas y ranuras
  moveItem(from, to) {
    const it = from.it;
    // quitar del origen (provisionalmente)
    const detach = () => {
      if (from.src === 'stash') S.stash.splice(S.stash.indexOf(it), 1);
      else if (from.src === 'bag') from.a.bag.splice(from.a.bag.indexOf(it), 1);
      else if (from.src === 'equip') from.a.equip[from.slot] = null;
      else if (from.src === 'mod') removeMod(from.a.equip[from.wslot], from.slot);
    };
    const reattach = () => {
      if (from.src === 'stash') S.stash.push(it);
      else if (from.src === 'bag') from.a.bag.push(it);
      else if (from.src === 'equip') from.a.equip[from.slot] = it;
      else if (from.src === 'mod') installMod(from.a.equip[from.wslot], it);
    };
    detach();
    let ok = true, msg = '';
    if (to.dst === 'stash') {
      if (!C.addToStash(it)) { ok = false; msg = 'El almacén está lleno.'; }
    } else if (to.dst === 'bag') {
      const rest = mergeInto(to.a.bag, it, bagCapacity(to.a));
      if (rest) { ok = false; msg = 'La mochila está llena.'; }
    } else if (to.dst === 'mod') {
      const w = to.a.equip[to.wslot];
      const prev = installMod(w, it);
      if (prev) {
        if (from.src === 'mod' && modFits(prev, from.a.equip[from.wslot], from.slot)) installMod(from.a.equip[from.wslot], prev);
        else if (from.src === 'bag') from.a.bag.push(prev);
        else if (!C.addToStash(prev)) { installMod(w, prev); ok = false; msg = 'El almacén está lleno.'; }
      }
      if (ok) toast(`Montado: ${esc(itemName(it))}`, 'good');
    } else if (to.dst === 'equip') {
      const prev = to.a.equip[to.slot];
      to.a.equip[to.slot] = it;
      if (prev) {
        // el objeto anterior va al origen
        if (from.src === 'equip') from.a.equip[from.slot] = prev;
        else if (from.src === 'bag') from.a.bag.push(prev);
        else if (!C.addToStash(prev)) { to.a.equip[to.slot] = prev; ok = false; msg = 'El almacén está lleno.'; }
      }
    }
    if (!ok) { reattach(); sfx.error(); toast(msg, 'bad'); }
    else {
      sfx.pickup();
      for (const a of S.agents) { const st = agentStats(a); if (a.hp > st.hpMaxEff) a.hp = st.hpMaxEff; }
      save();
    }
    this.render();
  }

  unloadBag(a) {
    let moved = 0;
    for (const it of [...a.bag]) {
      const c = ITEMS[it.b].cat;
      if (c === 'ammo' || c === 'consumable') continue;
      a.bag.splice(a.bag.indexOf(it), 1);
      if (C.addToStash(it)) moved++; else { a.bag.push(it); break; }
    }
    sfx.pickup();
    toast(moved ? `${moved} objeto(s) al almacén (munición y consumibles se quedan).` : 'Nada que descargar.');
    save(); this.render();
  }

  // =========================================================== BARRACONES
  tab_barracones() {
    const g = el('div', { class: 'grid2' });
    const L = panel({ title: `PLANTILLA ${S.agents.length}/${C.rosterCap()}`, bodyCls: 'scroll' });
    for (const a of S.agents) {
      const st = agentStats(a);
      const t = traitOf(a);
      const card = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr auto' } });
      card.innerHTML = `<div class="mg" style="color:${a.color}">@</div><div><b>${esc(agentName(a))}</b> <span class="dimt">Nv ${a.lvl}</span><div class="eff">${esc(t.name)} · SAL ${a.hp}/${st.hpMaxEff} · RAD ${Math.round(a.rad)} · ${a.missions || 0} misiones · ${a.kills || 0} bajas</div></div>`;
      const b = el('button', { class: 'btn danger small', onclick: async () => { if (await confirmBox('DESPEDIR', `¿Despedir a <b>${esc(agentName(a))}</b>? Su equipo vuelve al almacén si cabe.`, 'DESPEDIR', 'CANCELAR', true)) { C.dismiss(a); this.render(); } } }, 'DESPEDIR');
      card.append(b);
      tip(card, () => this.agentTip(a));
      L.body.append(card);
    }
    const R = panel({ title: 'CANDIDATOS DEL DÍA', bodyCls: 'scroll' });
    const rec = C.ensureRecruits();
    R.body.append(el('div', { class: 'dimt', text: 'Voluntarios del Comité. Llegan nuevos cada día (tras cada expedición). Vienen con equipo básico.' }), el('div', { class: 'sep', text: '─'.repeat(80) }));
    for (const entry of rec.list) {
      const a = entry.a;
      const st = agentStats(a);
      const t = traitOf(a);
      const card = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr auto' } });
      card.innerHTML = `<div class="mg" style="color:${a.color}">@</div><div><b>${esc(agentName(a))}</b> <span class="dimt">Nv ${a.lvl}</span><div class="eff">${esc(t.name)}: ${esc(t.desc)}</div><div class="eff">Salud ${st.hpMax} · Puntería ${st.acc} · Agilidad ${st.ev}</div></div>`;
      const can = S.rub >= entry.cost && S.agents.length < C.rosterCap();
      const b = el('button', { class: 'btn ' + (can ? 'primary' : 'disabled'), onclick: (ev) => {
        const r = C.hire(entry);
        if (r.ok) { sfx.buy(); uiSparkEl(ev.target); toast(`${esc(a.first)} se une al equipo.`, 'good'); this.selAgent = a; this.render(); this.pulseRes('rub'); }
        else { sfx.error(); toast(r.msg, 'bad'); }
      } }, `RECLUTAR ${entry.cost} ₽`);
      card.append(b);
      R.body.append(card);
    }
    if (!rec.list.length) R.body.append(el('div', { class: 'dimt', text: 'No quedan candidatos hoy.' }));
    g.append(L, R);
    return g;
  }

  // =========================================================== LABORATORIO
  tab_laboratorio() {
    const g = el('div', { class: 'grid2', style: { gridTemplateColumns: '1.4fr 1fr' } });
    const L = panel({ title: 'MÓDULOS DE LA BASE', bodyCls: 'scroll' });
    for (const m of MODULES) {
      const lvl = S.modules[m.id];
      const max = lvl >= MODULE_MAX;
      const c = max ? null : moduleCost(m.id, lvl);
      const can = c && S.ess >= c.ess && S.rub >= c.rub;
      const row = el('div', { class: 'module' });
      row.innerHTML = `<div class="mg">${m.glyph}</div><div><div class="spread"><b>${m.name}</b><span class="lvl">${levelPips(lvl, MODULE_MAX)}</span></div><div class="eff">${esc(m.desc)}</div><div class="eff">Ahora: <span class="o1">${esc(m.eff(lvl))}</span></div>${max ? '' : `<div class="eff">Siguiente: <span class="good">${esc(m.eff(lvl + 1))}</span></div>`}</div>`;
      const btn = el('button', { class: 'btn ' + (max ? 'disabled' : can ? 'primary' : 'disabled'), onclick: (ev) => {
        if (max) return;
        const r = C.upgradeModule(m.id);
        if (r.ok) {
          sfx.upgrade();
          uiSparkEl(ev.target, { n: 40, chars: ['✦', '*', '+', '·', m.glyph], colors: ['#5ff7ff', '#ff8a1f', '#fff'] });
          uiFly($('#res-ess'), ev.target, 10);
          toast(`${m.name} → nivel ${S.modules[m.id]}`, 'good');
          setTimeout(() => this.render(), 300);
        } else { sfx.error(); toast(r.msg, 'bad'); }
      } }, max ? 'MÁXIMO' : `MEJORAR ${c.ess}✦ ${c.rub}₽`);
      row.append(btn);
      L.body.append(row);
    }
    const R = panel({ title: 'LABORATORIO DE ESENCIA', bodyCls: 'scroll' });
    R.body.append(el('pre', { class: 'ascii-art', text: String.raw`
        ┌───────────────┐
        │  ╔═════════╗  │       ✦  ·    ✦
        │  ║ ░▒▓✦▓▒░ ║  │    ·     ✦
        │  ╚════╤════╝  │  ✦    ·
        │   ____│____   │
        │  |  ≈≈≈≈≈  |  │
        └──┴─────────┴──┘
          ESENCIA CHEBYLITA` }),
    el('div', { class: 'msg-topolev', text: '«La esencia es energía de radiación ordenada por la vida. Con ella podemos fortalecer cada módulo de la base. Cada mejora cuesta esencia y rublos, y abre nuevas posibilidades en la intendencia y en el campo.» — Dr. A. Topolev' }),
    el('div', { class: 'sep', text: '─'.repeat(80) }),
    el('div', { class: 'kv', html: `<span>Esencia</span><span class="cyan">${fmt(S.ess)} ✦</span><span>Rublos</span><span>${fmt(S.rub)} ₽</span><span>Esencia total</span><span>${fmt(S.stats.essTotal)} ✦</span>` }));
    // ---- forja de esencia ----
    const maxR = Math.min(5, S.modules.laboratorio + 1);
    R.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'FORJA DE ESENCIA' }),
      el('div', { class: 'dimt', html: `Infunde esencia en una pieza de equipo para subir su rareza y darle una propiedad nueva. Rareza máxima con tu laboratorio: <span style="color:${RARITIES[maxR].color}">${RARITIES[maxR].name}</span>.` }));
    const forgeIt = this.forgeUid && S.stash.find((x) => x.uid === this.forgeUid);
    const slot = el('div', { class: 'panel', style: { padding: 'var(--lh) 2ch', margin: '4px 0', minHeight: '5em' } });
    framify(slot, 'dash');
    if (forgeIt) {
      const c = forgeCost(forgeIt);
      const can = forgeIt.r < maxR && S.ess >= c.ess && S.rub >= c.rub;
      const chip = el('div', { class: 'item', html: itemHTML(forgeIt) });
      tip(chip, () => itemTooltip(forgeIt));
      slot.append(chip,
        el('div', { html: forgeIt.r >= maxR ? '<span class="bad">Rareza máxima para tu laboratorio.</span>' : `<span style="color:${RARITIES[forgeIt.r].color}">${RARITIES[forgeIt.r].name}</span> → <span style="color:${RARITIES[forgeIt.r + 1].color}">${RARITIES[forgeIt.r + 1].name}</span> · +1 propiedad · coste <span class="cyan">${c.ess} ✦</span> ${c.rub} ₽` }),
        el('div', { class: 'row', style: { marginTop: '4px' } },
          el('button', { class: 'btn ' + (can ? 'primary' : 'disabled'), onclick: (ev) => {
            if (!can) { sfx.error(); toast(forgeIt.r >= maxR ? 'Mejora el Laboratorio de esencia.' : 'Recursos insuficientes.', 'bad'); return; }
            S.ess -= c.ess; S.rub -= c.rub;
            infuse(forgeIt);
            sfx.upgrade();
            uiSparkEl(ev.target, { n: 50, chars: ['✦', '*', '+', '·'], colors: ['#5ff7ff', RARITIES[forgeIt.r].color, '#fff'] });
            toast(`¡${esc(itemName(forgeIt))} ahora es <span style="color:${RARITIES[forgeIt.r].color}">${RARITIES[forgeIt.r].name}</span>!`, 'good', 3500);
            save(); setTimeout(() => this.render(), 350);
          } }, 'INFUNDIR'),
          el('button', { class: 'btn small', onclick: () => { this.forgeUid = null; this.render(); } }, 'QUITAR')));
    } else slot.append(el('div', { class: 'dimt', style: { textAlign: 'center' }, text: 'Arrastra aquí un arma, protección, gadget o mochila del almacén' }));
    dropzone(slot, { accepts: (d) => d && d.src === 'stash' && FORGE_CATS.includes(ITEMS[d.it.b].cat), onDrop: (d) => { this.forgeUid = d.it.uid; sfx.pickup(); this.render(); } });
    R.body.append(slot);
    const forgeable = sortItems(S.stash.filter((it) => FORGE_CATS.includes(ITEMS[it.b].cat)));
    for (const it of forgeable) {
      const r = el('div', { class: 'item', html: itemHTML(it) });
      tip(r, () => itemTooltip(it, null, '<div class="dimt">Arrastra a la forja (o doble clic).</div>'));
      draggable(r, { data: () => ({ src: 'stash', it }), ghost: () => itemHTML(it) });
      r.addEventListener('dblclick', () => { this.forgeUid = it.uid; this.render(); });
      R.body.append(r);
    }
    if (!forgeable.length) R.body.append(el('div', { class: 'dimt', text: 'No hay equipo en el almacén.' }));
    const crystals = S.stash.filter((it) => ITEMS[it.b].essenceValue);
    if (crystals.length) {
      R.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'CRISTALES DE ESENCIA' }));
      for (const it of crystals) {
        const r = el('div', { class: 'row' }, el('div', { class: 'item', style: { flex: 1 }, html: itemHTML(it) }), el('button', { class: 'btn small', onclick: (ev) => this.doConvert(it, ev) }, 'CONVERTIR'));
        R.body.append(r);
      }
    }
    g.append(L, R);
    return g;
  }

  doConvert(it, ev) {
    const n = C.convertCrystal(it, S.stash);
    if (n) { sfx.essence(); uiFly(ev.target, $('#res-ess'), 10); toast(`+${n} ✦ de esencia`, 'good'); setTimeout(() => { this.render(); this.pulseRes('ess'); }, 500); }
  }
  doSell(it, ev) {
    const p = C.sell(it, S.stash);
    if (p) { sfx.buy(); uiFly(ev.target || ev, $('#res-rub'), 6, '₽', '#ffd23f'); setTimeout(() => { this.render(); this.pulseRes('rub'); }, 400); }
  }

  // =========================================================== INTENDENCIA
  tab_intendencia() {
    const g = el('div', { class: 'grid2' });
    const L = panel({ title: `EXISTENCIAS · DÍA ${S.day}`, bodyCls: 'scroll' });
    const shop = C.ensureShop();
    L.body.append(el('div', { class: 'dimt', text: 'El catálogo cambia cada día. Mejora los módulos para acceder a mejor material. Clic o arrastra al almacén para comprar.' }), el('div', { class: 'sep', text: '─'.repeat(80) }));
    const addRow = (it, supply) => {
      const price = C.buyPrice(it) * (it.q || 1);
      const can = S.rub >= price;
      const r = el('div', { class: 'shop-row' });
      const chip = el('div', { class: 'item', html: itemHTML(it) });
      tip(chip, () => itemTooltip(it, this.selAgent ? this.compareFor(this.selAgent, it) : null, `<div class="tt-sep">${'─'.repeat(40)}</div><div class="o0">Precio: ${price} ₽</div>`));
      draggable(chip, { data: () => ({ src: 'shop', it, supply }), ghost: () => itemHTML(it) });
      r.append(chip, el('span', { class: 'price', text: `${price} ₽` }), el('button', { class: 'btn small ' + (can ? '' : 'disabled'), onclick: (ev) => this.doBuy(it, supply, ev) }, 'COMPRAR'));
      return r;
    };
    L.body.append(el('div', { class: 'h', text: 'SUMINISTROS PERMANENTES' }));
    for (const it of C.shopSupplies()) L.body.append(addRow(it, true));
    L.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'MATERIAL DEL DÍA' }));
    for (const it of shop.stock) L.body.append(addRow(it, false));
    if (!shop.stock.length) L.body.append(el('div', { class: 'dimt', text: 'Agotado. Vuelve mañana.' }));
    const R = panel({ title: `ALMACÉN ${S.stash.length}/${C.stashCap()} · VENTA`, bodyCls: 'scroll' });
    const sellZone = el('div', { class: 'panel', style: { padding: 'var(--lh) 2ch', margin: '0 0 6px 0', textAlign: 'center' } }, el('div', { class: 'h', text: '₽ VENDER ₽' }), el('div', { class: 'dimt', text: 'Arrastra aquí objetos del almacén' }));
    framify(sellZone, 'dash');
    dropzone(sellZone, { accepts: (d) => d && d.src === 'stash', onDrop: (d, ev) => this.doSell(d.it, { target: sellZone }) });
    const val = S.stash.filter((it) => ITEMS[it.b].cat === 'valuable' && !ITEMS[it.b].essenceValue);
    const total = val.reduce((s, it) => s + C.sellPrice(it), 0);
    R.body.append(sellZone);
    if (val.length) R.body.append(el('button', { class: 'btn primary', onclick: (ev) => { for (const it of val) C.sell(it, S.stash); sfx.buy(); uiFly(ev.target, $('#res-rub'), 12, '₽', '#ffd23f'); toast(`Botín vendido: +${total} ₽`, 'good'); setTimeout(() => { this.render(); this.pulseRes('rub'); }, 400); } }, `VENDER TODO EL BOTÍN (${total} ₽)`));
    this.stashView(R.body, 'sell');
    dropzone(R.body, { accepts: (d) => d && d.src === 'shop', onDrop: (d, ev) => this.doBuy(d.it, d.supply, ev) });
    g.append(L, R);
    return g;
  }
  doBuy(it, supply, ev) {
    const r = C.buy(it, supply);
    if (r.ok) {
      sfx.buy();
      if (ev && ev.target) uiSparkEl(ev.target, { chars: ['₽', '*', '·'], colors: ['#ffd23f', '#ff8a1f'] });
      toast(`Comprado: ${esc(itemName(it))} (−${r.price} ₽)`, 'good');
      this.render(); this.pulseRes('rub');
    } else { sfx.error(); toast(r.msg, 'bad'); }
  }

  // =========================================================== EXPEDICIÓN
  tab_expedicion() {
    const g = el('div', { class: 'grid3' });
    const L = panel({ title: 'DESTINOS', bodyCls: 'scroll' });
    MAPS.forEach((m, i) => {
      const locked = i >= S.unlocked;
      const avg = (m.lvl[0] + m.lvl[1]) / 2;
      const card = el('div', { class: `mapcard ${i === this.selMap ? 'sel' : ''} ${locked ? 'locked' : ''}` });
      card.innerHTML = `<div class="o2">${locked ? '▒' : i + 1}</div><div><b>${locked ? '???' : m.name}</b><div class="dimt">${locked ? 'Extrae con éxito de la zona anterior' : m.short + ' · ' + (S.cleared[m.id] || 0) + ' extracciones'}</div></div><div class="dif" style="color:${diffColor(avg)}">Nv ${m.lvl[0]}–${m.lvl[1]}<br>${skulls(avg)}</div>`;
      if (!locked) card.addEventListener('click', () => { this.selMap = i; sfx.click(); this.render(); });
      L.body.append(card);
    });
    const m = MAPS[this.selMap];
    const M = panel({ title: m.name.toUpperCase(), bodyCls: 'scroll' });
    const avg = (m.lvl[0] + m.lvl[1]) / 2;
    const rw = rarityWeights(avg);
    const tot = rw.reduce((a, b) => a + b, 0);
    M.body.append(
      el('pre', { class: 'ascii-art', text: mapSchematic(this.selMap) }),
      el('div', { class: 'msg-topolev', text: m.desc }),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'kv', html: `<span>Nivel medio</span><span style="color:${diffColor(avg)}"><b>${avg}</b> (rango ${m.lvl[0]}–${m.lvl[1]}, nidos ±1)</span><span>Tamaño</span><span>${m.w}×${m.h} · ${m.sx * m.sy} sectores</span><span>Radiación amb.</span><span>${m.ambientRad ? m.ambientRad.toFixed(2) + '/turno base' : 'baja'}</span><span>Nidos</span><span>${m.nests[0]}–${m.nests[1]}</span><span>Vetas · Alijos</span><span>${m.veins.join('–')} · ${m.caches.join('–')}</span>` }),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'h', text: 'CHEBYLITAS DETECTADOS' }),
    );
    for (const id of m.enemies) {
      const d = ENEMIES[id];
      const known = S.bestiary[id];
      const r = el('div', { class: 'row', html: `<span style="color:${enemyColor(d.hue, Math.min(10, Math.max(d.minL, m.lvl[1])))};width:2ch;display:inline-block;font-weight:700">${d.glyph}</span><span>${known ? d.name : '???'}${d.boss ? ' <span class="bad">☠ jefe</span>' : ''}</span>` });
      tip(r, () => known ? `<div class="tt-title">${d.name}</div><div class="tt-lore">${esc(d.lore)}</div>` : '<div class="dimt">Especie no catalogada todavía.</div>');
      M.body.append(r);
    }
    M.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'BOTÍN ESPERADO' }));
    M.body.append(el('div', { html: RARITIES.map((r, i) => `<span style="color:${r.color}">${r.name} ${((rw[i] / tot) * 100).toFixed(rw[i] / tot < 0.01 ? 2 : 0)}%</span>`).join(' · ') }));
    // escuadrón
    const R = panel({ title: `ESCUADRÓN ${this.squad.size}/${C.squadCap()}`, bodyCls: 'scroll' });
    R.body.append(el('div', { class: 'dimt', text: 'Selecciona los agentes que bajarán. Si mueren, se pierde todo lo que lleven.' }), el('div', { class: 'sep', text: '─'.repeat(60) }));
    for (const a of S.agents) {
      const on = this.squad.has(a.id);
      const warn = this.agentWarnings(a);
      const row = this.agentRow(a, ` <span class="chk">${on ? '[■]' : '[ ]'}</span>`, () => {
        if (on) this.squad.delete(a.id);
        else if (this.squad.size < C.squadCap()) this.squad.add(a.id);
        else { toast(`Máximo ${C.squadCap()} agentes (mejora los Barracones).`, 'bad'); sfx.error(); return; }
        sfx.click(); this.render();
      });
      row.classList.toggle('sel', on);
      R.body.append(row);
      if (warn.length) R.body.append(el('div', { class: 'warn', style: { paddingLeft: '3ch', fontSize: '12px' }, text: '⚠ ' + warn.join(' · ') }));
    }
    const can = this.squad.size > 0;
    R.body.append(el('div', { class: 'sep', text: '─'.repeat(60) }),
      el('button', { class: 'btn primary ' + (can ? '' : 'disabled'), style: { fontSize: '15px' }, onclick: () => this.launch() }, '☢ LANZAR EXPEDICIÓN'),
      el('div', { class: 'dimt', style: { marginTop: '6px' }, text: S.modules.polvorin ? `El polvorín entrega ${S.modules.polvorin} cargador(es) extra por arma.` : 'Consejo: lleva munición, vendas y antirrad en la mochila.' }),
    );
    g.append(L, M, R);
    return g;
  }

  agentWarnings(a) {
    const w = [];
    const st = agentStats(a);
    if (!a.equip.w1 && !a.equip.w2) w.push('sin armas');
    for (const s of ['w1', 'w2']) {
      const it = a.equip[s];
      if (!it || !ITEMS[it.b].ammo) continue;
      const ammo = a.bag.reduce((n, x) => n + (x.b === ITEMS[it.b].ammo ? x.q : 0), 0);
      if (!ammo && !S.modules.polvorin) w.push(`sin munición para ${ITEMS[it.b].name.split(' ').slice(-1)[0]}`);
    }
    if (a.hp < st.hpMaxEff * 0.5) w.push('herido');
    if (a.rad >= 50) w.push('irradiado');
    return w;
  }

  async launch() {
    if (!this.squad.size) { toast('Selecciona al menos un agente.', 'bad'); sfx.error(); return; }
    const agents = S.agents.filter((a) => this.squad.has(a.id));
    const warns = agents.flatMap((a) => this.agentWarnings(a).map((w) => `${a.nick}: ${w}`));
    if (warns.length && !(await confirmBox('¿SEGURO?', `<div class="warn">${warns.map(esc).join('<br>')}</div><div class="dimt" style="margin-top:1em">¿Lanzar la expedición igualmente?</div>`, 'LANZAR', 'REVISAR'))) return;
    sfx.click();
    this.hooks.onLaunch(this.selMap, agents);
  }

  // =========================================================== ARCHIVO
  tab_archivo() {
    const g = el('div', { class: 'grid3' });
    const L = panel({ title: 'BESTIARIO CHEBYLITA', bodyCls: 'scroll' });
    for (const [id, d] of Object.entries(ENEMIES)) {
      const b = S.bestiary[id];
      const r = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr' } });
      if (b) r.innerHTML = `<div class="mg" style="color:${enemyColor(d.hue, 7)}">${d.glyph}</div><div><b>${d.name}</b>${d.boss ? ' <span class="bad">☠</span>' : ''} <span class="dimt">· ${d.origin} · ${b.kills} abatidos</span><div class="eff">${esc(d.lore)}</div><div class="eff">${d.abil.map((a) => ABIL_TEXT[a]).join(' · ') || 'Sin habilidades especiales'} · Nv ${d.minL}–${d.maxL}</div></div>`;
      else r.innerHTML = `<div class="mg o4">?</div><div><b class="o4">??????</b><div class="eff">Especie no catalogada.</div></div>`;
      L.body.append(r);
    }
    const M = panel({ title: 'MEMORIAL DE LOS CAÍDOS', bodyCls: 'scroll' });
    if (!S.fallen.length) M.body.append(el('div', { class: 'dimt', text: 'Nadie ha caído... todavía.' }));
    for (const f of S.fallen) M.body.append(el('div', { html: `✝ <b>${esc(f.name)}</b> <span class="dimt">Nv ${f.lvl}</span><div class="dimt" style="padding-left:2ch">Día ${f.day} · ${esc(f.map)} · ${esc(f.cause)} · ${f.kills} bajas</div>` }));
    const R = panel({ title: 'ESTADÍSTICAS', bodyCls: 'scroll' });
    const st = S.stats;
    R.body.append(el('div', { class: 'kv', html: `<span>Días</span><span>${S.day}</span><span>Expediciones</span><span>${st.expeditions}</span><span>Extracciones</span><span>${st.extractions}</span><span>Chebylitas abatidos</span><span>${st.kills}</span><span>Agentes caídos</span><span>${st.deaths}</span><span>Esencia total</span><span>${fmt(st.essTotal)} ✦</span><span>Rublos ganados</span><span>${fmt(st.rubTotal)} ₽</span><span>Turnos bajo tierra</span><span>${fmt(st.turns)}</span><span>Mejor objeto</span><span>${st.bestItem ? `<span style="color:${rarityColor(st.bestItem.r)}">${esc(st.bestItem.name)}</span>` : '—'}</span>` }),
      el('div', { class: 'sep', text: '─'.repeat(60) }),
      el('button', { class: 'btn primary', onclick: () => this.hooks.onHelp() }, 'INSTRUCCIONES'),
    );
    g.append(L, M, R);
    return g;
  }

  // =========================================================== MENÚ
  openMenu() {
    if (modalOpen()) { closeTopModal(); return; }
    const body = el('div', { class: 'title-menu', style: { marginTop: 0 } });
    let close;
    const btn = (label, fn, cls = '') => el('button', { class: 'btn ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
    body.append(
      btn('CONTINUAR', () => close()),
      btn(`SONIDO: ${settings.sound ? 'SÍ' : 'NO'}`, () => { settings.sound = !settings.sound; saveSettings(); close(); this.openMenu(); }),
      btn(`EFECTO CRT: ${settings.crt ? 'SÍ' : 'NO'}`, () => { settings.crt = !settings.crt; document.body.classList.toggle('no-crt', !settings.crt); saveSettings(); close(); this.openMenu(); }),
      btn('GUARDAR PARTIDA', () => { if (save()) toast(`Partida guardada (ranura ${slot}).`, 'good'); else toast('¡No se pudo guardar! El almacenamiento del navegador está lleno o bloqueado. Exporta la partida.', 'bad', 6000); close(); }),
      btn('EXPORTAR COPIA', () => {
        save();
        const txt = exportSlot(slot);
        if (!txt) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
        a.download = `topolev-ranura${slot}-dia${S.day}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        close();
      }),
      btn('PANTALLA COMPLETA', () => { toggleFullscreen(); close(); }),
      btn(`TEXTO: ${UI_SCALES[settings.uiScale || 0].name}`, () => { cycleUiScale(); close(); this.render(); this.openMenu(); }),
      btn('SALIR AL TÍTULO', () => { save(); close(); this.close(); this.hooks.onQuit(); }, 'danger'),
    );
    close = modal({ title: 'MENÚ', body, width: '46ch' });
  }
}

function diffColor(avg) {
  const t = Math.min(1, (avg - 1) / 9);
  const h = 40 - t * 40;
  return `hsl(${h},${70 + t * 30}%,${55 + t * 5}%)`;
}
function skulls(avg) { const n = Math.ceil(avg / 2); return '☢'.repeat(n) + '<span class="o5">' + '☢'.repeat(5 - n) + '</span>'; }

function mapSchematic(i) {
  const arts = [
    String.raw`  ┌──┬──┬──┐ ┌────┐
  │░░│  │▒▒├─┤ ○○ │   OFICINAS
  ├──┼──┤  │ │    │   ARCHIVOS
  │  │##│  ├─┤ ▓▓ │   VESTUARIOS
  └──┴──┴──┘ └────┘`,
    String.raw`  ╔═══════════════════╗
  ║ Θ Θ Θ   Θ Θ Θ   ▲ ║   TURBINAS
  ║ ═══════════════   ║   7 y 8
  ║ Θ Θ Θ   Θ Θ Θ   ▼ ║
  ╚═══════════════════╝`,
    String.raw`  ~~~~╗   ╔~~~~~~~~╗
  ≈≈≈≈║ ~ ║≈≈≈≈≈≈≈≈║   CANALES
  ~~~~╚═══╝~~~~ ≈≈≈≈║   ESCLUSAS
  ≈≈≈≈≈≈≈≈≈≈≈≈≈≈~~~~║
  ═══════════════════╝`,
    String.raw`   ▓▓▓▓▒▒░  ░▒▒▓▓▓▓
  ▓▓▒░   ·  ·   ░▒▓▓   GRIETAS
  ▓▒░  ·  ✦   ·   ░▒▓   NIDOS
  ▓▓▒░  ·    ·  ░▒▓▓
   ▓▓▓▓▒▒░░░░▒▒▓▓▓▓`,
    String.raw`      ▄▄████████▄▄
    ▄██▀▀ ☢  ☢ ▀▀██▄     REACTOR 4
   ██▀  ░▒▓██▓▒░  ▀██    CORIUM
   ██   ▒▓█▀▀█▓▒   ██
   ▀█▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▀`,
  ];
  return arts[i] || '';
}
