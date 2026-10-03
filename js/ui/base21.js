// Pestañas y paneles de la base viva (fase 21): plano de parcelas, investigación, fabricación, celda de contención,
// mercado negro y operaciones simultáneas. Se instalan como métodos de BaseUI.
import { el, esc, panel, toast, tip, confirmBox, modal, levelPips } from '../util/dom.js';
import { S, save } from '../core/state.js';
import { ITEMS } from '../data/items.js';
import { MAPS, MODULES, MODULE_MAX, moduleCost, zoneOpen } from '../data/world.js';
import { ENEMIES } from '../data/enemies.js';
import { PLOTS, PLOT_COLS, BUILD_ART, RESEARCH, RECIPES } from '../data/basedata.js';
import { itemHTML, itemTooltip, itemName } from '../core/items.js';
import * as C from '../core/campaign.js';
import * as B from '../core/basecore.js';
import { sfx } from '../audio.js';

const modDef = (id) => MODULES.find((m) => m.id === id);

export function installBase21(BaseUI) {
  Object.assign(BaseUI.prototype, {
    // ------------------------------------------------------------ plano de la base (CUARTEL)
    planView() {
      B.baseDefaults(S);
      const wrap = el('div', { class: 'base-plan' });
      const grid = el('div', { class: 'plan-grid', style: { gridTemplateColumns: `repeat(${PLOT_COLS}, 11ch)` } });
      for (let i = 0; i < PLOTS; i++) {
        const id = S.plots[i];
        const m = id ? modDef(id) : null;
        const lvl = id ? S.modules[id] || 0 : 0;
        const art = id ? BUILD_ART[id] || ['┌───────┐', `│   ${m.glyph}   │`, '└───────┘'] : ['· · · · ·', '·  libre ·', '· · · · ·'];
        const cell = el('div', { class: `plot ${id ? 'built' : 'empty'} ${this.selPlot === i ? 'sel' : ''}` }, el('pre', { text: art.join('\n') }), el('div', { class: 'plot-name', text: id ? `${m.name.slice(0, 11)} ${lvl}` : '' }));
        tip(cell, () => (id ? `<div class="tt-title">${esc(m.glyph)} ${esc(m.name)} · nivel ${lvl}</div><div>${esc(m.desc)}</div><div class="dimt">${esc(m.eff(lvl))}</div>` : '<div class="tt-title">Parcela libre</div><div class="dimt">Clic para construir aquí.</div>'));
        cell.addEventListener('click', () => { this.selPlot = i; sfx.click(); this.openPlot(i); });
        grid.append(cell);
      }
      const used = S.plots.filter(Boolean).length;
      wrap.append(grid, el('div', { class: 'dimt', text: `${used}/${PLOTS} parcelas ocupadas · ${MODULES.length} edificios posibles: no caben todos. Clic en una parcela para construir, mejorar o derribar.` }));
      return wrap;
    },
    openPlot(i) {
      const id = S.plots[i];
      const body = el('div');
      let close;
      const upgradeBtn = (mid) => {
        const lvl = S.modules[mid] || 0;
        if (lvl >= MODULE_MAX) return el('span', { class: 'dimt', text: 'Nivel máximo' });
        const c = moduleCost(mid, lvl);
        return el('button', { class: 'btn small ' + (S.ess >= c.ess && S.rub >= c.rub ? 'primary' : 'disabled'), onclick: () => {
          const r = C.upgradeModule(mid);
          // al construir, el edificio va a la parcela elegida
          if (r.ok && lvl === 0 && B.plotOf(mid) !== i && S.plots[i] == null) { S.plots[B.plotOf(mid)] = null; S.plots[i] = mid; }
          if (r.ok) { sfx.upgrade(); toast(`${modDef(mid).name} → nivel ${S.modules[mid]}`, 'good'); save(); close(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); }
        } }, `${lvl ? 'MEJORAR' : 'CONSTRUIR'} · ${c.ess}✦ ${c.rub}₽`);
      };
      if (id) {
        const m = modDef(id), lvl = S.modules[id] || 0;
        body.append(el('pre', { class: 'ascii-art', text: (BUILD_ART[id] || []).join('\n') }), el('div', { html: `<b>${esc(m.name)}</b> ${levelPips(lvl, MODULE_MAX)}` }), el('div', { class: 'dimt', text: m.desc }), el('div', { html: `Ahora: <span class="o1">${esc(m.eff(lvl))}</span>${lvl < MODULE_MAX ? `<br>Siguiente: <span class="good">${esc(m.eff(lvl + 1))}</span>` : ''}` }), el('div', { class: 'row', style: { gap: '1ch', marginTop: '.6em' } }, upgradeBtn(id),
          el('button', { class: 'btn small danger', onclick: async () => { if (!(await confirmBox('DERRIBAR', `¿Derribar ${esc(m.name)}? Se pierde todo su nivel (no se devuelve nada).`, 'DERRIBAR', 'NO'))) return; const r = B.demolish(id); if (r.ok) { save(); close(); this.render(); } else toast(r.msg, 'bad'); } }, 'DERRIBAR')));
      } else {
        body.append(el('div', { class: 'dimt', text: 'Elige qué construir en esta parcela:' }));
        for (const m of MODULES) {
          if (B.plotOf(m.id) >= 0) continue;
          body.append(el('div', { class: 'row', style: { justifyContent: 'space-between', margin: '.3em 0' } }, el('span', { html: `<span class="o2">${esc(m.glyph)}</span> <b>${esc(m.name)}</b> <span class="dimt">— ${esc(m.desc)}</span>` }), upgradeBtn(m.id)));
        }
      }
      close = modal({ title: id ? 'EDIFICIO' : `PARCELA ${i + 1}`, body, width: 'min(80ch, 94vw)', actions: [{ label: 'CERRAR' }] });
    },

    // ------------------------------------------------------------ INVESTIGACIÓN · FABRICACIÓN · CONTENCIÓN
    tab_investigacion() {
      B.baseDefaults(S);
      const g = el('div', { class: 'grid3' });
      // investigación
      const L = panel({ title: `INVESTIGACIÓN${S.resQueue ? ` · ${RESEARCH[S.resQueue.id].name.toUpperCase()} (${S.resQueue.left} d)` : ''}`, bodyCls: 'scroll' });
      if (!(S.modules.laboratorio > 0)) L.body.append(el('div', { class: 'warn', text: 'Hace falta construir el Laboratorio de esencia.' }));
      for (const [id, R] of Object.entries(RESEARCH)) {
        const st = B.researchState(id);
        const c = R.cost;
        const cost = [c.ess ? `${c.ess} ✦` : '', c.rub ? `${c.rub} ₽` : '', ...Object.entries(c.items || {}).map(([b, n]) => `${n}× ${ITEMS[b].name}`), c.specimen ? `${c.specimen} espécimen(es) vivo(s)` : ''].filter(Boolean).join(', ');
        const row = el('div', { class: `research ${st}` }, el('div', { html: `<span class="o2">${esc(R.glyph)}</span> <b>${esc(R.name)}</b> <span class="dimt">· ${R.days} d</span> ${st === 'done' ? '<span class="good">✓</span>' : st === 'running' ? '<span class="cyan">en curso</span>' : st === 'locked' ? `<span class="dimt">requiere: ${R.req.map((r) => RESEARCH[r].name).join(', ')}</span>` : ''}` }), el('div', { class: 'dimt', text: R.desc }), st === 'available' ? el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { class: 'eff', text: cost }), el('button', { class: 'btn small ' + (B.researchMissing(id).length || S.resQueue ? 'disabled' : 'primary'), onclick: () => { const r = B.startResearch(id); if (r.ok) { sfx.upgrade(); toast(`Investigando «${R.name}» (${r.days} días)`, 'good'); save(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, 'INVESTIGAR')) : '');
        L.body.append(row);
      }
      // fabricación
      const M = panel({ title: `TALLER DE FABRICACIÓN · NIVEL ${S.modules.taller_fab || 0}`, bodyCls: 'scroll' });
      const mats = ['chatarra', 'electronica', 'plomo', 'tejido', 'parts'].map((b) => `${ITEMS[b].name}: <b>${S.stash.filter((x) => x.b === b).reduce((n, x) => n + (x.q || 1), 0)}</b>`).join(' · ');
      M.body.append(el('div', { class: 'eff', html: mats }), el('div', { class: 'sep', text: '─'.repeat(70) }));
      for (const r of RECIPES) {
        const st = B.recipeState(r);
        const cost = [...Object.entries(r.cost).map(([b, n]) => `${n}× ${ITEMS[b].name}`), r.ess ? `${r.ess} ✦` : ''].filter(Boolean).join(', ');
        M.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between', margin: '.2em 0' } }, el('span', { html: `<b class="${st.ok ? '' : 'dimt'}">${esc(r.name)}</b> <span class="dimt">· ${esc(cost)}${st.ok ? '' : ` · ${esc(st.why)}`}</span>` }), el('button', { class: 'btn small ' + (st.ok ? 'primary' : 'disabled'), onclick: () => { const x = B.craft(r.id); if (x.ok) { sfx.buy(); toast(`Fabricado: ${esc(itemName(x.it))}`, 'good'); save(); this.render(); } else { sfx.error(); toast(x.msg, 'bad'); } } }, 'FABRICAR')));
      }
      // mejoras sobre objetos
      const drones = [...S.stash, ...S.agents.map((a) => a.equip.comp)].filter((x) => x && (ITEMS[x.b].drone === 'strizh' || ITEMS[x.b].drone === 'eco'));
      const cases = [...S.stash, ...S.agents.map((a) => a.equip.case)].filter((x) => x && ITEMS[x.b].cat === 'case');
      if (drones.length || cases.length) M.body.append(el('div', { class: 'sep', text: '─'.repeat(70) }), el('div', { class: 'h', text: 'INSTALAR MEJORAS' }));
      for (const d of drones) M.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: `${esc(itemName(d))} <span class="dimt">(+${d.batBonus || 0} de batería)</span>` }), el('button', { class: 'btn small', onclick: () => { const r = B.installUpgrade('battery', d); toast(r.ok ? 'Batería instalada (+20 turnos).' : r.msg, r.ok ? 'good' : 'bad'); if (r.ok) { save(); this.render(); } } }, 'BATERÍA')));
      for (const c of cases) M.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: `${esc(itemName(c))} <span class="dimt">(+${c.caseBonus || 0} huecos)</span>` }), el('button', { class: 'btn small', onclick: () => { const r = B.installUpgrade('plate', c); toast(r.ok ? 'Contenedor ampliado (+1 hueco).' : r.msg, r.ok ? 'good' : 'bad'); if (r.ok) { save(); this.render(); } } }, 'PLACA')));
      // desmontar
      M.body.append(el('div', { class: 'sep', text: '─'.repeat(70) }), el('div', { class: 'h', text: 'DESMONTAR (DEL ALMACÉN)' }));
      const scrappable = S.stash.filter((it) => Object.keys(B.scrapYield(it)).length && !['ammo', 'material', 'case'].includes(ITEMS[it.b].cat) && !(ITEMS[it.b].cat === 'companion' && !it.broken));
      if (!scrappable.length) M.body.append(el('div', { class: 'dimt', text: 'Nada que desmontar.' }));
      for (const it of scrappable.slice(0, 40)) {
        const y = B.scrapYield(it);
        const row = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: itemHTML(it) + ` <span class="dimt">→ ${Object.entries(y).map(([b, n]) => `${n} ${ITEMS[b].name.toLowerCase()}`).join(', ')}</span>` }), el('button', { class: 'btn small ' + (B.fabLvl() ? '' : 'disabled'), onclick: () => { const r = B.scrapItem(it); if (r.ok) { sfx.click(); save(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, 'DESMONTAR'));
        tip(row, () => itemTooltip(it));
        M.body.append(row);
      }
      // fase 23.5: reparar armas gastadas (almacén y equipo de los agentes)
      const worn = [...S.stash, ...S.agents.flatMap((a) => [a.equip.w1, a.equip.w2])].filter((it) => it && ITEMS[it.b].cat === 'weapon' && it.dur != null && it.dur < 100);
      M.body.append(el('div', { class: 'sep', text: '─'.repeat(70) }), el('div', { class: 'h', text: 'REPARAR ARMAS' }));
      if (!worn.length) M.body.append(el('div', { class: 'dimt', text: 'Todas las armas están en buen estado.' }));
      for (const it of worn.slice(0, 30)) {
        const row = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: itemHTML(it) + ` <span class="${it.dur >= 60 ? 'good' : it.dur >= 30 ? 'warn' : 'bad'}">${Math.round(it.dur)}%</span>` }),
          el('button', { class: 'btn small ' + (B.fabLvl() ? '' : 'disabled'), onclick: () => { const r = B.repairWeapon(it); if (r.ok) { sfx.buy(); toast(`Reparada (−${r.cost} chatarra).`, 'good'); save(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, `REPARAR · ${B.repairCost(it)} chatarra`));
        tip(row, () => itemTooltip(it));
        M.body.append(row);
      }
      // contención
      const R = panel({ title: `CELDA DE CONTENCIÓN · ${S.specimens.length}/${B.cellCap()}`, bodyCls: 'scroll' });
      R.body.append(el('pre', { class: 'ascii-art', text: '  ╔═╦═╦═╦═╗\n  ║#║ ║#║ ║\n  ╚═╩═╩═╩═╝' }), el('div', { class: 'dimt', text: 'Cada espécimen produce esencia todos los días. Cuanto mejor la celda, menos fugas.' }));
      if (!B.cellCap()) R.body.append(el('div', { class: 'warn', text: 'Construye la Celda de contención en el plano de la base.' }));
      S.specimens.forEach((sp, i) => {
        const nm = ENEMIES[sp.species] ? ENEMIES[sp.species].name : sp.species;
        R.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: `# <b>${esc(nm)}</b> <span class="dimt">Nv ${sp.lvl} · desde el día ${sp.since} · ${1 + Math.floor(sp.lvl / 2) + (B.hasRes('r_contencion') ? 1 : 0)} ✦/día</span>` }), el('button', { class: 'btn small', onclick: async () => { if (await confirmBox('SACRIFICAR', `¿Sacrificar el espécimen? Se obtiene tejido chebylita.`, 'SÍ', 'NO')) { B.releaseSpecimen(i); save(); this.render(); } } }, 'SACRIFICAR')));
      });
      const cages = S.stash.filter((it) => it.b === 'cagefull');
      if (cages.length) R.body.append(el('div', { class: 'sep', text: '─'.repeat(60) }), el('div', { class: 'h', text: 'JAULAS EN EL ALMACÉN' }));
      for (const it of cages) R.body.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: itemHTML(it) + ` <span class="dimt">${esc(ENEMIES[it.species] ? ENEMIES[it.species].name : '')}</span>` }), el('button', { class: 'btn small ' + (S.specimens.length < B.cellCap() ? 'primary' : 'disabled'), onclick: () => { const r = B.storeSpecimen(it); if (r.ok) { sfx.click(); save(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, 'A LA CELDA')));
      g.append(L, M, R);
      return g;
    },

    // ------------------------------------------------------------ mercado negro (INTENDENCIA)
    blackMarketBox() {
      const box = el('div', { class: 'bm-box' });
      box.append(el('div', { class: 'h', text: 'TRASTIENDA DEL SARGENTO KRAVETS' }), el('div', { class: 'dimt', text: 'Paga mejor y vende lo que no hay en la intendencia… pero cada trato tiene un 8% de riesgo de que el KGB lo descubra.' }));
      const bm = B.blackMarket();
      for (const it of bm.items) {
        const p = B.bmBuyPrice(it);
        const row = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: itemHTML(it) }), el('button', { class: 'btn small ' + (S.rub >= p ? '' : 'disabled'), onclick: () => { const r = B.bmBuy(it); if (r.ok) { sfx.buy(); toast(r.caught || `Comprado en la trastienda: −${r.price} ₽`, r.caught ? 'bad' : 'good'); save(); this.render(); } else { sfx.error(); toast(r.msg, 'bad'); } } }, `${p} ₽`));
        tip(row, () => itemTooltip(it));
        box.append(row);
      }
      const sellable = S.stash.filter((it) => ['valuable', 'weapon', 'gadget'].includes(ITEMS[it.b].cat)).slice(0, 12);
      if (sellable.length) box.append(el('div', { class: 'dimt', style: { marginTop: '.5em' }, text: 'Kravets compra (precio de trastienda):' }));
      for (const it of sellable) {
        const p = B.bmSellPrice(it);
        const row = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { html: itemHTML(it) + (B.demandK(it.b) < 1 ? ` <span class="warn" title="Habéis vendido mucho de esto últimamente">▼${Math.round(B.demandK(it.b) * 100)}%</span>` : '') }), el('button', { class: 'btn small', onclick: () => { const r = B.bmSell(it); if (r.ok) { sfx.buy(); toast(r.caught || `Vendido: +${r.price} ₽`, r.caught ? 'bad' : 'good'); save(); this.render(); } } }, `+${p} ₽`));
        tip(row, () => itemTooltip(it));
        box.append(row);
      }
      return box;
    },

  });
}
