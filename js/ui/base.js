// La base: cuartel general cerca de la central
import { el, $, panel, framify, esc, UI_SCALES, cycleUiScale, toast, tip, draggable, dropzone, hpBar, bar, levelPips, confirmBox, modal, modalOpen, closeTopModal, contextMenu } from '../util/dom.js';
import { S, save, settings, saveSettings, slot, exportSlot } from '../core/state.js';
import { ITEMS, CAT_INFO } from '../data/items.js';
import { MAPS, MODULES, MODULE_MAX, moduleCost, TRAITS, zoneOpen, openCount, STRATA, EVENT_ZONES, eventDef, mapIndex } from '../data/world.js';
import { ENEMIES, enemyColor, ABIL_TEXT } from '../data/enemies.js';
import { RARITIES, rarityWeights } from '../data/rarity.js';
import { itemHTML, itemTooltip, itemName, itemStats, sortItems, mergeInto, rarityColor, itemValue, forgeCost, infuse, FORGE_CATS, slotsOf, modFits, installMod, removeMod, WTYPE_NAMES, caseRefusal, caseUsed, splitStack, stackOnto } from '../core/items.js';
import { MOD_SLOTS } from '../data/mods.js';
import { talentFlag } from '../core/agents.js';
import { agentStats, agentName, EQUIP_SLOTS, canEquip, bagCapacity, traitOf, xpForLevel, pendingAscent, pickTalent, talentDef, effAttrs, specOf, needsSpec, chooseSpec, currentOffer, rerollOffer, MAX_LEVEL, synOk } from '../core/agents.js';
import { ATTRS, ATTR_MAX, TALENTS, TALENT_EVERY } from '../data/talents.js';
import { SPECS, SPEC_TALENTS, SPEC_LEVEL, rerollCost } from '../data/specs.js';
import { bgName, BACKGROUNDS } from '../data/backgrounds.js';
import { ACQUIRED, MEDALS, RETIRE_LEVEL, MAX_INSTRUCTORS, INSTRUCTOR_XP, ROOKIE_LEVEL } from '../data/honors.js';
import * as C from '../core/campaign.js';
import { sfx, music } from '../audio.js';
import { uiBurst, uiSparkEl, uiFly, uiText } from './fx.js';
import { fmt } from '../util/rng.js';
import { toggleFullscreen } from './expui.js';
import { showDialog } from './dialog.js';
import { playScene } from './scene.js';
import * as NARR from '../core/narrator.js';
import * as ST from '../core/story.js';
import * as B21 from '../core/basecore.js';
import { installBase21 } from './base21.js';
import { ACTS, STAFF } from '../data/story.js';
import { NOTES, COLLECTIONS } from '../data/lore.js';
import { regionMap } from './region.js';
import { MODIFIERS } from '../data/modifiers.js';
import { FACTIONS, REP_LEVELS, repLevel, repOf, squadAttitude, ATTITUDE_TEXT, ATTITUDE_CLASS, COMBAT_FACTIONS } from '../data/factions.js';
import { SQUADS, HUMANS } from '../data/humans.js';
import { floorsFor } from '../exp/expedition.js';
import * as ECO from '../core/ecosys.js';
import { a11yButtons } from './a11y.js';
import { t } from '../i18n/index.js';
import { achievementsModal } from './achievements.js';
import { settingsModal } from './settings.js';
import { asciiSlider } from './widgets.js';
import { codexModal } from './codex.js';
import { modeTag, challengeScore } from '../core/modes.js';
import { controlsModal, keyName } from './keys.js';

const TABS = [
  { id: 'cuartel', label: 'CUARTEL' },
  { id: 'equipo', label: 'EQUIPO' },
  { id: 'barracones', label: 'BARRACONES' },
  { id: 'laboratorio', label: 'LABORATORIO' },
  { id: 'intendencia', label: 'INTENDENCIA' },
  { id: 'expedicion', label: 'EXPEDICIÓN' },
  { id: 'radio', label: 'RADIO' },
  { id: 'garaje', label: 'GARAJE' },
  { id: 'investigacion', label: 'INVESTIGACIÓN' },
  { id: 'archivo', label: 'ARCHIVO' },
];

// barra de reputación −100…+100 con el cero en el centro
function repBar(v, w = 20) {
  const half = w / 2, n = Math.round((Math.abs(v) / 100) * half);
  const left = v < 0 ? ' '.repeat(half - n) + `<span class="bad">${'█'.repeat(n)}</span>` : '·'.repeat(half);
  const right = v > 0 ? `<span class="good">${'█'.repeat(n)}</span>` + ' '.repeat(half - n) : '·'.repeat(half);
  return `<span class="dimt">[</span>${v < 0 ? left : `<span class="dimt">${left}</span>`}<span class="o2">|</span>${v > 0 ? right : `<span class="dimt">${right}</span>`}<span class="dimt">]</span>`;
}

const DOG_ART = String.raw`
        __
   (\,--'  \___      LAIKA-M
    \_ o    o  \     Академия наук СССР
      \__,-.__ /|
       |_|  |_|/ |
      /_/  /_/  /`;
const DRONE_ART = String.raw`
     _______    _______
    (___o___)--(___o___)
         \  [▣]  /
          \_____/
         //  ||  \\`;

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
      const ti = n === 0 ? 10 : n;
      if (ti >= 1 && ti <= TABS.length) { this.show(TABS[ti - 1].id); sfx.click(); }
      if (ev.key === '?') this.hooks.onHelp();
      if (ev.key === 'Escape') this.openMenu();
    });
  }

  open(tab) {
    this.active = true;
    if (tab) this.tab = tab;
    if (!this.selAgent || !S.agents.includes(this.selAgent)) this.selAgent = S.agents[0] || null;
    if (!zoneOpen(S, this.selMap)) this.selMap = 0;
    for (const id of [...this.squad]) if (!S.agents.find((a) => a.id === id)) this.squad.delete(id);
    C.ensureShop(); C.ensureRecruits();
    this.render();
    setTimeout(() => this.runDialogs(), 400);
  }

  // diálogos pendientes del motor de eventos (visitas, cartas…)
  runDialogs() {
    if (!this.active || this.dlgOpen) return;
    // escenas ASCII pendientes (actos, finales)
    // __noScenes: pruebas automáticas (se descartan sin volver a dibujar la base)
    while (S.pendingScenes && S.pendingScenes.length && (window.__noScenes || !ST.sceneDef(S.pendingScenes[0]))) S.pendingScenes.shift();
    const scId = S.pendingScenes && S.pendingScenes[0];
    if (scId) {
      this.dlgOpen = true;
      playScene(ST.sceneDef(scId), () => { S.pendingScenes.shift(); save(); this.dlgOpen = false; this.render(); setTimeout(() => this.runDialogs(), 250); });
      return;
    }
    // fase 21.6: se ha decidido defender el puesto
    if (S.attack && S.attack.go) {
      S.attack.go = 0;
      const agents = B21.defenders(C.squadCap());
      if (agents.length) { toast('¡A las armas! Defended el Puesto.', 'bad'); this.hooks.onLaunch(0, agents, 'defensa'); return; }
    }
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
      el('span', { class: 'logo', html: t('base.logo') }),
      (() => { const M = NARR.narrMood(); const n = el('span', { class: 'narr-tag', html: `<span style="color:${M.color}">${M.glyph}</span> <span class="dimt">${esc(M.text)}</span>` }); tip(n, () => `<div class="tt-title" style="color:${M.color}">${M.glyph} NARRADOR: ${esc(M.name.toUpperCase())}</div><div>${esc(M.desc)}</div><div class="tt-sep">${'─'.repeat(30)}</div><div class="tt-row"><span class="dimt">Adaptación</span><span>${M.adapt}/100</span></div><div class="dimt">Sube con vuestros éxitos (más presión) y baja con las bajas y los fracasos (más alivios). Se cambia en MENÚ → NARRADOR.</div>`); return n; })(),
      modeTag() ? el('span', { class: 'warn mode-tag', title: 'Modo de juego', text: modeTag() + (S.challenge ? (S.challenge.done ? ` · ${S.challenge.done.score} pts` : ` · día ${S.day}/${S.challenge.days} · ${challengeScore()} pts`) : '') }) : '',
      el('span', { class: 'dimt', html: `PUESTO PRIPYAT-7 · DÍA <b>${S.day}</b> · ${B21.dateStr()} · <span title="${esc(B21.seasonInfo().desc)}">${B21.seasonInfo().glyph} ${B21.seasonInfo().name}</span> · cuota: <span class="${S.ess >= S.quota.ess ? 'good' : 'warn'}" title="Cuota del Comité: esencia a entregar">${S.quota.ess} ✦ en ${Math.max(0, S.quota.due - S.day)} d</span> · <span title="Alerta del reactor: ${esc(ECO.alertInfo().desc)}" style="color:${ECO.alertInfo().color}">☢ ${ECO.alertInfo().name}</span>` }),
      el('div', { class: 'res' },
        this.resEl('ess', '✦', t('base.ess'), S.ess, 'cyan'),
        this.resEl('rub', '₽', t('base.rub'), S.rub, 'o0'),
        this.resEl('ag', '@', t('base.ag'), `${S.agents.length}/${C.rosterCap()}`, ''),
        el('button', { class: 'btn small', onclick: () => this.hooks.onHelp() }, t('base.help')),
        el('button', { class: 'btn small', onclick: () => this.openMenu() }, t('base.menu')),
      ),
    );
    const tabs = el('div', { class: 'tabs' });
    TABS.forEach((tb0, i) => {
      const tb = el('div', { class: 'tab' + (tb0.id === this.tab ? ' active' : ''), html: `<span class="k">${i + 1}</span>${t('tab.' + tb0.id)}` });
      tb.addEventListener('click', () => { sfx.click(); this.show(tb0.id); });
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
    tip(e, () => `<div class="tt-title">${label}</div><div class="dimt">${t('base.' + id + 'Tip')}</div>`);
    return e;
  }
  pulseRes(id) { const v = $('#res-' + id + ' .v'); if (v) { v.classList.remove('pulse'); void v.offsetWidth; v.classList.add('pulse'); } }

  // =========================================================== CUARTEL
  tab_cuartel() {
    const g = el('div', { class: 'grid3' });
    const a = panel({ title: 'PUESTO PRIPYAT-7', bodyCls: 'scroll' });
    const stash = S.stash.length;
    a.body.append(
      this.planView(),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'kv', html: `
        <span>Día</span><span>${S.day}</span>
        <span>Agentes</span><span>${S.agents.length} / ${C.rosterCap()} · escuadrón de ${C.squadCap()}</span>
        <span>Almacén</span><span>${stash} / ${C.stashCap()}</span>
        <span>Esencia</span><span class="cyan">${fmt(S.ess)} ✦</span>
        <span>Rublos</span><span>${fmt(S.rub)} ₽</span>
        <span>Zonas</span><span>${openCount(S)} / ${MAPS.length} accesibles</span>
        <span>Expediciones</span><span>${S.stats.expeditions} (${S.stats.extractions} con éxito)</span>
        <span>Caídos</span><span class="bad">${S.fallen.length}</span>` }),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'kv', html: `<span>Capítulo</span><span class="o1">${esc(ACTS[S.act] ? ACTS[S.act].name : '—')}${S.ending ? ' · <span class="cyan">epílogo</span>' : ''}</span><span>Confianza de Topolev</span><span>${bar(S.trust ?? 50, 100, 14)} ${S.trust ?? 50} · ${ST.trustLevel()}</span>` }),
      this.staffBox('zhdanov'),
      el('div', { class: 'sep', text: '─'.repeat(80) }),
      el('div', { class: 'row', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn primary', onclick: () => this.show('expedicion') }, 'PREPARAR EXPEDICIÓN'),
        el('button', { class: 'btn', onclick: () => this.show('equipo') }, 'EQUIPAR AGENTES'),
      ),
    );
    const m = panel({ title: 'MENSAJES · DR. A. TOPOLEV', bodyCls: 'scroll' });
    if ((S.comedor || []).length) {
      m.body.append(el('div', { class: 'h', text: 'EN EL COMEDOR' }));
      for (const c of S.comedor.slice(0, 2)) m.body.append(el('div', { class: 'comedor', html: `<span class="dimt">[día ${c.day}]</span> ${esc(c.text)}` }));
      m.body.append(el('div', { class: 'sep', text: '═'.repeat(80) }));
    }
    for (const msg of S.messages) m.body.append(el('div', { class: 'msg-topolev', html: `<span class="dimt">[día ${msg.day}]</span> ${esc(msg.text)}` }), el('div', { class: 'sep', text: '·'.repeat(80) }));
    const r = panel({ title: 'ENCARGOS · ÚLTIMO INFORME', bodyCls: 'scroll' });
    this.contractsBox(r.body);
    r.body.append(el('div', { class: 'sep', text: '═'.repeat(80) }), el('div', { class: 'h', text: 'ÚLTIMO INFORME' }));
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
    for (const a of S.agents) {
      // soltar un objeto sobre cualquier agente (no solo el seleccionado): lo equipa si tiene la ranura libre, si no a la mochila
      const row = this.agentRow(a);
      dropzone(row, { accepts: (d) => d && d.it && ['stash', 'bag', 'equip', 'vault'].includes(d.src) && d.a !== a, onDrop: (d) => this.giveTo(a, d) });
      L.body.append(row);
    }
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
    const up = pendingAscent(a) ? '<span class="warn ascend-mark" title="Ascenso pendiente">▲</span>' : '';
    const row = el('div', { class: 'agent-row' + (a === this.selAgent ? ' sel' : ''), html: `<span class="ag" style="color:${a.color}">@</span><span class="an">${esc(a.first)} «${esc(a.nick)}» ${esc(a.last)}</span><span class="dimt">${up}Nv${a.lvl}</span> ${hpBar(a.hp, st.hpMaxEff, 6)}${extra}` });
    row.addEventListener('click', onClick || (() => { this.selAgent = a; sfx.click(); this.render(); }));
    tip(row, () => this.agentTip(a));
    return row;
  }
  agentTip(a) {
    const st = agentStats(a);
    const t = traitOf(a);
    const sp = specOf(a);
    const E = st.attrs;
    const tal = (a.talents || []).map((id) => talentDef(id)).filter(Boolean);
    return `<div class="tt-title" style="color:${a.color}">${esc(agentName(a))}</div><div class="tt-sub">Nivel ${a.lvl} · ${esc(bgName(a))}${sp ? ` · <span style="color:${sp.color}">${sp.glyph} ${esc(sp.name)}</span>` : ''}</div>
      <div class="dimt">${esc(t.name)} (${esc(t.desc)})</div><div class="tt-sep">${'─'.repeat(40)}</div>
      <div class="tt-row"><span class="dimt">Salud</span><span>${a.hp}/${st.hpMaxEff}${st.hpMaxEff < st.hpMax ? ` <span class="bad">(máx ${st.hpMax})</span>` : ''}</span></div>
      <div class="tt-row"><span class="dimt">Radiación</span><span>${Math.round(a.rad)}</span></div>
      <div class="attr-mini">${ATTRS.map((x) => `<span title="${esc(x.name)}">${x.glyph}<b>${E[x.id]}</b></span>`).join('')}</div>
      <div class="tt-row"><span class="dimt">Precisión · Agilidad</span><span>${st.acc} · ${st.ev}</span></div>
      <div class="tt-row"><span class="dimt">Misiones</span><span>${a.missions || 0} (${a.extractions || 0} extracciones)</span></div><div class="tt-row"><span class="dimt">Bajas</span><span>${a.kills || 0}</span></div>
      ${tal.length ? `<div class="tt-sep">${'─'.repeat(40)}</div>${tal.map((d) => `<div class="tt-aff">${esc(d.glyph)} ${esc(d.name)} <span class="dimt">— ${esc(d.desc)}</span></div>`).join('')}` : ''}
      ${(a.medals || []).length ? `<div>${a.medals.map((m) => `<span style="color:${MEDALS[m].color}" title="${esc(MEDALS[m].name)}">${MEDALS[m].glyph}</span>`).join(' ')} <span class="dimt">${a.medals.length} condecoración(es)</span></div>` : ''}
      ${(a.acquired || []).length ? `<div class="dimt">Rasgos: ${a.acquired.map((x) => esc(ACQUIRED[x].name)).join(', ')}</div>` : ''}
      ${(a.wounds || []).length ? `<div class="bad">✖ ${a.wounds.map((w) => esc(w.name)).join(', ')}</div>` : ''}
      <div class="tt-row"><span class="dimt">Estrés</span><span class="${(a.stress || 0) >= 70 ? 'bad' : (a.stress || 0) >= 45 ? 'warn' : ''}">${Math.round(a.stress || 0)} · ${ST.stressLevel(a.stress || 0)}</span></div>
      ${ST.relationsOf(a).slice(0, 3).map((r) => `<div class="${r.st === 'rivales' ? 'bad' : 'good'}">${r.st === 'rivales' ? '⚔' : '♥'} ${ST.AFF_TEXT[r.st]} con ${esc(r.b.nick)} (${r.v})</div>`).join('')}
      ${a.vengeance ? `<div class="warn">🔥 Venganza contra ${esc(a.vengeance.name)}</div>` : ''}
      ${pendingAscent(a) ? '<div class="warn">▲ Ascenso pendiente: abre su ficha.</div>' : ''}`;
  }

  // ---- fase 20: personal de la base y encargos
  staffBox(id) {
    const l = ST.staffLine(id);
    if (!l) return '';
    return el('div', { class: 'staff-box', html: `<span style="color:${l.color};font-weight:700">${esc(l.name)}</span> <span class="dimt">· ${esc(l.role)}</span><div>${esc(l.text)}</div>` });
  }
  contractsBox(body) {
    const C2 = S.contracts;
    body.append(el('div', { class: 'h', text: `ENCARGOS EN MARCHA (${C2.active.filter((c) => !c.special && !c.job).length}/3 · trabajos ${C2.active.filter((c) => c.job).length}/${ST.JOB_MAX})` }));
    if (!C2.active.length) body.append(el('div', { class: 'dimt', text: 'Ninguno. Acepta alguno de los que se ofrecen abajo.' }));
    for (const c of C2.active) {
      const d = ST.CONTRACTS[c.id];
      const z = ST.contractZone(c);
      const spm = d.special ? MODIFIERS[d.special] : null;
      const prog = ST.contractProgress(c);
      const row = el('div', { class: `contract${spm ? ' special' : ''}${d.job ? ' job' : ''}` }, el('div', { html: `${d.job ? '<span class="cyan">⚑</span> ' : ''}${spm ? `<span style="color:${spm.color}">${esc(spm.glyph)}</span> ` : ''}<b>${esc(d.name)}</b>${prog ? ` <span class="warn">[${esc(prog)}]</span>` : ''} <span class="dimt">· ${esc(ST.GIVER_NAME(d.giver))}${z ? ` · ${esc(MAPS[mapIndex(z)].name)}` : ''}${spm ? ' · solo hoy' : ''}</span>${c.done || ST.contractMet(c) ? ' <span class="good">✓ listo para cobrar al volver</span>' : ''}` }), el('div', { class: 'dimt', text: d.desc + (c.who ? ` (${c.who})` : '') }),
        el('button', { class: 'btn small', onclick: async () => { if (await confirmBox('ABANDONAR ENCARGO', d.special || d.job ? `¿Abandonar «${esc(d.name)}»? ${d.job ? 'Es de la bolsa de trabajo: sin penalización.' : 'Era solo para hoy: nadie os lo tendrá en cuenta.'}` : `¿Abandonar «${esc(d.name)}»? Quien os lo encargó no lo olvidará.`, 'ABANDONAR', 'SEGUIR')) { ST.dropContract(c.id); save(); this.render(); } } }, 'ABANDONAR'));
      body.append(row);
    }
    // encargo especial del día (fase 16.4): ligado a un modificador de zona
    const sp = ST.specialOffer();
    if (sp) {
      const d = ST.CONTRACTS[sp.id], M = MODIFIERS[sp.mod], R = sp.reward;
      const rw = [R.rub ? `${R.rub} ₽` : '', R.ess ? `${R.ess} ✦` : '', R.rep ? `rep. ${R.rep[1] > 0 ? '+' : ''}${R.rep[1]}` : '', R.trust ? `confianza +${R.trust}` : ''].filter(Boolean).join(' · ');
      body.append(el('div', { class: 'h', style: { marginTop: '.6em', color: '#ffd23f' }, text: '◎ ENCARGO ESPECIAL · SOLO HOY' }));
      body.append(el('div', { class: 'contract offer special' }, el('div', { html: `<span style="color:${M.color}">${esc(M.glyph)} ${esc(M.name)}</span> · <b>${esc(d.name)}</b> <span class="dimt">· ${esc(ST.GIVER_NAME(d.giver))} · ${esc(ST.specialZone(sp).name)}</span>` }), el('div', { class: 'dimt', text: d.desc }), el('div', { class: 'good', text: 'Recompensa: ' + rw }),
        el('button', { class: 'btn small primary', onclick: () => { const r2 = ST.acceptContract(sp.id); if (r2.ok) { sfx.click(); toast(`Encargo especial aceptado: ${d.name}`, 'good'); save(); this.render(); } else { sfx.error(); toast(r2.msg, 'bad'); } } }, 'ACEPTAR')));
    }
    // bolsa de trabajo: encargos repetibles con zona, cantidad y paga según el nivel (se renuevan cada día)
    const jobs = ST.jobOffers();
    if (jobs.length) body.append(el('div', { class: 'h', style: { marginTop: '.6em', color: 'var(--cyan)' }, text: `⚑ BOLSA DE TRABAJO · SE RENUEVA CADA DÍA` }));
    for (const j of jobs) {
      const R = j.reward;
      const rw = [R.rub ? `${R.rub} ₽` : '', R.ess ? `${R.ess} ✦` : '', R.rep ? `rep. ${FACTIONS[R.rep[0]] ? FACTIONS[R.rep[0]].short : R.rep[0]} ${R.rep[1] > 0 ? '+' : ''}${R.rep[1]}` : '', R.trust ? `confianza +${R.trust}` : ''].filter(Boolean).join(' · ');
      body.append(el('div', { class: 'contract offer job', 'data-job': j.job }, el('div', { html: `<span class="cyan">⚑</span> <b>${esc(j.name)}</b> <span class="dimt">· ${esc(ST.GIVER_NAME(j.giver))}${j.zone ? ` · ${esc(MAPS[mapIndex(j.zone)].name)}` : ''}</span>` }), el('div', { class: 'dimt', text: j.desc }), el('div', { class: 'good', text: 'Paga: ' + rw }),
        el('button', { class: 'btn small primary', onclick: () => { const r2 = ST.acceptJob(j.id); if (r2.ok) { toast(`Trabajo aceptado: ${j.name}`, 'good'); save(); this.render(); } else { sfx.error(); toast(r2.msg, 'bad'); } } }, 'ACEPTAR')));
    }
    const offers = ST.contractOffers();
    if (offers.length) body.append(el('div', { class: 'h', style: { marginTop: '.6em' }, text: 'SE OFRECEN HOY' }));
    for (const id of offers) {
      const d = ST.CONTRACTS[id];
      const g = STAFF[d.giver] || null;
      const R = d.reward;
      const rw = [R.rub ? `${R.rub} ₽` : '', R.ess ? `${R.ess} ✦` : '', R.rep ? `rep. ${R.rep[1] > 0 ? '+' : ''}${R.rep[1]}` : '', R.trust ? `confianza +${R.trust}` : '', R.item ? `«${R.item[1]}»` : ''].filter(Boolean).join(' · ');
      body.append(el('div', { class: 'contract offer' }, el('div', { html: `<b style="color:${g ? g.color : ''}">${esc(d.name)}</b> <span class="dimt">· ${esc(ST.GIVER_NAME(d.giver))}</span>` }), el('div', { class: 'dimt', text: d.desc }), el('div', { class: 'good', text: 'Recompensa: ' + rw }),
        el('button', { class: 'btn small primary', onclick: () => { const r2 = ST.acceptContract(id); if (r2.ok) { sfx.click(); toast(`Encargo aceptado: ${d.name}`, 'good'); save(); this.render(); } else { sfx.error(); toast(r2.msg, 'bad'); } } }, 'ACEPTAR')));
    }
  }

  agentSheet(B, a) {
    const st = agentStats(a);
    const t = traitOf(a);
    const xpPrev = a.lvl > 1 ? xpForLevel(a.lvl - 1) : 0;
    const sp = specOf(a);
    const E = st.attrs;
    const xpTxt = a.lvl >= MAX_LEVEL ? 'nivel máximo' : `${a.xp}/${xpForLevel(a.lvl)}`;
    B.append(
      el('div', { class: 'spread' }, el('span', { class: 'h', html: `<span style="color:${a.color}">@</span> ${esc(agentName(a))}` }), el('span', { class: 'dimt', text: `Nv ${a.lvl}` })),
      el('div', { class: 'dimt', html: `${esc(bgName(a))} · ${esc(t.name)} — ${esc(t.desc)}` }),
      el('div', { html: sp ? `<span style="color:${sp.color}">${sp.glyph} ${esc(sp.name.toUpperCase())}</span> <span class="dimt">· habilidad: ${esc(sp.ability.name)}</span>` : `<span class="dimt">Sin especialización${a.lvl >= SPEC_LEVEL ? ' — <span class="warn">elígela en ASCENSO</span>' : ` (al nivel ${SPEC_LEVEL})`}</span>` }),
      el('div', { html: `XP ${a.lvl >= MAX_LEVEL ? bar(1, 1, 16) : bar(a.xp - xpPrev, xpForLevel(a.lvl) - xpPrev, 16)} <span class="dimt">${xpTxt}</span>` }),
      el('div', { html: `SAL ${hpBar(a.hp, st.hpMaxEff, 16)} ${a.hp}/${st.hpMaxEff}${st.hpMaxEff < st.hpMax ? ` <span class="bad">(rad: máx ${st.hpMax})</span>` : ''}` }),
      el('div', { html: `RAD ${bar(Math.min(100, a.rad), 100, 16, 'rad')} ${Math.round(a.rad)}` }),
      el('div', { html: `EST ${bar(Math.round(a.stress || 0), 100, 16)} ${Math.round(a.stress || 0)} <span class="${(a.stress || 0) >= 70 ? 'bad' : 'dimt'}">${ST.stressLevel(a.stress || 0)}</span>${(a.stress || 0) >= 70 ? ' <span class="bad">(riesgo de pánico, paranoia o temblor)</span>' : ''}` }),
      ...ST.relationsOf(a).map((r) => el('div', { class: r.st === 'rivales' ? 'bad' : 'good', html: `${r.st === 'rivales' ? '⚔' : '♥'} ${ST.AFF_TEXT[r.st]} con <b>${esc(r.b.nick)}</b> <span class="dimt">(${r.v}) · ${r.st === 'inseparables' ? 'juntos: +3 puntería, +2 agilidad' : r.st === 'camaradas' ? 'juntos: +1 puntería' : 'juntos: −2 puntería, +10% daño'}</span>` })),
    );
    // atributos (efectivos: base + talentos − heridas)
    const at = el('div', { class: 'attr-sheet' });
    for (const x of ATTRS) {
      const base = (a.attr && a.attr[x.id]) || 1, v = E[x.id];
      const hurt = (a.wounds || []).filter((w) => w.attr === x.id).length;
      const c = el('div', { class: 'attr-cell', html: `<span class="o1">${x.glyph} ${esc(x.name)}</span> <b class="${hurt ? 'bad' : v > base ? 'good' : ''}">${v}</b>` });
      tip(c, () => `<div class="tt-title">${esc(x.name)} ${v}</div><div>${esc(x.desc)}</div><div class="dimt">Base ${base}${v - base + hurt ? ` · talentos +${v - base + hurt}` : ''}${hurt ? ` · <span class="bad">heridas −${hurt}</span>` : ''}</div>`);
      at.append(c);
    }
    B.append(at, el('div', { class: 'kv', style: { marginTop: '2px' }, html: `<span>Precisión</span><span>${st.acc}</span><span>Agilidad</span><span>${st.ev}</span><span>Protección</span><span>${st.prot}</span><span>Resist. rad.</span><span>${st.rad}%</span><span>Visión</span><span>${st.vision}</span><span>Crítico</span><span>${st.crit}%</span><span>Mochila</span><span>${a.bag.length}/${bagCapacity(a)}</span>` }));
    // talentos, rasgos adquiridos, condecoraciones y heridas
    const chips = el('div', { class: 'talent-line' });
    const chip = (txt, cls, tt) => { const c = el('span', { class: 'talent-chip ' + cls, html: txt }); tip(c, tt); chips.append(c); };
    for (const id of a.talents || []) { const d = talentDef(id); if (!d) continue; const synOn = (d.syn || []).some((sy) => synOk(a, sy)); chip(`${esc(d.glyph)} ${esc(d.name)}${synOn ? ' <span class="cyan">◈</span>' : ''}`, d.spec ? 'spec' : '', () => `<div class="tt-title">${esc(d.name)}</div><div>${esc(d.desc)}</div>${d.spec ? `<div class="dimt">${esc(SPECS[d.spec].name)} · rama ${esc(SPECS[d.spec].branches[d.branch].name)}</div>` : '<div class="dimt">Talento general</div>'}${synOn ? '<div class="cyan">◈ Sinergia activa con tu equipo</div>' : ''}`); }
    for (const id of a.acquired || []) { const d = ACQUIRED[id]; chip(`${esc(d.glyph)} ${esc(d.name)}`, 'acq', () => `<div class="tt-title">${esc(d.name)}</div><div>${esc(d.desc)}</div><div class="dimt">Rasgo adquirido: ${esc(d.how)}</div>`); }
    for (const id of a.medals || []) { const d = MEDALS[id]; chip(`<span style="color:${d.color}">${esc(d.glyph)}</span> ${esc(d.name)}`, 'medal', () => `<div class="tt-title" style="color:${d.color}">${esc(d.name)}</div><div>${esc(d.desc)}</div><div class="dimt">${esc(d.how)}</div>`); }
    if (chips.children.length) B.append(chips);
    for (const [i, w] of (a.wounds || []).entries()) {
      const wc = C.treatWoundCost();
      B.append(el('div', { class: 'wound-row' }, el('span', { class: 'bad', html: `✖ ${esc(w.name)} <span class="dimt">(−1 ${esc(ATTRS.find((x) => x.id === w.attr).name)})</span>` }),
        el('button', { class: 'btn small ' + (S.rub >= wc ? 'good' : 'disabled'), onclick: (ev) => { const r = C.treatWound(a, i); if (r.ok) { sfx.upgrade(); uiSparkEl(ev.target, { colors: ['#3ddc6b', '#fff'], chars: ['+'] }); toast(`${esc(r.name)} tratada (−${r.cost} ₽).`, 'good'); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, `OPERAR (${wc} ₽)`)));
    }
    const cost = C.treatCost(a);
    const acts = el('div', { class: 'row', style: { flexWrap: 'wrap', margin: '4px 0' } });
    const nOff = (a.offers || []).length;
    if (pendingAscent(a)) acts.append(el('button', { class: 'btn primary ascend-btn', onclick: () => this.openAscent(a) }, `▲ ASCENSO${needsSpec(a) ? ' · especialización' : ''}${a.pts ? ` · ${a.pts} punto${a.pts > 1 ? 's' : ''}` : ''}${nOff ? ` · ${nOff} talento${nOff > 1 ? 's' : ''}` : ''}`));
    else if (a.spec) acts.append(el('button', { class: 'btn', onclick: () => this.openAscent(a) }, 'ÁRBOL DE TALENTOS'));
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
        r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.itemMenu(ev, it); });
        r.addEventListener('dblclick', () => { this.moveItem({ src: 'equip', a, slot: s.id, it }, { dst: 'bag', a }); });
        val.append(r);
      } else val.append(el('div', { class: 'empty', text: `— ${s.cats.map((c) => CAT_INFO[c].name.toLowerCase()).join('/')} —` }));
      const row = el('div', { class: 'slot' }, el('span', { class: 'sl', text: s.label }), val);
      dropzone(row, { accepts: (d) => d && d.it && canEquip(d.it, s.id) && !(d.src === 'equip' && d.slot === s.id && d.a === a), onDrop: (d) => this.moveItem(d, { dst: 'equip', a, slot: s.id }) });
      B.append(row);
      if (s.id === 'case' && it) B.append(this.vaultBox(a, it));
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
      tip(r, () => itemTooltip(it, this.compareFor(a, it), `<div class="dimt">Arrastra a una ranura, al almacén o a otro agente. Doble clic: al almacén.${it.q > 1 ? ' Clic derecho: comprar otro / dividir la pila.' : ' Clic derecho: comprar otro.'}</div>`));
      draggable(r, { data: () => ({ src: 'bag', a, it }), ghost: () => itemHTML(it) });
      r.addEventListener('dblclick', () => this.moveItem({ src: 'bag', a, it }, { dst: 'stash' }));
      this.stackable(r, it, a.bag, bagCapacity(a), 'la mochila');
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
      if (this.stashFilter === 'gadget') return c === 'gadget' || c === 'backpack' || c === 'case';
      return c === this.stashFilter;
    };
    const items = sortItems([...S.stash]).filter(filt);
    for (const it of items) {
      const extra = mode === 'sell' ? `<span class="iq o0">${C.sellPrice(it)} ₽</span>` : '';
      const r = el('div', { class: 'item', html: itemHTML(it, { extra }) });
      const a = this.selAgent;
      tip(r, () => itemTooltip(it, a ? this.compareFor(a, it) : null, mode === 'sell' ? `<div class="tt-sep">${'─'.repeat(40)}</div><div class="o0">Venta: ${C.sellPrice(it)} ₽</div><div class="dimt">Doble clic o arrastra a VENDER.</div>${ITEMS[it.b].essenceValue ? '<div class="cyan">Clic derecho: convertir en esencia.</div>' : ''}` : `<div class="dimt">Arrastra a un agente (a cualquiera de la lista). Doble clic: equipar o meter en la mochila del agente seleccionado.${it.q > 1 ? ' Clic derecho: comprar otro / dividir la pila.' : ' Clic derecho: comprar otro.'}</div>`));
      draggable(r, { data: () => ({ src: 'stash', it }), ghost: () => itemHTML(it) });
      if (mode === 'sell') {
        r.addEventListener('dblclick', (ev) => this.doSell(it, ev));
        r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (ITEMS[it.b].essenceValue) this.doConvert(it, ev); });
      } else {
        this.stackable(r, it, S.stash, C.stashCap(), 'el almacén');
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

  // ventana de ascenso: repartir puntos, elegir especialización y talentos, ver el árbol
  openAscent(a) {
    const body = el('div', { class: 'ascent' });
    let tmp = { ...a.attr };
    let left = a.pts || 0;
    const sep = () => el('div', { class: 'sep', text: '─'.repeat(80) });
    const render = () => {
      body.innerHTML = '';
      const sp = specOf(a);
      body.append(el('div', { class: 'spread' }, el('span', { class: 'h', html: `<span style="color:${a.color}">@</span> ${esc(agentName(a))} · Nv ${a.lvl} · <span class="dimt">${esc(bgName(a))}</span>` }), el('span', { class: left ? 'warn' : 'dimt', text: `${left} punto${left === 1 ? '' : 's'} por repartir` })));
      body.append(el('div', { class: 'dimt', text: `Cada nivel da 1 punto de atributo (máximo ${ATTR_MAX}); cada ${TALENT_EVERY} niveles, un talento. Al nivel ${SPEC_LEVEL}, una especialización. Todo es permanente.` }));
      // ---- atributos
      body.append(sep(), el('div', { class: 'h', text: 'ATRIBUTOS' }));
      for (const at of ATTRS) {
        const v = tmp[at.id] || 1, base = a.attr[at.id] || 1;
        const pips = `<span class="o2">${'■'.repeat(base)}</span><span class="warn">${'■'.repeat(v - base)}</span><span class="o5">${'□'.repeat(Math.max(0, ATTR_MAX - v))}</span>`;
        const minus = el('button', { class: 'btn small' + (v > base ? '' : ' disabled'), onclick: () => { if (v > base) { tmp[at.id]--; left++; sfx.click(); render(); } } }, '−');
        const plus = el('button', { class: 'btn small' + (left > 0 && v < ATTR_MAX ? '' : ' disabled'), onclick: () => { if (left > 0 && v < ATTR_MAX) { tmp[at.id]++; left--; sfx.click(); render(); } } }, '+');
        body.append(el('div', { class: 'attr-row' }, el('span', { class: 'o1', text: `${at.glyph} ${at.name}` }), el('span', { class: 'pips', html: `${pips} <b>${v}</b>` }), minus, plus, el('span', { class: 'dimt', text: at.desc })));
      }
      const changed = ATTRS.some((x) => (tmp[x.id] || 0) !== (a.attr[x.id] || 0));
      body.append(el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '4px' } }, el('button', { class: 'btn primary' + (changed ? '' : ' disabled'), onclick: (ev) => {
        if (!changed) return;
        a.attr = { ...tmp }; a.pts = left; save(); sfx.upgrade(); uiSparkEl(ev.target, { chars: ['▲', '+', '·'], colors: ['#ffd23f', '#ff8a1f'] }); render(); this.render();
      } }, 'CONFIRMAR ATRIBUTOS')));
      // ---- especialización
      if (needsSpec(a)) {
        body.append(sep(), el('div', { class: 'h warn', text: 'ESPECIALIZACIÓN · elige una (definitiva)' }));
        const cards = el('div', { class: 'spec-cards' });
        for (const [id, S2] of Object.entries(SPECS)) {
          const card = el('div', { class: 'talent-card spec-card', html: `<div class="tg" style="color:${S2.color}">${esc(S2.glyph)}</div><div class="tn" style="color:${S2.color}">${esc(S2.name)}</div><div class="td">${esc(S2.fantasy)}</div><div class="td o1" style="margin-top:.3em">${esc(S2.ability.glyph)} ${esc(S2.ability.name)}</div>` });
          tip(card, () => `<div class="tt-title" style="color:${S2.color}">${esc(S2.name)}</div><div>${esc(S2.fantasy)}</div><div class="tt-sep">${'─'.repeat(40)}</div><div class="o1">${esc(S2.ability.glyph)} ${esc(S2.ability.name)} <span class="dimt">(recarga ${S2.ability.cd} turnos)</span></div><div>${esc(S2.ability.desc)}</div><div class="tt-sep">${'─'.repeat(40)}</div>${S2.branches.map((b) => `<div><b>${esc(b.name)}</b>: <span class="dimt">${b.talents.map((t) => esc(SPEC_TALENTS[t].name)).join(' · ')}</span></div>`).join('')}`);
          card.addEventListener('click', async () => {
            if (!(await confirmBox('ESPECIALIZACIÓN', `¿${esc(a.nick)} se especializa como <b style="color:${S2.color}">${esc(S2.name)}</b>?<div class="dimt">No se puede cambiar. Sus talentos pendientes pasarán a ser de este árbol.</div>`, 'ESPECIALIZAR'))) return;
            chooseSpec(a, id); save(); sfx.upgrade(); render(); this.render();
          });
          cards.append(card);
        }
        body.append(cards);
      }
      // ---- talento pendiente
      const offer = !needsSpec(a) && currentOffer(a);
      if (offer && offer.length) {
        save();
        const cost = rerollCost(a.lvl);
        body.append(sep(), el('div', { class: 'spread' }, el('span', { class: 'h', text: `TALENTO${a.offers.length > 1 ? ` (${a.offers.length} pendientes)` : ''} · elige uno` }),
          el('button', { class: 'btn small' + (S.rub >= cost ? '' : ' disabled'), onclick: () => { if (S.rub < cost) { sfx.error(); toast('Rublos insuficientes.', 'bad'); return; } S.rub -= cost; rerollOffer(a); save(); sfx.click(); render(); this.render(); } }, `VOLVER A TIRAR (${cost} ₽)`)));
        const cards = el('div', { class: 'talent-cards' });
        for (const id of offer) {
          const t = talentDef(id);
          const where = t.spec ? `${SPECS[t.spec].branches[t.branch].name}${t.tier > 1 ? ' · avanzado' : ''}` : 'general';
          const card = el('div', { class: 'talent-card', html: `<div class="tg">${esc(t.glyph)}</div><div class="tn">${esc(t.name)}</div><div class="td">${esc(t.desc)}</div><div class="td dimt" style="margin-top:.3em">${esc(where)}</div>` });
          card.addEventListener('click', async () => {
            if (!(await confirmBox('TALENTO', `¿${esc(a.nick)} aprende <b>${esc(t.name)}</b>?<div class="dimt">${esc(t.desc)}</div>`, 'APRENDER'))) return;
            pickTalent(a, id); save(); sfx.upgrade(); uiSparkEl(card, { chars: ['★', '+', '·'], colors: ['#ffd23f', '#ff8a1f'] });
            render(); this.render();
          });
          cards.append(card);
        }
        body.append(cards);
      }
      // ---- árbol de la especialización
      if (sp) {
        body.append(sep(), el('div', { class: 'h', html: `ÁRBOL · <span style="color:${sp.color}">${esc(sp.glyph)} ${esc(sp.name)}</span> <span class="dimt">· ${esc(sp.ability.name)}: ${esc(sp.ability.desc)}</span>` }));
        const tree = el('div', { class: 'spec-tree' });
        for (const br of sp.branches) {
          const col = el('div', { class: 'branch' }, el('div', { class: 'bn', text: br.name }));
          const has = br.talents.some((t) => a.talents.includes(t));
          for (const id of br.talents) {
            const d = SPEC_TALENTS[id];
            const own = a.talents.includes(id);
            const open = d.tier === 1 || has;
            const n = el('div', { class: `node ${own ? 'own' : open ? 'open' : 'locked'}`, html: `${own ? '■' : open ? '□' : '▒'} ${esc(d.name)}${d.tier > 1 ? ' <span class="dimt">II</span>' : ''}` });
            tip(n, () => `<div class="tt-title">${esc(d.name)}</div><div>${esc(d.desc)}</div><div class="dimt">${own ? 'Aprendido' : open ? 'Puede salir en las próximas ofertas' : 'Avanzado: necesita un talento de esta rama'}</div>`);
            col.append(n);
          }
          tree.append(col);
        }
        body.append(tree);
      }
      // ---- generales aprendidos
      const gen = (a.talents || []).filter((id) => TALENTS[id]);
      if (gen.length) {
        body.append(sep(), el('div', { class: 'h', text: 'TALENTOS GENERALES' }));
        for (const id of gen) body.append(el('div', { html: `<span class="o1">${esc(TALENTS[id].glyph)} ${esc(TALENTS[id].name)}</span> <span class="dimt">— ${esc(TALENTS[id].desc)}</span>` }));
      }
    };
    render();
    modal({ title: 'ASCENSO', body, width: 'min(104ch, 95vw)', actions: [{ label: 'CERRAR' }] });
  }

  // modificadores de zona de hoy (fase 16.4)
  modsBox(i) {
    const zm = C.zoneMods(i);
    const box = el('div', { class: 'mods-box' });
    box.append(el('div', { class: 'h', text: `CONDICIONES DE HOY · DÍA ${S.day}` }));
    if (!zm.length) { box.append(el('div', { class: 'dimt', text: 'Sin novedades: condiciones normales.' })); return box; }
    for (const id of zm) {
      const M = MODIFIERS[id];
      box.append(el('div', { class: 'mod-row', html: `<span style="color:${M.color}"><b>${esc(M.glyph)} ${esc(M.name)}</b></span> <span class="bad">▼ ${esc(M.risk)}</span> <span class="good">▲ ${esc(M.reward)}</span>` }));
    }
    // fase 22: nidos que vuelven, zona que crece, jefe de la zona
    const zw = ECO.zoneWorld(MAPS[i].id);
    const hb = ECO.homeBossOf(MAPS[i].id);
    if (zw.calmLeft) box.append(el('div', { class: 'good', text: `✓ Nidos diezmados: la zona se repuebla en ${zw.calmLeft} día(s).` }));
    if (zw.grow) box.append(el('div', { class: 'bad', text: `▲ Sin visitar desde hace días: los nidos han crecido (+${zw.grow} nivel${zw.grow > 1 ? 'es' : ''}).` }));
    if (hb) box.append(el('div', { html: zw.bossAway ? `<span class="dimt">☠ ${esc(ENEMIES[hb].name)}: abatido hace poco; aún no ha vuelto.</span>` : `<span class="bad">☠ Jefe de la zona: <b>${esc(ENEMIES[hb].name)}</b></span> <span class="dimt">(en el piso más profundo)</span>` }));
    const sp = S.contracts.active.find((c) => c.special && c.zone === MAPS[i].id && c.day === S.day);
    if (sp) box.append(el('div', { html: `<span style="color:#ffd23f">◎ Encargo especial: <b>${esc(ST.CONTRACTS[sp.id].name)}</b></span> <span class="dimt">· solo hoy</span>` }));
    box.append(el('div', { class: 'dimt', text: 'Cambian cada día (cada expedición).' }));
    return box;
  }

  // contenido del contenedor de seguridad (en la base se puede llenar y vaciar libremente)
  vaultBox(a, c) {
    const d = ITEMS[c.b];
    const box = el('div', { class: 'vault' });
    box.append(el('div', { class: 'spread' }, el('span', { class: 'dimt', html: `[▣] contenido ${caseUsed(c)}/${d.caseSlots + (c.caseBonus || 0)}` }), c.vault.length ? el('button', { class: 'btn small', onclick: () => { for (const x of [...c.vault]) this.moveItem({ src: 'vault', a, it: x }, { dst: 'stash' }); } }, 'VACIAR AL ALMACÉN') : el('span')));
    for (const x of c.vault) {
      const r = el('div', { class: 'item', html: '<span class="dimt">▣ </span>' + itemHTML(x) });
      tip(r, () => itemTooltip(x, null, '<div class="dimt">Arrastra fuera para sacarlo. Doble clic: al almacén.</div>'));
      draggable(r, { data: () => ({ src: 'vault', a, it: x }), ghost: () => itemHTML(x) });
      r.addEventListener('dblclick', () => this.moveItem({ src: 'vault', a, it: x }, { dst: 'stash' }));
      box.append(r);
    }
    if (!c.vault.length) box.append(el('div', { class: 'dimt', text: 'Arrastra aquí lo que deba volver pase lo que pase.' }));
    dropzone(box, { accepts: (dd) => dd && dd.it && dd.src !== 'vault' && dd.src !== 'shop' && dd.it !== c && !caseRefusal(c, dd.it), onDrop: (dd) => this.moveItem(dd, { dst: 'vault', a }) });
    return box;
  }

  autoSlot(a, it) {
    const c = ITEMS[it.b].cat;
    if (c === 'weapon') return !a.equip.w1 ? 'w1' : !a.equip.w2 ? 'w2' : 'w1';
    if (c === 'armor') return 'armor';
    if (c === 'helmet') return 'helmet';
    if (c === 'backpack') return 'pack';
    if (c === 'gadget') return !a.equip.g1 ? 'g1' : !a.equip.g2 ? 'g2' : 'g1';
    if (c === 'case') return 'case';
    return null;
  }

  // mueve objetos entre almacén, mochilas y ranuras
  // ---- pilas (revisión fase 24): clic derecho = dividir; soltar sobre el mismo objeto = juntar
  stackable(r, it, list, cap, where) {
    const d = ITEMS[it.b];
    if ((d.stack || 1) <= 1) { r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.itemMenu(ev, it); }); return; }
    r.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.itemMenu(ev, it, { list, cap, where }); });
    dropzone(r, { accepts: (dd) => dd && dd.it && dd.it !== it && dd.it.b === it.b && dd.it.r === it.r && it.q < d.stack && ['stash', 'bag', 'vault'].includes(dd.src), onDrop: (dd) => this.mergeStack(dd, it) });
  }
  // menú contextual de un objeto en EQUIPO (revisión): comprar otro igual si está a la venta hoy y dividir la pila
  itemMenu(ev, it, ctx = null) {
    const opts = [];
    const d = ITEMS[it.b];
    const shopList = [...C.shopSupplies().map((x) => ({ x, supply: true })), ...C.ensureShop().stock.map((x) => ({ x, supply: false }))].filter((o) => o.x.b === it.b);
    for (const { x, supply } of shopList) {
      const price = C.buyPrice(x) * (x.q || 1);
      const essC = ITEMS[x.b].essCost || 0;
      const can = S.rub >= price && S.ess >= essC;
      opts.push({ label: `₽ Comprar ${esc(itemName(x))}${x.q > 1 ? ' ×' + x.q : ''}`, hint: `${price} ₽${essC ? ` + ${essC} ✦` : ''}${supply ? '' : ' · material del día'}${can ? '' : ' · no te llega'}`, disabled: !can, fn: (e2) => this.doBuy(x, supply, { target: ev.target }) });
    }
    if (!shopList.length) opts.push({ label: 'No está a la venta hoy en la Intendencia', disabled: true });
    if (ctx && ctx.list && (d.stack || 1) > 1 && it.q > 1) opts.push({ label: '⇹ Dividir la pila…', fn: () => this.splitModal(it, ctx.list, ctx.cap, ctx.where) });
    contextMenu(ev.clientX, ev.clientY, opts, itemHTML(it));
  }
  splitModal(it, list, cap, where) {
    if (!(it.q > 1)) { toast('Solo hay una unidad.', 'dimt'); return; }
    if (list.length >= cap) { sfx.error(); toast(`No hay hueco en ${where} para otra pila.`, 'bad'); return; }
    let n = Math.floor(it.q / 2);
    // deslizador ASCII: unidades que pasan a la pila nueva (y las que se quedan)
    const sl = asciiSlider({ value: n, min: 1, max: it.q - 1, width: Math.min(30, Math.max(10, it.q - 1)), fmt: (v) => `${v} / ${it.q - v}`, label: 'dividir', onInput: (v) => { n = v; } });
    sl.classList.add('split-slider');
    const body = el('div', { style: { minWidth: 'min(52ch, 90vw)' } },
      el('div', { html: itemHTML(it) }),
      el('div', { class: 'dimt', style: { margin: '.4em 0' }, text: 'Cuántas unidades pasan a la pila nueva (nueva / se quedan). Arrastra o usa las flechas:' }),
      sl);
    setTimeout(() => sl.focus(), 50);
    modal({ title: 'DIVIDIR PILA', body, actions: [{ label: 'CANCELAR' }, { label: 'DIVIDIR', cls: 'primary', fn: () => { if (splitStack(list, it, n)) { sfx.pickup(); save(); this.render(); } } }] });
  }
  mergeStack(from, dst) {
    const src = from.it;
    const mv = stackOnto(dst, src);
    if (!mv) { sfx.error(); toast('La pila ya está llena.', 'bad'); return; }
    if (src.q <= 0) {
      if (from.src === 'stash') S.stash.splice(S.stash.indexOf(src), 1);
      else if (from.src === 'bag') from.a.bag.splice(from.a.bag.indexOf(src), 1);
      else if (from.src === 'vault') { const v = from.a.equip.case.vault; v.splice(v.indexOf(src), 1); }
    }
    sfx.pickup(); toast(`Juntadas ${mv} unidad(es).`, 'good'); save(); this.render();
  }
  // soltar sobre un agente de la lista: equipar si la ranura está libre, si no a la mochila
  giveTo(a, d) {
    const slot = this.autoSlot(a, d.it);
    if (slot && !a.equip[slot] && canEquip(d.it, slot)) this.moveItem(d, { dst: 'equip', a, slot });
    else if (ITEMS[d.it.b].cat === 'mod') { sfx.error(); toast('Los mods se montan desde la ficha del agente.', 'bad'); }
    else this.moveItem(d, { dst: 'bag', a });
    if (a !== this.selAgent) toast(`→ ${esc(a.nick)}`, 'good');
  }

  moveItem(from, to) {
    const it = from.it;
    // quitar del origen (provisionalmente)
    const detach = () => {
      if (from.src === 'stash') S.stash.splice(S.stash.indexOf(it), 1);
      else if (from.src === 'bag') from.a.bag.splice(from.a.bag.indexOf(it), 1);
      else if (from.src === 'equip') from.a.equip[from.slot] = null;
      else if (from.src === 'mod') removeMod(from.a.equip[from.wslot], from.slot);
      else if (from.src === 'vault') { const v = from.a.equip.case.vault; v.splice(v.indexOf(it), 1); }
    };
    const reattach = () => {
      if (from.src === 'stash') S.stash.push(it);
      else if (from.src === 'bag') from.a.bag.push(it);
      else if (from.src === 'equip') from.a.equip[from.slot] = it;
      else if (from.src === 'mod') installMod(from.a.equip[from.wslot], it);
      else if (from.src === 'vault') from.a.equip.case.vault.push(it);
    };
    detach();
    let ok = true, msg = '';
    if (to.dst === 'stash') {
      if (!C.addToStash(it)) { ok = false; msg = 'El almacén está lleno.'; }
    } else if (to.dst === 'vault') {
      const c = to.a.equip.case;
      msg = c ? caseRefusal(c, it) : 'No lleva contenedor.';
      if (msg) ok = false; else c.vault.push(it);
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
    L.body.append(this.staffBox('orlova'));
    for (const a of S.agents) {
      const st = agentStats(a);
      const t = traitOf(a);
      const card = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr auto' } });
      const sp = specOf(a);
      card.innerHTML = `<div class="mg" style="color:${a.color}">@</div><div><b>${esc(agentName(a))}</b> <span class="dimt">Nv ${a.lvl}</span>${sp ? ` <span style="color:${sp.color}">${sp.glyph} ${esc(sp.name)}</span>` : ''}<div class="eff">${esc(bgName(a))} · ${esc(t.name)} · SAL ${a.hp}/${st.hpMaxEff} · RAD ${Math.round(a.rad)} · ${a.missions || 0} misiones · ${a.kills || 0} bajas</div></div>`;
      const btns = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
      const why = C.canRetire(a);
      if (a.lvl >= RETIRE_LEVEL) btns.append(el('button', { class: 'btn small ' + (why ? 'disabled' : 'good'), title: why, onclick: async () => {
        if (why) { toast(why, 'bad'); return; }
        if (!(await confirmBox('RETIRO', `¿<b>${esc(agentName(a))}</b> se retira como <b>instructor</b>?<div class="dimt">Deja de ir a expediciones. Mientras haya instructores, los agentes de nivel ${ROOKIE_LEVEL} o menos ganan un ${INSTRUCTOR_XP}% más de experiencia por cada uno (máximo ${MAX_INSTRUCTORS}). Su equipo vuelve al almacén.</div>`, 'RETIRAR'))) return;
        const r = C.retire(a); if (r.ok) { sfx.upgrade(); toast(`${esc(a.nick)} es ahora instructor.`, 'good'); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); }
      } }, 'RETIRAR'));
      btns.append(el('button', { class: 'btn danger small', onclick: async () => { if (await confirmBox('DESPEDIR', `¿Despedir a <b>${esc(agentName(a))}</b>? Su equipo vuelve al almacén si cabe.`, 'DESPEDIR', 'CANCELAR', true)) { C.dismiss(a); this.render(); } } }, 'DESPEDIR'));
      card.append(btns);
      tip(card, () => this.agentTip(a));
      L.body.append(card);
    }
    // instructores retirados
    L.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: `INSTRUCTORES ${(S.instructors || []).length}/${MAX_INSTRUCTORS}` }));
    if (!(S.instructors || []).length) L.body.append(el('div', { class: 'dimt', text: `Los agentes de nivel ${RETIRE_LEVEL} o más pueden retirarse como instructores: los novatos (nivel ${ROOKIE_LEVEL} o menos) ganan +${INSTRUCTOR_XP}% de experiencia por cada uno.` }));
    for (const ins of S.instructors || []) {
      const sp = ins.spec && SPECS[ins.spec];
      L.body.append(el('div', { html: `<span style="color:${ins.color || '#fff'}">@</span> ${esc(ins.name)} <span class="dimt">Nv ${ins.lvl} · ${esc(ins.bg || '')}${sp ? ` · <span style="color:${sp.color}">${esc(sp.name)}</span>` : ''} · desde el día ${ins.day}</span> ${(ins.medals || []).map((m) => `<span style="color:${MEDALS[m].color}">${MEDALS[m].glyph}</span>`).join('')}` }));
    }
    const R = panel({ title: 'CANDIDATOS DEL DÍA', bodyCls: 'scroll' });
    const rec = C.ensureRecruits();
    R.body.append(el('div', { class: 'dimt', text: 'Voluntarios del Comité. Llegan nuevos cada día (tras cada expedición). Vienen con equipo básico.' }), el('div', { class: 'sep', text: '─'.repeat(80) }));
    for (const entry of rec.list) {
      const a = entry.a;
      const st = agentStats(a);
      const t = traitOf(a);
      const card = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr auto' } });
      const sp = specOf(a);
      card.innerHTML = `<div class="mg" style="color:${a.color}">@</div><div><b>${esc(agentName(a))}</b> <span class="dimt">Nv ${a.lvl}</span>${sp ? ` <span style="color:${sp.color}">${sp.glyph} ${esc(sp.name)}</span>` : ''}<div class="eff">${esc(bgName(a))} · ${esc(t.name)}: ${esc(t.desc)}</div><div class="eff">Salud ${st.hpMax} · ${ATTRS.map((x) => `${x.glyph}${st.attrs[x.id]}`).join(' ')}</div></div>`;
      tip(card, () => this.agentTip(a));
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
    L.body.append(this.staffBox('kravets'));
    const shop = C.ensureShop();
    L.body.append(el('div', { class: 'dimt', text: 'El catálogo cambia cada día. Mejora los módulos para acceder a mejor material. Clic o arrastra al almacén para comprar.' }), el('div', { class: 'sep', text: '─'.repeat(80) }));
    const addRow = (it, supply) => {
      const price = C.buyPrice(it) * (it.q || 1);
      const essC = ITEMS[it.b].essCost || 0;
      const can = S.rub >= price && S.ess >= essC;
      const priceTxt = `${price} ₽${essC ? ` + ${essC} ✦` : ''}`;
      const r = el('div', { class: 'shop-row' });
      const chip = el('div', { class: 'item', html: itemHTML(it) });
      tip(chip, () => itemTooltip(it, this.selAgent ? this.compareFor(this.selAgent, it) : null, `<div class="tt-sep">${'─'.repeat(40)}</div><div class="o0">Precio: ${priceTxt}</div>`));
      draggable(chip, { data: () => ({ src: 'shop', it, supply }), ghost: () => itemHTML(it) });
      r.append(chip, el('span', { class: 'price', text: priceTxt }), el('button', { class: 'btn small ' + (can ? '' : 'disabled'), onclick: (ev) => this.doBuy(it, supply, ev) }, 'COMPRAR'));
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
    R.body.append(el('div', { class: 'sep', text: '═'.repeat(60) }), this.blackMarketBox());
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
    const g = el('div', { class: 'exp-tab' });
    const L = panel({ title: 'DESTINOS', bodyCls: 'scroll' });
    // zonas de evento temporales (17.3)
    const evs = (S.eventZones || []).map((ev) => C.eventZoneView(ev));
    if (this.selEvent && !evs.some((v) => v.id === this.selEvent)) this.selEvent = null;
    if (evs.length) {
      L.body.append(el('div', { class: 'h', style: { color: '#ff6ad5' }, text: '! ZONAS DE EVENTO' }));
      for (const v of evs) {
        const card = el('div', { class: `mapcard event ${this.selEvent === v.id ? 'sel' : ''}` });
        card.innerHTML = `<div class="o2" style="color:#ff6ad5">${esc(v.glyph)}</div><div><b>${esc(v.name)}</b><div class="dimt">Un solo uso · desaparece en ${v.left} día(s)</div></div><div class="dif" style="color:#ff6ad5">EVENTO</div>`;
        card.addEventListener('click', () => { this.selEvent = v.id; sfx.click(); this.render(); });
        L.body.append(card);
      }
      L.body.append(el('div', { class: 'h', text: 'ZONAS' }));
    }
    MAPS.forEach((m, i) => {
      const locked = !zoneOpen(S, i);
      const avg = (m.lvl[0] + m.lvl[1]) / 2;
      const card = el('div', { class: `mapcard ${i === this.selMap && !this.selEvent ? 'sel' : ''} ${locked ? 'locked' : ''}` });
      const zm = locked ? [] : C.zoneMods(i);
      const spHere = !locked && S.contracts.active.some((c) => c.special && c.zone === m.id && c.day === S.day);
      const jobHere = locked ? 0 : S.contracts.active.filter((c) => c.job && ST.CONTRACTS[c.id] && ST.CONTRACTS[c.id].zone === m.id).length;
      const zmHtml = zm.map((id) => `<span style="color:${MODIFIERS[id].color}" title="${esc(MODIFIERS[id].name)}">${MODIFIERS[id].glyph}</span>`).join(' ') + (spHere ? ' <span style="color:#ffd23f" title="Encargo especial de hoy">◎</span>' : '') + (jobHere ? ` <span class="cyan" title="Trabajo de la bolsa en esta zona">⚑${jobHere > 1 ? jobHere : ''}</span>` : '');
      card.innerHTML = `<div class="o2">${locked ? '▒' : m.stratum === 'sup' ? '◆' : m.social ? '☭' : '▼'}</div><div><b>${locked ? '???' : m.name}</b><div class="dimt">${locked ? `Extrae con éxito de ${m.req.map((r) => MAPS.find((z) => z.id === r).short).join(' o ')}` : STRATA[m.stratum] + ' · ' + floorsFor(i) + ' piso(s) · ' + (S.cleared[m.id] || 0) + ' extracciones'}</div>${zmHtml ? `<div class="zone-mods">${zmHtml}</div>` : ''}</div><div class="dif" style="color:${diffColor(avg)}">Nv ${m.lvl[0]}–${m.lvl[1]}<br>${skulls(avg)}</div>`;
      if (!locked) card.addEventListener('click', () => { this.selMap = i; this.selEvent = null; sfx.click(); this.render(); });
      L.body.append(card);
    });
    const evSel = this.selEvent ? S.eventZones.find((z) => z.id === this.selEvent) : null;
    const m = evSel ? eventDef(evSel) : MAPS[this.selMap];
    // el mapa de la región es lo principal: ocupa casi todo el panel, centrado y escalado para caber sin scroll
    const M = panel({ title: (evSel ? '! ' : '') + m.name.toUpperCase(), bodyCls: 'exp-main-body' });
    const fit = el('div', { class: 'region-fit' });
    fit.append(regionMap(S, this.selEvent || this.selMap, (i) => {
      if (typeof i === 'number') { this.selMap = i; this.selEvent = null; } else this.selEvent = i.id;
      sfx.click(); this.render();
    }, evs));
    M.body.append(fit);
    requestAnimationFrame(() => fitRegionMap(fit));
    if (this._fitRO) this._fitRO.disconnect();
    this._fitRO = new ResizeObserver(() => fitRegionMap(fit));
    this._fitRO.observe(fit);
    // franja de información: lo detallado (chebylitas, botín, plano, condiciones) va en rollovers
    const avg = (m.lvl[0] + m.lvl[1]) / 2;
    const rw = rarityWeights(avg);
    const tot = rw.reduce((a, b) => a + b, 0);
    const chip = (html, tt, cls = '') => { const c = el('span', { class: 'zchip ' + cls, html }); tip(c, tt); return c; };
    const known = m.enemies.filter((id) => S.bestiary[id]).length;
    const enemiesTip = () => `<div class="tt-title">CHEBYLITAS DETECTADOS</div>${m.enemies.map((id) => { const d = ENEMIES[id]; const k = S.bestiary[id]; return `<div><span style="color:${enemyColor(d.hue, Math.min(10, Math.max(d.minL, m.lvl[1])))};font-weight:700;display:inline-block;width:2ch">${esc(d.glyph)}</span>${k ? esc(d.name) : '???'}${d.boss ? ' <span class="bad">☠ jefe</span>' : ''}${k && k.kills ? ` <span class="dimt">· ${k.kills} abatidos</span>` : ''}</div>`; }).join('')}<div class="dimt">Las especies no catalogadas aparecen como ???.</div>`;
    const lootTip = () => `<div class="tt-title">BOTÍN ESPERADO</div>${RARITIES.map((r, i) => `<div class="tt-row"><span style="color:${r.color}">${esc(r.name)}</span><span>${((rw[i] / tot) * 100).toFixed(rw[i] / tot < 0.01 ? 2 : 0)}%</span></div>`).join('')}<div class="dimt">Vetas ${m.veins.join('–')} · alijos ${m.caches.join('–')} por piso.</div>`;
    const planTip = () => `<div class="tt-title">PLANO</div><pre class="ascii-art" style="margin:0">${esc(mapSchematic(evSel ? mapIndex(EVENT_ZONES[evSel.kind].base) : this.selMap))}</pre>`;
    const zm = evSel ? [] : C.zoneMods(this.selMap);
    // trabajos de la bolsa que se hacen en esta zona
    const zoneJobs = evSel ? [] : S.contracts.active.filter((c) => c.job && ST.CONTRACTS[c.id] && ST.CONTRACTS[c.id].zone === m.id).map((c) => ST.CONTRACTS[c.id]);
    const jobsTip = () => `<div class="tt-title">TRABAJOS EN ESTA ZONA</div>${zoneJobs.map((d) => `<div><b class="cyan">⚑ ${esc(d.name)}</b></div><div class="dimt">${esc(d.desc)}</div>`).join('')}`;
    const condTip = () => { const b = evSel ? el('div', { class: 'warn', text: 'Zona de evento: un solo uso y sin modificadores.' }) : this.modsBox(this.selMap); return b.outerHTML; };
    const strip = el('div', { class: 'zone-strip' },
      el('div', { class: 'msg-topolev zone-desc', text: m.desc }),
      evSel ? el('div', { class: 'warn', html: `Zona de evento: <b>un solo uso</b> y sin modificadores. Desaparece en ${Math.max(1, evSel.left - 1)} día(s). Terreno parecido a ${esc(MAPS[mapIndex(EVENT_ZONES[evSel.kind].base)].name)}.` }) : '',
      el('div', { class: 'zone-chips' },
        el('span', { class: 'zchip', html: `<span style="color:${diffColor(avg)}">Nv <b>${m.lvl[0]}–${m.lvl[1]}</b> ${skulls(avg)}</span>` }),
        el('span', { class: 'zchip', html: `${m.w}×${m.h} · ${m.sx * m.sy} sectores` }),
        el('span', { class: 'zchip', html: `☢ ${m.ambientRad ? m.ambientRad.toFixed(2) : 'baja'}` }),
        el('span', { class: 'zchip', html: `▲ nidos ${m.nests[0]}–${m.nests[1]}` }),
        chip(`◎ CONDICIONES ${zm.length ? zm.map((id) => `<span style="color:${MODIFIERS[id].color}">${MODIFIERS[id].glyph}</span>`).join('') : '<span class="dimt">normales</span>'}`, condTip, zm.length ? 'tt-chip hot' : 'tt-chip'),
        chip(`☣ CHEBYLITAS <span class="dimt">${known}/${m.enemies.length}</span>`, enemiesTip, 'tt-chip'),
        chip('■ BOTÍN', lootTip, 'tt-chip'),
        chip('▤ PLANO', planTip, 'tt-chip'),
        ...(zoneJobs.length ? [chip(`<span class="cyan">⚑ TRABAJOS ${zoneJobs.length}</span>`, jobsTip, 'tt-chip')] : []),
      ),
      el('div', { class: 'zone-go' },
        el('button', { class: 'btn primary big', 'data-go': '1', onclick: () => this.squadModal() }, `▶ ACEPTAR DESTINO: ${m.name.toUpperCase()}`),
        el('span', { class: 'dimt', text: 'Después eliges el escuadrón.' })),
    );
    M.body.append(strip);
    g.append(L, M);
    return g;
  }

  // selección del escuadrón tras aceptar el destino
  squadModal() {
    const evSel = this.selEvent ? S.eventZones.find((z) => z.id === this.selEvent) : null;
    const m = evSel ? eventDef(evSel) : MAPS[this.selMap];
    const body = el('div', { class: 'squad-pick', style: { minWidth: 'min(70ch, 92vw)' } });
    let close;
    const draw = () => {
      body.innerHTML = '';
      body.append(el('div', { class: 'dimt', text: `Destino: ${m.name} (Nv ${m.lvl[0]}–${m.lvl[1]}). Selecciona los agentes que bajarán (máximo ${C.squadCap()}). Si mueren, se pierde todo lo que lleven.` }), el('div', { class: 'sep', text: '─'.repeat(70) }));
      for (const a of S.agents) {
        const on = this.squad.has(a.id);
        const warn = this.agentWarnings(a);
        const sick = NARR.sickDays(a);
        const row = this.agentRow(a, ` <span class="chk">${sick ? `<span class="bad">enfermo ${sick} d</span>` : on ? '[■]' : '[ ]'}</span>`, () => {
          if (sick) { toast(`${a.nick} tiene fiebre: no puede bajar a la Zona en ${sick} día(s).`, 'bad'); sfx.error(); return; }
          if (on) this.squad.delete(a.id);
          else if (this.squad.size < C.squadCap()) this.squad.add(a.id);
          else { toast(`Máximo ${C.squadCap()} agentes (mejora los Barracones).`, 'bad'); sfx.error(); return; }
          sfx.click(); draw();
        });
        row.classList.toggle('sel', on);
        body.append(row);
        if (warn.length) body.append(el('div', { class: 'warn', style: { paddingLeft: '3ch', fontSize: '12px' }, text: '⚠ ' + warn.join(' · ') }));
      }
      const can = this.squad.size > 0;
      body.append(el('div', { class: 'sep', text: '─'.repeat(70) }),
        el('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap' } },
          el('span', { class: 'h', text: `ESCUADRÓN ${this.squad.size}/${C.squadCap()}` }),
          el('button', { class: 'btn primary ' + (can ? '' : 'disabled'), style: { fontSize: '15px' }, onclick: () => { if (!can) { toast('Selecciona al menos un agente.', 'bad'); sfx.error(); return; } close(); this.launch(); } }, '☢ LANZAR EXPEDICIÓN')),
        el('div', { class: 'dimt', style: { marginTop: '6px' }, text: S.modules.polvorin ? `El polvorín entrega ${S.modules.polvorin} cargador(es) extra por arma.` : 'Consejo: lleva munición, vendas y antirrad en la mochila.' }));
    };
    draw();
    close = modal({ title: `ESCUADRÓN · ${m.name.toUpperCase()}`, body, width: 'min(80ch, 94vw)', actions: [{ label: 'VOLVER' }] });
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
    const evId = this.selEvent;
    this.selEvent = null;
    this.hooks.onLaunch(this.selMap, agents, evId);
  }

  // =========================================================== RADIO (fase 18: facciones y reputación)
  tab_radio() {
    const g = el('div', { class: 'grid3' });
    const facs = [...COMBAT_FACTIONS, 'kgb'];
    if (!this.selFac || !FACTIONS[this.selFac]) this.selFac = 'rda';
    const met = S.met || {};
    const L = panel({ title: 'SALA DE RADIO · FACCIONES', bodyCls: 'scroll' });
    L.body.append(el('div', { class: 'dimt', text: 'Reputación de −100 a +100. Atacar, robar o apuntar a alguien la baja; ayudar, comerciar y cumplir encargos la sube.' }), el('div', { class: 'sep', text: '─'.repeat(60) }));
    for (const f of facs) {
      const F = FACTIONS[f], v = repOf(S, f), lv = repLevel(v);
      const known = met[f] || f === 'kgb' || f === 'rda';
      const att = F.combat === false ? null : squadAttitude(S, f);
      const card = el('div', { class: `mapcard fac-card ${this.selFac === f ? 'sel' : ''}` });
      card.innerHTML = `<div class="o2" style="color:${F.color}">${known ? '■' : '?'}</div><div><b style="color:${F.color}">${known ? esc(F.name) : '???'}</b><div class="dimt">${esc(F.country)}${att ? ` · <span class="${ATTITUDE_CLASS[att]}">${ATTITUDE_TEXT[att]}</span>` : ''}</div><div class="repbar">${repBar(v)}</div></div><div class="dif ${lv.cls}">${v > 0 ? '+' : ''}${v}<br>${lv.name}</div>`;
      card.addEventListener('click', () => { this.selFac = f; sfx.click(); this.render(); });
      L.body.append(card);
    }
    const f = this.selFac, F = FACTIONS[f], v = repOf(S, f), lv = repLevel(v);
    const known = met[f] || f === 'kgb' || f === 'rda';
    const M = panel({ title: known ? F.name.toUpperCase() : 'FACCIÓN SIN CONTACTO', bodyCls: 'scroll' });
    M.body.append(
      el('div', { class: 'kv', html: `<span>País</span><span>${esc(F.country)}</span><span>Reputación</span><span class="${lv.cls}"><b>${v > 0 ? '+' : ''}${v}</b> · ${lv.name}</span>${F.combat === false ? '' : `<span>Postura</span><span class="${ATTITUDE_CLASS[squadAttitude(S, f)]}">${ATTITUDE_TEXT[squadAttitude(S, f)]}</span>`}` }),
      el('div', { class: 'repbar big', html: repBar(v, 40) }),
      el('div', { class: 'msg-topolev', text: known ? F.desc : 'Todavía no os habéis cruzado con ellos. Las otras expediciones aparecen en las zonas según su región y peligrosidad.' }),
    );
    if (known && F.offers) M.body.append(el('div', { html: `<span class="dimt">Qué ofrecen:</span> ${esc(F.offers)}` }));
    M.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'UMBRALES' }));
    for (const l of REP_LEVELS) M.body.append(el('div', { class: l.id === lv.id ? 'sel' : '', html: `<span class="${l.cls}">${l.id === lv.id ? '►' : ' '} ${l.name}</span> <span class="dimt">desde ${l.min}</span>` }));
    M.body.append(el('div', { class: 'dimt', style: { marginTop: '.5em' }, text: F.combat === false ? 'El Directorio 9 no combate. Le gustan los informes; le disgusta que comerciéis con extranjeros que no son del Pacto.' : f === 'usa' || f === 'uk' || f === 'culto' ? 'Hostiles a la vista: solo dejarían de disparar con una reputación excepcional.' : F.negotiable ? 'Negociables: con reputación 0 o más se apartan; con 50, colaboran.' : F.bloc === 'varsovia' ? 'Del Pacto de Varsovia: desde «Amistosa» luchan a vuestro lado; por debajo de −15 desconfían, por debajo de −50 disparan.' : 'Neutrales: con «Aliada» luchan a vuestro lado; si los atacáis, se vuelven hostiles toda la expedición.' }));
    if (known && SQUADS[f]) {
      M.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: 'PERSONAL AVISTADO' }));
      for (const [type] of SQUADS[f]) { const h = HUMANS[type]; M.body.append(el('div', { html: `<span style="color:${F.color};font-weight:700">@</span> ${esc(h.name)} <span class="dimt">· ${esc(h.weapon ? ITEMS[h.weapon].name : 'sin arma')}</span><div class="dimt" style="padding-left:2ch">${esc(h.lore)}</div>` })); }
    }
    // KGB: entrega de informes
    const R = panel({ title: 'DIRECTORIO 9 · INFORMES', bodyCls: 'scroll' });
    const kv = repOf(S, 'kgb');
    R.body.append(
      el('div', { class: 'msg-topolev', text: '«Camarada director: cualquier documento extranjero, diario o registro de vuelo es propiedad del Estado. El Estado sabe ser agradecido.» — Mayor Volkov, KGB' }),
      el('div', { class: 'kv', html: `<span>Confianza del KGB</span><span class="${repLevel(kv).cls}">${kv > 0 ? '+' : ''}${kv} · ${repLevel(kv).name}</span><span>Informes entregados</span><span>${S.kgbReports || 0}</span><span>Tratos con extranjeros</span><span class="${(S.foreignTrade || 0) ? 'warn' : ''}">${S.foreignTrade || 0}</span>` }),
      el('div', { class: 'sep', text: '─'.repeat(60) }),
    );
    const wants = C.kgbStash();
    if (!wants.length) R.body.append(el('div', { class: 'dimt', text: 'No hay en el almacén nada que interese al KGB (informes de inteligencia, documentos, cajas negras, diarios extranjeros, reliquias).' }));
    for (const it of wants) {
      const p = C.kgbPrice(it);
      const row = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: itemHTML(it) }), el('button', { class: 'btn small', onclick: () => { const got = C.kgbDeliver(it); sfx.buy(); toast(`Entregado al KGB: +${got} ₽ y +3 de confianza.`, 'good'); save(); this.render(); this.pulseRes('rub'); } }, `ENTREGAR · ${p} ₽`));
      tip(row, () => itemTooltip(it));
      R.body.append(row);
    }
    if (kv <= -25) R.body.append(el('div', { class: 'bad', style: { marginTop: '1em' }, text: '⚠ El KGB desconfía del puesto: espera la visita de un comisario.' }));
    else if (kv >= 50) R.body.append(el('div', { class: 'good', style: { marginTop: '1em' }, text: '★ El KGB confía en el puesto: paga mejor los informes y envía fondos de vez en cuando.' }));
    g.append(L, M, R);
    return g;
  }

  // =========================================================== GARAJE (fase 19: compañeros mecánicos)
  tab_garaje() {
    const g = el('div', { class: 'grid3' });
    const lvl = C.garageLvl();
    // compañeros: equipados por agentes y en el almacén
    const list = [];
    for (const a of S.agents) if (a.equip.comp) list.push({ it: a.equip.comp, a });
    for (const it of S.stash) if (ITEMS[it.b].cat === 'companion') list.push({ it, a: null });
    if (this.selComp && !list.some((x) => x.it === this.selComp)) this.selComp = null;
    if (!this.selComp && list.length) this.selComp = list[0].it;
    const L = panel({ title: 'COMPAÑEROS', bodyCls: 'scroll' });
    L.body.append(this.staffBox('babai'));
    if (!list.length) L.body.append(el('div', { class: 'dimt', text: lvl ? 'No tenéis ningún compañero. Compradlo en la tienda del garaje.' : 'Construid el Garaje (pestaña LABORATORIO) para comprar el perro robot y los drones.' }));
    for (const { it, a } of list) {
      const d = ITEMS[it.b];
      const max = C.compMaxHp(it, a), hp = C.compHp(it, a);
      const card = el('div', { class: `mapcard ${this.selComp === it ? 'sel' : ''}` });
      card.innerHTML = `<div class="o2" style="color:${d.kind === 'dog' ? '#5fd0ff' : '#9fe8ff'}">${esc(d.glyph)}</div><div><b>${esc(d.name)}</b><div class="dimt">${a ? `con ${esc(a.nick)}` : 'en el almacén'}${d.kind === 'dog' ? ` · ${(it.dmods || []).length}/${d.modSlots} módulos` : ''}</div></div><div class="dif">${it.broken ? '<span class="bad">ROTO</span>' : max ? `${hp}/${max}` : ''}</div>`;
      card.addEventListener('click', () => { this.selComp = it; sfx.click(); this.render(); });
      L.body.append(card);
    }
    L.body.append(el('div', { class: 'sep', text: '─'.repeat(60) }), el('div', { class: 'dimt', text: `Se equipan en la ranura COMPAÑERO de cada agente (pestaña EQUIPO). En expedición: tecla ${keyName('companion')} para lanzar drones o dar órdenes al perro.` }));
    // detalle
    const it = this.selComp;
    const M = panel({ title: it ? ITEMS[it.b].name.toUpperCase() : 'TALLER', bodyCls: 'scroll' });
    if (it) {
      const d = ITEMS[it.b];
      const owner = S.agents.find((a) => a.equip.comp === it) || null;
      M.body.append(el('pre', { class: 'ascii-art', text: d.kind === 'dog' ? DOG_ART : DRONE_ART }), el('div', { class: 'msg-topolev', text: d.desc }));
      const max = C.compMaxHp(it, owner);
      if (max) M.body.append(el('div', { class: 'kv', html: `<span>Estado</span><span>${it.broken ? '<span class="bad">CHASIS DESTRUIDO</span>' : `${hpBar(C.compHp(it, owner), max, 16)} ${C.compHp(it, owner)}/${max}`}</span>${d.armor != null ? `<span>Blindaje</span><span>${d.armor + (it.dmods || []).reduce((n, m) => n + (ITEMS[m.b].armor || 0), 0)}</span>` : ''}${d.cargo ? `<span>Carga</span><span>${d.cargo} huecos</span>` : ''}${owner && talentFlag(owner, 'mechanic') ? '<span>Mecánico</span><span class="good">+30% salud y daño</span>' : ''}` }));
      const rc = C.repairCost(it, owner);
      if (rc) M.body.append(el('button', { class: 'btn primary', onclick: () => { const r = C.repairComp(it, owner); if (r.ok) { sfx.upgrade(); toast('Reparado.', 'good'); this.render(); this.pulseRes('rub'); } else { sfx.error(); toast(r.msg, 'bad'); } } }, `REPARAR · ${rc.rub} ₽${rc.parts ? ` + ${rc.parts} piezas` : ''}`));
      if (d.kind === 'dog') {
        M.body.append(el('div', { class: 'sep', text: '─'.repeat(80) }), el('div', { class: 'h', text: `MÓDULOS (${(it.dmods || []).length}/${d.modSlots})` }));
        for (const m of it.dmods || []) M.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: `¬ <b>${esc(ITEMS[m.b].name)}</b> <span class="dimt">${esc(ITEMS[m.b].desc)}</span>` }), el('button', { class: 'btn small', onclick: () => { const r = C.removeDogMod(it, m); if (r.ok) { sfx.click(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, 'QUITAR')));
        const mods = S.stash.filter((x) => ITEMS[x.b].cat === 'dogmod');
        if (mods.length && (it.dmods || []).length < d.modSlots) {
          M.body.append(el('div', { class: 'dimt', text: 'Módulos en el almacén:' }));
          for (const m of mods) M.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: `¬ ${esc(ITEMS[m.b].name)}` }), el('button', { class: 'btn small', onclick: () => { const r = C.installDogMod(it, m); if (r.ok) { sfx.upgrade(); toast('Módulo instalado.', 'good'); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, 'INSTALAR')));
        }
      }
    } else M.body.append(el('pre', { class: 'ascii-art', text: DOG_ART }), el('div', { class: 'msg-topolev', text: '«La Academia de Ciencias nos ha prestado un prototipo. Lo llaman Laika-M. Os pido que lo traigáis de vuelta… aunque sea en piezas.» — Dr. A. Topolev' }));
    // tienda
    const R = panel({ title: `TIENDA DEL GARAJE · NIVEL ${lvl}`, bodyCls: 'scroll' });
    if (!lvl) R.body.append(el('div', { class: 'warn', text: 'Sin garaje. Constrúyelo en la pestaña LABORATORIO (módulos de la base).' }));
    for (const b of C.garageStock()) {
      const d = ITEMS[b];
      const row = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: `<span class="o2">${esc(d.glyph)}</span> ${esc(d.name)} <span class="dimt">· ${CAT_INFO[d.cat].name}</span>` }), el('button', { class: 'btn small ' + (S.rub >= d.value ? '' : 'disabled'), onclick: () => { const r = C.garageBuy(b); if (r.ok) { sfx.buy(); toast(`Comprado: ${esc(d.name)}`, 'good'); this.selComp = d.cat === 'companion' ? r.it : this.selComp; this.render(); this.pulseRes('rub'); } else { sfx.error(); toast(r.msg, 'bad'); } } }, `${d.value} ₽`));
      tip(row, () => `<div class="tt-title">${esc(d.name)}</div><div>${esc(d.desc)}</div>`);
      R.body.append(row);
    }
    const next = Object.keys(ITEMS).filter((b) => ITEMS[b].garage > lvl);
    if (next.length) R.body.append(el('div', { class: 'dimt', style: { marginTop: '1em' }, text: `Mejorando el garaje: ${next.map((b) => ITEMS[b].name).join(', ')}.` }));
    g.append(L, M, R);
    return g;
  }

  // =========================================================== ARCHIVO
  tab_archivo() {
    const g = el('div', { class: 'grid3' });
    const L = panel({ title: 'BESTIARIO CHEBYLITA', bodyCls: 'scroll' });
    for (const [id, d] of Object.entries(ENEMIES)) {
      const b = S.bestiary[id];
      const r = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr' } });
      if (b) r.innerHTML = `<div class="mg" style="color:${enemyColor(d.hue, 7)}">${d.glyph}</div><div><b>${d.name}</b>${d.boss ? ' <span class="bad">☠</span>' : ''} <span class="dimt">· ${d.origin} · ${b.kills} abatidos</span>${S.photos && S.photos[id] ? ' <span class="cyan" title="Fotografiado con la Zenit-E: +10% de daño contra su especie">📷 +10%</span>' : ''}${S.captured && S.captured[id] ? ` <span class="good" title="Ejemplares capturados vivos">#${S.captured[id]}</span>` : ''}<div class="eff">${esc(d.lore)}</div><div class="eff">${d.abil.map((a) => ABIL_TEXT[a]).join(' · ') || 'Sin habilidades especiales'} · Nv ${d.minL}–${d.maxL}</div></div>`;
      else r.innerHTML = `<div class="mg o4">?</div><div><b class="o4">??????</b><div class="eff">Especie no catalogada.</div></div>`;
      L.body.append(r);
    }
    const M = panel({ title: 'MEMORIAL DE LOS CAÍDOS', bodyCls: 'scroll' });
    if (!S.fallen.length) M.body.append(el('div', { class: 'dimt', text: 'Nadie ha caído... todavía.' }));
    for (const f of S.fallen) {
      const row = el('div', { html: `✝ <b>${esc(f.name)}</b> <span class="dimt">Nv ${f.lvl}</span><div class="dimt" style="padding-left:2ch">Día ${f.day} · ${esc(f.map)} · ${esc(f.cause)} · ${f.kills} bajas</div>${f.epitaph ? `<div class="epitaph">«${esc(f.epitaph)}»</div>` : ''}` });
      if (f.letter) tip(row, () => `<div class="tt-title">Última carta de ${esc(f.name)}</div><div class="tt-lore">${esc(f.letter)}</div><div class="dimt">Encontrada en su taquilla.</div>`);
      M.body.append(row);
    }
    const R = panel({ title: 'COLECCIONES · ESTADÍSTICAS', bodyCls: 'scroll' });
    for (const [cid, col] of Object.entries(COLLECTIONS)) {
      const p = ST.collectionProgress(cid);
      const done = S.colsDone && S.colsDone[cid];
      const row = el('div', { class: 'module', style: { gridTemplateColumns: '3ch 1fr auto', cursor: 'pointer' }, html: `<div class="mg ${done ? 'good' : 'o4'}">${done ? '✓' : '?'}</div><div><b>${esc(col.name)}</b><div class="eff">${esc(col.desc)}</div></div><div class="${done ? 'good' : 'dimt'}">${p.read}/${p.total}</div>` });
      row.addEventListener('click', () => {
        const read = p.idx.filter((i) => S.notesRead[i]);
        modal({ title: col.name.toUpperCase(), width: 'min(80ch, 92vw)', body: read.length ? read.map((i) => `<div class="note-entry"><div>${esc(NOTES[i].t)}</div><div class="dimt" style="text-align:right">— ${esc(NOTES[i].a)}</div></div>`).join('') + (p.read < p.total ? `<div class="dimt">Faltan ${p.total - p.read} nota(s). Se encuentran en el suelo de las zonas (glifo ?).</div>` : '') : '<div class="dimt">Todavía no habéis encontrado ninguna nota de esta colección.</div>', actions: [{ label: 'CERRAR' }] });
      });
      R.body.append(row);
    }
    R.body.append(el('div', { class: 'sep', text: '─'.repeat(60) }));
    const st = S.stats;
    R.body.append(el('div', { class: 'kv', html: `<span>Días</span><span>${S.day}</span><span>Expediciones</span><span>${st.expeditions}</span><span>Extracciones</span><span>${st.extractions}</span><span>Chebylitas abatidos</span><span>${st.kills}</span><span>Agentes caídos</span><span>${st.deaths}</span><span>Esencia total</span><span>${fmt(st.essTotal)} ✦</span><span>Rublos ganados</span><span>${fmt(st.rubTotal)} ₽</span><span>Turnos bajo tierra</span><span>${fmt(st.turns)}</span><span>Mejor objeto</span><span>${st.bestItem ? `<span style="color:${rarityColor(st.bestItem.r)}">${esc(st.bestItem.name)}</span>` : '—'}</span>` }),
      el('div', { class: 'sep', text: '─'.repeat(60) }),
      el('button', { class: 'btn primary', onclick: () => this.hooks.onHelp() }, 'INSTRUCCIONES'),
      el('button', { class: 'btn', onclick: () => this.openChronicle() }, 'CRÓNICA DEL DIRECTOR'),
      el('button', { class: 'btn', onclick: () => achievementsModal() }, t('menu.achievements')),
      el('button', { class: 'btn', onclick: () => codexModal() }, t('menu.codex')),
    );
    g.append(L, M, R);
    return g;
  }

  openChronicle() {
    const txt = ST.chronicleText();
    const body = el('div', {}, el('pre', { class: 'chronicle', text: txt }));
    modal({ title: 'CRÓNICA DEL DIRECTOR', width: 'min(96ch, 94vw)', body, actions: [
      { label: 'EXPORTAR .TXT', cls: 'primary', fn: () => { const b = new Blob([txt], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b); const aEl = document.createElement('a'); aEl.href = u; aEl.download = `cronica-pripyat7-dia${S.day}.txt`; document.body.append(aEl); aEl.click(); aEl.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); return false; } },
      { label: 'CERRAR' },
    ] });
  }

  // =========================================================== MENÚ
  // fase 25: cambiar de Narrador a mitad de partida
  narratorModal() {
    const body = el('div', { style: { minWidth: 'min(60ch, 90vw)' } });
    let close;
    for (const [id, P] of Object.entries(NARR.PERSONAS)) {
      const cur = NARR.persona() === P;
      body.append(el('div', { class: 'module', style: { gridTemplateColumns: '4ch 1fr auto', marginBottom: '6px' } },
        el('div', { class: 'mg', style: { color: P.color }, text: P.glyph }),
        el('div', { html: `<b style="color:${P.color}">${esc(P.name)}</b><div class="eff">${esc(P.desc)}</div>` }),
        el('button', { class: 'btn small ' + (cur ? 'primary' : ''), 'data-narr': id, onclick: () => { if (!cur) { NARR.setPersona(id); save(); sfx.click(); toast(`Narrador: ${P.name}`, 'good'); } close(); this.render(); } }, cur ? 'ACTUAL' : 'ELEGIR')));
    }
    close = modal({ title: 'NARRADOR DEL REACTOR', body, actions: [{ label: 'CERRAR' }] });
  }
  openMenu() {
    if (modalOpen()) { closeTopModal(); return; }
    const body = el('div', { class: 'title-menu', style: { marginTop: 0 } });
    let close;
    const btn = (label, fn, cls = '') => el('button', { class: 'btn ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
    body.append(
      btn(t('menu.continue'), () => close()),
      btn(t('menu.save'), () => { if (save()) toast(t('menu.saved', { n: slot }), 'good'); else toast(t('menu.saveFail'), 'bad', 6000); close(); }),
      btn(t('menu.settings'), () => { close(); settingsModal({ after: () => { this.render(); this.openMenu(); } }); }),
      btn(`NARRADOR: ${NARR.persona().glyph} ${NARR.persona().name.toUpperCase()}`, () => { close(); this.narratorModal(); }),
      btn(t('menu.quit'), () => { save(); close(); this.close(); this.hooks.onQuit(); }, 'danger'),
    );
    close = modal({ title: t('menu.title'), body, width: '46ch' });
  }
}

// escala el mapa ASCII de la región para que quepa entero en su caja (sin scroll), centrado
function fitRegionMap(box) {
  const pre = box.querySelector('.region-map');
  const legend = box.querySelector('.region-legend');
  if (!pre || !box.isConnected) return;
  const W = box.clientWidth - 8, H = box.clientHeight - (legend ? legend.offsetHeight : 0) - 8;
  if (W <= 0 || H <= 0) return;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;line-height:1.05;white-space:pre';
  probe.textContent = 'MMMMMMMMMM';
  pre.append(probe);
  const cw = probe.getBoundingClientRect().width / 10 / 100, lh = 1.05;
  probe.remove();
  const fs = Math.max(8, Math.min(34, Math.floor(Math.min(W / (64 * cw), H / (22 * lh)) * 10) / 10));
  pre.style.fontSize = fs + 'px';
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
    // ---- fase 17 ----
    String.raw`   ▐█▌ ▐█▌   ,-○-.   ▐█▌
   ▐█▌ ▐█▌  ○  |  ○  ▐█▌   PRÍPIAT
   ▐█▌ ▐█▌   '-○-'   ▐█▌   LA NORIA
  ══════════════════════   HOSPITAL 126
   ▪ ▪ ▪   Ħ Ħ    ▪ ▪ ▪`,
    String.raw`  ♠ ♠♣ ♠  ♠ ♣♠ ♠  ♠ ♣
   ♣ ♠ ÷÷÷÷ ♠ ♠  ♣♠  ♠    BOSQUE ROJO
  ♠  ♣ ÷÷÷÷  ♠ ♣ ♠  ♠     FOSAS
   ♠ ♠  ♣ ♠  ♠♠  ♣ ♠ ♣
  ♣ ♠ ♠  ♠ ♣  ♠ ♠  ♠ ♠`,
    String.raw`  ╪═╪═╪═╪═╪═╪═╪═╪═╪═╪═
  [▒▒▒▒][▒▒▒▒][▒▒▒▒]▄▄█    YANOV
  ╪═╪═╪═╪═╪═╪═╪═╪═╪═╪═    VAGONES
  [▒▒▒▒]  [▒▒▒▒][▒▒▒▒]    DEPÓSITO
  ╪═╪═╪═╪═╪═╪═╪═╪═╪═╪═`,
    String.raw`   _/‾‾\_   _/‾‾\_   ▄▄▄
  [ Mi-8 ] [ Mi-8 ] [BTR]  RASSOKHA
   ‾‾‾‾‾‾   ‾‾‾‾‾‾   ▀▀▀   HELICÓPTEROS
  [ZIL][ZIL][ZIL][ZIL]     CAMIONES
   ☢    ☢     ☢     ☢`,
    String.raw`  ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
  ≈≈≈≈ ▪▪ ≈≈≈≈≈≈≈ ◡ ≈≈≈≈   ESTANQUE
  ≈≈≈≈≈≈≈≈≈ ▪▪▪ ≈≈≈≈≈≈≈   ISLOTES
  ≈≈ ʂ ≈≈≈≈≈≈≈≈≈≈≈ ʂ ≈≈   BARCAS
  ════════════ ≈≈≈≈≈≈≈`,
    String.raw`  ╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳
  ╳║║╳║║╳║║╳║║╳║║╳║║╳╳   DUGA-3
  ╳║║╳║║╳║║╳║║╳║║╳║║╳╳   ANTENA
  ╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳   ϟ CABLES ϟ
   ϟ    Ψ CONTROL Ψ   ϟ`,
    String.raw`  ┌────────────────────┐
  │ ☭  CAMPAMENTO  ☭   │   WISMUT
  │ [+] [$] [?] [≡]    │   RDA
  │  @   @    @   @    │   COMERCIO
  └────────────────────┘`,
    String.raw`  ════════════════════════
  ▒[▓▓▓▓▓▓]▒▒[▓▓▓▓▓▓]▒▒▒   METRO-2
  ════════════════════════   ANDÉN
  ▪▪▪▪▪▪ ▓ ESCLUSA ▓ ▪▪▪▪   OBJETO 4
  ════════════════════════`,
    String.raw`   ◉        ★        ◉
  ┌──Ŧ──────────────Ŧ──┐   FÉNIX
  │  ▬▬  [HQ]  ▬▬      │   EE. UU.
  │ ▄▄▄  ▄▄▄  ▄▄▄  ▄▄▄ │   ALARMAS
  └──Ŧ──────────────Ŧ──┘`,
    String.raw`  ┌──┬──┬──┬──┬──┐┌───┐
  │▓▓│▓▓│▓▓│▓▓│▓▓││ ? │   OBJETO 7
  ├──┴──┴──┴──┴──┤│KGB│   CELDAS
  │  ▣   ▣   ▣   │└───┘   ARCHIVO
  └──────────────┘`,
    String.raw`   ψ ~ ψ ~~ ψ ~ ψ ~~ ψ
  ~ ψ   ◦◦◦   ψ   ◦◦ ψ ~   LAS RAÍCES
   ψ  ◦◦ Ѱ ◦◦  ψ ◦◦  ψ     LAS PAREDES
  ~ ψ   ◦◦◦   ψ   ◦◦ ψ ~   RESPIRAN
   ψ ~ ψ ~~ ψ ~ ψ ~~ ψ`,
    String.raw`     ▄▄▓▓▓████▓▓▓▄▄
   ▄▓▓▒░  ▓▓▓▓  ░▒▓▓▄      EL ÚTERO
  ▓▓░ ░▒▓████▓▒░ ░░▓▓     DE CORIUM
   ▀▓▓▒░  ▓▓▓▓  ░▒▓▓▀      ☢ ☢ ☢
     ▀▀▓▓▓████▓▓▓▀▀`,
  ];
  return arts[i] || '';
}

installBase21(BaseUI);
