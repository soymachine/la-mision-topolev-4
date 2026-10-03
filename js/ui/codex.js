// ENCICLOPEDIA dentro del juego (fase 24.8): solo muestra lo descubierto en la partida.
// Chebylitas vistos (S.bestiary), objetos encontrados (S.seenItems), zonas abiertas, facciones conocidas (S.met),
// notas leídas (S.notesRead) y trofeos conseguidos; lo demás sale como «???». Con búsqueda y enlaces cruzados.
// Los trozos que comparte con la documentación (admin.js) están en util/codexlines.js.
import { el, modal } from '../util/dom.js';
import { S } from '../core/state.js';
import { ENEMIES, ABIL_TEXT, enemyColor } from '../data/enemies.js';
import { ITEMS, CAT_INFO } from '../data/items.js';
import { MAPS, STRATA, zoneOpen } from '../data/world.js';
import { FACTIONS, repOf, repLevel } from '../data/factions.js';
import { NOTES } from '../data/lore.js';
import { escHTML as esc, ecoLines, zonesOf } from '../util/codexlines.js';

export const CODEX_SECTIONS = [
  { id: 'chebylitas', name: 'CHEBYLITAS' },
  { id: 'objetos', name: 'OBJETOS' },
  { id: 'zonas', name: 'ZONAS' },
  { id: 'facciones', name: 'FACCIONES' },
  { id: 'notas', name: 'NOTAS' },
  { id: 'trofeos', name: 'TROFEOS' },
];
const UNK = '<span class="o4">???</span>';
const link = (sec, id, txt) => `<a class="cx-link" data-sec="${sec}" data-id="${esc(id)}">${txt}</a>`;

// ---------------------------------------------------------------- qué se conoce
const seenEnemy = (id) => !!(S.bestiary && S.bestiary[id]);
const seenItem = (id) => !!(S.seenItems && S.seenItems[id]);
const zoneKnown = (id) => { const i = MAPS.findIndex((m) => m.id === id); return i >= 0 && zoneOpen(S, i); };
const factionKnown = (id) => id === 'chebylitas' || id === 'kgb' || !!(S.met && S.met[id]);
const enemyName = (id) => (seenEnemy(id) ? link('chebylitas', id, esc(ENEMIES[id].name)) : UNK);
const zoneName = (id) => (zoneKnown(id) ? link('zonas', id, esc(MAPS.find((m) => m.id === id).name)) : UNK);

// cada sección: lista de { id, known, name (texto para buscar), html }
function entries(sec) {
  if (sec === 'chebylitas') {
    return Object.entries(ENEMIES).map(([id, d]) => {
      const known = seenEnemy(id);
      if (!known) return { id, known, name: '', html: `<div class="cx-h"><span class="o4">?</span> ???</div><div class="eff">Especie no catalogada.</div>` };
      const b = S.bestiary[id];
      return { id, known, name: d.name, html: `<div class="cx-h"><span style="color:${enemyColor(d.hue, 6)}">${esc(d.glyph)}</span> <b>${esc(d.name)}</b>${d.boss ? ' <span class="bad">☠ JEFE</span>' : ''} <span class="dimt">· ${esc(d.origin)} · Nv ${d.minL}–${d.maxL} · ${b.kills || 0} abatidos</span></div>
        <div class="eff">${d.abil.map((a) => ABIL_TEXT[a]).join(' · ') || 'Sin habilidades especiales'}</div>${ecoLines(d, enemyName)}
        <div class="eff">Zonas: ${zonesOf(id).map(zoneName).join(', ') || '—'}</div><div class="eff cx-lore">${esc(d.lore)}</div>` };
    });
  }
  if (sec === 'objetos') {
    return Object.entries(ITEMS).filter(([, d]) => !d.trophy && !d.hidden).map(([id, d]) => {
      const known = seenItem(id);
      if (!known) return { id, known, name: '', html: `<div class="cx-h"><span class="o4">?</span> ??? <span class="dimt">· ${esc((CAT_INFO[d.cat] || {}).name || d.cat)}</span></div>` };
      return { id, known, name: d.name, html: `<div class="cx-h"><span class="o1">${esc(d.glyph || '·')}</span> <b>${esc(d.name)}</b> <span class="dimt">· ${esc((CAT_INFO[d.cat] || {}).name || d.cat)} · nivel ${d.tier ?? 0} · ${d.value || 0} ₽</span></div>${d.desc ? `<div class="eff">${esc(d.desc)}</div>` : ''}` };
    });
  }
  if (sec === 'zonas') {
    return MAPS.map((m) => {
      const known = zoneKnown(m.id);
      if (!known) return { id: m.id, known, name: '', html: `<div class="cx-h"><span class="o4">?</span> ??? <span class="dimt">· ${esc(STRATA[m.stratum] || '')}</span></div><div class="eff">Zona sin explorar.</div>` };
      const boss = Object.keys(ENEMIES).find((k) => ENEMIES[k].home === m.id);
      return { id: m.id, known, name: m.name, html: `<div class="cx-h"><b>${esc(m.name)}</b> <span class="dimt">· ${esc(STRATA[m.stratum] || '')} · Nv ${m.lvl[0]}–${m.lvl[1]} · ${m.floors || 1} piso(s) · ${S.cleared[m.id] || 0} extracciones</span></div>
        <div class="eff">${esc(m.desc)}</div><div class="eff">Chebylitas: ${m.enemies.map(enemyName).join(', ')}</div>${boss ? `<div class="eff">Jefe: ${enemyName(boss)}</div>` : ''}` };
    });
  }
  if (sec === 'facciones') {
    return Object.entries(FACTIONS).filter(([id]) => id !== 'squad').map(([id, f]) => {
      const known = factionKnown(id);
      if (!known) return { id, known, name: '', html: `<div class="cx-h"><span class="o4">?</span> ???</div><div class="eff">Aún no os habéis cruzado.</div>` };
      const r = repOf(S, id);
      return { id, known, name: f.name, html: `<div class="cx-h"><b style="color:${f.color}">${esc(f.name)}</b> <span class="dimt">· ${esc(f.country || '')}${id !== 'chebylitas' ? ` · reputación ${r} (${esc(repLevel(r).name)})` : ''}</span></div><div class="eff">${esc(f.desc || '')}</div>` };
    });
  }
  if (sec === 'notas') {
    return NOTES.map((n, i) => {
      const known = !!(S.notesRead && S.notesRead[i]);
      if (!known) return { id: String(i), known, name: '', html: `<div class="cx-h"><span class="o4">✉</span> ??? <span class="dimt">· nota sin encontrar</span></div>` };
      return { id: String(i), known, name: n.t + ' ' + (n.a || ''), html: `<div class="eff cx-lore">${esc(n.t)}</div><div class="dimt" style="text-align:right">— ${esc(n.a || '')}</div>` };
    });
  }
  if (sec === 'trofeos') {
    return Object.entries(ITEMS).filter(([, d]) => d.trophy).map(([id, d]) => {
      const boss = Object.keys(ENEMIES).find((k) => ENEMIES[k].trophy === id);
      const known = seenItem(id);
      if (!known) return { id, known, name: '', html: `<div class="cx-h"><span class="o4">♛</span> ??? <span class="dimt">· de ${boss ? enemyName(boss) : UNK}</span></div>` };
      return { id, known, name: d.name, html: `<div class="cx-h"><span class="warn">♛</span> <b>${esc(d.name)}</b> <span class="dimt">· de ${boss ? enemyName(boss) : '—'}</span></div><div class="eff">${esc(d.desc || '')}</div>` };
    });
  }
  return [];
}

// ---------------------------------------------------------------- pantalla
export function codexModal(start = {}) {
  if (!S) return;
  const st = { sec: start.sec || 'chebylitas', q: '', focus: start.id || null };
  const body = el('div', { class: 'codex', style: { minWidth: 'min(92ch, 94vw)' } });
  const tabs = el('div', { class: 'tabs cx-tabs' });
  const search = el('input', { class: 'cx-search', type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar en la enciclopedia' });
  const count = el('span', { class: 'dimt' });
  const list = el('div', { class: 'cx-list scroll' });
  body.append(tabs, el('div', { class: 'row', style: { margin: '4px 0', gap: '1ch' } }, search, count), list);
  const draw = () => {
    tabs.innerHTML = '';
    for (const s of CODEX_SECTIONS) {
      const all = entries(s.id);
      const t = el('div', { class: 'tab' + (s.id === st.sec ? ' active' : ''), 'data-sec': s.id, html: `${s.name} <span class="k">${all.filter((x) => x.known).length}/${all.length}</span>` });
      t.addEventListener('click', () => { st.sec = s.id; st.focus = null; draw(); });
      tabs.append(t);
    }
    const q = st.q.trim().toLowerCase();
    const all = entries(st.sec);
    const shown = q ? all.filter((x) => x.known && x.name.toLowerCase().includes(q)) : all;
    count.textContent = q ? `${shown.length} resultado(s)` : `${all.filter((x) => x.known).length} de ${all.length} descubiertos`;
    list.innerHTML = '';
    for (const x of shown) list.append(el('div', { class: 'cx-entry' + (x.known ? '' : ' unknown'), 'data-id': x.id, 'data-known': x.known ? '1' : '0', html: x.html }));
    if (!shown.length) list.append(el('div', { class: 'dimt', text: 'Nada que coincida (solo se busca entre lo descubierto).' }));
    if (st.focus) {
      const t = list.querySelector(`.cx-entry[data-id="${CSS.escape(st.focus)}"]`);
      if (t) { t.classList.add('focus'); t.scrollIntoView({ block: 'center' }); }
    }
  };
  search.addEventListener('input', () => { st.q = search.value; st.focus = null; draw(); });
  search.addEventListener('keydown', (ev) => ev.stopPropagation()); // las teclas no mueven al agente
  // enlaces cruzados: de un chebylita a sus zonas, de una zona a sus chebylitas y jefe…
  list.addEventListener('click', (ev) => {
    const a = ev.target.closest('.cx-link');
    if (!a) return;
    st.sec = a.dataset.sec; st.focus = a.dataset.id; st.q = ''; search.value = '';
    draw();
  });
  draw();
  modal({ title: 'ENCICLOPEDIA', body, width: 'min(100ch, 96vw)', actions: [{ label: 'CERRAR' }] });
}
